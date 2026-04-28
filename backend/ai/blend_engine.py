"""
Mathematical blend of a concept (AI) layer over a base swatch — no LLM involvement.

Backdrop = base colour image (bottom). Source = AI-generated image (top).
Standard blend modes combine layers; intensity mixes AI toward that result (see blend_concept_over_base).
"""

from __future__ import annotations

import base64
import io
from typing import Literal

import numpy as np
from PIL import Image

BlendMode = Literal["overlay", "soft_light", "multiply", "screen", "difference", "luminosity"]

ALLOWED_MODES: frozenset[str] = frozenset(
  {"overlay", "soft_light", "multiply", "screen", "difference", "luminosity"}
)


def _b64_to_image(b64: str) -> Image.Image:
  raw = base64.b64decode(b64)
  return Image.open(io.BytesIO(raw)).convert("RGBA")


def _image_to_png_b64(im: Image.Image) -> tuple[str, str]:
  buf = io.BytesIO()
  rgb = im.convert("RGB")
  rgb.save(buf, format="PNG", optimize=True)
  return "image/png", base64.b64encode(buf.getvalue()).decode("ascii")


def _to_float_rgb(im: Image.Image, size: tuple[int, int]) -> np.ndarray:
  """RGB float64 HxWx3 in [0,1]."""
  resized = im.convert("RGB").resize(size, Image.Resampling.LANCZOS)
  return np.asarray(resized).astype(np.float64) / 255.0


def _from_float_rgb(arr: np.ndarray) -> Image.Image:
  arr = np.clip(arr, 0.0, 1.0)
  return Image.fromarray((arr * 255.0).astype(np.uint8), mode="RGB")


def _blend_multiply(b: np.ndarray, s: np.ndarray) -> np.ndarray:
  return b * s


def _blend_screen(b: np.ndarray, s: np.ndarray) -> np.ndarray:
  return 1.0 - (1.0 - b) * (1.0 - s)


def _blend_overlay(b: np.ndarray, s: np.ndarray) -> np.ndarray:
  return np.where(b < 0.5, 2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s))


def _blend_soft_light(b: np.ndarray, s: np.ndarray) -> np.ndarray:
  """Photoshop-style soft light (source blends onto backdrop)."""
  sqrt_b = np.sqrt(np.clip(b, 0.0, 1.0))
  return np.where(
    s <= 0.5,
    b - (1.0 - 2.0 * s) * b * (1.0 - b),
    b + (2.0 * s - 1.0) * (sqrt_b - b),
  )


def _blend_difference(b: np.ndarray, s: np.ndarray) -> np.ndarray:
  return np.abs(b - s)


def _blend_luminosity(b: np.ndarray, s: np.ndarray) -> np.ndarray:
  """Replace luminance from source; chroma from backdrop (LAB L channel)."""
  bi = _from_float_rgb(b)
  si = _from_float_rgb(s)
  lab_b = np.array(bi.convert("LAB"), dtype=np.float32)
  lab_s = np.array(si.convert("LAB"), dtype=np.float32)
  out = lab_b.copy()
  out[:, :, 0] = lab_s[:, :, 0]
  out_img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), mode="LAB").convert("RGB")
  return np.asarray(out_img).astype(np.float64) / 255.0


def _apply_mode(b: np.ndarray, s: np.ndarray, mode: str) -> np.ndarray:
  if mode == "multiply":
    return _blend_multiply(b, s)
  if mode == "screen":
    return _blend_screen(b, s)
  if mode == "overlay":
    return _blend_overlay(b, s)
  if mode == "soft_light":
    return _blend_soft_light(b, s)
  if mode == "difference":
    return _blend_difference(b, s)
  if mode == "luminosity":
    return _blend_luminosity(b, s)
  raise ValueError(f"Unknown blend mode: {mode}")


def blend_concept_over_base(
  *,
  base_image_b64: str,
  concept_image_b64: str,
  mode: str,
  opacity: float,
) -> tuple[str, str]:
  """
  Resize base to concept size. Blend concept onto base using `mode`,
  then mix: (1-opacity)*concept + opacity*blended.

  Returns (mime_type, base64_png).
  """
  if mode not in ALLOWED_MODES:
    raise ValueError(f"mode must be one of {sorted(ALLOWED_MODES)}")
  if not 0.0 <= opacity <= 1.0:
    raise ValueError("opacity must be between 0 and 1")

  concept_im = _b64_to_image(concept_image_b64)
  base_im = _b64_to_image(base_image_b64)

  w, h = concept_im.size
  if w < 1 or h < 1:
    raise ValueError("Invalid concept image dimensions")

  b = _to_float_rgb(base_im, (w, h))
  s = _to_float_rgb(concept_im, (w, h))

  blended = _apply_mode(b, s, mode)
  # Interpolate AI (s) → graded result (blended), not base → blended (which hid the AI).
  out = (1.0 - opacity) * s + opacity * blended
  return _image_to_png_b64(_from_float_rgb(out))
