import io
import os
from typing import Any, Dict, List, Optional, Sequence, Tuple

from . import gemini_client
from . import openai_client


def _provider_mode() -> str:
  return (os.environ.get("AI_PROVIDER") or "auto").strip().lower()


def _has_gemini_key() -> bool:
  return bool((os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "").strip())


def _has_openai_key() -> bool:
  return bool((os.environ.get("OPENAI_API_KEY") or "").strip())


def _looks_like_gemini_model(model: str) -> bool:
  m = (model or "").strip()
  return m.startswith("models/") or m.lower().startswith("gemini")


def _is_quota_or_rate_limit_error(e: Exception) -> bool:
  s = str(e or "").lower()
  return ("resource_exhausted" in s) or ("rate limit" in s) or ("quota" in s) or ("429" in s)


def _openai_model_or_default(requested: str) -> Optional[str]:
  """
  Flask defaults use Gemini-style ids. OpenAI must not receive those strings.
  Return None so openai_client falls back to OPENAI_* env defaults.
  """
  r = (requested or "").strip()
  if not r or _looks_like_gemini_model(r):
    return None
  return r


def generate_text(prompt: str, model: str) -> str:
  mode = _provider_mode()

  # Explicit provider modes.
  if mode == "gemini":
    return gemini_client.generate_text(prompt=prompt, model=model)
  if mode == "openai":
    return openai_client.generate_text(prompt=prompt, model=_openai_model_or_default(model))

  # Auto mode.
  prefer_gemini = _looks_like_gemini_model(model)
  providers = ["gemini", "openai"] if prefer_gemini else ["openai", "gemini"]

  last_err: Optional[Exception] = None
  for p in providers:
    if p == "gemini" and not _has_gemini_key():
      continue
    if p == "openai" and not _has_openai_key():
      continue
    try:
      if p == "gemini":
        return gemini_client.generate_text(prompt=prompt, model=model)
      return openai_client.generate_text(prompt=prompt, model=_openai_model_or_default(model))
    except Exception as e:
      last_err = e
      # Only failover on quota/rate-limit style errors.
      if not _is_quota_or_rate_limit_error(e):
        raise

  if last_err:
    raise last_err
  raise RuntimeError("No AI provider is configured. Set GEMINI_API_KEY or OPENAI_API_KEY.")


def generate_images_base64(
  prompt: str,
  model: str,
  *,
  aspect_ratio: Optional[str] = None,
  number_of_images: int = 1,
) -> List[Dict[str, Any]]:
  mode = _provider_mode()

  # For OpenAI, pick an equivalent size for the requested aspect ratio.
  size = "1024x1024"
  if aspect_ratio == "9:16":
    size = "1024x1536"
  elif aspect_ratio == "16:9":
    size = "1536x1024"

  if mode == "gemini":
    return gemini_client.generate_images_base64(prompt=prompt, model=model, aspect_ratio=aspect_ratio, number_of_images=number_of_images)
  if mode == "openai":
    return openai_client.generate_images_base64(
      prompt=prompt, model=_openai_model_or_default(model), size=size, number_of_images=number_of_images
    )

  prefer_gemini = _looks_like_gemini_model(model)
  providers = ["gemini", "openai"] if prefer_gemini else ["openai", "gemini"]

  last_err: Optional[Exception] = None
  for p in providers:
    if p == "gemini" and not _has_gemini_key():
      continue
    if p == "openai" and not _has_openai_key():
      continue
    try:
      if p == "gemini":
        return gemini_client.generate_images_base64(prompt=prompt, model=model, aspect_ratio=aspect_ratio, number_of_images=number_of_images)
      return openai_client.generate_images_base64(
        prompt=prompt, model=_openai_model_or_default(model), size=size, number_of_images=number_of_images
      )
    except Exception as e:
      last_err = e
      if not _is_quota_or_rate_limit_error(e):
        raise

  if last_err:
    raise last_err
  raise RuntimeError("No AI provider is configured. Set GEMINI_API_KEY or OPENAI_API_KEY.")


def recreate_image_base64(
  prompt: str,
  model: str,
  *,
  reference_images: Sequence[Dict[str, str]],
  aspect_ratio: Optional[str] = None,
  number_of_images: int = 1,
) -> List[Dict[str, Any]]:
  mode = _provider_mode()
  if mode == "gemini":
    return gemini_client.recreate_image_base64(
      prompt=prompt,
      model=model,
      reference_images=reference_images,  # type: ignore[arg-type]
      aspect_ratio=aspect_ratio,
      number_of_images=number_of_images,
    )
  if mode == "openai":
    return openai_client.recreate_image_base64(
      prompt=prompt, model=_openai_model_or_default(model), reference_images=reference_images, number_of_images=number_of_images
    )

  prefer_gemini = _looks_like_gemini_model(model)
  providers = ["gemini", "openai"] if prefer_gemini else ["openai", "gemini"]
  last_err: Optional[Exception] = None
  for p in providers:
    if p == "gemini" and not _has_gemini_key():
      continue
    if p == "openai" and not _has_openai_key():
      continue
    try:
      if p == "gemini":
        return gemini_client.recreate_image_base64(
          prompt=prompt,
          model=model,
          reference_images=reference_images,  # type: ignore[arg-type]
          aspect_ratio=aspect_ratio,
          number_of_images=number_of_images,
        )
      return openai_client.recreate_image_base64(
        prompt=prompt, model=_openai_model_or_default(model), reference_images=reference_images, number_of_images=number_of_images
      )
    except Exception as e:
      last_err = e
      if not _is_quota_or_rate_limit_error(e):
        raise
  if last_err:
    raise last_err
  raise RuntimeError("No AI provider is configured. Set GEMINI_API_KEY or OPENAI_API_KEY.")


def generate_flyer_image_base64(
  prompt: str,
  model: str,
  *,
  reference_images_bytes: Sequence[Tuple[bytes, str]],
  aspect_ratio: Optional[str] = None,
  number_of_images: int = 1,
) -> List[Dict[str, Any]]:
  mode = _provider_mode()
  if mode == "gemini":
    return gemini_client.generate_flyer_image_base64(
      prompt=prompt,
      model=model,
      reference_images_bytes=reference_images_bytes,
      aspect_ratio=aspect_ratio,
      number_of_images=number_of_images,
    )
  if mode == "openai":
    return openai_client.generate_flyer_image_base64(
      prompt=prompt,
      model=_openai_model_or_default(model),
      reference_images_bytes=reference_images_bytes,
      aspect_ratio=aspect_ratio,
      number_of_images=number_of_images,
    )

  prefer_gemini = _looks_like_gemini_model(model)
  providers = ["gemini", "openai"] if prefer_gemini else ["openai", "gemini"]
  last_err: Optional[Exception] = None
  for p in providers:
    if p == "gemini" and not _has_gemini_key():
      continue
    if p == "openai" and not _has_openai_key():
      continue
    try:
      if p == "gemini":
        return gemini_client.generate_flyer_image_base64(
          prompt=prompt,
          model=model,
          reference_images_bytes=reference_images_bytes,
          aspect_ratio=aspect_ratio,
          number_of_images=number_of_images,
        )
      return openai_client.generate_flyer_image_base64(
        prompt=prompt,
        model=_openai_model_or_default(model),
        reference_images_bytes=reference_images_bytes,
        aspect_ratio=aspect_ratio,
        number_of_images=number_of_images,
      )
    except Exception as e:
      last_err = e
      if not _is_quota_or_rate_limit_error(e):
        raise
  if last_err:
    raise last_err
  raise RuntimeError("No AI provider is configured. Set GEMINI_API_KEY or OPENAI_API_KEY.")


def _normalize_flyer_inpaint_inputs(image_bytes: bytes, mask_png_bytes: bytes) -> Tuple[bytes, bytes]:
  """Validate mask, match dimensions to image, return (flyer_png_bytes, mask_l_png_bytes)."""
  from PIL import Image

  im = Image.open(io.BytesIO(image_bytes))
  im = im.convert("RGBA")
  w, h = im.size
  if w < 32 or h < 32:
    raise ValueError("image dimensions too small")
  if w > 4096 or h > 4096:
    raise ValueError("image dimensions too large (max 4096px)")

  m_user = Image.open(io.BytesIO(mask_png_bytes)).convert("L")
  if m_user.size != (w, h):
    m_user = m_user.resize((w, h), Image.Resampling.LANCZOS)

  pixels = list(m_user.getdata())
  edit_count = sum(1 for p in pixels if p >= 128)
  if edit_count == 0:
    raise ValueError("mask has no painted edit region (paint white over areas to change)")
  if edit_count >= len(pixels) * 0.98:
    raise ValueError("mask covers nearly the entire image; inpainting requires some preserved area")

  buf_im = io.BytesIO()
  im.save(buf_im, format="PNG")
  buf_m = io.BytesIO()
  m_user.save(buf_m, format="PNG")
  return buf_im.getvalue(), buf_m.getvalue()


def inpaint_flyer_region_base64(
  image_bytes: bytes,
  mask_png_bytes: bytes,
  prompt: str,
  model: str,
  *,
  aspect_ratio: Optional[str] = "4:5",
  number_of_images: int = 1,
) -> List[Dict[str, Any]]:
  """
  Masked local edit for the final flyer. Respects AI_PROVIDER like other routes:
  - openai: native Images `edit` + transparency mask (best mask fidelity).
  - gemini: image+mask as two references with strict mask instructions (semantic edit).
  - auto: order follows model id (Gemini-style vs OpenAI-style), then failover on quota.
  """
  image_png, mask_png = _normalize_flyer_inpaint_inputs(image_bytes, mask_png_bytes)

  mode = _provider_mode()
  if mode == "gemini":
    return gemini_client.inpaint_flyer_with_mask_base64(
      image_png,
      mask_png,
      prompt,
      model,
      aspect_ratio=aspect_ratio,
      number_of_images=number_of_images,
    )
  if mode == "openai":
    return openai_client.inpaint_with_mask_base64(
      image_png,
      mask_png,
      prompt,
      model=_openai_model_or_default(model),
      aspect_ratio=aspect_ratio,
      number_of_images=number_of_images,
    )

  prefer_gemini = _looks_like_gemini_model(model)
  providers = ["gemini", "openai"] if prefer_gemini else ["openai", "gemini"]
  last_err: Optional[Exception] = None
  for p in providers:
    if p == "gemini" and not _has_gemini_key():
      continue
    if p == "openai" and not _has_openai_key():
      continue
    try:
      if p == "gemini":
        return gemini_client.inpaint_flyer_with_mask_base64(
          image_png,
          mask_png,
          prompt,
          model,
          aspect_ratio=aspect_ratio,
          number_of_images=number_of_images,
        )
      return openai_client.inpaint_with_mask_base64(
        image_png,
        mask_png,
        prompt,
        model=_openai_model_or_default(model),
        aspect_ratio=aspect_ratio,
        number_of_images=number_of_images,
      )
    except Exception as e:
      last_err = e
      if not _is_quota_or_rate_limit_error(e):
        raise
  if last_err:
    raise last_err
  raise RuntimeError("No AI provider is configured. Set GEMINI_API_KEY or OPENAI_API_KEY.")

