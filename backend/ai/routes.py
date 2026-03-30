import os
import json

from flask import Blueprint, jsonify, request

from .gemini_client import generate_flyer_image_base64, generate_images_base64, generate_text, recreate_image_base64
from .templates import pick_template_image


ai_bp = Blueprint("ai", __name__)

DEFAULT_TEXT_MODEL = os.environ.get("AI_TEXT_MODEL") or "models/gemini-3.1-pro-preview"
# "Nano Banana 2" in your model list maps to Gemini 3.1 Flash Image (fast, production-oriented).
DEFAULT_IMAGE_MODEL = os.environ.get("AI_IMAGE_MODEL") or "models/gemini-3.1-flash-image-preview"
DEFAULT_FLYER_MODEL = os.environ.get("AI_FLYER_MODEL") or DEFAULT_IMAGE_MODEL


def _json_error(message: str, status: int = 400):
  return jsonify({"error": message}), status


def _guess_mime(filename: str) -> str:
  ext = os.path.splitext(filename or "")[1].lower()
  if ext in [".jpg", ".jpeg"]:
    return "image/jpeg"
  if ext == ".png":
    return "image/png"
  if ext == ".webp":
    return "image/webp"
  return "application/octet-stream"


@ai_bp.post("/api/ai/text")
def ai_text():
  payload = request.get_json(silent=True) or {}
  prompt = payload.get("prompt", "")
  model = payload.get("model") or DEFAULT_TEXT_MODEL

  try:
    text = generate_text(prompt=prompt, model=model)
  except ValueError as e:
    return _json_error(str(e), 400)
  except Exception as e:
    return _json_error(str(e), 500)

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
    return _json_error(str(e), 500)

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
    return _json_error(str(e), 500)

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
      return _json_error(str(e), 500)
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
      return _json_error(str(e), 500)
    return jsonify({"type": "image", "model": model, "images": images})

  return _json_error('Invalid type. Use "text" or "image".', 400)


@ai_bp.post("/api/ai/flyer")
def ai_flyer():
  """
  Multipart form endpoint.

  Fields:
  - eventDetails: JSON string
  - concept: string (optional)
  - ministersMeta: JSON string of [{name,title}, ...] aligned with ministers[] files order
  - message: string (optional; edit instructions)

  Files:
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

  try:
    template_path, bucket = pick_template_image(minister_count)
    template_bytes = template_path.read_bytes()
    template_mime = _guess_mime(template_path.name)
  except Exception as e:
    return _json_error(str(e), 500)

  # Build prompt (simple English).
  church = (event_details.get("churchName") or "").strip()
  event_name = (event_details.get("eventName") or "").strip()
  theme = (event_details.get("theme") or "").strip()
  date = (event_details.get("date") or "").strip()
  time = (event_details.get("time") or "").strip()
  venue = (event_details.get("venue") or "").strip()
  other = (event_details.get("otherInfo") or "").strip()

  ministers_lines = []
  for i, meta in enumerate(ministers_meta[: len(minister_files)]):
    if not isinstance(meta, dict):
      continue
    name = (meta.get("name") or "").strip()
    title = (meta.get("title") or "").strip()
    if name and title:
      ministers_lines.append(f"- Minister {i+1}: {name} ({title})")
    elif name:
      ministers_lines.append(f"- Minister {i+1}: {name}")

  prompt_lines = [
    "Use simple, clear English. Keep text short and neat.",
    "Create a clean, premium church event flyer image in 9:16.",
    "Use the first reference image as the template layout guide.",
    "Place the provided logos and minister photos neatly on the flyer.",
    "Keep faces natural and consistent with the photos.",
    "Make sure the flyer looks professional and balanced.",
    "",
    "Flyer text to include (spell correctly):",
    f"- Church/Ministry: {church}" if church else None,
    f"- Event name: {event_name}" if event_name else None,
    f"- Theme: {theme}" if theme else None,
    f"- Date: {date}" if date else None,
    f"- Time: {time}" if time else None,
    f"- Venue: {venue}" if venue else None,
    f"- Other info: {other}" if other else None,
    "",
    "Ministers (if any):",
    *ministers_lines,
    "",
    f"Background concept: {concept}" if concept else None,
    "",
    "Do not add extra information that was not provided.",
    "Do not add watermarks.",
    message and f"Edit instructions: {message}",
  ]
  prompt = "\n".join([l for l in prompt_lines if l])

  # Reference images order matters: template first, then logos, then ministers.
  refs: list[tuple[bytes, str]] = [(template_bytes, template_mime)]
  for f in logos_files:
    data = f.read()
    if data:
      refs.append((data, _guess_mime(f.filename)))
  for f in minister_files:
    data = f.read()
    if data:
      refs.append((data, _guess_mime(f.filename)))

  try:
    images = generate_flyer_image_base64(prompt=prompt, model=model, reference_images_bytes=refs, aspect_ratio="9:16", number_of_images=1)
  except Exception as e:
    return _json_error(str(e), 500)

  return jsonify(
    {
      "model": model,
      "template": {"bucket": bucket, "file": template_path.name},
      "images": images,
    }
  )

