"""
Upload USER INPUT assets to Cloudinary and cache secure URLs locally.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

USER_INPUT_DIR = Path(__file__).resolve().parents[1] / "assets" / "USER INPUT"
URL_CACHE_FILE = USER_INPUT_DIR / "cloudinary-urls.json"

# Local filenames in USER INPUT (one minister for now).
BACKGROUND_FILE = "Background Concept.jpg"
LOGO_FILE = "Church Logo.png"
MINISTER_FILE = "Johnny Mikey.jpg"
DETAILS_FILE = "Details.txt"

CLOUDINARY_KEYS = {
  "background_image": "test-flyer-background",
  "church_logo": "test-flyer-logo",
  "minister_photo": "test-flyer-minister-1",
}


def _cloudinary_configured() -> bool:
  if (os.environ.get("CLOUDINARY_URL") or "").strip():
    return True
  return bool(
    (os.environ.get("CLOUDINARY_CLOUD_NAME") or "").strip()
    and (os.environ.get("CLOUDINARY_API_KEY") or "").strip()
    and (os.environ.get("CLOUDINARY_API_SECRET") or "").strip()
  )


def _init_cloudinary() -> None:
  import cloudinary

  url = (os.environ.get("CLOUDINARY_URL") or "").strip()
  if url:
    cloudinary.config(cloudinary_url=url, secure=True)
    return

  cloudinary.config(
    cloud_name=(os.environ.get("CLOUDINARY_CLOUD_NAME") or "").strip(),
    api_key=(os.environ.get("CLOUDINARY_API_KEY") or "").strip(),
    api_secret=(os.environ.get("CLOUDINARY_API_SECRET") or "").strip(),
    secure=True,
  )


def _upload_folder() -> str:
  folder = (os.environ.get("CLOUDINARY_UPLOAD_FOLDER") or "halorai").strip().strip("/")
  return folder or "halorai"


def parse_user_input_details() -> dict[str, str]:
  path = USER_INPUT_DIR / DETAILS_FILE
  if not path.is_file():
    raise FileNotFoundError(f"Missing {path}")

  out: dict[str, str] = {}
  for raw in path.read_text(encoding="utf-8").splitlines():
    line = raw.strip()
    if not line or line.startswith("USERS INPUT"):
      continue
    m = re.match(r"^([^:]+):\s*(.+)$", line)
    if not m:
      continue
    key = m.group(1).strip().lower().replace(" ", "_")
    out[key] = m.group(2).strip()

  event_name = out.get("event_name", "").strip()
  host_name = out.get("host_name", "").strip()
  date = out.get("date", "").strip()
  if not event_name or not date or not host_name:
    raise ValueError("Details.txt must include Event Name, Date, and Host Name.")

  return {
    "church_name": out.get("church_name", ""),
    "event_name": event_name,
    "theme": out.get("theme", ""),
    "date": date,
    "time": out.get("time", ""),
    "venue": out.get("venue", ""),
    "host_name": host_name,
  }


def _file_mtimes() -> dict[str, float]:
  mtimes: dict[str, float] = {}
  for name in (BACKGROUND_FILE, LOGO_FILE, MINISTER_FILE):
    p = USER_INPUT_DIR / name
    if p.is_file():
      mtimes[name] = p.stat().st_mtime
  return mtimes


def _load_url_cache() -> dict[str, Any]:
  if not URL_CACHE_FILE.is_file():
    return {}
  try:
    return json.loads(URL_CACHE_FILE.read_text(encoding="utf-8"))
  except Exception:
    return {}


def _save_url_cache(cache: dict[str, Any]) -> None:
  URL_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
  URL_CACHE_FILE.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")


def _upload_file(local_name: str, public_id: str) -> str:
  import cloudinary.uploader

  path = USER_INPUT_DIR / local_name
  if not path.is_file():
    raise FileNotFoundError(f"Missing asset: {path}")

  folder = _upload_folder()
  full_public_id = f"{folder}/{public_id}" if folder else public_id

  result = cloudinary.uploader.upload(
    str(path),
    public_id=full_public_id,
    overwrite=True,
    resource_type="image",
  )
  url = (result.get("secure_url") or result.get("url") or "").strip()
  if not url:
    raise RuntimeError(f"Cloudinary returned no URL for {local_name}")
  return url


def ensure_cloudinary_urls(*, force: bool = False) -> dict[str, str]:
  """
  Upload USER INPUT images if needed; persist URLs in cloudinary-urls.json.
  Returns dict with background_image, church_logo, minister_photo URLs.
  """
  if not _cloudinary_configured():
    raise RuntimeError(
      "Cloudinary is not configured. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, "
      "CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    )

  mtimes = _file_mtimes()
  cache = _load_url_cache()
  cached_mtimes = cache.get("source_mtime") if isinstance(cache.get("source_mtime"), dict) else {}

  stale = force or not cache.get("background_image") or cached_mtimes != mtimes

  if not stale:
    return {
      "background_image": str(cache["background_image"]),
      "church_logo": str(cache["church_logo"]),
      "minister_photo": str((cache.get("minister_photos") or [""])[0]),
    }

  _init_cloudinary()

  background_url = _upload_file(BACKGROUND_FILE, CLOUDINARY_KEYS["background_image"])
  logo_url = _upload_file(LOGO_FILE, CLOUDINARY_KEYS["church_logo"])
  minister_url = _upload_file(MINISTER_FILE, CLOUDINARY_KEYS["minister_photo"])

  new_cache = {
    "uploaded_at": datetime.now(timezone.utc).isoformat(),
    "source_mtime": mtimes,
    "background_image": background_url,
    "church_logo": logo_url,
    "minister_photos": [minister_url],
  }
  _save_url_cache(new_cache)

  return {
    "background_image": background_url,
    "church_logo": logo_url,
    "minister_photo": minister_url,
  }


def psd_template_name(minister_count: int) -> str:
  """Root PSD group name, e.g. Template Min 1 (one minister)."""
  n = max(1, int(minister_count))
  return f"Template Min {n}"


def build_test_flyer_json(*, force_upload: bool = False) -> dict[str, Any]:
  """
  JSON for Photoshop UXP plugin — keys match PSD folder/layer names.
  Template Min N root → Details, Event Name, Minister Name, Minister Picture, Theme, Logo, Church Name, Background.
  """
  details = parse_user_input_details()
  urls = ensure_cloudinary_urls(force=force_upload)
  minister_count = 1  # one minister for now

  return {
    "template": psd_template_name(minister_count),
    "minister_count": minister_count,
    "layers": {
      "Details": {
        "Venue": details["venue"],
        "Date": details["date"],
        "Time": details["time"],
      },
      "Event Name": details["event_name"],
      "Minister Name": [details["host_name"]],
      "Minister Picture": [urls["minister_photo"]],
      "Theme": details["theme"],
      "Logo": urls["church_logo"],
      "Church Name": details["church_name"],
      "Background": urls["background_image"],
    },
  }
