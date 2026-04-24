import base64
import os
from functools import lru_cache
from typing import Any, Dict, List, Optional, Sequence, TypedDict


def _get_api_key() -> str:
  # Accept either name; you said you'll create `.env` with the key.
  key = (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "").strip()
  if not key:
    raise RuntimeError("Missing GEMINI_API_KEY (or GOOGLE_API_KEY). Add it to backend/.env.")
  return key


@lru_cache(maxsize=1)
def _client():
  from google import genai

  return genai.Client(api_key=_get_api_key())


def generate_text(prompt: str, model: str) -> str:
  if not prompt or not str(prompt).strip():
    raise ValueError("prompt is required")
  resp = _client().models.generate_content(model=model, contents=str(prompt))
  return (getattr(resp, "text", None) or "").strip()


class ReferenceImage(TypedDict, total=False):
  mimeType: str
  base64: str


def _extract_inline_images(resp, *, limit: int = 1) -> List[Dict[str, Any]]:
  out: List[Dict[str, Any]] = []
  parts = getattr(resp, "parts", None) or []
  for part in parts:
    inline = getattr(part, "inline_data", None)
    if not inline:
      continue

    mime_type = getattr(inline, "mime_type", None) or getattr(inline, "mimeType", None) or "image/png"
    data = getattr(inline, "data", None)

    if isinstance(data, (bytes, bytearray)):
      b64 = base64.b64encode(bytes(data)).decode("ascii")
    elif isinstance(data, str):
      b64 = data
    else:
      # Best-effort fallback.
      b64 = ""

    out.append({"mimeType": mime_type, "base64": b64})
    if limit and len(out) >= max(1, int(limit)):
      break

  return out


def generate_images_base64(
  prompt: str,
  model: str,
  *,
  aspect_ratio: Optional[str] = None,
  number_of_images: int = 1,
) -> List[Dict[str, Any]]:
  if not prompt or not str(prompt).strip():
    raise ValueError("prompt is required")

  # We prefer Gemini image-output via generate_content because Imagen `generate_images`
  # can be allowlist-gated depending on API/account.
  from google.genai import types

  cfg_kwargs: Dict[str, Any] = {"response_modalities": ["IMAGE"]}
  if aspect_ratio:
    cfg_kwargs["image_config"] = types.ImageConfig(aspect_ratio=aspect_ratio)

  # NOTE: number_of_images is not supported by all Gemini image-output models/configs.
  # We keep it as a hint (best-effort); the API may return 1 image regardless.
  resp = _client().models.generate_content(
    model=model,
    contents=str(prompt),
    config=types.GenerateContentConfig(**cfg_kwargs),
  )

  return _extract_inline_images(resp, limit=number_of_images)


def recreate_image_base64(
  prompt: str,
  model: str,
  *,
  reference_images: Sequence[ReferenceImage],
  aspect_ratio: Optional[str] = None,
  number_of_images: int = 1,
) -> List[Dict[str, Any]]:
  """
  Prompt + reference images -> generated image(s) (base64).

  `reference_images` should be a list of { mimeType, base64 } items.
  """
  if not prompt or not str(prompt).strip():
    raise ValueError("prompt is required")
  if not reference_images:
    raise ValueError("referenceImages is required")

  from google.genai import types

  parts: List[Any] = [types.Part.from_text(text=str(prompt))]
  for img in reference_images:
    b64 = (img.get("base64") or "").strip()
    mime = (img.get("mimeType") or "image/png").strip()
    if not b64:
      continue
    try:
      img_bytes = base64.b64decode(b64, validate=True)
    except Exception as e:
      raise ValueError(f"Invalid base64 image: {e}") from e
    parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime))

  cfg_kwargs: Dict[str, Any] = {"response_modalities": ["IMAGE"]}
  if aspect_ratio:
    cfg_kwargs["image_config"] = types.ImageConfig(aspect_ratio=aspect_ratio)

  resp = _client().models.generate_content(
    model=model,
    contents=parts,
    config=types.GenerateContentConfig(**cfg_kwargs),
  )

  return _extract_inline_images(resp, limit=number_of_images)


def generate_flyer_image_base64(
  prompt: str,
  model: str,
  *,
  reference_images_bytes: Sequence[tuple[bytes, str]],
  aspect_ratio: Optional[str] = "4:5",
  number_of_images: int = 1,
) -> List[Dict[str, Any]]:
  """
  Prompt + reference images (raw bytes) -> generated image(s) (base64).
  Default 4:5 matches Step 3ii background generation.
  """
  if not prompt or not str(prompt).strip():
    raise ValueError("prompt is required")
  if not reference_images_bytes:
    raise ValueError("reference images are required")

  from google.genai import types

  parts: List[Any] = [types.Part.from_text(text=str(prompt))]
  for data, mime in reference_images_bytes:
    if not data:
      continue
    parts.append(types.Part.from_bytes(data=data, mime_type=(mime or "image/jpeg")))

  cfg_kwargs: Dict[str, Any] = {"response_modalities": ["IMAGE"]}
  if aspect_ratio:
    cfg_kwargs["image_config"] = types.ImageConfig(aspect_ratio=aspect_ratio)

  resp = _client().models.generate_content(
    model=model,
    contents=parts,
    config=types.GenerateContentConfig(**cfg_kwargs),
  )

  return _extract_inline_images(resp, limit=number_of_images)

