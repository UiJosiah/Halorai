import base64
import io
import os
from functools import lru_cache
from typing import Any, Dict, List, Optional, Sequence, TypedDict


def _get_api_key() -> str:
  key = (os.environ.get("OPENAI_API_KEY") or "").strip()
  if not key:
    raise RuntimeError("Missing OPENAI_API_KEY. Add it to backend/.env.")
  return key


@lru_cache(maxsize=1)
def _client():
  from openai import OpenAI

  return OpenAI(api_key=_get_api_key())


def _preferred_text_model() -> str:
  return (os.environ.get("OPENAI_TEXT_MODEL") or "").strip() or "gpt-5.4"


def _preferred_image_model() -> str:
  return (os.environ.get("OPENAI_IMAGE_MODEL") or "").strip() or "gpt-image-1.5"


def _preferred_flyer_model() -> str:
  return (os.environ.get("OPENAI_FLYER_MODEL") or "").strip() or _preferred_image_model()


class ReferenceImage(TypedDict, total=False):
  mimeType: str
  base64: str


def _b64_to_bytes(b64: str) -> bytes:
  b64 = (b64 or "").strip()
  if not b64:
    return b""
  return base64.b64decode(b64, validate=True)


def _as_upload_file(data: bytes, *, filename: str) -> io.BytesIO:
  bio = io.BytesIO(data)
  # The OpenAI SDK accepts file-like objects; providing a name helps content-type inference.
  setattr(bio, "name", filename)
  return bio


def generate_text(prompt: str, model: Optional[str] = None) -> str:
  if not prompt or not str(prompt).strip():
    raise ValueError("prompt is required")
  m = (model or "").strip() or _preferred_text_model()
  resp = _client().chat.completions.create(
    model=m,
    messages=[
      {
        "role": "user",
        "content": str(prompt),
      }
    ],
  )
  out = (resp.choices[0].message.content or "").strip() if resp and resp.choices else ""
  return out


def generate_images_base64(
  prompt: str,
  model: Optional[str] = None,
  *,
  size: str = "1024x1024",
  number_of_images: int = 1,
) -> List[Dict[str, Any]]:
  if not prompt or not str(prompt).strip():
    raise ValueError("prompt is required")
  m = (model or "").strip() or _preferred_image_model()
  n = max(1, int(number_of_images or 1))

  res = _client().images.generate(
    model=m,
    prompt=str(prompt),
    size=size,
    n=n,
  )

  out: List[Dict[str, Any]] = []
  for item in (getattr(res, "data", None) or [])[:n]:
    b64 = (getattr(item, "b64_json", None) or getattr(item, "b64Json", None) or "").strip()
    if not b64:
      continue
    out.append({"mimeType": "image/png", "base64": b64})
  return out


def recreate_image_base64(
  prompt: str,
  model: Optional[str] = None,
  *,
  reference_images: Sequence[ReferenceImage],
  number_of_images: int = 1,
  output_format: str = "png",
  input_fidelity: str = "high",
) -> List[Dict[str, Any]]:
  if not prompt or not str(prompt).strip():
    raise ValueError("prompt is required")
  if not reference_images:
    raise ValueError("referenceImages is required")

  m = (model or "").strip() or _preferred_image_model()
  n = max(1, int(number_of_images or 1))

  files: List[io.BytesIO] = []
  for idx, img in enumerate(reference_images):
    b64 = (img.get("base64") or "").strip()
    if not b64:
      continue
    data = _b64_to_bytes(b64)
    if not data:
      continue
    mime = (img.get("mimeType") or "image/png").lower()
    ext = "png"
    if "jpeg" in mime or "jpg" in mime:
      ext = "jpg"
    elif "webp" in mime:
      ext = "webp"
    files.append(_as_upload_file(data, filename=f"ref-{idx+1}.{ext}"))

  if not files:
    raise ValueError("referenceImages had no usable base64 data")

  res = _client().images.edit(
    model=m,
    image=files[:16],
    prompt=str(prompt),
    n=n,
    size="1024x1536",
    input_fidelity=input_fidelity,
    output_format=output_format,
  )

  out: List[Dict[str, Any]] = []
  for item in (getattr(res, "data", None) or [])[:n]:
    b64 = (getattr(item, "b64_json", None) or getattr(item, "b64Json", None) or "").strip()
    if not b64:
      continue
    mime = "image/png" if output_format.lower() == "png" else "image/jpeg"
    out.append({"mimeType": mime, "base64": b64})
  return out


def generate_flyer_image_base64(
  prompt: str,
  model: Optional[str] = None,
  *,
  reference_images_bytes: Sequence[tuple[bytes, str]],
  number_of_images: int = 1,
  output_format: str = "png",
  input_fidelity: str = "high",
) -> List[Dict[str, Any]]:
  """
  Template-first, then logos, then ministers.
  Uses OpenAI Images Edit endpoint which accepts up to 16 input images.
  """
  if not prompt or not str(prompt).strip():
    raise ValueError("prompt is required")
  if not reference_images_bytes:
    raise ValueError("reference images are required")

  m = (model or "").strip() or _preferred_flyer_model()
  n = max(1, int(number_of_images or 1))

  files: List[io.BytesIO] = []
  for idx, (data, mime) in enumerate(reference_images_bytes[:16]):
    if not data:
      continue
    # Use an extension matching mime when possible (helps some stacks).
    ext = "png"
    if "jpeg" in (mime or "").lower() or "jpg" in (mime or "").lower():
      ext = "jpg"
    elif "webp" in (mime or "").lower():
      ext = "webp"
    files.append(_as_upload_file(data, filename=f"ref-{idx+1}.{ext}"))

  if not files:
    raise ValueError("reference images had no usable bytes")

  res = _client().images.edit(
    model=m,
    image=files[:16],
    prompt=str(prompt),
    n=n,
    size="1024x1536",
    input_fidelity=input_fidelity,
    output_format=output_format,
  )

  out: List[Dict[str, Any]] = []
  for item in (getattr(res, "data", None) or [])[:n]:
    b64 = (getattr(item, "b64_json", None) or getattr(item, "b64Json", None) or "").strip()
    if not b64:
      continue
    mime = "image/png" if output_format.lower() == "png" else "image/jpeg"
    out.append({"mimeType": mime, "base64": b64})
  return out

