import type { FlyerImage } from "@/contexts/CreateDesignContext";

export const FLYER_EDIT_MAX_W = 1024;
export const FLYER_EDIT_MIN_STROKE_LEN = 24;
export const FLYER_EDIT_SKETCH_STROKE_RATIO = 0.014;

export const FLYER_SKETCH_COLORS = [
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

function loadMaskImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load mask"));
    };
    img.src = url;
  });
}

/** Union multiple white-on-black masks into one (one API call for all regions). */
export async function mergeMaskBlobs(blobs: Blob[]): Promise<Blob | null> {
  if (!blobs.length) return null;
  if (blobs.length === 1) return blobs[0];

  const images = await Promise.all(blobs.map(loadMaskImage));
  const w = images[0].naturalWidth;
  const h = images[0].naturalHeight;

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";
  for (const img of images) {
    ctx.drawImage(img, 0, 0, w, h);
  }

  return new Promise((resolve) => out.toBlob((b) => resolve(b), "image/png", 1));
}

export type RegionBatchItem = { prompt: string; referenceImages: File[] };

/** One combined prompt + flat attachment list for a single inpaint call. */
export function buildBatchRegionPrompt(regions: RegionBatchItem[]): {
  prompt: string;
  referenceImages: File[];
} {
  const n = regions.length;
  const attachmentStart = 3 + n;

  if (n === 1) {
    const region = regions[0];
    const lines = [
      "Reference #1: current flyer. Reference #2: edit mask (white = editable zone).",
    ];
    if (region.referenceImages.length) {
      lines.push("Reference #3: user attachment for this edit.");
    }
    lines.push(
      "",
      "Apply this edit ONLY where reference image #2 is white.",
      region.referenceImages.length ? "Use reference image #3 as described below." : "",
      "",
      region.prompt.trim()
    );
    return {
      prompt: lines.filter(Boolean).join("\n"),
      referenceImages: [...region.referenceImages],
    };
  }

  const referenceImages: File[] = [];
  const lines: string[] = [
    "Apply ALL edits below in ONE pass on the current flyer.",
    "Reference #1: current flyer.",
    "Reference #2: combined mask (white = any editable zone).",
    `References #3–#${2 + n}: one mask per edit — apply each edit ONLY where its mask is white.`,
    "",
  ];

  regions.forEach((region, index) => {
    const editNum = index + 1;
    const maskRef = 3 + index;
    let attachmentLine = "";
    if (region.referenceImages.length) {
      const startIdx = attachmentStart + referenceImages.length;
      const refNums = region.referenceImages.map((_, j) => startIdx + j);
      referenceImages.push(...region.referenceImages);
      attachmentLine =
        refNums.length === 1
          ? ` Use reference image #${refNums[0]}.`
          : ` Use reference images #${refNums.join(", #")}.`;
    }
    lines.push(`Edit ${editNum} — ONLY where reference image #${maskRef} is white${attachmentLine}`);
    lines.push(region.prompt.trim());
    lines.push("");
  });

  return { prompt: lines.join("\n").trim(), referenceImages };
}
