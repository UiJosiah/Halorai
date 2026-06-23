"""
Flyer composition helpers — shared by multipart and JSON API routes.
"""
from __future__ import annotations

import base64
import io
import json
import os
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from .templates import MAX_MINISTERS, pick_template_image


def guess_mime(filename: str) -> str:
  ext = os.path.splitext(filename or "")[1].lower()
  if ext in [".jpg", ".jpeg"]:
    return "image/jpeg"
  if ext == ".png":
    return "image/png"
  if ext == ".webp":
    return "image/webp"
  return "application/octet-stream"


def encode_image_bytes(data: bytes, mime: str, filename: str = "") -> dict[str, str]:
  return {
    "mimeType": mime or "application/octet-stream",
    "base64": base64.b64encode(data).decode("ascii"),
    **({"filename": filename} if filename else {}),
  }


def encode_image_file(path: Path) -> dict[str, str]:
  data = path.read_bytes()
  return encode_image_bytes(data, guess_mime(path.name), path.name)


def decode_image_payload(item: Any, *, field_name: str) -> tuple[bytes, str]:
  if item is None:
    raise ValueError(
      f"{field_name} is required (object with mimeType and base64). "
      "GET /api/ai/flyer/sample-payload or POST { \"useSamplePayload\": true }."
    )
  if not isinstance(item, dict):
    raise ValueError(f"{field_name} must be an object with mimeType and base64, not {type(item).__name__}")
  b64 = (item.get("base64") or "").strip()
  if not b64:
    raise ValueError(f"{field_name}.base64 is required")
  try:
    data = base64.b64decode(b64, validate=False)
  except Exception as e:
    raise ValueError(f"{field_name}.base64 is invalid") from e
  if not data:
    raise ValueError(f"{field_name}.base64 is empty")
  mime = (item.get("mimeType") or item.get("mime") or "").strip()
  if not mime:
    filename = (item.get("filename") or item.get("name") or "").strip()
    mime = guess_mime(filename) if filename else "image/png"
  return data, mime


@dataclass
class FlyerComposeBundle:
  prompt: str
  refs: list[tuple[bytes, str]]
  template_bucket: str
  template_file: str
  template_title: str
  minister_count: int
  model: str


@dataclass
class FlyerComposeInput:
  event_details: dict
  concept: str
  message: str
  ministers_meta: list
  bg_bytes: bytes
  bg_mime: str
  logo_refs: list[tuple[bytes, str]]
  minister_refs: list[tuple[bytes, str]]
  template_bytes: bytes
  template_mime: str
  template_file: str
  template_bucket: str
  template_title: str
  model: str


def validate_ministers_meta(minister_count: int, ministers_meta: list) -> Optional[str]:
  if minister_count > MAX_MINISTERS:
    return f"Too many ministers. Max allowed is {MAX_MINISTERS}."
  if minister_count > 0:
    if not isinstance(ministers_meta, list) or len(ministers_meta) != minister_count:
      return "ministersMeta must include one entry per minister image."
    for i, meta in enumerate(ministers_meta):
      if not isinstance(meta, dict):
        return f"Invalid ministersMeta at index {i}."
  return None


def build_flyer_prompt(
  *,
  event_details: dict,
  concept: str,
  message: str,
  ministers_meta: list,
  minister_count: int,
  logo_refs: list[tuple[bytes, str]],
  minister_refs: list[tuple[bytes, str]],
) -> str:
  church = (event_details.get("churchName") or "").strip()
  event_name = (event_details.get("eventName") or "").strip()
  theme = (event_details.get("theme") or "").strip()
  date = (event_details.get("date") or "").strip()
  event_time = (event_details.get("time") or "").strip()
  venue = (event_details.get("venue") or "").strip()
  other = (event_details.get("otherInfo") or "").strip()

  n_logos = len(logo_refs)
  n_minister_imgs = len(minister_refs)

  ref_order_lines: list[str] = [
    "REFERENCE IMAGE ORDER (STRICT — DO NOT MIX OR SWAP):",
    "The model receives reference images in this exact 1-based order. Each index maps to exactly one use.",
    "",
    "- Reference image #1: USER-SELECTED BACKGROUND (4:5 portrait, same as Instagram portrait).",
    "  This is the real flyer background artwork. Preserve its scene, colors, lighting, and mood.",
    "  Do NOT replace it with a newly invented background. Do NOT paste the template (image #2) over it as the scene.",
    "  Composite all text, logos, and minister portraits ON TOP of this background only.",
    "",
    "- Reference image #2: FLYER TEMPLATE — layout, typography, and TEXT-EFFECT style guide ONLY.",
    "  Use it to learn where text blocks, logo areas, and minister photo frames are placed.",
    "  Study EVERY text element in the template as its own design unit: each block often has a DIFFERENT color, size, weight, and effect stack from the others.",
    "  Do NOT unify all flyer text into one color or one font treatment — copy each slot’s individual look from the template.",
    "  Render USER CONTENT using the SAME per-slot text effects as the matching template blocks — never as plain, flat, or boring default typography.",
    "  Do NOT use the template as the final background. Remove template placeholder faces and template sample wording from the final output (replace with USER CONTENT in the same per-slot styles).",
    "  Align your layers with image #1 so placements match the template’s structure.",
    "",
    "CRITICAL — DO NOT CONFUSE LOGOS WITH PEOPLE:",
    "- Logo reference images are brand marks (symbols/text marks). They are NOT faces and NOT ministers.",
    "- Minister reference images are photos of people. They are NOT logos.",
    "- Never place a logo image inside a minister/person frame.",
    "- Never place a minister photo where a logo belongs.",
    "",
  ]

  for j in range(n_logos):
    idx = 3 + j
    ref_order_lines.append(
      f"- Reference image #{idx}: LOGO #{j + 1} — organization/church logo graphic ONLY. "
      "Not a person. Not a minister. Use only as a small brand mark where the template has logo space."
    )

  minister_base_idx = 3 + n_logos
  ministers_lines: list[str] = []
  for k in range(minister_count):
    meta = ministers_meta[k] if k < len(ministers_meta) and isinstance(ministers_meta[k], dict) else {}
    name = (meta.get("name") or "").strip()
    title = (meta.get("title") or "").strip()
    ref_idx = minister_base_idx + k
    role_line = f"Reference image #{ref_idx} = MINISTER PHOTO for slot #{k + 1} ONLY."
    if title and name:
      ministers_lines.append(f'- Slot {k + 1} ({role_line}): {name} — role/title on flyer: "{title}"')
    elif title:
      ministers_lines.append(f'- Slot {k + 1} ({role_line}): role/title on flyer: "{title}"')
    elif name:
      ministers_lines.append(f"- Slot {k + 1} ({role_line}): {name}")
    else:
      ministers_lines.append(
        f"- Slot {k + 1} ({role_line}): use minister photo only (no name or title text on flyer unless the template implies it)."
      )

    if k < n_minister_imgs:
      ref_order_lines.append(
        f"- Reference image #{ref_idx}: MINISTER PHOTO #{k + 1} ONLY — minister slot #{k + 1} on the template."
        + (f' This face/body MUST be labeled on the flyer as: "{title}"' if title else "")
        + (f' (name if shown: "{name}")' if name else "")
        + ". Use ONLY this file for this slot — never for another slot, never as a logo."
      )

  if n_minister_imgs == 1:
    minister_slot_summary = (
      f"- Follow REFERENCE IMAGE ORDER: the only minister photo is reference image #{minister_base_idx} — use it for minister slot 1 only."
    )
  elif n_minister_imgs > 1:
    minister_slot_summary = (
      f"- Follow REFERENCE IMAGE ORDER: minister slots 1–{n_minister_imgs} map to reference images "
      f"#{minister_base_idx}–#{minister_base_idx + n_minister_imgs - 1} in upload order (one slot per image, no swaps)."
    )
  else:
    minister_slot_summary = "- No minister photo references were uploaded."

  minister_photo_sizing_block: list[str] = []
  if n_minister_imgs > 0:
    minister_photo_sizing_block = [
      "",
      "MINISTER PHOTO SIZE ON THE FLYER (BACKGROUND #1 ONLY — DOES NOT APPLY TO LOGOS):",
      f"- There are {n_minister_imgs} minister photo(s). The **combined visible area** of all minister portraits (after cutout, on top of the background) should be about **30–40% of the full 4:5 canvas** so faces are never tiny.",
      "- **Fewer ministers ⇒ each portrait larger:** with one minister, that single figure should use most of that ~35% band (one bold presence). With two or three, split that band across them so **each face stays large and readable** — do not shrink ministers to leave empty canvas.",
      "- Logos are **excluded** from this rule: keep logos as **small** marks in their template logo zones only. Do **not** steal size from ministers to enlarge logos.",
    ]

  logo_scale_note: list[str] = []
  if n_logos > 0:
    logo_scale_note = [
      "",
      "LOGO SCALE (SEPARATE FROM MINISTERS):",
      "- Logos stay **small** crisp brand marks where the template shows logo space. The ~35% footprint rule above applies **only** to minister photos.",
    ]

  multi_minister_block: list[str] = []
  if n_minister_imgs > 1:
    multi_minister_block = [
      "",
      "MULTIPLE MINISTERS — FOLLOW TEMPLATE #2 GEOMETRY ONLY (NOT FOR LOGOS):",
      "- Look at the **people / minister placeholder frames** in reference #2. On background #1, reproduce their **left-to-right order, horizontal spacing between adjacent frames, vertical alignment, and the overall width of the minister band** as closely as the composition allows.",
      "- Ministers must read as **one cluster** in the same arrangement as the template — **not** pushed toward unrelated far corners and **not** with gaps wider than the template suggests between faces.",
      "- If the template shows three heads close together, keep your three uploads **similarly close**; do not spread them across the flyer.",
      "- This cluster / spacing rule applies **only** to minister portraits. **Do not** use it for logos — logos use only their own template slots, separate from the minister group.",
    ]

  prompt_lines = [
    "Flyer Builder Prompt",
    "",
    "You are compositing a finished church/event flyer.",
    "You are NOT asked to invent a new background scene.",
    "",
    "GOAL:",
    "Start from the user’s chosen background (reference #1).",
    "Use the template (reference #2) only as a map for where to place text, logos, and minister photos.",
    "Output one 4:5 portrait flyer (same aspect ratio as reference #1) that keeps the background artwork and adds correct event details and assets.",
    "",
    "INPUTS:",
    "- Event details (title, date, time, venue, theme, other info)",
    "- Reference images (exact order — see next section)",
    "- Optional creative notes (if provided)",
    "",
    *ref_order_lines,
    "",
    "CORE RULE:",
    "Image #1 is the canvas. Image #2 defines placement, typography, and text-effect styling only.",
    "Do not replace image #1 with a different scene. Do not output the template image as the background.",
    "Do not render user text as plain flat type — always inherit the template’s text effects for each slot.",
    "",
    "----------------------------------",
    "",
    "WHAT TO PRESERVE (STRICT):",
    "- The background from reference #1 (scene, palette, lighting, atmosphere).",
    "- Overall 4:5 framing (match reference #1 width-to-height).",
    "",
    "----------------------------------",
    "",
    "WHAT TO ADD / REPLACE:",
    "",
    "1. Typography and text effects (from template #2)",
    "- Reference #2 is the source of truth for how text should LOOK — not just where it sits.",
    "- PER-SLOT RULE (STRICT): Treat each text block in the template as a separate style recipe. For each USER CONTENT field, find the closest matching template block and copy that block’s FULL visual treatment: font feel, weight, **exact color or gradient**, relative **size**, glow, outer glow, drop shadow, stroke/outline, gradient fill, texture, 3D/extrusion, bevel, metallic shine, emboss, or any decorative effect visible on that template sample text.",
    "- VARIETY IS REQUIRED: Templates almost always use **different colors and sizes** across headline, subhead, date, time, venue, and labels. Reproduce that variety — do NOT paint every text field the same color, same size, or same effect stack.",
    "- FORBIDDEN: one global text color for the whole flyer; one uniform font size for all lines; plain white/black flat text; generic system fonts; or unstyled body copy — unless that exact slot in the template is intentionally minimal.",
    "- Swap only the words to USER CONTENT (spell exactly); keep each slot’s template color, size relationship, effects, and placement.",
    "",
    "CONTENT ↔ TEMPLATE SLOT MAPPING (STRICT — hierarchy + per-slot styling):",
    "- THEME → template’s dominant primary headline slot: **largest size**, strongest effects, most visual weight in reference #2.",
    "- EVENT NAME → template’s secondary headline / subhead slot: clearly **smaller and less dominant** than the theme slot; use that slot’s **own color and effects** (often different from the theme color). Never outrank the theme.",
    "- CHURCH / MINISTRY → template organization / church-name slot (if present): use that slot’s size and color — not the theme or event-name styles.",
    "- DATE, TIME, VENUE → each maps to its own supporting-detail slot(s) in the template; copy **each slot’s distinct size and color** (date is not required to match venue color).",
    "- MINISTER NAMES / TITLES → template people-label slots only; inherit those label styles separately from headline text.",
    "- If the template has fewer visible slots than USER CONTENT fields, split supporting details using the template’s smallest detail styles — still with **varied colors/sizes** as the template shows, not one shared style.",
    "",
    "- Spell every USER CONTENT string exactly as given (no paraphrasing, no spelling changes).",
    "- Ensure effects remain readable on top of background #1 (adjust glow/shadow strength if needed, but keep the same effect **type and color family** as the template slot).",
    "",
    "2. Minister photos",
    minister_slot_summary,
    "- Do NOT invent faces. Do NOT merge faces. Do NOT swap ministers between slots.",
    "- Place each minister photo in the region suggested by the template (#2), scaled and cropped to fit image #1.",
    "- Minister photos from uploads are source-of-truth pixels: do NOT regenerate/redraw a new person. Allowed edits: remove background, cut out subject, and crop excess only to fit the target frame.",
    "- Remove any template placeholder faces; use only the provided minister reference images.",
    *multi_minister_block,
    *minister_photo_sizing_block,
    "",
    "3. Logos (if provided)",
    *(
      [
        f"- Logos are reference images #{3} through #{2 + n_logos} (after background #1 and template #2).",
        "- Place each logo only where the template implies a brand mark, at sensible scale, with crisp edges.",
        "LOGO FILES FROM THE USER ARE FINAL — DO NOT EDIT THE ARTWORK:",
        "- Do not redraw, re-vectorize, simplify, stylize, recolor, add outlines, glows, shadows inside the mark, or replace the file with a newly invented version.",
        "- Do not crop away meaningful parts of the logo or change any letter, symbol, or embedded text inside the uploaded logo pixels.",
        "- Allowed: position, uniform scale, and at most a small rotation to align with the template slot — nothing that alters the artwork itself.",
        "- If a logo already shows the ministry/church/organization name inside the graphic, that satisfies the organization identity on the flyer: do NOT add a separate large headline that repeats the same ministry name (avoid redundant duplicate naming).",
      ]
      if n_logos > 0
      else ["- No logo reference images were uploaded."]
    ),
    *logo_scale_note,
    "",
    "----------------------------------",
    "",
    "CONSISTENCY RULE:",
    "Text, logos, and faces should feel integrated with the lighting and color of background #1.",
    "",
    "----------------------------------",
    "",
    "STRICT RULES:",
    "- Do NOT generate a wholly new unrelated background.",
    "- Do NOT add text that is not from USER CONTENT or minister labels below.",
    "- Do NOT add any person, icon, logo, shape, sticker, or decorative image that was not uploaded by the user in this request.",
    "- Do NOT leave template sample text or placeholder faces visible.",
    "- Do NOT add watermarks.",
    "- Do NOT regenerate uploaded logo/minister assets as new artwork. Use the uploaded files only (logos unedited; ministers may only be cut out/background-removed/cropped to fit).",
    "- Do NOT modify, re-draw, or re-type any pixels inside uploaded logo images (see LOGO FILES section).",
    "- Do NOT let the event name outrank the theme in typographic prominence — theme stays primary.",
    "- Do NOT render all USER CONTENT in one shared color or one shared font size — each field must inherit its matching template slot’s color and size.",
    "- Do NOT render USER CONTENT as boring flat text when the template shows stylized/effected type for that role.",
    "",
    "----------------------------------",
    "",
    "VALIDATION BEFORE OUTPUT:",
    "- Background still matches reference #1’s scene (not swapped for template art).",
    "- All USER CONTENT text is present and spelled exactly as given; no extra text strings are introduced.",
    "- Minister photos used in correct slots; **minister group** footprint roughly **~35%** of canvas (logos small, separate).",
    "- With 2+ ministers: spacing and band match template #2’s people frames (clustered, not overspread).",
    "- No newly generated people/logos/decorative assets were introduced beyond uploaded references.",
    "- Theme reads visually stronger than the event name; logos match uploaded pixels (unedited).",
    "- Text uses **per-slot** template styling: varied colors and sizes across fields as in reference #2 — not one uniform color/size for all text.",
    "- User text uses the template’s text effects (glow, gradient, 3D, stroke, etc.) — not plain default typography.",
    "",
    "If any rule fails, regenerate correctly.",
    "",
    "PRIORITY:",
    "1. Preserve user background #1",
    "2. Match template #2 placement for details",
    "3. Exact user text and correct assets",
    "4. Polish integration (shadows, readability)",
    "",
    "OUTPUT:",
    "- Single clean flyer image, aspect ratio 4:5 (must match reference #1).",
    "",
    "----------------------------------",
    "",
    "USER CONTENT (use exactly):",
    f"- Church/Ministry: {church}" if church else None,
    f"- Event name: {event_name}" if event_name else None,
    f"- Theme: {theme}" if theme else None,
    f"- Date: {date}" if date else None,
    f"- Time: {event_time}" if event_time else None,
    f"- Venue: {venue}" if venue else None,
    f"- Other info: {other}" if other else None,
    "",
    "Ministers (slot → reference image → text on flyer):",
    *ministers_lines,
    "",
    f"Optional creative / tone notes (do not replace the background): {concept}" if concept else None,
    "",
    message and f"Edit instructions (only if provided): {message}",
  ]
  return "\n".join([l for l in prompt_lines if isinstance(l, str) and l.strip()])


def compose_flyer_bundle(inp: FlyerComposeInput) -> FlyerComposeBundle:
  minister_count = len(inp.minister_refs)
  prompt = build_flyer_prompt(
    event_details=inp.event_details,
    concept=inp.concept,
    message=inp.message,
    ministers_meta=inp.ministers_meta,
    minister_count=minister_count,
    logo_refs=inp.logo_refs,
    minister_refs=inp.minister_refs,
  )
  refs: list[tuple[bytes, str]] = [
    (inp.bg_bytes, inp.bg_mime),
    (inp.template_bytes, inp.template_mime),
    *inp.logo_refs,
    *inp.minister_refs,
  ]
  return FlyerComposeBundle(
    prompt=prompt,
    refs=refs,
    template_bucket=inp.template_bucket,
    template_file=inp.template_file,
    template_title=inp.template_title,
    minister_count=minister_count,
    model=inp.model,
  )


def plugin_assets_json(inp: FlyerComposeInput) -> dict[str, Any]:
  """Images for Photoshop plugin — background, logos, ministers only (no template image)."""
  logos = [
    encode_image_bytes(data, mime, f"logo-{i}.png")
    for i, (data, mime) in enumerate(inp.logo_refs, start=1)
  ]
  ministers = [
    encode_image_bytes(data, mime, f"minister-{i}.png")
    for i, (data, mime) in enumerate(inp.minister_refs, start=1)
  ]
  return {
    "backgroundImage": encode_image_bytes(inp.bg_bytes, inp.bg_mime, "background"),
    "logos": logos,
    "ministers": ministers,
  }


def flyer_plugin_json(inp: FlyerComposeInput) -> dict[str, Any]:
  """
  Photoshop plugin handoff — PSD template already lives in PS.
  ministerCount + templateBucket tell the plugin which PSD folder/layout to use.
  """
  minister_count = len(inp.minister_refs)
  return {
    "ministerCount": minister_count,
    "templateBucket": inp.template_bucket,
    "aspectRatio": "4:5",
    "eventDetails": inp.event_details,
    "ministersMeta": inp.ministers_meta,
    **plugin_assets_json(inp),
  }


def build_flyer_plugin_manifest(inp: FlyerComposeInput, *, filenames: dict[str, Any]) -> dict[str, Any]:
  return {
    "version": 1,
    "ministerCount": len(inp.minister_refs),
    "templateBucket": inp.template_bucket,
    "aspectRatio": "4:5",
    "eventDetails": inp.event_details,
    "ministersMeta": inp.ministers_meta,
    "files": filenames,
  }


def reference_images_for_json(
  inp: FlyerComposeInput,
) -> list[dict[str, Any]]:
  """Reference images in AI order (#1 background, #2 template, logos, ministers)."""
  out: list[dict[str, Any]] = [
    {**encode_image_bytes(inp.bg_bytes, inp.bg_mime, "background"), "role": "background", "index": 1},
    {
      **encode_image_bytes(inp.template_bytes, inp.template_mime, inp.template_file),
      "role": "template",
      "index": 2,
    },
  ]
  idx = 3
  for i, (data, mime) in enumerate(inp.logo_refs, start=1):
    out.append({**encode_image_bytes(data, mime, f"logo-{i}.png"), "role": "logo", "index": idx})
    idx += 1
  for i, (data, mime) in enumerate(inp.minister_refs, start=1):
    out.append({**encode_image_bytes(data, mime, f"minister-{i}.png"), "role": "minister", "index": idx})
    idx += 1
  return out


def flyer_input_to_request_json(inp: FlyerComposeInput) -> dict[str, Any]:
  body: dict[str, Any] = {
    "ministerCount": len(inp.minister_refs),
    "templateBucket": inp.template_bucket,
    "eventDetails": inp.event_details,
    "ministersMeta": inp.ministers_meta,
    "aspectRatio": "4:5",
    **plugin_assets_json(inp),
  }
  if inp.concept:
    body["concept"] = inp.concept
  return body


def flyer_layers_json(inp: FlyerComposeInput) -> dict[str, Any]:
  """Alias for Photoshop plugin JSON (no template image)."""
  return flyer_plugin_json(inp)


def normalize_flyer_json_body(payload: dict[str, Any], *, default_model: str) -> dict[str, Any]:
  """
  Accept several caller shapes:
  - Direct compose body (backgroundImage at top level)
  - Sample response wrapper: { request: { ... } }
  - Shortcut: { useSamplePayload: true } fills from bundled demo assets
  """
  if not isinstance(payload, dict):
    return payload

  if payload.get("useSamplePayload") or payload.get("useSample"):
    sample = build_sample_flyer_json_payload()
    body = dict(sample["request"])
    for key in ("concept", "eventDetails", "ministersMeta"):
      if key in payload and payload[key] is not None:
        body[key] = payload[key]
    return body

  req = payload.get("request")
  if isinstance(req, dict) and isinstance(req.get("backgroundImage"), dict):
    body = dict(req)
    for key in ("concept", "eventDetails", "ministersMeta"):
      if key in payload and payload[key] is not None:
        body[key] = payload[key]
    return body

  layers = payload.get("payload")
  if isinstance(layers, dict) and isinstance(layers.get("referenceImages"), list):
    return normalize_flyer_json_body(layers, default_model=default_model)

  # Full layers response from GET sample-payload
  if isinstance(payload.get("referenceImages"), list) and isinstance(payload.get("backgroundImage"), dict):
    return payload
  if isinstance(payload.get("referenceImages"), list) and isinstance(payload.get("eventDetails"), dict):
    layers = dict(payload)
    bg = None
    for ref in payload.get("referenceImages") or []:
      if isinstance(ref, dict) and ref.get("role") == "background":
        bg = {"mimeType": ref.get("mimeType"), "base64": ref.get("base64"), "filename": ref.get("filename")}
        break
    if bg and bg.get("base64"):
      layers["backgroundImage"] = bg
    logos = []
    ministers = []
    for ref in payload.get("referenceImages") or []:
      if not isinstance(ref, dict):
        continue
      item = {"mimeType": ref.get("mimeType"), "base64": ref.get("base64"), "filename": ref.get("filename")}
      if ref.get("role") == "logo":
        logos.append(item)
      elif ref.get("role") == "minister":
        ministers.append(item)
    if logos:
      layers["logos"] = logos
    if ministers:
      layers["ministers"] = ministers
    tpl = payload.get("template")
    if isinstance(tpl, dict) and tpl.get("base64"):
      layers["template"] = tpl
    return layers

  return payload


def parse_flyer_json_payload(payload: dict[str, Any], *, default_model: str) -> tuple[Optional[FlyerComposeInput], Optional[str]]:
  if not isinstance(payload, dict):
    return None, "JSON body must be an object"

  event_details = payload.get("eventDetails") or {}
  if not isinstance(event_details, dict):
    return None, "eventDetails must be an object"

  concept = (payload.get("concept") or "").strip()
  message = (payload.get("message") or "").strip()
  model = (payload.get("model") or "").strip() or default_model

  ministers_meta = payload.get("ministersMeta") or []
  if not isinstance(ministers_meta, list):
    return None, "ministersMeta must be an array"

  try:
    bg_bytes, bg_mime = decode_image_payload(payload.get("backgroundImage"), field_name="backgroundImage")
  except ValueError as e:
    return None, str(e)

  logo_refs: list[tuple[bytes, str]] = []
  logos_raw = payload.get("logos") or []
  if logos_raw and not isinstance(logos_raw, list):
    return None, "logos must be an array"
  for i, item in enumerate(logos_raw):
    try:
      logo_refs.append(decode_image_payload(item, field_name=f"logos[{i}]"))
    except ValueError as e:
      return None, str(e)

  minister_refs: list[tuple[bytes, str]] = []
  ministers_raw = payload.get("ministers") or []
  if ministers_raw and not isinstance(ministers_raw, list):
    return None, "ministers must be an array"
  for i, item in enumerate(ministers_raw):
    try:
      minister_refs.append(decode_image_payload(item, field_name=f"ministers[{i}]"))
    except ValueError as e:
      return None, str(e)

  minister_count = len(minister_refs)
  err = validate_ministers_meta(minister_count, ministers_meta)
  if err:
    return None, err

  template_payload = payload.get("template")
  try:
    if isinstance(template_payload, dict) and (template_payload.get("base64") or "").strip():
      template_bytes, template_mime = decode_image_payload(template_payload, field_name="template")
      template_file = (template_payload.get("filename") or template_payload.get("file") or "template.jpg").strip()
      template_bucket = (template_payload.get("bucket") or "").strip() or "custom"
      template_title = (template_payload.get("title") or Path(template_file).stem).strip()
    else:
      template_path, bucket = pick_template_image(minister_count)
      template_bytes = template_path.read_bytes()
      template_mime = guess_mime(template_path.name)
      template_file = template_path.name
      template_bucket = bucket
      template_title = template_path.stem
  except Exception as e:
    return None, str(e)

  return (
    FlyerComposeInput(
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
      template_file=template_file,
      template_bucket=template_bucket,
      template_title=template_title,
      model=model,
    ),
    None,
  )


def _repo_public_dir() -> Path:
  backend_root = Path(__file__).resolve().parents[1]
  return backend_root.parent / "public"


def _sample_template_for_ministers(minister_count: int) -> tuple[Path, str]:
  backend_root = Path(__file__).resolve().parents[1]
  if minister_count <= 0:
    bucket = "0-minister"
  elif minister_count == 1:
    bucket = "1-minister"
  else:
    bucket = f"{min(minister_count, MAX_MINISTERS)}-ministers"
  folder = backend_root / "Templates By Pic" / bucket
  if not folder.exists():
    template_path, bucket = pick_template_image(minister_count)
    return template_path, bucket
  candidates = sorted(
    [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}],
    key=lambda p: p.name.lower(),
  )
  if not candidates:
    template_path, bucket = pick_template_image(minister_count)
    return template_path, bucket
  return candidates[0], bucket


def mime_to_ext(mime: str) -> str:
  m = (mime or "").lower()
  if "jpeg" in m or "jpg" in m:
    return ".jpg"
  if "webp" in m:
    return ".webp"
  return ".png"


def build_flyer_layers_zip(inp: FlyerComposeInput) -> bytes:
  """ZIP for Photoshop plugin — background, logos, ministers, text manifest (no template image)."""
  buf = io.BytesIO()
  bg_name = f"01-background{mime_to_ext(inp.bg_mime)}"
  logo_names: list[str] = []
  minister_names: list[str] = []

  readme = "\n".join(
    [
      "Halorai → Photoshop plugin handoff",
      "===================================",
      "",
      f"ministerCount: {len(inp.minister_refs)}",
      f"templateBucket: {inp.template_bucket}",
      "(Open the matching PSD template already installed in Photoshop.)",
      "",
      "Files:",
      f"  {bg_name}              — replace BACKGROUND layer",
      "  NN-logo-*                — replace logo slot(s)",
      "  NN-minister-*            — replace minister portrait(s)",
      "",
      "manifest.json            — ministerCount, templateBucket, eventDetails, ministersMeta, file names",
      "",
      "Text fields in eventDetails → map to your named text layers in the PSD.",
    ]
  )

  with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
    zf.writestr(bg_name, inp.bg_bytes)

    idx = 2
    for i, (data, mime) in enumerate(inp.logo_refs, start=1):
      name = f"{idx:02d}-logo-{i}{mime_to_ext(mime)}"
      zf.writestr(name, data)
      logo_names.append(name)
      idx += 1

    for i, (data, mime) in enumerate(inp.minister_refs, start=1):
      name = f"{idx:02d}-minister-{i}{mime_to_ext(mime)}"
      zf.writestr(name, data)
      minister_names.append(name)
      idx += 1

    manifest = build_flyer_plugin_manifest(
      inp,
      filenames={
        "background": bg_name,
        "logos": logo_names,
        "ministers": minister_names,
      },
    )
    zf.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False))
    zf.writestr("README.txt", readme)

  return buf.getvalue()


def build_sample_flyer_input() -> FlyerComposeInput:
  """Bundled demo assets for testing / Photoshop handoff."""
  public = _repo_public_dir()
  bg_path = public / "Halorai Dev" / "Images" / "Easter retreat.png"
  logo_path = public / "Halorai Dev" / "Images" / "Ellipse 1.png"
  minister_path = public / "Halorai Dev" / "Images" / "user avatar.png"

  ministers_meta = [
    {"name": "Pastor K", "title": "Guest Minister"},
    {"name": "Pastor Ayo", "title": "Worship Leader"},
  ]

  template_path, bucket = _sample_template_for_ministers(len(ministers_meta))
  template_bytes = template_path.read_bytes()
  template_mime = guess_mime(template_path.name)

  bg = encode_image_file(bg_path)
  logo = encode_image_file(logo_path)
  minister_img = encode_image_file(minister_path)

  return FlyerComposeInput(
    event_details={
      "churchName": "St Albert Chaplaincy",
      "eventName": "Annual Music Revival",
      "theme": "MUSIC REVIVAL",
      "date": "Sunday, 14 December 2025",
      "time": "4:00 PM",
      "venue": "Main Auditorium, St Albert Chaplaincy",
      "otherInfo": "Free entry. Come expecting a move of God.",
    },
    concept="Cinematic fire and light rays over the background; warm gold accents matching the revival theme.",
    message="",
    ministers_meta=ministers_meta,
    bg_bytes=base64.b64decode(bg["base64"]),
    bg_mime=bg["mimeType"],
    logo_refs=[(base64.b64decode(logo["base64"]), logo["mimeType"])],
    minister_refs=[
      (base64.b64decode(minister_img["base64"]), minister_img["mimeType"]),
      (base64.b64decode(minister_img["base64"]), minister_img["mimeType"]),
    ],
    template_bytes=template_bytes,
    template_mime=template_mime,
    template_file=template_path.name,
    template_bucket=bucket,
    template_title=template_path.stem,
    model="",
  )


def build_sample_flyer_json_payload() -> dict[str, Any]:
  """
  Prefilled flyer layer bundle for Photoshop / external compositor testing.
  """
  inp = build_sample_flyer_input()

  layers = flyer_plugin_json(inp)
  request_body = flyer_input_to_request_json(inp)

  return {
    "description": "Photoshop plugin handoff. ministerCount + templateBucket select the PSD; ZIP has background, logos, ministers, manifest.json.",
    "request": request_body,
    "payload": layers,
  }
