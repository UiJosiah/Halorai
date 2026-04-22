import os
import json
import logging
import time
import re

from flask import Blueprint, jsonify, request, g

from .ai_client import generate_flyer_image_base64, generate_images_base64, generate_text, recreate_image_base64
from .templates import MAX_MINISTERS, pick_template_image


ai_bp = Blueprint("ai", __name__)

DEFAULT_TEXT_MODEL = os.environ.get("AI_TEXT_MODEL") or "models/gemini-3.1-pro-preview"
# "Nano Banana 2" in your model list maps to Gemini 3.1 Flash Image (fast, production-oriented).
DEFAULT_IMAGE_MODEL = os.environ.get("AI_IMAGE_MODEL") or "models/gemini-3.1-flash-image-preview"
DEFAULT_FLYER_MODEL = os.environ.get("AI_FLYER_MODEL") or DEFAULT_IMAGE_MODEL

ai_logger = logging.getLogger("ai")


def _json_error(message: str, status: int = 400):
  return jsonify({"error": message}), status


def _preview_text(s: str, limit: int = 320) -> str:
  s = (s or "").replace("\r\n", "\n").replace("\r", "\n")
  s = " ".join(s.split())  # collapse whitespace for single-line logs
  if len(s) <= limit:
    return s
  return s[:limit] + "…"


def _rid() -> str:
  return str(getattr(g, "request_id", "") or "")


def _guess_mime(filename: str) -> str:
  ext = os.path.splitext(filename or "")[1].lower()
  if ext in [".jpg", ".jpeg"]:
    return "image/jpeg"
  if ext == ".png":
    return "image/png"
  if ext == ".webp":
    return "image/webp"
  return "application/octet-stream"


def _ai_exception_to_http(e: Exception) -> tuple[int, str]:
  """
  Convert bulky provider errors into a user-friendly message + HTTP status.
  Full details are still logged server-side for debugging.
  """
  raw = str(e) or e.__class__.__name__
  low = raw.lower()

  # Quota / rate limit.
  if (
    "resource_exhausted" in low
    or "exceeded your current quota" in low
    or "rate limit" in low
    or re.search(r"\b429\b", low)
  ):
    return 429, "AI limit reached right now. Please wait a bit and try again."

  # Auth / billing / key issues.
  if ("api key" in low and ("invalid" in low or "missing" in low)) or re.search(r"\b401\b|\b403\b", low):
    return 401, "AI is not configured correctly (missing/invalid API key)."

  # Timeouts.
  if "timeout" in low or "deadline exceeded" in low:
    return 504, "AI took too long to respond. Please try again."

  return 500, "AI request failed. Please try again."


@ai_bp.post("/api/ai/text")
def ai_text():
  payload = request.get_json(silent=True) or {}
  prompt = payload.get("prompt", "")
  model = payload.get("model") or DEFAULT_TEXT_MODEL

  t0 = time.perf_counter()
  try:
    print(
      f"[AI][{_rid()}] /api/ai/text -> model={model} promptPreview={_preview_text(str(prompt), 180)!r}",
      flush=True,
    )
  except Exception:
    pass

  try:
    text = generate_text(prompt=prompt, model=model)
  except ValueError as e:
    return _json_error(str(e), 400)
  except Exception as e:
    status, msg = _ai_exception_to_http(e)
    ai_logger.exception(
      json.dumps(
        {
          "type": "ai_error",
          "endpoint": "/api/ai/text",
          "requestId": getattr(g, "request_id", None),
          "model": model,
          "error": str(e),
        },
        ensure_ascii=False,
      )
    )
    return _json_error(msg, status)

  t_ms = int((time.perf_counter() - t0) * 1000)
  try:
    print(
      f"[AI][{_rid()}] /api/ai/text <- ok {t_ms}ms chars={len(text or '')} preview={_preview_text(text or '', 200)!r}",
      flush=True,
    )
  except Exception:
    pass

  # Log a small preview of what the model returned.
  ai_logger.info(
    json.dumps(
      {
        "type": "ai_response",
        "endpoint": "/api/ai/text",
        "requestId": getattr(g, "request_id", None),
        "model": model,
        "chars": len(text or ""),
        "preview": _preview_text(text or ""),
      },
      ensure_ascii=False,
    )
  )

  return jsonify({"model": model, "text": text})


@ai_bp.post("/api/ai/image")
def ai_image():
  payload = request.get_json(silent=True) or {}
  prompt = payload.get("prompt", "")
  model = payload.get("model") or DEFAULT_IMAGE_MODEL
  aspect_ratio = payload.get("aspectRatio")
  number_of_images = payload.get("numberOfImages", 1)
  reference_images = payload.get("referenceImages") or payload.get("images") or []

  try:
    if reference_images:
      images = recreate_image_base64(
        prompt=prompt,
        model=model,
        reference_images=reference_images,
        aspect_ratio=aspect_ratio,
        number_of_images=number_of_images,
      )
    else:
      images = generate_images_base64(
        prompt=prompt,
        model=model,
        aspect_ratio=aspect_ratio,
        number_of_images=number_of_images,
      )
  except ValueError as e:
    return _json_error(str(e), 400)
  except Exception as e:
    status, msg = _ai_exception_to_http(e)
    ai_logger.exception(
      json.dumps(
        {
          "type": "ai_error",
          "endpoint": "/api/ai/image",
          "requestId": getattr(g, "request_id", None),
          "model": model,
          "error": str(e),
        },
        ensure_ascii=False,
      )
    )
    return _json_error(msg, status)

  first = images[0] if images else None
  if first:
    b64 = (first.get("base64") or "")
    ai_logger.info(
      json.dumps(
        {
          "type": "ai_response",
          "endpoint": "/api/ai/image",
          "requestId": getattr(g, "request_id", None),
          "model": model,
          "mimeType": first.get("mimeType"),
          "base64Len": len(b64),
          "base64Prefix": b64[:48],
        },
        ensure_ascii=False,
      )
    )

  return jsonify({"model": model, "images": images})


@ai_bp.post("/api/ai/image/recreate")
def ai_image_recreate():
  payload = request.get_json(silent=True) or {}
  prompt = payload.get("prompt", "")
  model = payload.get("model") or DEFAULT_IMAGE_MODEL
  aspect_ratio = payload.get("aspectRatio")
  number_of_images = payload.get("numberOfImages", 1)
  reference_images = payload.get("referenceImages") or payload.get("images") or []

  try:
    images = recreate_image_base64(
      prompt=prompt,
      model=model,
      reference_images=reference_images,
      aspect_ratio=aspect_ratio,
      number_of_images=number_of_images,
    )
  except ValueError as e:
    return _json_error(str(e), 400)
  except Exception as e:
    status, msg = _ai_exception_to_http(e)
    ai_logger.exception(
      json.dumps(
        {
          "type": "ai_error",
          "endpoint": "/api/ai/image/recreate",
          "requestId": getattr(g, "request_id", None),
          "model": model,
          "error": str(e),
        },
        ensure_ascii=False,
      )
    )
    return _json_error(msg, status)

  first = images[0] if images else None
  if first:
    b64 = (first.get("base64") or "")
    ai_logger.info(
      json.dumps(
        {
          "type": "ai_response",
          "endpoint": "/api/ai/image/recreate",
          "requestId": getattr(g, "request_id", None),
          "model": model,
          "mimeType": first.get("mimeType"),
          "base64Len": len(b64),
          "base64Prefix": b64[:48],
        },
        ensure_ascii=False,
      )
    )

  return jsonify({"model": model, "images": images})


@ai_bp.post("/api/ai/generate")
def ai_generate():
  payload = request.get_json(silent=True) or {}
  kind = (payload.get("type") or payload.get("mode") or "text").strip().lower()

  if kind in ("text", "txt"):
    # Delegate to text handler logic.
    prompt = payload.get("prompt", "")
    model = payload.get("model") or DEFAULT_TEXT_MODEL
    try:
      text = generate_text(prompt=prompt, model=model)
    except ValueError as e:
      return _json_error(str(e), 400)
    except Exception as e:
      status, msg = _ai_exception_to_http(e)
      ai_logger.exception(
        json.dumps(
          {
            "type": "ai_error",
            "endpoint": "/api/ai/generate",
            "requestId": getattr(g, "request_id", None),
            "model": model,
            "mode": "text",
            "error": str(e),
          },
          ensure_ascii=False,
        )
      )
      return _json_error(msg, status)
    return jsonify({"type": "text", "model": model, "text": text})

  if kind in ("image", "img", "images"):
    prompt = payload.get("prompt", "")
    model = payload.get("model") or DEFAULT_IMAGE_MODEL
    aspect_ratio = payload.get("aspectRatio")
    number_of_images = payload.get("numberOfImages", 1)
    reference_images = payload.get("referenceImages") or payload.get("images") or []
    try:
      if reference_images:
        images = recreate_image_base64(
          prompt=prompt,
          model=model,
          reference_images=reference_images,
          aspect_ratio=aspect_ratio,
          number_of_images=number_of_images,
        )
      else:
        images = generate_images_base64(
          prompt=prompt,
          model=model,
          aspect_ratio=aspect_ratio,
          number_of_images=number_of_images,
        )
    except ValueError as e:
      return _json_error(str(e), 400)
    except Exception as e:
      status, msg = _ai_exception_to_http(e)
      ai_logger.exception(
        json.dumps(
          {
            "type": "ai_error",
            "endpoint": "/api/ai/generate",
            "requestId": getattr(g, "request_id", None),
            "model": model,
            "mode": "image",
            "error": str(e),
          },
          ensure_ascii=False,
        )
      )
      return _json_error(msg, status)
    return jsonify({"type": "image", "model": model, "images": images})

  return _json_error('Invalid type. Use "text" or "image".', 400)


@ai_bp.post("/api/ai/flyer")
def ai_flyer():
  """
  Multipart form endpoint.

  Fields:
  - eventDetails: JSON string
  - concept: string (optional)
  - ministersMeta: JSON string of [{name,title}, ...] aligned with ministers[] files order (title optional)
  - message: string (optional; edit instructions)

  Files:
  - backgroundImage: required — user-selected 9:16 background from Step 3ii (image bytes)
  - logos: multiple image files (0-2)
  - ministers: multiple image files
  """
  try:
    event_details_raw = request.form.get("eventDetails", "") or ""
    event_details = json.loads(event_details_raw) if event_details_raw else {}
  except Exception:
    return _json_error("Invalid eventDetails JSON", 400)

  concept = (request.form.get("concept", "") or "").strip()
  message = (request.form.get("message", "") or "").strip()
  model = (request.form.get("model", "") or "").strip() or DEFAULT_FLYER_MODEL

  try:
    ministers_meta_raw = request.form.get("ministersMeta", "") or ""
    ministers_meta = json.loads(ministers_meta_raw) if ministers_meta_raw else []
    if not isinstance(ministers_meta, list):
      ministers_meta = []
  except Exception:
    ministers_meta = []

  logos_files = request.files.getlist("logos")
  minister_files = request.files.getlist("ministers")
  minister_count = len(minister_files)

  if minister_count > MAX_MINISTERS:
    return _json_error(f"Too many ministers. Max allowed is {MAX_MINISTERS}.", 400)

  # Validation: if minister images were uploaded, ministersMeta must align (name/title optional; matches Step 2 UI).
  if minister_count > 0:
    if not isinstance(ministers_meta, list) or len(ministers_meta) != minister_count:
      return _json_error("ministersMeta must include one entry per uploaded minister image.", 400)

    for i, meta in enumerate(ministers_meta):
      if not isinstance(meta, dict):
        return _json_error(f"Invalid ministersMeta at index {i}.", 400)

  try:
    template_path, bucket = pick_template_image(minister_count)
    template_bytes = template_path.read_bytes()
    template_mime = _guess_mime(template_path.name)
  except Exception as e:
    return _json_error(str(e), 500)

  template_title = template_path.stem
  try:
    print(
      f"[AI][{_rid()}] /api/ai/flyer templateSelected title={template_title!r} file={template_path.name!r} bucket={bucket!r}",
      flush=True,
    )
  except Exception:
    pass

  # Build prompt (simple English).
  church = (event_details.get("churchName") or "").strip()
  event_name = (event_details.get("eventName") or "").strip()
  theme = (event_details.get("theme") or "").strip()
  date = (event_details.get("date") or "").strip()
  event_time = (event_details.get("time") or "").strip()
  venue = (event_details.get("venue") or "").strip()
  other = (event_details.get("otherInfo") or "").strip()

  # Read upload bytes once; order is fixed for both prompt text and `refs`.
  logo_refs: list[tuple[bytes, str]] = []
  for f in logos_files:
    data = f.read()
    if data:
      logo_refs.append((data, _guess_mime(f.filename)))

  minister_refs: list[tuple[bytes, str]] = []
  for f in minister_files:
    data = f.read()
    if data:
      minister_refs.append((data, _guess_mime(f.filename)))

  bg_file = request.files.get("backgroundImage")
  if not bg_file:
    return _json_error("backgroundImage is required (the user-selected 9:16 background from Step 3ii).", 400)
  bg_bytes = bg_file.read()
  if not bg_bytes:
    return _json_error("backgroundImage is empty.", 400)
  bg_mime = _guess_mime(getattr(bg_file, "filename", "") or "") or "image/png"

  n_logos = len(logo_refs)
  n_minister_imgs = len(minister_refs)

  # 1-based indices: #1 user background, #2 template, #3..#(2+n_logos) logos, then ministers.
  ref_order_lines: list[str] = [
    "REFERENCE IMAGE ORDER (STRICT — DO NOT MIX OR SWAP):",
    "The model receives reference images in this exact 1-based order. Each index maps to exactly one use.",
    "",
    "- Reference image #1: USER-SELECTED BACKGROUND (9:16).",
    "  This is the real flyer background artwork. Preserve its scene, colors, lighting, and mood.",
    "  Do NOT replace it with a newly invented background. Do NOT paste the template (image #2) over it as the scene.",
    "  Composite all text, logos, and minister portraits ON TOP of this background only.",
    "",
    "- Reference image #2: FLYER TEMPLATE — layout and typography style guide ONLY.",
    "  Use it ONLY to learn where text blocks, logo areas, and minister photo frames are placed.",
    "  Do NOT use the template as the final background. Remove template placeholder faces and template sample text from the final output.",
    "  Align your layers with image #1 so placements match the template’s structure.",
    "",
    "CRITICAL — DO NOT CONFUSE LOGOS WITH PEOPLE:",
    "- Logo reference images are brand marks (symbols/text marks). They are NOT faces and NOT ministers.",
    "- Minister reference images are photos of people. They are NOT logos.",
    "- Never place a logo image inside a minister/person frame.",
    "- Never place a minister photo where a logo belongs.",
    "",
  ]

  for j in range(n_logos):
    idx = 3 + j
    ref_order_lines.append(
      f"- Reference image #{idx}: LOGO #{j + 1} — organization/church logo graphic ONLY. "
      "Not a person. Not a minister. Use only as a small brand mark where the template has logo space."
    )

  minister_base_idx = 3 + n_logos
  ministers_lines: list[str] = []
  for k in range(minister_count):
    meta = ministers_meta[k] if k < len(ministers_meta) and isinstance(ministers_meta[k], dict) else {}
    name = (meta.get("name") or "").strip()
    title = (meta.get("title") or "").strip()
    ref_idx = minister_base_idx + k
    role_line = f"Reference image #{ref_idx} = MINISTER PHOTO for slot #{k + 1} ONLY."
    if title and name:
      ministers_lines.append(f"- Slot {k + 1} ({role_line}): {name} — role/title on flyer: \"{title}\"")
    elif title:
      ministers_lines.append(f"- Slot {k + 1} ({role_line}): role/title on flyer: \"{title}\"")
    elif name:
      ministers_lines.append(f"- Slot {k + 1} ({role_line}): {name}")
    else:
      ministers_lines.append(f"- Slot {k + 1} ({role_line}): use minister photo only (no name or title text on flyer unless the template implies it).")

    if k < n_minister_imgs:
      ref_order_lines.append(
        f"- Reference image #{ref_idx}: MINISTER PHOTO #{k + 1} ONLY — minister slot #{k + 1} on the template."
        + (f' This face/body MUST be labeled on the flyer as: \"{title}\"' if title else "")
        + (f' (name if shown: \"{name}\")' if name else "")
        + ". Use ONLY this file for this slot — never for another slot, never as a logo."
      )

  if n_minister_imgs == 1:
    minister_slot_summary = f"- Follow REFERENCE IMAGE ORDER: the only minister photo is reference image #{minister_base_idx} — use it for minister slot 1 only."
  elif n_minister_imgs > 1:
    minister_slot_summary = (
      f"- Follow REFERENCE IMAGE ORDER: minister slots 1–{n_minister_imgs} map to reference images "
      f"#{minister_base_idx}–#{minister_base_idx + n_minister_imgs - 1} in upload order (one slot per image, no swaps)."
    )
  else:
    minister_slot_summary = "- No minister photo references were uploaded."

  prompt_lines = [
    "Flyer Builder Prompt",
    "",
    "You are compositing a finished church/event flyer.",
    "You are NOT asked to invent a new background scene.",
    "",
    "GOAL:",
    "Start from the user’s chosen background (reference #1).",
    "Use the template (reference #2) only as a map for where to place text, logos, and minister photos.",
    "Output one 9:16 flyer that keeps the background artwork and adds correct event details and assets.",
    "",
    "INPUTS:",
    "- Event details (title, date, time, venue, theme, other info)",
    "- Reference images (exact order — see next section)",
    "- Optional creative notes (if provided)",
    "",
    *ref_order_lines,
    "",
    "CORE RULE:",
    "Image #1 is the canvas. Image #2 defines placement and typography style only.",
    "Do not replace image #1 with a different scene. Do not output the template image as the background.",
    "",
    "----------------------------------",
    "",
    "WHAT TO PRESERVE (STRICT):",
    "- The background from reference #1 (scene, palette, lighting, atmosphere).",
    "- Overall 9:16 framing.",
    "",
    "----------------------------------",
    "",
    "WHAT TO ADD / REPLACE:",
    "",
    "1. Typography and text blocks",
    "- Use reference #2 to decide positions, hierarchy, and font style for titles, subtitles, date, time, venue, etc.",
    "- Render the USER CONTENT text exactly as written (no paraphrasing, no spelling changes).",
    "- Text must read clearly on top of the user background (contrast, subtle backing if needed).",
    "",
    "2. Minister photos",
    minister_slot_summary,
    "- Do NOT invent faces. Do NOT merge faces. Do NOT swap ministers between slots.",
    "- Place each minister photo in the region suggested by the template (#2), scaled and cropped to fit image #1.",
    "- Remove any template placeholder faces; use only the provided minister reference images.",
    "",
    "3. Logos (if provided)",
    *(
      [
        f"- Logos are reference images #{3} through #{2 + n_logos} (after background #1 and template #2).",
        "- Place each logo where the template implies a brand mark. Keep crisp edges and sensible scale.",
      ]
      if n_logos > 0
      else ["- No logo reference images were uploaded."]
    ),
    "",
    "----------------------------------",
    "",
    "CONSISTENCY RULE:",
    "Text, logos, and faces should feel integrated with the lighting and color of background #1.",
    "",
    "----------------------------------",
    "",
    "STRICT RULES:",
    "- Do NOT generate a wholly new unrelated background.",
    "- Do NOT add text that is not from USER CONTENT or minister labels below.",
    "- Do NOT leave template sample text or placeholder faces visible.",
    "- Do NOT add watermarks.",
    "",
    "----------------------------------",
    "",
    "VALIDATION BEFORE OUTPUT:",
    "- Background still matches reference #1’s scene (not swapped for template art).",
    "- All USER CONTENT text is present and spelled exactly as given.",
    "- Minister and logo references used in the correct slots.",
    "",
    "If any rule fails, regenerate correctly.",
    "",
    "PRIORITY:",
    "1. Preserve user background #1",
    "2. Match template #2 placement for details",
    "3. Exact user text and correct assets",
    "4. Polish integration (shadows, readability)",
    "",
    "OUTPUT:",
    "- Single clean flyer image, aspect ratio 9:16.",
    "",
    "----------------------------------",
    "",
    "USER CONTENT (use exactly):",
    f"- Church/Ministry: {church}" if church else None,
    f"- Event name: {event_name}" if event_name else None,
    f"- Theme: {theme}" if theme else None,
    f"- Date: {date}" if date else None,
    f"- Time: {event_time}" if event_time else None,
    f"- Venue: {venue}" if venue else None,
    f"- Other info: {other}" if other else None,
    "",
    "Ministers (slot → reference image → text on flyer):",
    *ministers_lines,
    "",
    f"Optional creative / tone notes (do not replace the background): {concept}" if concept else None,
    "",
    message and f"Edit instructions (only if provided): {message}",
  ]
  # Keep prompt tidy (no empty/None lines).
  prompt = "\n".join([l for l in prompt_lines if isinstance(l, str) and l.strip()])

  # Order MUST match the prompt: user background, template, logos, ministers.
  refs: list[tuple[bytes, str]] = [(bg_bytes, bg_mime), (template_bytes, template_mime)] + logo_refs + minister_refs

  t0 = time.perf_counter()
  try:
    print(
      f"[AI][{_rid()}] /api/ai/flyer -> model={model} templateTitle={template_title!r} templateFile={template_path.name!r} templateBucket={bucket} bgBytes={len(bg_bytes)} logos={len(logos_files)} ministers={minister_count} messageChars={len(message)} promptPreview={_preview_text(prompt, 180)!r}",
      flush=True,
    )
  except Exception:
    pass

  try:
    images = generate_flyer_image_base64(prompt=prompt, model=model, reference_images_bytes=refs, aspect_ratio="9:16", number_of_images=1)
  except Exception as e:
    status, msg = _ai_exception_to_http(e)
    ai_logger.exception(
      json.dumps(
        {
          "type": "ai_error",
          "endpoint": "/api/ai/flyer",
          "requestId": getattr(g, "request_id", None),
          "model": model,
          "templateTitle": template_title,
          "templateFile": template_path.name,
          "templateBucket": bucket,
          "error": str(e),
        },
        ensure_ascii=False,
      )
    )
    return _json_error(msg, status)

  t_ms = int((time.perf_counter() - t0) * 1000)
  first = images[0] if images else None
  if first:
    b64 = (first.get("base64") or "")
    try:
      print(
        f"[AI][{_rid()}] /api/ai/flyer <- ok {t_ms}ms templateTitle={template_title!r} mimeType={first.get('mimeType')} base64Len={len(b64)}",
        flush=True,
      )
    except Exception:
      pass
    ai_logger.info(
      json.dumps(
        {
          "type": "ai_response",
          "endpoint": "/api/ai/flyer",
          "requestId": getattr(g, "request_id", None),
          "model": model,
          "templateTitle": template_title,
          "templateBucket": bucket,
          "templateFile": template_path.name,
          "mimeType": first.get("mimeType"),
          "base64Len": len(b64),
          "base64Prefix": b64[:48],
        },
        ensure_ascii=False,
      )
    )

  return jsonify(
    {
      "model": model,
      "template": {"bucket": bucket, "file": template_path.name, "title": template_title},
      "images": images,
    }
  )

