import os
import json
import logging
import time
import re
import io

from flask import Blueprint, jsonify, redirect, request, g, send_file, Response

from .ai_client import (
  edit_flyer_base64,
  generate_flyer_image_base64,
  generate_images_base64,
  generate_text,
  inpaint_flyer_region_base64,
  recreate_image_base64,
)
from .blend_engine import blend_concept_over_base
from .cloudinary_assets import build_test_flyer_json
from .plugin_results import (
  check_plugin_api_key,
  enrich_result_links,
  get_flyer_result,
  get_latest_flyer_result,
  list_flyer_results,
  parse_flyer_result_upload,
  save_flyer_result_from_bytes,
)
from .flyer_compose import (
  FlyerComposeInput,
  build_flyer_layers_zip,
  build_sample_flyer_json_payload,
  build_sample_flyer_input,
  compose_flyer_bundle,
  flyer_layers_json,
  flyer_plugin_json,
  guess_mime,
  normalize_flyer_json_body,
  parse_flyer_json_payload,
  validate_ministers_meta,
)


ai_bp = Blueprint("ai", __name__)

DEFAULT_TEXT_MODEL = os.environ.get("AI_TEXT_MODEL") or "models/gemini-3.1-pro-preview"
# "Nano Banana 2" in your model list maps to Gemini 3.1 Flash Image (fast, production-oriented).
DEFAULT_IMAGE_MODEL = os.environ.get("AI_IMAGE_MODEL") or "models/gemini-3.1-flash-image-preview"
DEFAULT_FLYER_MODEL = os.environ.get("AI_FLYER_MODEL") or DEFAULT_IMAGE_MODEL

ai_logger = logging.getLogger("ai")


def _json_error(message: str, status: int = 400):
  return jsonify({"error": message}), status


def _preview_text(s: str, limit: int = 320) -> str:
  s = (s or "").replace("\r\n", "\n").replace("\r", "\n")
  s = " ".join(s.split())  # collapse whitespace for single-line logs
  if len(s) <= limit:
    return s
  return s[:limit] + "…"


def _rid() -> str:
  return str(getattr(g, "request_id", "") or "")


def _guess_mime(filename: str) -> str:
  return guess_mime(filename)


def _ai_exception_to_http(e: Exception) -> tuple[int, str]:
  """
  Convert bulky provider errors into a user-friendly message + HTTP status.
  Full details are still logged server-side for debugging.
  """
  raw = str(e) or e.__class__.__name__
  low = raw.lower()

  # Quota / rate limit.
  if (
    "resource_exhausted" in low
    or "exceeded your current quota" in low
    or "rate limit" in low
    or re.search(r"\b429\b", low)
  ):
    return 429, "AI limit reached right now. Please wait a bit and try again."

  # Auth / billing / key issues.
  if ("api key" in low and ("invalid" in low or "missing" in low)) or re.search(r"\b401\b|\b403\b", low):
    return 401, "AI is not configured correctly (missing/invalid API key)."

  # Timeouts.
  if "timeout" in low or "deadline exceeded" in low:
    return 504, "AI took too long to respond. Please try again."

  return 500, "AI request failed. Please try again."


@ai_bp.post("/api/ai/text")
def ai_text():
  payload = request.get_json(silent=True) or {}
  prompt = payload.get("prompt", "")
  model = payload.get("model") or DEFAULT_TEXT_MODEL

  t0 = time.perf_counter()
  try:
    print(
      f"[AI][{_rid()}] /api/ai/text -> model={model} promptPreview={_preview_text(str(prompt), 180)!r}",
      flush=True,
    )
  except Exception:
    pass

  try:
    text = generate_text(prompt=prompt, model=model)
  except ValueError as e:
    return _json_error(str(e), 400)
  except Exception as e:
    status, msg = _ai_exception_to_http(e)
    ai_logger.exception(
      json.dumps(
        {
          "type": "ai_error",
          "endpoint": "/api/ai/text",
          "requestId": getattr(g, "request_id", None),
          "model": model,
          "error": str(e),
        },
        ensure_ascii=False,
      )
    )
    return _json_error(msg, status)

  t_ms = int((time.perf_counter() - t0) * 1000)
  try:
    print(
      f"[AI][{_rid()}] /api/ai/text <- ok {t_ms}ms chars={len(text or '')} preview={_preview_text(text or '', 200)!r}",
      flush=True,
    )
  except Exception:
    pass

  # Log a small preview of what the model returned.
  ai_logger.info(
    json.dumps(
      {
        "type": "ai_response",
        "endpoint": "/api/ai/text",
        "requestId": getattr(g, "request_id", None),
        "model": model,
        "chars": len(text or ""),
        "preview": _preview_text(text or ""),
      },
      ensure_ascii=False,
    )
  )

  return jsonify({"model": model, "text": text})


@ai_bp.post("/api/ai/image")
def ai_image():
  payload = request.get_json(silent=True) or {}
  prompt = payload.get("prompt", "")
  model = payload.get("model") or DEFAULT_IMAGE_MODEL
  aspect_ratio = payload.get("aspectRatio")
  number_of_images = payload.get("numberOfImages", 1)
  reference_images = payload.get("referenceImages") or payload.get("images") or []

  try:
    if reference_images:
      images = recreate_image_base64(
        prompt=prompt,
        model=model,
        reference_images=reference_images,
        aspect_ratio=aspect_ratio,
        number_of_images=number_of_images,
      )
    else:
      images = generate_images_base64(
        prompt=prompt,
        model=model,
        aspect_ratio=aspect_ratio,
        number_of_images=number_of_images,
      )
  except ValueError as e:
    return _json_error(str(e), 400)
  except Exception as e:
    status, msg = _ai_exception_to_http(e)
    ai_logger.exception(
      json.dumps(
        {
          "type": "ai_error",
          "endpoint": "/api/ai/image",
          "requestId": getattr(g, "request_id", None),
          "model": model,
          "error": str(e),
        },
        ensure_ascii=False,
      )
    )
    return _json_error(msg, status)

  first = images[0] if images else None
  if first:
    b64 = (first.get("base64") or "")
    ai_logger.info(
      json.dumps(
        {
          "type": "ai_response",
          "endpoint": "/api/ai/image",
          "requestId": getattr(g, "request_id", None),
          "model": model,
          "mimeType": first.get("mimeType"),
          "base64Len": len(b64),
          "base64Prefix": b64[:48],
        },
        ensure_ascii=False,
      )
    )

  return jsonify({"model": model, "images": images})


@ai_bp.post("/api/image/blend")
def image_blend():
  """
  Blend AI concept image over a base swatch using real blend math (Pillow + NumPy).
  JSON: baseImage { base64 }, conceptImage { base64 }, mode, opacity (0..1).
  """
  payload = request.get_json(silent=True) or {}
  base_payload = payload.get("baseImage") or {}
  concept_payload = payload.get("conceptImage") or {}
  base_b64 = (base_payload.get("base64") or "").strip()
  concept_b64 = (concept_payload.get("base64") or "").strip()
  mode = (payload.get("mode") or "soft_light").strip().lower()
  opacity_raw = payload.get("opacity")

  if not base_b64 or not concept_b64:
    return _json_error("baseImage.base64 and conceptImage.base64 are required", 400)

  try:
    opacity_f = float(opacity_raw)
  except (TypeError, ValueError):
    return _json_error("opacity must be a number between 0 and 1", 400)

  try:
    mime, out_b64 = blend_concept_over_base(
      base_image_b64=base_b64,
      concept_image_b64=concept_b64,
      mode=mode,
      opacity=opacity_f,
    )
  except ValueError as e:
    return _json_error(str(e), 400)
  except Exception as e:
    ai_logger.exception(
      json.dumps(
        {
          "type": "blend_error",
          "endpoint": "/api/image/blend",
          "requestId": getattr(g, "request_id", None),
          "error": str(e),
        },
        ensure_ascii=False,
      )
    )
    return _json_error("Blend failed", 500)

  return jsonify({"mimeType": mime, "base64": out_b64})


@ai_bp.post("/api/ai/image/recreate")
def ai_image_recreate():
  payload = request.get_json(silent=True) or {}
  prompt = payload.get("prompt", "")
  model = payload.get("model") or DEFAULT_IMAGE_MODEL
  aspect_ratio = payload.get("aspectRatio")
  number_of_images = payload.get("numberOfImages", 1)
  reference_images = payload.get("referenceImages") or payload.get("images") or []

  try:
    images = recreate_image_base64(
      prompt=prompt,
      model=model,
      reference_images=reference_images,
      aspect_ratio=aspect_ratio,
      number_of_images=number_of_images,
    )
  except ValueError as e:
    return _json_error(str(e), 400)
  except Exception as e:
    status, msg = _ai_exception_to_http(e)
    ai_logger.exception(
      json.dumps(
        {
          "type": "ai_error",
          "endpoint": "/api/ai/image/recreate",
          "requestId": getattr(g, "request_id", None),
          "model": model,
          "error": str(e),
        },
        ensure_ascii=False,
      )
    )
    return _json_error(msg, status)

  first = images[0] if images else None
  if first:
    b64 = (first.get("base64") or "")
    ai_logger.info(
      json.dumps(
        {
          "type": "ai_response",
          "endpoint": "/api/ai/image/recreate",
          "requestId": getattr(g, "request_id", None),
          "model": model,
          "mimeType": first.get("mimeType"),
          "base64Len": len(b64),
          "base64Prefix": b64[:48],
        },
        ensure_ascii=False,
      )
    )

  return jsonify({"model": model, "images": images})


@ai_bp.post("/api/ai/generate")
def ai_generate():
  payload = request.get_json(silent=True) or {}
  kind = (payload.get("type") or payload.get("mode") or "text").strip().lower()

  if kind in ("text", "txt"):
    # Delegate to text handler logic.
    prompt = payload.get("prompt", "")
    model = payload.get("model") or DEFAULT_TEXT_MODEL
    try:
      text = generate_text(prompt=prompt, model=model)
    except ValueError as e:
      return _json_error(str(e), 400)
    except Exception as e:
      status, msg = _ai_exception_to_http(e)
      ai_logger.exception(
        json.dumps(
          {
            "type": "ai_error",
            "endpoint": "/api/ai/generate",
            "requestId": getattr(g, "request_id", None),
            "model": model,
            "mode": "text",
            "error": str(e),
          },
          ensure_ascii=False,
        )
      )
      return _json_error(msg, status)
    return jsonify({"type": "text", "model": model, "text": text})

  if kind in ("image", "img", "images"):
    prompt = payload.get("prompt", "")
    model = payload.get("model") or DEFAULT_IMAGE_MODEL
    aspect_ratio = payload.get("aspectRatio")
    number_of_images = payload.get("numberOfImages", 1)
    reference_images = payload.get("referenceImages") or payload.get("images") or []
    try:
      if reference_images:
        images = recreate_image_base64(
          prompt=prompt,
          model=model,
          reference_images=reference_images,
          aspect_ratio=aspect_ratio,
          number_of_images=number_of_images,
        )
      else:
        images = generate_images_base64(
          prompt=prompt,
          model=model,
          aspect_ratio=aspect_ratio,
          number_of_images=number_of_images,
        )
    except ValueError as e:
      return _json_error(str(e), 400)
    except Exception as e:
      status, msg = _ai_exception_to_http(e)
      ai_logger.exception(
        json.dumps(
          {
            "type": "ai_error",
            "endpoint": "/api/ai/generate",
            "requestId": getattr(g, "request_id", None),
            "model": model,
            "mode": "image",
            "error": str(e),
          },
          ensure_ascii=False,
        )
      )
      return _json_error(msg, status)
    return jsonify({"type": "image", "model": model, "images": images})

  return _json_error('Invalid type. Use "text" or "image".', 400)


def _run_flyer_compose(bundle, *, endpoint: str, template_title: str, template_file: str, template_bucket: str):
  """Call image model with composed prompt + refs; log and return JSON response."""
  t0 = time.perf_counter()
  try:
    print(
      f"[AI][{_rid()}] {endpoint} -> model={bundle.model} templateTitle={template_title!r} templateFile={template_file!r} templateBucket={template_bucket} promptPreview={_preview_text(bundle.prompt, 180)!r}",
      flush=True,
    )
  except Exception:
    pass

  try:
    images = generate_flyer_image_base64(
      prompt=bundle.prompt,
      model=bundle.model,
      reference_images_bytes=bundle.refs,
      aspect_ratio="4:5",
      number_of_images=1,
    )
  except Exception as e:
    status, msg = _ai_exception_to_http(e)
    ai_logger.exception(
      json.dumps(
        {
          "type": "ai_error",
          "endpoint": endpoint,
          "requestId": getattr(g, "request_id", None),
          "model": bundle.model,
          "templateTitle": template_title,
          "templateFile": template_file,
          "templateBucket": template_bucket,
          "error": str(e),
        },
        ensure_ascii=False,
      )
    )
    return _json_error(msg, status)

  t_ms = int((time.perf_counter() - t0) * 1000)
  first = images[0] if images else None
  if first:
    b64 = (first.get("base64") or "")
    try:
      print(
        f"[AI][{_rid()}] {endpoint} <- ok {t_ms}ms templateTitle={template_title!r} mimeType={first.get('mimeType')} base64Len={len(b64)}",
        flush=True,
      )
    except Exception:
      pass
    ai_logger.info(
      json.dumps(
        {
          "type": "ai_response",
          "endpoint": endpoint,
          "requestId": getattr(g, "request_id", None),
          "model": bundle.model,
          "templateTitle": template_title,
          "templateBucket": template_bucket,
          "templateFile": template_file,
          "mimeType": first.get("mimeType"),
          "base64Len": len(b64),
          "base64Prefix": b64[:48],
        },
        ensure_ascii=False,
      )
    )

  return jsonify(
    {
      "model": bundle.model,
      "template": {"bucket": template_bucket, "file": template_file, "title": template_title},
      "images": images,
    }
  )


@ai_bp.get("/api/test-flyer")
def test_flyer():
  """
  Photoshop UXP test JSON — PSD layer names + Cloudinary image URLs.
  Reads backend/assets/USER INPUT/ (Details.txt + images).
  Response: { template, minister_count, layers: { Details, Event Name, ... } }
  ?job_id=abc links handoff to POST /api/plugin/flyer-result for the finished export.
  ?refresh=1 forces re-upload to Cloudinary.
  """
  force = (request.args.get("refresh") or "").lower() in ("1", "true", "yes")
  job_id = (request.args.get("job_id") or "").strip() or None
  try:
    return jsonify(build_test_flyer_json(force_upload=force, job_id=job_id))
  except FileNotFoundError as e:
    return _json_error(str(e), 503)
  except RuntimeError as e:
    return _json_error(str(e), 503)
  except Exception as e:
    ai_logger.exception("test_flyer failed")
    return _json_error(f"Failed to build test flyer JSON: {e}", 500)


def _frontend_origin() -> str | None:
  raw = (os.environ.get("FRONTEND_ORIGIN") or os.environ.get("CORS_ORIGINS") or "").strip()
  if not raw:
    return None
  return raw.split(",")[0].strip().rstrip("/") or None


@ai_bp.post("/api/plugin/flyer-result")
def plugin_flyer_result_upload():
  """
  Photoshop UXP — upload finished flat export (PNG/JPEG/WebP). No job_id required.
  Multipart: file (required). Optional: template.
  JSON alternative: { image_base64, mime_type?, template? }
  Returns { id, url, view_url, preview_page, created_at } — share preview_page with the team.
  Optional header X-Plugin-Key when PLUGIN_API_KEY is set.
  """
  auth_err = check_plugin_api_key(request)
  if auth_err:
    return _json_error(auth_err, 401)

  try:
    data, mime, job_id, template = parse_flyer_result_upload(request)
    record = save_flyer_result_from_bytes(
      data,
      mime=mime,
      job_id=job_id,
      template=template,
    )
    record = enrich_result_links(
      record,
      api_base=request.url_root,
      frontend_base=_frontend_origin(),
    )
    return jsonify(record), 201
  except ValueError as e:
    return _json_error(str(e), 400)
  except RuntimeError as e:
    return _json_error(str(e), 503)
  except Exception as e:
    ai_logger.exception("plugin_flyer_result_upload failed")
    return _json_error(f"Failed to store plugin export: {e}", 500)


@ai_bp.get("/api/plugin/flyer-results")
def plugin_flyer_results_list():
  """Recent plugin exports, newest first (for preview page)."""
  try:
    limit = int(request.args.get("limit") or "20")
  except ValueError:
    limit = 20
  return jsonify({"items": list_flyer_results(limit=limit)})


@ai_bp.get("/api/plugin/flyer-result/latest")
def plugin_flyer_result_latest():
  """Latest plugin export — used by the preview page auto-refresh."""
  record = get_latest_flyer_result()
  if not record:
    return _json_error("No plugin exports yet.", 404)
  return jsonify(record)


@ai_bp.get("/api/plugin/flyer-result/<result_id>")
def plugin_flyer_result_get(result_id: str):
  """
  Fetch a plugin export by result id or job_id (latest export for that job).
  Response: { id, url, job_id?, template?, created_at }
  """
  record = get_flyer_result(result_id)
  if not record:
    return _json_error("Plugin export not found.", 404)
  return jsonify(record)


@ai_bp.get("/api/plugin/flyer-result/<result_id>/view")
def plugin_flyer_result_view(result_id: str):
  """Redirect to the Cloudinary URL for browser / img display."""
  record = get_flyer_result(result_id)
  if not record:
    return _json_error("Plugin export not found.", 404)
  url = (record.get("url") or "").strip()
  if not url:
    return _json_error("Plugin export has no image URL.", 404)
  return redirect(url, code=302)


_PLUGIN_PREVIEW_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Halorai — Plugin export preview</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; background: #111; color: #eee; }
    h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 8px; }
    p { color: #aaa; margin: 0 0 20px; font-size: 0.9rem; }
    .main { max-width: 960px; margin: 0 auto; }
    .card { background: #1a1a1a; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
    img.preview { width: 100%; height: auto; border-radius: 8px; display: block; background: #000; }
    .meta { font-size: 0.85rem; color: #888; margin-top: 12px; }
    .empty { color: #888; padding: 48px 16px; text-align: center; }
    .thumbs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
    .thumbs button { border: 2px solid transparent; padding: 0; border-radius: 6px; cursor: pointer; background: none; }
    .thumbs button.active { border-color: #7c5cff; }
    .thumbs img { width: 72px; height: 72px; object-fit: cover; border-radius: 4px; display: block; }
    a { color: #a78bfa; }
  </style>
</head>
<body>
  <div class="main">
    <h1>Photoshop plugin export</h1>
    <p>Latest upload from the UXP plugin. This page refreshes every 5 seconds.</p>
    <div id="content" class="card empty">Waiting for an export…</div>
    <div id="history" class="thumbs"></div>
  </div>
  <script>
    const params = new URLSearchParams(location.search);
    let selectedId = params.get("id") || "";

    async function load() {
      try {
        const listRes = await fetch("/api/plugin/flyer-results?limit=12");
        const listData = await listRes.json();
        const items = (listData.items || []);
        if (!items.length) {
          document.getElementById("content").className = "card empty";
          document.getElementById("content").innerHTML = "No exports yet. Photoshop dev should POST to <code>/api/plugin/flyer-result</code>.";
          document.getElementById("history").innerHTML = "";
          return;
        }
        const pick = selectedId
          ? items.find((x) => x.id === selectedId) || items[0]
          : items[0];
        selectedId = pick.id;
        const when = pick.created_at ? new Date(pick.created_at).toLocaleString() : "";
        document.getElementById("content").className = "card";
        document.getElementById("content").innerHTML =
          '<img class="preview" src="' + pick.url + '" alt="Plugin export" />' +
          '<div class="meta">' + (pick.template ? pick.template + " · " : "") + when +
          ' · <a href="' + pick.url + '" target="_blank" rel="noopener">Open full image</a></div>';
        document.getElementById("history").innerHTML = items.map((it) =>
          '<button type="button" class="' + (it.id === selectedId ? "active" : "") + '" data-id="' + it.id + '">' +
          '<img src="' + it.url + '" alt="" /></button>'
        ).join("");
        document.querySelectorAll("#history button").forEach((btn) => {
          btn.onclick = () => {
            selectedId = btn.getAttribute("data-id");
            history.replaceState(null, "", "?id=" + selectedId);
            load();
          };
        });
      } catch (e) {
        document.getElementById("content").className = "card empty";
        document.getElementById("content").textContent = "Could not load exports.";
      }
    }
    load();
    setInterval(load, 5000);
  </script>
</body>
</html>
"""


@ai_bp.get("/plugin/preview")
def plugin_preview_page():
  """Standalone page — open in browser to review Photoshop exports (no app integration)."""
  return Response(_PLUGIN_PREVIEW_HTML, mimetype="text/html; charset=utf-8")


_PLUGIN_UPLOAD_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Halorai — Test plugin upload</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 520px; margin: 40px auto; padding: 0 16px; }
    h1 { font-size: 1.2rem; }
    p, label { font-size: 0.9rem; color: #444; }
    input[type=file] { margin: 12px 0; display: block; }
    button { padding: 10px 16px; cursor: pointer; }
    pre { background: #f4f4f4; padding: 12px; overflow: auto; font-size: 0.8rem; }
    .err { color: #b00020; }
    a { color: #5b21b6; }
  </style>
</head>
<body>
  <h1>Test plugin upload</h1>
  <p>Same as Postman: <code>POST /api/plugin/flyer-result</code> with form field <code>file</code>. Upload may take 15–30s (Cloudinary).</p>
  <form id="f">
    <label>Image file (PNG/JPG)</label>
    <input type="file" name="file" accept="image/png,image/jpeg,image/webp" required />
    <button type="submit" id="btn">Upload</button>
  </form>
  <p id="status"></p>
  <pre id="out" hidden></pre>
  <p><a href="/plugin/preview">View preview page</a></p>
  <script>
    document.getElementById("f").onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById("btn");
      const status = document.getElementById("status");
      const out = document.getElementById("out");
      const fd = new FormData(e.target);
      btn.disabled = true;
      status.textContent = "Uploading… (wait for Cloudinary)";
      status.className = "";
      out.hidden = true;
      try {
        const res = await fetch("/api/plugin/flyer-result", { method: "POST", body: fd });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }
        out.textContent = JSON.stringify(data, null, 2);
        out.hidden = false;
        if (!res.ok) {
          status.textContent = "Failed (" + res.status + ")";
          status.className = "err";
        } else {
          status.innerHTML = 'OK — <a href="' + (data.preview_page || "/plugin/preview") + '">open preview</a>';
        }
      } catch (err) {
        status.textContent = "Network error — is the backend running on port 5000?";
        status.className = "err";
      } finally {
        btn.disabled = false;
      }
    };
  </script>
</body>
</html>
"""


@ai_bp.get("/plugin/upload")
def plugin_upload_test_page():
  """Browser test form — same POST as Postman / UXP plugin."""
  return Response(_PLUGIN_UPLOAD_HTML, mimetype="text/html; charset=utf-8")


@ai_bp.get("/api/ai/flyer/sample-payload")
def ai_flyer_sample_payload():
  """
  Returns a prefilled flyer layer bundle (event details + base64 images).
  For Photoshop plugin handoff.
  """
  try:
    return jsonify(build_sample_flyer_json_payload())
  except FileNotFoundError as e:
    return _json_error(str(e), 503)
  except Exception as e:
    ai_logger.exception("ai_flyer_sample_payload failed")
    return _json_error(f"Failed to build sample plugin payload: {e}", 500)


@ai_bp.get("/api/ai/flyer/json")
def ai_flyer_json_get():
  """
  Returns bundled demo flyer layers (same as POST { useSamplePayload: true }).
  For Photoshop plugin handoff.
  """
  try:
    return jsonify(flyer_plugin_json(build_sample_flyer_input()))
  except FileNotFoundError as e:
    return _json_error(str(e), 503)
  except Exception as e:
    ai_logger.exception("ai_flyer_json_get failed")
    return _json_error(f"Failed to build sample plugin payload: {e}", 500)


@ai_bp.post("/api/ai/flyer/json")
def ai_flyer_json():
  """
  Photoshop plugin handoff as JSON (no template image).

  Body: eventDetails, ministersMeta?, backgroundImage, logos?, ministers?
  Response includes ministerCount + templateBucket (which PSD folder to use).
  """
  payload = request.get_json(silent=True) or {}

  if not payload:
    return _json_error(
      'JSON body is required. Use GET /api/ai/flyer/json for demo layers, '
      'or POST { "useSamplePayload": true }.',
      400,
    )

  normalized = normalize_flyer_json_body(payload, default_model=DEFAULT_FLYER_MODEL)

  inp, err = parse_flyer_json_payload(normalized, default_model=DEFAULT_FLYER_MODEL)
  if err:
    return _json_error(err, 400)
  assert inp is not None

  return jsonify(flyer_plugin_json(inp))


def _flyer_layers_zip_response(inp: FlyerComposeInput):
  try:
    data = build_flyer_layers_zip(inp)
  except Exception as e:
    ai_logger.exception("flyer_layers_zip failed")
    raise
  return send_file(
    io.BytesIO(data),
    mimetype="application/zip",
    as_attachment=True,
    download_name="halorai-flyer-layers.zip",
  )


@ai_bp.get("/api/ai/flyer/layers.zip")
def flyer_layers_zip_get():
  """
  Download ZIP for Photoshop plugin: background, logos, ministers, manifest.json.
  Template PSD is already in Photoshop — ministerCount + templateBucket pick the layout.
  """
  try:
    return _flyer_layers_zip_response(build_sample_flyer_input())
  except FileNotFoundError as e:
    return _json_error(str(e), 503)
  except Exception as e:
    ai_logger.exception("flyer_layers_zip_get failed")
    return _json_error(f"Failed to build plugin ZIP: {e}", 500)


@ai_bp.post("/api/ai/flyer/layers.zip")
def flyer_layers_zip_post():
  """Same as GET, but layers built from JSON body (or useSamplePayload: true)."""
  payload = request.get_json(silent=True) or {}
  try:
    if not payload:
      return _flyer_layers_zip_response(build_sample_flyer_input())

    normalized = normalize_flyer_json_body(payload, default_model=DEFAULT_FLYER_MODEL)
    inp, err = parse_flyer_json_payload(normalized, default_model=DEFAULT_FLYER_MODEL)
    if err:
      return _json_error(err, 400)
    assert inp is not None
    return _flyer_layers_zip_response(inp)
  except FileNotFoundError as e:
    return _json_error(str(e), 503)
  except Exception as e:
    ai_logger.exception("flyer_layers_zip_post failed")
    return _json_error(f"Failed to build plugin ZIP: {e}", 500)


@ai_bp.post("/api/ai/flyer")
def ai_flyer():
  """
  Multipart form endpoint.

  Fields:
  - eventDetails: JSON string
  - concept: string (optional)
  - ministersMeta: JSON string of [{name,title}, ...] aligned with ministers[] files order (title optional)
  - message: string (optional; edit instructions)

  Files:
  - backgroundImage: required — user-selected 4:5 background from Step 3ii (image bytes)
  - logos: multiple image files (0-2)
  - ministers: multiple image files
  """
  try:
    event_details_raw = request.form.get("eventDetails", "") or ""
    event_details = json.loads(event_details_raw) if event_details_raw else {}
  except Exception:
    return _json_error("Invalid eventDetails JSON", 400)

  concept = (request.form.get("concept", "") or "").strip()
  message = (request.form.get("message", "") or "").strip()
  model = (request.form.get("model", "") or "").strip() or DEFAULT_FLYER_MODEL

  try:
    ministers_meta_raw = request.form.get("ministersMeta", "") or ""
    ministers_meta = json.loads(ministers_meta_raw) if ministers_meta_raw else []
    if not isinstance(ministers_meta, list):
      ministers_meta = []
  except Exception:
    ministers_meta = []

  logos_files = request.files.getlist("logos")
  minister_files = request.files.getlist("ministers")
  minister_count = len(minister_files)

  err = validate_ministers_meta(minister_count, ministers_meta)
  if err:
    return _json_error(err, 400)

  try:
    from .templates import pick_template_image

    template_path, bucket = pick_template_image(minister_count)
    template_bytes = template_path.read_bytes()
    template_mime = _guess_mime(template_path.name)
  except Exception as e:
    return _json_error(str(e), 500)

  template_title = template_path.stem
  try:
    print(
      f"[AI][{_rid()}] /api/ai/flyer templateSelected title={template_title!r} file={template_path.name!r} bucket={bucket!r}",
      flush=True,
    )
  except Exception:
    pass

  logo_refs: list[tuple[bytes, str]] = []
  for f in logos_files:
    data = f.read()
    if data:
      logo_refs.append((data, _guess_mime(f.filename)))

  minister_refs: list[tuple[bytes, str]] = []
  for f in minister_files:
    data = f.read()
    if data:
      minister_refs.append((data, _guess_mime(f.filename)))

  bg_file = request.files.get("backgroundImage")
  if not bg_file:
    return _json_error("backgroundImage is required (the user-selected 4:5 background from Step 3ii).", 400)
  bg_bytes = bg_file.read()
  if not bg_bytes:
    return _json_error("backgroundImage is empty.", 400)
  bg_mime = _guess_mime(getattr(bg_file, "filename", "") or "") or "image/png"

  compose_inp = FlyerComposeInput(
    event_details=event_details,
    concept=concept,
    message=message,
    ministers_meta=ministers_meta,
    bg_bytes=bg_bytes,
    bg_mime=bg_mime,
    logo_refs=logo_refs,
    minister_refs=minister_refs,
    template_bytes=template_bytes,
    template_mime=template_mime,
    template_file=template_path.name,
    template_bucket=bucket,
    template_title=template_title,
    model=model,
  )
  bundle = compose_flyer_bundle(compose_inp)

  try:
    print(
      f"[AI][{_rid()}] /api/ai/flyer -> model={model} templateTitle={template_title!r} templateFile={template_path.name!r} templateBucket={bucket} bgBytes={len(bg_bytes)} logos={len(logos_files)} ministers={minister_count} messageChars={len(message)} promptPreview={_preview_text(bundle.prompt, 180)!r}",
      flush=True,
    )
  except Exception:
    pass

  return _run_flyer_compose(
    bundle,
    endpoint="/api/ai/flyer",
    template_title=template_title,
    template_file=template_path.name,
    template_bucket=bucket,
  )


@ai_bp.post("/api/ai/flyer/inpaint")
def ai_flyer_inpaint():
  """
  Masked local edit of the generated flyer (Step 5).
  multipart/form-data:
    - image: final flyer image (PNG/JPEG/WebP)
    - mask: PNG combined mask; **white = edit**, **black = preserve**
    - regionMasks: optional (2–3) — one mask per numbered edit (same order as prompts)
    - prompt: edit instructions (combined for batch edits)
    - referenceImages: optional — user attachments (flattened, all regions)
    - model: optional (defaults to AI_IMAGE_MODEL / same as other image routes; OpenAI vs Gemini from AI_PROVIDER)
  """
  prompt = (request.form.get("prompt") or "").strip()
  if not prompt:
    return _json_error("prompt is required", 400)
  if len(prompt) > 4000:
    return _json_error("prompt is too long (max 4000 characters)", 400)

  img_f = request.files.get("image")
  mask_f = request.files.get("mask")
  if not img_f or not getattr(img_f, "filename", None):
    return _json_error("image file is required", 400)
  if not mask_f or not getattr(mask_f, "filename", None):
    return _json_error("mask file is required (PNG recommended; white = areas to edit)", 400)

  image_bytes = img_f.read() or b""
  mask_bytes = mask_f.read() or b""
  if not image_bytes:
    return _json_error("image file is empty", 400)
  if not mask_bytes:
    return _json_error("mask file is empty", 400)

  reference_images: list[tuple[bytes, str]] = []
  for ref_f in request.files.getlist("referenceImages"):
    if not getattr(ref_f, "filename", None):
      continue
    ref_bytes = ref_f.read() or b""
    if ref_bytes:
      reference_images.append((ref_bytes, _guess_mime(ref_f.filename) or "image/png"))
  if len(reference_images) > 6:
    return _json_error("At most 6 referenceImages are allowed.", 400)

  region_masks: list[bytes] = []
  for rm_f in request.files.getlist("regionMasks"):
    if not getattr(rm_f, "filename", None):
      continue
    rm_bytes = rm_f.read() or b""
    if rm_bytes:
      region_masks.append(rm_bytes)
  if len(region_masks) > 3:
    return _json_error("At most 3 regionMasks are allowed.", 400)

  model = (request.form.get("model") or "").strip() or DEFAULT_IMAGE_MODEL

  t0 = time.perf_counter()
  try:
    print(
      f"[AI][{_rid()}] /api/ai/flyer/inpaint -> model={model!r} promptChars={len(prompt)} imageBytes={len(image_bytes)} maskBytes={len(mask_bytes)} regionMaskCount={len(region_masks)} refCount={len(reference_images)}",
      flush=True,
    )
  except Exception:
    pass

  try:
    images = inpaint_flyer_region_base64(
      image_bytes,
      mask_bytes,
      prompt,
      model,
      region_masks=region_masks or None,
      reference_images=reference_images or None,
      aspect_ratio="4:5",
      number_of_images=1,
    )
  except ValueError as e:
    return _json_error(str(e), 400)
  except RuntimeError as e:
    return _json_error(str(e) or "Inpainting is not available.", 503)
  except Exception as e:
    status, msg = _ai_exception_to_http(e)
    ai_logger.exception(
      json.dumps(
        {
          "type": "ai_error",
          "endpoint": "/api/ai/flyer/inpaint",
          "requestId": getattr(g, "request_id", None),
          "model": model,
          "error": str(e),
        },
        ensure_ascii=False,
      )
    )
    return _json_error(msg, status)

  t_ms = int((time.perf_counter() - t0) * 1000)
  first = images[0] if images else None
  if first:
    b64 = (first.get("base64") or "")
    try:
      print(
        f"[AI][{_rid()}] /api/ai/flyer/inpaint <- ok {t_ms}ms mimeType={first.get('mimeType')} base64Len={len(b64)}",
        flush=True,
      )
    except Exception:
      pass

  return jsonify({"model": model, "images": images})


@ai_bp.post("/api/ai/flyer/edit")
def ai_flyer_edit():
  """
  Full-flyer edit from Step 5 sidebar (no template / no Step 3ii background).
  multipart/form-data:
    - flyerImage: required — the current generated flyer
    - message: required — edit instructions
    - referenceImages: optional (0–2) — user attachments from the + button
    - model: optional
  """
  message = (request.form.get("message") or "").strip()
  if not message:
    return _json_error("message is required", 400)
  if len(message) > 4000:
    return _json_error("message is too long (max 4000 characters)", 400)

  flyer_f = request.files.get("flyerImage")
  if not flyer_f or not getattr(flyer_f, "filename", None):
    return _json_error("flyerImage is required (the current flyer to edit)", 400)

  flyer_bytes = flyer_f.read() or b""
  if not flyer_bytes:
    return _json_error("flyerImage is empty", 400)
  flyer_mime = _guess_mime(getattr(flyer_f, "filename", "") or "") or "image/png"

  reference_images: list[tuple[bytes, str]] = []
  for ref_f in request.files.getlist("referenceImages"):
    if not getattr(ref_f, "filename", None):
      continue
    ref_bytes = ref_f.read() or b""
    if ref_bytes:
      reference_images.append((ref_bytes, _guess_mime(ref_f.filename) or "image/png"))
  if len(reference_images) > 2:
    return _json_error("At most 2 referenceImages are allowed.", 400)

  model = (request.form.get("model") or "").strip() or DEFAULT_FLYER_MODEL

  t0 = time.perf_counter()
  try:
    print(
      f"[AI][{_rid()}] /api/ai/flyer/edit -> model={model!r} messageChars={len(message)} flyerBytes={len(flyer_bytes)} refCount={len(reference_images)}",
      flush=True,
    )
  except Exception:
    pass

  try:
    images = edit_flyer_base64(
      flyer_bytes,
      flyer_mime,
      message,
      model,
      reference_images=reference_images or None,
      aspect_ratio="4:5",
      number_of_images=1,
    )
  except ValueError as e:
    return _json_error(str(e), 400)
  except RuntimeError as e:
    return _json_error(str(e) or "Flyer edit is not available.", 503)
  except Exception as e:
    status, msg = _ai_exception_to_http(e)
    ai_logger.exception(
      json.dumps(
        {
          "type": "ai_error",
          "endpoint": "/api/ai/flyer/edit",
          "requestId": getattr(g, "request_id", None),
          "model": model,
          "error": str(e),
        },
        ensure_ascii=False,
      )
    )
    return _json_error(msg, status)

  t_ms = int((time.perf_counter() - t0) * 1000)
  first = images[0] if images else None
  if first:
    b64 = first.get("base64") or ""
    try:
      print(
        f"[AI][{_rid()}] /api/ai/flyer/edit <- ok {t_ms}ms mimeType={first.get('mimeType')} base64Len={len(b64)}",
        flush=True,
      )
    except Exception:
      pass

  return jsonify({"model": model, "images": images})

