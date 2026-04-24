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

