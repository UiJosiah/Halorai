import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

from ai.routes import ai_bp


APP_ROOT = Path(__file__).resolve().parent
STORAGE_DIR = APP_ROOT / "storage"
UPLOADS_DIR = STORAGE_DIR / "uploads"
EVENTS_DIR = STORAGE_DIR / "events"
INDEX_PATH = STORAGE_DIR / "index.json"


def _ensure_dirs() -> None:
  EVENTS_DIR.mkdir(parents=True, exist_ok=True)
  (UPLOADS_DIR / "logos").mkdir(parents=True, exist_ok=True)
  (UPLOADS_DIR / "ministers").mkdir(parents=True, exist_ok=True)
  STORAGE_DIR.mkdir(parents=True, exist_ok=True)
  if not INDEX_PATH.exists():
    INDEX_PATH.write_text(json.dumps({"files": {}}, indent=2), encoding="utf-8")


def _load_index() -> dict:
  _ensure_dirs()
  return json.loads(INDEX_PATH.read_text(encoding="utf-8"))


def _save_index(idx: dict) -> None:
  INDEX_PATH.write_text(json.dumps(idx, indent=2), encoding="utf-8")


def _now_iso() -> str:
  return datetime.now(timezone.utc).isoformat()


def _safe_ext(filename: str) -> str:
  _, ext = os.path.splitext(filename or "")
  ext = (ext or "").lower()
  if ext in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]:
    return ext
  return ""


def _register_file(kind: str, rel_path: str, original_name: str) -> dict:
  idx = _load_index()
  file_id = uuid.uuid4().hex
  idx["files"][file_id] = {
    "kind": kind,
    "rel_path": rel_path.replace("\\", "/"),
    "original_name": original_name,
    "created_at": _now_iso(),
  }
  _save_index(idx)
  return {"id": file_id, "url": f"/uploads/{idx['files'][file_id]['rel_path']}", "originalName": original_name}


def _delete_file(file_id: str) -> bool:
  idx = _load_index()
  meta = idx["files"].get(file_id)
  if not meta:
    return False
  abs_path = UPLOADS_DIR / meta["rel_path"]
  try:
    if abs_path.exists():
      abs_path.unlink()
  finally:
    idx["files"].pop(file_id, None)
    _save_index(idx)
  return True


_ensure_dirs()

# Load backend/.env if present (for GEMINI_API_KEY, etc.)
load_dotenv(dotenv_path=APP_ROOT / ".env", override=False)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}, r"/uploads/*": {"origins": "*"}})
app.register_blueprint(ai_bp)


@app.get("/api/health")
def health():
  return jsonify({"ok": True, "time": _now_iso()})


@app.post("/api/event-details")
def save_event_details():
  payload = request.get_json(silent=True) or {}
  event_id = uuid.uuid4().hex
  record = {
    "id": event_id,
    "created_at": _now_iso(),
    "data": payload,
  }
  (EVENTS_DIR / f"{event_id}.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
  return jsonify({"id": event_id})


@app.post("/api/uploads/logos")
def upload_logos():
  files = request.files.getlist("files")
  if not files:
    return jsonify({"error": "No files uploaded"}), 400
  if len(files) > 2:
    return jsonify({"error": "Max 2 logos"}), 400

  uploaded = []
  for f in files:
    ext = _safe_ext(f.filename)
    if not ext:
      return jsonify({"error": f"Unsupported file type: {f.filename}"}), 400
    filename = f"{uuid.uuid4().hex}{ext}"
    rel_path = f"logos/{filename}"
    abs_path = UPLOADS_DIR / rel_path
    f.save(abs_path)
    uploaded.append(_register_file("logo", rel_path, f.filename))

  return jsonify({"items": uploaded})


@app.delete("/api/uploads/logos/<file_id>")
def delete_logo(file_id: str):
  ok = _delete_file(file_id)
  return jsonify({"ok": ok})


@app.post("/api/uploads/ministers")
def upload_ministers():
  files = request.files.getlist("files")
  if not files:
    return jsonify({"error": "No files uploaded"}), 400

  uploaded = []
  for f in files:
    ext = _safe_ext(f.filename)
    if not ext:
      return jsonify({"error": f"Unsupported file type: {f.filename}"}), 400
    filename = f"{uuid.uuid4().hex}{ext}"
    rel_path = f"ministers/{filename}"
    abs_path = UPLOADS_DIR / rel_path
    f.save(abs_path)
    uploaded.append(_register_file("minister", rel_path, f.filename))

  return jsonify({"items": uploaded})


@app.delete("/api/uploads/ministers/<file_id>")
def delete_minister(file_id: str):
  ok = _delete_file(file_id)
  return jsonify({"ok": ok})


@app.get("/uploads/<path:filename>")
def uploads(filename: str):
  # filename is relative inside UPLOADS_DIR; send_from_directory handles path traversal.
  return send_from_directory(str(UPLOADS_DIR), filename)


if __name__ == "__main__":
  port = int(os.environ.get("PORT", "5000"))
  app.run(host="0.0.0.0", port=port, debug=True)

