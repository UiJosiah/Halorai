import type { FlyerImage } from "@/contexts/CreateDesignContext";

export const FLYER_EDIT_MAX_W = 1024;
export const FLYER_EDIT_MIN_STROKE_LEN = 24;
export const FLYER_EDIT_SKETCH_STROKE_RATIO = 0.014;

export const FLYER_SKETCH_COLORS = [
  { id: "blue", label: "Blue", value: "hsl(210,100%,55%)" },
  { id: "pink", label: "Pink", value: "hsl(330,100%,65%)" },
  { id: "yellow", label: "Yellow", value: "hsl(45,100%,52%)" },
  { id: "green", label: "Green", value: "hsl(140,65%,42%)" },
  { id: "red", label: "Red", value: "hsl(5,85%,55%)" },
  { id: "black", label: "Black", value: "hsl(0,0%,10%)" },
  { id: "white", label: "White", value: "hsl(0,0%,100%)" },
] as const;

export const FLYER_SKETCH_DEFAULT_COLOR = FLYER_SKETCH_COLORS[0].value;

export type FlyerLayout = { w: number; h: number };
export type FlyerPoint = { x: number; y: number };
export type FlyerSketch = FlyerPoint[];

export function layoutFromImage(nw: number, nh: number): FlyerLayout | null {
  if (!nw || !nh) return null;
  const w = Math.min(FLYER_EDIT_MAX_W, nw);
  const h = Math.round((w * nh) / nw);
  return { w, h };
}

export function sketchStrokeWidth(layout: FlyerLayout): number {
  return Math.max(2, Math.round(layout.w * FLYER_EDIT_SKETCH_STROKE_RATIO));
}

export function sketchPathLength(points: FlyerSketch): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

export function isSketchValid(points: FlyerSketch): boolean {
  return points.length >= 3 && sketchPathLength(points) >= FLYER_EDIT_MIN_STROKE_LEN;
}

export function sketchBounds(points: FlyerSketch, pad: number) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    x0: minX - pad,
    y0: minY - pad,
    x1: maxX + pad,
    y1: maxY + pad,
  };
}

function drawSketchStroke(
  ctx: CanvasRenderingContext2D,
  points: FlyerSketch,
  strokeWidth: number,
  mode: "preview" | "mask",
  previewColor: string
) {
  if (points.length < 2) return;
  ctx.save();
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = mode === "mask" ? "#fff" : previewColor;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

export function sketchToMaskBlob(
  layout: FlyerLayout,
  points: FlyerSketch,
  strokeWidth: number
): Promise<Blob | null> {
  const out = document.createElement("canvas");
  out.width = layout.w;
  out.height = layout.h;
  const ctx = out.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, layout.w, layout.h);
  drawSketchStroke(ctx, points, strokeWidth, "mask", "#fff");
  return new Promise((resolve) => out.toBlob((b) => resolve(b), "image/png", 1));
}

export function cropSketchPreviewUrl(
  img: HTMLImageElement,
  layout: FlyerLayout,
  points: FlyerSketch,
  strokeWidth: number,
  size = 88
): string | null {
  const pad = Math.ceil(strokeWidth / 2) + 4;
  const raw = sketchBounds(points, pad);
  const x0 = Math.max(0, Math.floor(raw.x0));
  const y0 = Math.max(0, Math.floor(raw.y0));
  const x1 = Math.min(layout.w, Math.ceil(raw.x1));
  const y1 = Math.min(layout.h, Math.ceil(raw.y1));
  const sw = Math.max(1, x1 - x0);
  const sh = Math.max(1, y1 - y0);

  const src = document.createElement("canvas");
  src.width = layout.w;
  src.height = layout.h;
  const sctx = src.getContext("2d");
  if (!sctx) return null;
  sctx.drawImage(img, 0, 0, layout.w, layout.h);

  const thumb = document.createElement("canvas");
  thumb.width = size;
  thumb.height = size;
  const tctx = thumb.getContext("2d");
  if (!tctx) return null;
  tctx.drawImage(src, x0, y0, sw, sh, 0, 0, size, size);
  return thumb.toDataURL("image/png");
}

export function drawSketchPreview(
  ctx: CanvasRenderingContext2D,
  layout: FlyerLayout,
  points: FlyerSketch,
  strokeWidth: number,
  previewColor: string
) {
  ctx.clearRect(0, 0, layout.w, layout.h);
  drawSketchStroke(ctx, points, strokeWidth, "preview", previewColor);
}

export async function flyerImageToPngBlob(img: FlyerImage): Promise<Blob> {
  const binary = atob(img.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: img.mimeType || "image/png" });
}
