import json
import logging
import os
import time
import traceback
import uuid
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from flask import Flask, g, jsonify, request
from werkzeug.exceptions import HTTPException


def _ensure_logs_dir(app_root: Path) -> Path:
  logs_dir = app_root / "storage" / "logs"
  logs_dir.mkdir(parents=True, exist_ok=True)
  return logs_dir


class _SafeRotatingFileHandler(RotatingFileHandler):
  """
  Windows can throw PermissionError during rollover if another process
  has the log file open (common with Flask debug reloader).
  We never want logging to crash the server thread.
  """

  def doRollover(self):  # type: ignore[override]
    try:
      super().doRollover()
    except PermissionError:
      # Fallback: switch to a new file for this process.
      try:
        if self.stream:
          self.stream.close()
          self.stream = None
      except Exception:
        pass
      base = Path(self.baseFilename)
      pid = os.getpid()
      ts = int(time.time())
      self.baseFilename = str(base.with_name(f"{base.stem}-{pid}-{ts}{base.suffix}"))
      try:
        self.stream = self._open()
      except Exception:
        # Give up silently; console handler will still work.
        self.stream = None


def _make_handler(path: Path) -> RotatingFileHandler:
  handler = _SafeRotatingFileHandler(
    filename=str(path),
    maxBytes=25 * 1024 * 1024,
    backupCount=3,
    encoding="utf-8",
    delay=True,
  )
  fmt = logging.Formatter(
    fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S%z",
  )
  handler.setFormatter(fmt)
  return handler


def setup_logging(app: Flask, *, app_root: Path) -> None:
  """
  - Logs requests + exceptions with a requestId.
  - Writes server logs to backend/storage/logs/server-<pid>.log (rotating).
  """
  logs_dir = _ensure_logs_dir(app_root)
  level = (os.environ.get("LOG_LEVEL") or "INFO").upper()

  root = logging.getLogger()
  root.setLevel(level)

  # Avoid duplicate handlers during dev reload.
  # Use a per-process filename to prevent Windows file locks across reloader processes.
  pid = os.getpid()
  server_path = logs_dir / f"server-{pid}.log"
  if not any(isinstance(h, RotatingFileHandler) and getattr(h, "baseFilename", "").endswith(str(server_path)) for h in root.handlers):
    root.addHandler(_make_handler(server_path))

  # Keep console logging too.
  if not any(isinstance(h, logging.StreamHandler) for h in root.handlers):
    console = logging.StreamHandler()
    console.setLevel(level)
    console.setFormatter(logging.Formatter("%(levelname)s %(message)s"))
    root.addHandler(console)

  logger = logging.getLogger("app")

  @app.before_request
  def _before():
    g.request_id = uuid.uuid4().hex
    g._start_time = time.time()

  @app.after_request
  def _after(resp):
    try:
      dur_ms = int((time.time() - getattr(g, "_start_time", time.time())) * 1000)
    except Exception:
      dur_ms = -1

    logger.info(
      json.dumps(
        {
          "type": "request",
          "requestId": getattr(g, "request_id", None),
          "method": request.method,
          "path": request.path,
          "status": resp.status_code,
          "durationMs": dur_ms,
          "ip": request.headers.get("x-forwarded-for", request.remote_addr),
          "ua": request.headers.get("user-agent"),
        },
        ensure_ascii=False,
      )
    )
    resp.headers["X-Request-Id"] = getattr(g, "request_id", "")
    return resp

  @app.errorhandler(Exception)
  def _handle_exception(e: Exception):
    request_id = getattr(g, "request_id", uuid.uuid4().hex)
    is_http = isinstance(e, HTTPException)
    status = int(getattr(e, "code", 500)) if is_http else 500

    # Log full stacktrace server-side.
    logger.error(
      json.dumps(
        {
          "type": "exception",
          "requestId": request_id,
          "method": request.method,
          "path": request.path,
          "status": status,
          "error": str(e),
          "stack": traceback.format_exc(limit=50),
        },
        ensure_ascii=False,
      )
    )

    # Client response: keep it simple.
    msg = str(e) if is_http else "Internal Server Error"
    return jsonify({"error": msg, "requestId": request_id}), status


def append_client_log(app_root: Path, payload: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
  """
  Writes a single client log record as JSONL to backend/storage/logs/client.log
  """
  try:
    logs_dir = _ensure_logs_dir(app_root)
    p = logs_dir / "client.log"
    p.open("a", encoding="utf-8").write(json.dumps(payload, ensure_ascii=False) + "\n")
    return True, None
  except Exception as e:
    return False, str(e)

