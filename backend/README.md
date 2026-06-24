# Flask backend (local)

## Setup

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Backend runs on `http://localhost:5000`.

Optional local debug:

```bash
set FLASK_DEBUG=1
python app.py
```

## Deploy on Render (production)

Matches the pattern used in Keji (`Procfile` + `gunicorn_config.py`), but **without Eventlet** (this API has no WebSockets).

1. **Blueprint (repo root `render.yaml`)**  
   In the Render dashboard: **New → Blueprint** → connect this repo. It deploys the **Web Service** with `rootDir: backend`.

2. **Or manual Web Service**  
   - **Root directory:** `backend`  
   - **Build command:** `pip install -r requirements.txt`  
   - **Start command:** `gunicorn --config gunicorn_config.py app:app`  
   - **Health check path:** `/api/health`

3. **Environment variables** (set in Render; do not commit secrets)  
   Copy from `backend/.env.example` / your local `backend/.env`, e.g. `GEMINI_API_KEY`, `OPENAI_API_KEY`, `AI_*`, `AI_TEMPLATES_DIR` if templates live outside the repo, etc.

   **CORS:** set `CORS_ORIGINS` to the exact URL(s) where the SPA is hosted (no `*`), comma-separated — e.g. `https://your-app.vercel.app`. Match what you use in the browser (and add preview URLs if you need them). If unset locally, the backend defaults include `http://localhost:8080` (this repo’s Vite port) plus other common dev ports.

4. **Frontend**  
   Set `VITE_BACKEND_ORIGIN` to your Render service URL (e.g. `https://halorai-backend.onrender.com`) so the Vite app calls the deployed API. Keep `VITE_PUBLIC_SITE_URL` in sync with what you put in `CORS_ORIGINS` (documentation / team convention).

**Note:** Render’s filesystem is **ephemeral**. `storage/uploads`, logs, and generated indexes reset when the instance restarts unless you add a [persistent disk](https://render.com/docs/disks) and point storage under the mount path.

## Endpoints

- `GET /api/health`
- `POST /api/event-details` (JSON)
- `POST /api/uploads/logos` (multipart form-data `files`, max 2)
- `DELETE /api/uploads/logos/<id>`
- `POST /api/uploads/ministers` (multipart form-data `files`)
- `DELETE /api/uploads/ministers/<id>`
- `GET /api/test-flyer` — Photoshop UXP JSON: `template` (e.g. Template Min 1), `layers` matching PSD folders (Details, Event Name, Logo, Background, etc.) + Cloudinary URLs. `?job_id=abc` links to export upload. `?refresh=1` re-uploads.
- `POST /api/plugin/flyer-result` — **Photoshop UXP upload** finished flat PNG/JPEG/WebP (`multipart` field `file`). Returns `{ id, url, preview_page, ... }`. Share `preview_page` with the team.
- `GET /api/plugin/flyer-result/latest` — latest export (JSON).
- `GET /api/plugin/flyer-results` — recent exports list.
- `GET /api/plugin/flyer-result/<id>` — fetch one export by id.
- `GET /api/plugin/flyer-result/<id>/view` — redirect to image URL.
- `GET /plugin/preview` — simple browser page (backend) to review uploads; auto-refreshes.
- `GET /plugin/upload` — browser test form (same POST as Postman); use if Postman setup is awkward.

**Team preview (frontend):** open `/plugin-preview` on the Vercel app (set `FRONTEND_ORIGIN` on Render so upload response includes that link).
- `GET /api/ai/flyer/sample-payload` — prefilled flyer layers JSON (event details + base64 images) for Photoshop testing
- `GET /api/ai/flyer/layers.zip` — ZIP for **Photoshop plugin**: background, logos, ministers, `manifest.json` (`ministerCount`, `templateBucket`, text). No template image — PSD lives in Photoshop.
- `POST /api/ai/flyer/layers.zip` — same ZIP from a JSON body
- `GET /api/ai/flyer/json` — demo flyer layers as JSON (base64)
- `GET /uploads/<path>` serves uploaded files

