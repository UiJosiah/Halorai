import os
import json
import logging
import time
import re

from flask import Blueprint, jsonify, request, g

from .ai_client import (
  edit_flyer_base64,
  generate_flyer_image_base64,
  generate_images_base64,
  generate_text,
  inpaint_flyer_region_base64,
  recreate_image_base64,
)
from .blend_engine import blend_concept_over_base
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


@ai_bp.post("/api/image/blend")
def image_blend():
  """
  Blend AI concept image over a base swatch using real blend math (Pillow + NumPy).
  JSON: baseImage { base64 }, conceptImage { base64 }, mode, opacity (0..1).
  """
  payload = request.get_json(silent=True) or {}
  base_payload = payload.get("baseImage") or {}
  concept_payload = payload.get("conceptImage") or {}
  base_b64 = (base_payload.get("base64") or "").strip()
  concept_b64 = (concept_payload.get("base64") or "").strip()
  mode = (payload.get("mode") or "soft_light").strip().lower()
  opacity_raw = payload.get("opacity")

  if not base_b64 or not concept_b64:
    return _json_error("baseImage.base64 and conceptImage.base64 are required", 400)

  try:
    opacity_f = float(opacity_raw)
  except (TypeError, ValueError):
    return _json_error("opacity must be a number between 0 and 1", 400)

  try:
    mime, out_b64 = blend_concept_over_base(
      base_image_b64=base_b64,
      concept_image_b64=concept_b64,
      mode=mode,
      opacity=opacity_f,
    )
  except ValueError as e:
    return _json_error(str(e), 400)
  except Exception as e:
    ai_logger.exception(
      json.dumps(
        {
          "type": "blend_error",
          "endpoint": "/api/image/blend",
          "requestId": getattr(g, "request_id", None),
          "error": str(e),
        },
        ensure_ascii=False,
      )
    )
    return _json_error("Blend failed", 500)

  return jsonify({"mimeType": mime, "base64": out_b64})


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
  - backgroundImage: required — user-selected 4:5 background from Step 3ii (image bytes)
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
    return _json_error("backgroundImage is required (the user-selected 4:5 background from Step 3ii).", 400)
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
    "- Reference image #1: USER-SELECTED BACKGROUND (4:5 portrait, same as Instagram portrait).",
    "  This is the real flyer background artwork. Preserve its scene, colors, lighting, and mood.",
    "  Do NOT replace it with a newly invented background. Do NOT paste the template (image #2) over it as the scene.",
    "  Composite all text, logos, and minister portraits ON TOP of this background only.",
    "",
    "- Reference image #2: FLYER TEMPLATE — layout, typography, and TEXT-EFFECT style guide ONLY.",
    "  Use it to learn where text blocks, logo areas, and minister photo frames are placed.",
    "  Study EVERY text element in the template as its own design unit: each block often has a DIFFERENT color, size, weight, and effect stack from the others.",
    "  Do NOT unify all flyer text into one color or one font treatment — copy each slot’s individual look from the template.",
    "  Render USER CONTENT using the SAME per-slot text effects as the matching template blocks — never as plain, flat, or boring default typography.",
    "  Do NOT use the template as the final background. Remove template placeholder faces and template sample wording from the final output (replace with USER CONTENT in the same per-slot styles).",
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

  minister_photo_sizing_block: list[str] = []
  if n_minister_imgs > 0:
    minister_photo_sizing_block = [
      "",
      "MINISTER PHOTO SIZE ON THE FLYER (BACKGROUND #1 ONLY — DOES NOT APPLY TO LOGOS):",
      f"- There are {n_minister_imgs} minister photo(s). The **combined visible area** of all minister portraits (after cutout, on top of the background) should be about **30–40% of the full 4:5 canvas** so faces are never tiny.",
      "- **Fewer ministers ⇒ each portrait larger:** with one minister, that single figure should use most of that ~35% band (one bold presence). With two or three, split that band across them so **each face stays large and readable** — do not shrink ministers to leave empty canvas.",
      "- Logos are **excluded** from this rule: keep logos as **small** marks in their template logo zones only. Do **not** steal size from ministers to enlarge logos.",
    ]

  logo_scale_note: list[str] = []
  if n_logos > 0:
    logo_scale_note = [
      "",
      "LOGO SCALE (SEPARATE FROM MINISTERS):",
      "- Logos stay **small** crisp brand marks where the template shows logo space. The ~35% footprint rule above applies **only** to minister photos.",
    ]

  multi_minister_block: list[str] = []
  if n_minister_imgs > 1:
    multi_minister_block = [
      "",
      "MULTIPLE MINISTERS — FOLLOW TEMPLATE #2 GEOMETRY ONLY (NOT FOR LOGOS):",
      "- Look at the **people / minister placeholder frames** in reference #2. On background #1, reproduce their **left-to-right order, horizontal spacing between adjacent frames, vertical alignment, and the overall width of the minister band** as closely as the composition allows.",
      "- Ministers must read as **one cluster** in the same arrangement as the template — **not** pushed toward unrelated far corners and **not** with gaps wider than the template suggests between faces.",
      "- If the template shows three heads close together, keep your three uploads **similarly close**; do not spread them across the flyer.",
      "- This cluster / spacing rule applies **only** to minister portraits. **Do not** use it for logos — logos use only their own template slots, separate from the minister group.",
    ]

  prompt_lines = [
    "Flyer Builder Prompt",
    "",
    "You are compositing a finished church/event flyer.",
    "You are NOT asked to invent a new background scene.",
    "",
    "GOAL:",
    "Start from the user’s chosen background (reference #1).",
    "Use the template (reference #2) only as a map for where to place text, logos, and minister photos.",
    "Output one 4:5 portrait flyer (same aspect ratio as reference #1) that keeps the background artwork and adds correct event details and assets.",
    "",
    "INPUTS:",
    "- Event details (title, date, time, venue, theme, other info)",
    "- Reference images (exact order — see next section)",
    "- Optional creative notes (if provided)",
    "",
    *ref_order_lines,
    "",
    "CORE RULE:",
    "Image #1 is the canvas. Image #2 defines placement, typography, and text-effect styling only.",
    "Do not replace image #1 with a different scene. Do not output the template image as the background.",
    "Do not render user text as plain flat type — always inherit the template’s text effects for each slot.",
    "",
    "----------------------------------",
    "",
    "WHAT TO PRESERVE (STRICT):",
    "- The background from reference #1 (scene, palette, lighting, atmosphere).",
    "- Overall 4:5 framing (match reference #1 width-to-height).",
    "",
    "----------------------------------",
    "",
    "WHAT TO ADD / REPLACE:",
    "",
    "1. Typography and text effects (from template #2)",
    "- Reference #2 is the source of truth for how text should LOOK — not just where it sits.",
    "- PER-SLOT RULE (STRICT): Treat each text block in the template as a separate style recipe. For each USER CONTENT field, find the closest matching template block and copy that block’s FULL visual treatment: font feel, weight, **exact color or gradient**, relative **size**, glow, outer glow, drop shadow, stroke/outline, gradient fill, texture, 3D/extrusion, bevel, metallic shine, emboss, or any decorative effect visible on that template sample text.",
    "- VARIETY IS REQUIRED: Templates almost always use **different colors and sizes** across headline, subhead, date, time, venue, and labels. Reproduce that variety — do NOT paint every text field the same color, same size, or same effect stack.",
    "- FORBIDDEN: one global text color for the whole flyer; one uniform font size for all lines; plain white/black flat text; generic system fonts; or unstyled body copy — unless that exact slot in the template is intentionally minimal.",
    "- Swap only the words to USER CONTENT (spell exactly); keep each slot’s template color, size relationship, effects, and placement.",
    "",
    "CONTENT ↔ TEMPLATE SLOT MAPPING (STRICT — hierarchy + per-slot styling):",
    "- THEME → template’s dominant primary headline slot: **largest size**, strongest effects, most visual weight in reference #2.",
    "- EVENT NAME → template’s secondary headline / subhead slot: clearly **smaller and less dominant** than the theme slot; use that slot’s **own color and effects** (often different from the theme color). Never outrank the theme.",
    "- CHURCH / MINISTRY → template organization / church-name slot (if present): use that slot’s size and color — not the theme or event-name styles.",
    "- DATE, TIME, VENUE → each maps to its own supporting-detail slot(s) in the template; copy **each slot’s distinct size and color** (date is not required to match venue color).",
    "- MINISTER NAMES / TITLES → template people-label slots only; inherit those label styles separately from headline text.",
    "- If the template has fewer visible slots than USER CONTENT fields, split supporting details using the template’s smallest detail styles — still with **varied colors/sizes** as the template shows, not one shared style.",
    "",
    "- Spell every USER CONTENT string exactly as given (no paraphrasing, no spelling changes).",
    "- Ensure effects remain readable on top of background #1 (adjust glow/shadow strength if needed, but keep the same effect **type and color family** as the template slot).",
    "",
    "2. Minister photos",
    minister_slot_summary,
    "- Do NOT invent faces. Do NOT merge faces. Do NOT swap ministers between slots.",
    "- Place each minister photo in the region suggested by the template (#2), scaled and cropped to fit image #1.",
    "- Minister photos from uploads are source-of-truth pixels: do NOT regenerate/redraw a new person. Allowed edits: remove background, cut out subject, and crop excess only to fit the target frame.",
    "- Remove any template placeholder faces; use only the provided minister reference images.",
    *multi_minister_block,
    *minister_photo_sizing_block,
    "",
    "3. Logos (if provided)",
    *(
      [
        f"- Logos are reference images #{3} through #{2 + n_logos} (after background #1 and template #2).",
        "- Place each logo only where the template implies a brand mark, at sensible scale, with crisp edges.",
        "LOGO FILES FROM THE USER ARE FINAL — DO NOT EDIT THE ARTWORK:",
        "- Do not redraw, re-vectorize, simplify, stylize, recolor, add outlines, glows, shadows inside the mark, or replace the file with a newly invented version.",
        "- Do not crop away meaningful parts of the logo or change any letter, symbol, or embedded text inside the uploaded logo pixels.",
        "- Allowed: position, uniform scale, and at most a small rotation to align with the template slot — nothing that alters the artwork itself.",
        "- If a logo already shows the ministry/church/organization name inside the graphic, that satisfies the organization identity on the flyer: do NOT add a separate large headline that repeats the same ministry name (avoid redundant duplicate naming).",
      ]
      if n_logos > 0
      else ["- No logo reference images were uploaded."]
    ),
    *logo_scale_note,
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
    "- Do NOT add any person, icon, logo, shape, sticker, or decorative image that was not uploaded by the user in this request.",
    "- Do NOT leave template sample text or placeholder faces visible.",
    "- Do NOT add watermarks.",
    "- Do NOT regenerate uploaded logo/minister assets as new artwork. Use the uploaded files only (logos unedited; ministers may only be cut out/background-removed/cropped to fit).",
    "- Do NOT modify, re-draw, or re-type any pixels inside uploaded logo images (see LOGO FILES section).",
    "- Do NOT let the event name outrank the theme in typographic prominence — theme stays primary.",
    "- Do NOT render all USER CONTENT in one shared color or one shared font size — each field must inherit its matching template slot’s color and size.",
    "- Do NOT render USER CONTENT as boring flat text when the template shows stylized/effected type for that role.",
    "",
    "----------------------------------",
    "",
    "VALIDATION BEFORE OUTPUT:",
    "- Background still matches reference #1’s scene (not swapped for template art).",
    "- All USER CONTENT text is present and spelled exactly as given; no extra text strings are introduced.",
    "- Minister photos used in correct slots; **minister group** footprint roughly **~35%** of canvas (logos small, separate).",
    "- With 2+ ministers: spacing and band match template #2’s people frames (clustered, not overspread).",
    "- No newly generated people/logos/decorative assets were introduced beyond uploaded references.",
    "- Theme reads visually stronger than the event name; logos match uploaded pixels (unedited).",
    "- Text uses **per-slot** template styling: varied colors and sizes across fields as in reference #2 — not one uniform color/size for all text.",
    "- User text uses the template’s text effects (glow, gradient, 3D, stroke, etc.) — not plain default typography.",
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
    "- Single clean flyer image, aspect ratio 4:5 (must match reference #1).",
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
    images = generate_flyer_image_base64(
      prompt=prompt, model=model, reference_images_bytes=refs, aspect_ratio="4:5", number_of_images=1
    )
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


@ai_bp.post("/api/ai/flyer/inpaint")
def ai_flyer_inpaint():
  """
  Masked local edit of the generated flyer (Step 5).
  multipart/form-data:
    - image: final flyer image (PNG/JPEG/WebP)
    - mask: PNG combined mask; **white = edit**, **black = preserve**
    - regionMasks: optional (2–3) — one mask per numbered edit (same order as prompts)
    - prompt: edit instructions (combined for batch edits)
    - referenceImages: optional — user attachments (flattened, all regions)
    - model: optional (defaults to AI_IMAGE_MODEL / same as other image routes; OpenAI vs Gemini from AI_PROVIDER)
  """
  prompt = (request.form.get("prompt") or "").strip()
  if not prompt:
    return _json_error("prompt is required", 400)
  if len(prompt) > 4000:
    return _json_error("prompt is too long (max 4000 characters)", 400)

  img_f = request.files.get("image")
  mask_f = request.files.get("mask")
  if not img_f or not getattr(img_f, "filename", None):
    return _json_error("image file is required", 400)
  if not mask_f or not getattr(mask_f, "filename", None):
    return _json_error("mask file is required (PNG recommended; white = areas to edit)", 400)

  image_bytes = img_f.read() or b""
  mask_bytes = mask_f.read() or b""
  if not image_bytes:
    return _json_error("image file is empty", 400)
  if not mask_bytes:
    return _json_error("mask file is empty", 400)

  reference_images: list[tuple[bytes, str]] = []
  for ref_f in request.files.getlist("referenceImages"):
    if not getattr(ref_f, "filename", None):
      continue
    ref_bytes = ref_f.read() or b""
    if ref_bytes:
      reference_images.append((ref_bytes, _guess_mime(ref_f.filename) or "image/png"))
  if len(reference_images) > 6:
    return _json_error("At most 6 referenceImages are allowed.", 400)

  region_masks: list[bytes] = []
  for rm_f in request.files.getlist("regionMasks"):
    if not getattr(rm_f, "filename", None):
      continue
    rm_bytes = rm_f.read() or b""
    if rm_bytes:
      region_masks.append(rm_bytes)
  if len(region_masks) > 3:
    return _json_error("At most 3 regionMasks are allowed.", 400)

  model = (request.form.get("model") or "").strip() or DEFAULT_IMAGE_MODEL

  t0 = time.perf_counter()
  try:
    print(
      f"[AI][{_rid()}] /api/ai/flyer/inpaint -> model={model!r} promptChars={len(prompt)} imageBytes={len(image_bytes)} maskBytes={len(mask_bytes)} regionMaskCount={len(region_masks)} refCount={len(reference_images)}",
      flush=True,
    )
  except Exception:
    pass

  try:
    images = inpaint_flyer_region_base64(
      image_bytes,
      mask_bytes,
      prompt,
      model,
      region_masks=region_masks or None,
      reference_images=reference_images or None,
      aspect_ratio="4:5",
      number_of_images=1,
    )
  except ValueError as e:
    return _json_error(str(e), 400)
  except RuntimeError as e:
    return _json_error(str(e) or "Inpainting is not available.", 503)
  except Exception as e:
    status, msg = _ai_exception_to_http(e)
    ai_logger.exception(
      json.dumps(
        {
          "type": "ai_error",
          "endpoint": "/api/ai/flyer/inpaint",
          "requestId": getattr(g, "request_id", None),
          "model": model,
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
        f"[AI][{_rid()}] /api/ai/flyer/inpaint <- ok {t_ms}ms mimeType={first.get('mimeType')} base64Len={len(b64)}",
        flush=True,
      )
    except Exception:
      pass

  return jsonify({"model": model, "images": images})


@ai_bp.post("/api/ai/flyer/edit")
def ai_flyer_edit():
  """
  Full-flyer edit from Step 5 sidebar (no template / no Step 3ii background).
  multipart/form-data:
    - flyerImage: required — the current generated flyer
    - message: required — edit instructions
    - referenceImages: optional (0–2) — user attachments from the + button
    - model: optional
  """
  message = (request.form.get("message") or "").strip()
  if not message:
    return _json_error("message is required", 400)
  if len(message) > 4000:
    return _json_error("message is too long (max 4000 characters)", 400)

  flyer_f = request.files.get("flyerImage")
  if not flyer_f or not getattr(flyer_f, "filename", None):
    return _json_error("flyerImage is required (the current flyer to edit)", 400)

  flyer_bytes = flyer_f.read() or b""
  if not flyer_bytes:
    return _json_error("flyerImage is empty", 400)
  flyer_mime = _guess_mime(getattr(flyer_f, "filename", "") or "") or "image/png"

  reference_images: list[tuple[bytes, str]] = []
  for ref_f in request.files.getlist("referenceImages"):
    if not getattr(ref_f, "filename", None):
      continue
    ref_bytes = ref_f.read() or b""
    if ref_bytes:
      reference_images.append((ref_bytes, _guess_mime(ref_f.filename) or "image/png"))
  if len(reference_images) > 2:
    return _json_error("At most 2 referenceImages are allowed.", 400)

  model = (request.form.get("model") or "").strip() or DEFAULT_FLYER_MODEL

  t0 = time.perf_counter()
  try:
    print(
      f"[AI][{_rid()}] /api/ai/flyer/edit -> model={model!r} messageChars={len(message)} flyerBytes={len(flyer_bytes)} refCount={len(reference_images)}",
      flush=True,
    )
  except Exception:
    pass

  try:
    images = edit_flyer_base64(
      flyer_bytes,
      flyer_mime,
      message,
      model,
      reference_images=reference_images or None,
      aspect_ratio="4:5",
      number_of_images=1,
    )
  except ValueError as e:
    return _json_error(str(e), 400)
  except RuntimeError as e:
    return _json_error(str(e) or "Flyer edit is not available.", 503)
  except Exception as e:
    status, msg = _ai_exception_to_http(e)
    ai_logger.exception(
      json.dumps(
        {
          "type": "ai_error",
          "endpoint": "/api/ai/flyer/edit",
          "requestId": getattr(g, "request_id", None),
          "model": model,
          "error": str(e),
        },
        ensure_ascii=False,
      )
    )
    return _json_error(msg, status)

  t_ms = int((time.perf_counter() - t0) * 1000)
  first = images[0] if images else None
  if first:
    b64 = first.get("base64") or ""
    try:
      print(
        f"[AI][{_rid()}] /api/ai/flyer/edit <- ok {t_ms}ms mimeType={first.get('mimeType')} base64Len={len(b64)}",
        flush=True,
      )
    except Exception:
      pass

  return jsonify({"model": model, "images": images})

