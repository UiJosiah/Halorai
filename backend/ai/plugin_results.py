"""
Photoshop plugin export results — upload to Cloudinary, index locally for lookup.
"""
from __future__ import annotations

import base64
import io
import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Request

from .cloudinary_assets import _cloudinary_configured, _init_cloudinary, _upload_folder

APP_ROOT = Path(__file__).resolve().parents[1]
RESULTS_DIR = APP_ROOT / "storage" / "plugin-results"
INDEX_PATH = RESULTS_DIR / "index.json"

MAX_BYTES = 15 * 1024 * 1024
ALLOWED_MIMES = frozenset({"image/png", "image/jpeg", "image/jpg", "image/webp"})
EXT_BY_MIME = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
}


def _now_iso() -> str:
  return datetime.now(timezone.utc).isoformat()


def _ensure_results_dir() -> None:
  RESULTS_DIR.mkdir(parents=True, exist_ok=True)
  if not INDEX_PATH.exists():
    INDEX_PATH.write_text(json.dumps({"results": {}, "job_latest": {}}, indent=2), encoding="utf-8")


def _load_index() -> dict[str, Any]:
  _ensure_results_dir()
  try:
    return json.loads(INDEX_PATH.read_text(encoding="utf-8"))
  except Exception:
    return {"results": {}, "job_latest": {}}


def _save_index(idx: dict[str, Any]) -> None:
  _ensure_results_dir()
  INDEX_PATH.write_text(json.dumps(idx, indent=2, ensure_ascii=False), encoding="utf-8")


def _normalize_job_id(raw: str | None) -> str | None:
  s = (raw or "").strip()
  if not s:
    return None
  if len(s) > 128:
    raise ValueError("job_id must be at most 128 characters.")
  if not re.fullmatch(r"[\w\-]+", s):
    raise ValueError("job_id may only contain letters, numbers, underscores, and hyphens.")
  return s


def check_plugin_api_key(req: Request) -> str | None:
  """
  Returns an error message when the key is invalid; None when allowed.
  If PLUGIN_API_KEY is unset, uploads are allowed (local dev).
  """
  expected = (os.environ.get("PLUGIN_API_KEY") or "").strip()
  if not expected:
    return None

  provided = (req.headers.get("X-Plugin-Key") or req.headers.get("Authorization") or "").strip()
  if provided.lower().startswith("bearer "):
    provided = provided[7:].strip()
  if provided != expected:
    return "Invalid plugin API key."
  return None


def _guess_mime_from_bytes(data: bytes, fallback: str = "image/png") -> str:
  if data[:8] == b"\x89PNG\r\n\x1a\n":
    return "image/png"
  if data[:3] == b"\xff\xd8\xff":
    return "image/jpeg"
  if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
    return "image/webp"
  mime = (fallback or "image/png").lower().split(";")[0].strip()
  return mime if mime in ALLOWED_MIMES else "image/png"


def _upload_bytes_to_cloudinary(data: bytes, *, mime: str) -> str:
  if not _cloudinary_configured():
    raise RuntimeError(
      "Cloudinary is not configured. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, "
      "CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    )

  _init_cloudinary()
  import cloudinary.uploader

  folder = _upload_folder()
  export_id = uuid.uuid4().hex
  public_id = f"{folder}/exports/{export_id}" if folder else f"exports/{export_id}"
  ext = EXT_BY_MIME.get(mime, ".png")

  result = cloudinary.uploader.upload(
    io.BytesIO(data),
    public_id=public_id,
    format=ext.lstrip("."),
    resource_type="image",
    overwrite=False,
  )
  url = (result.get("secure_url") or result.get("url") or "").strip()
  if not url:
    raise RuntimeError("Cloudinary returned no URL for plugin export.")
  return url


def _register_result(*, url: str, job_id: str | None, template: str | None) -> dict[str, Any]:
  result_id = uuid.uuid4().hex
  record: dict[str, Any] = {
    "id": result_id,
    "url": url,
    "created_at": _now_iso(),
  }
  if job_id:
    record["job_id"] = job_id
  if template:
    record["template"] = template

  idx = _load_index()
  results = idx.setdefault("results", {})
  results[result_id] = record
  if job_id:
    idx.setdefault("job_latest", {})[job_id] = result_id
  _save_index(idx)
  return record


def save_flyer_result_from_bytes(
  data: bytes,
  *,
  mime: str,
  job_id: str | None = None,
  template: str | None = None,
) -> dict[str, Any]:
  if not data:
    raise ValueError("Empty image data.")
  if len(data) > MAX_BYTES:
    raise ValueError(f"Image too large (max {MAX_BYTES // (1024 * 1024)} MB).")

  mime = _guess_mime_from_bytes(data, mime)
  if mime not in ALLOWED_MIMES:
    raise ValueError("Unsupported image type. Use PNG, JPEG, or WebP.")

  job_id = _normalize_job_id(job_id)
  template = (template or "").strip() or None

  url = _upload_bytes_to_cloudinary(data, mime=mime)
  return _register_result(url=url, job_id=job_id, template=template)


def parse_flyer_result_upload(req: Request) -> tuple[bytes, str, str | None, str | None]:
  """
  Accept multipart `file` or JSON { image_base64, mime_type?, job_id?, template? }.
  Returns (bytes, mime, job_id, template).
  """
  if req.content_type and "multipart/form-data" in req.content_type:
    f = req.files.get("file")
    if not f:
      raise ValueError("Missing file field.")
    data = f.read()
    mime = (f.mimetype or "image/png").lower().split(";")[0].strip()
    job_id = _normalize_job_id(req.form.get("job_id"))
    template = (req.form.get("template") or "").strip() or None
    return data, mime, job_id, template

  body = req.get_json(silent=True) or {}
  if not isinstance(body, dict):
    raise ValueError("Invalid JSON body.")

  b64 = (body.get("image_base64") or body.get("base64") or "").strip()
  if not b64:
    raise ValueError("Provide multipart file or JSON with image_base64.")

  if b64.startswith("data:"):
    header, _, payload = b64.partition(",")
    mime = header.split(";")[0].replace("data:", "").strip() or "image/png"
    b64 = payload

  try:
    data = base64.b64decode(b64, validate=True)
  except Exception as e:
    raise ValueError("Invalid image_base64.") from e

  mime = (body.get("mime_type") or body.get("mimeType") or "image/png").lower().split(";")[0].strip()
  job_id = _normalize_job_id(body.get("job_id") or body.get("jobId"))
  template = (body.get("template") or "").strip() or None
  return data, mime, job_id, template


def get_flyer_result(result_or_job_id: str) -> dict[str, Any] | None:
  key = (result_or_job_id or "").strip()
  if not key:
    return None

  idx = _load_index()
  results: dict[str, Any] = idx.get("results") or {}
  if key in results:
    return dict(results[key])

  job_latest: dict[str, str] = idx.get("job_latest") or {}
  linked = job_latest.get(key)
  if linked and linked in results:
    return dict(results[linked])

  return None


def list_flyer_results(*, limit: int = 20) -> list[dict[str, Any]]:
  """Most recent exports first."""
  limit = max(1, min(int(limit), 100))
  idx = _load_index()
  results: dict[str, Any] = idx.get("results") or {}
  items = sorted(
    (dict(v) for v in results.values() if isinstance(v, dict) and v.get("url")),
    key=lambda r: r.get("created_at") or "",
    reverse=True,
  )
  return items[:limit]


def get_latest_flyer_result() -> dict[str, Any] | None:
  items = list_flyer_results(limit=1)
  return items[0] if items else None


def enrich_result_links(record: dict[str, Any], *, api_base: str, frontend_base: str | None = None) -> dict[str, Any]:
  """Add view_url and preview_page for sharing after upload."""
  out = dict(record)
  rid = str(out.get("id") or "").strip()
  if not rid:
    return out
  base = api_base.rstrip("/")
  out["view_url"] = f"{base}/api/plugin/flyer-result/{rid}/view"
  fe = (frontend_base or "").strip().rstrip("/")
  out["preview_page"] = f"{fe}/plugin-preview?id={rid}" if fe else f"{base}/plugin/preview?id={rid}"
  return out

