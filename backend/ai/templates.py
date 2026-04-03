import os
import random
from pathlib import Path
from typing import Optional, Tuple


def _max_ministers() -> int:
  raw = (os.environ.get("AI_MAX_MINISTERS") or "").strip()
  try:
    n = int(raw) if raw else 3
  except Exception:
    n = 3
  return max(0, n)


MAX_MINISTERS = _max_ministers()


def _templates_root() -> Optional[Path]:
  # Allow override in env for deployment flexibility.
  env = (os.environ.get("AI_TEMPLATES_DIR") or "").strip()
  if env:
    p = Path(env).expanduser().resolve()
    if p.exists():
      return p

  # Default: repo-root/"Templates By Pic"
  app_root = Path(__file__).resolve().parents[1]  # backend/
  repo_root = app_root.parent
  p = repo_root / "Templates By Pic"
  if p.exists():
    return p

  # Fallback (if user relocates later)
  p2 = app_root / "Templates By Pic"
  if p2.exists():
    return p2

  return None


def _bucket_name(minister_count: int) -> str:
  n = max(0, int(minister_count))
  n = min(n, MAX_MINISTERS)
  if n <= 0:
    return "0-minister"
  if n == 1:
    return "1-minister"
  return f"{n}-ministers"


def pick_template_image(minister_count: int) -> Tuple[Path, str]:
  root = _templates_root()
  if not root:
    raise FileNotFoundError('Templates folder not found. Expected "Templates By Pic" in repo root or set AI_TEMPLATES_DIR.')

  bucket = _bucket_name(minister_count)
  folder = root / bucket
  if not folder.exists():
    raise FileNotFoundError(f"Template bucket not found: {folder}")

  exts = {".png", ".jpg", ".jpeg", ".webp"}
  candidates = [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in exts]
  if not candidates:
    raise FileNotFoundError(f"No template images found in: {folder}")

  chosen = random.choice(candidates)
  return chosen, bucket

