import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { FlyerImage } from "@/contexts/CreateDesignContext";
import { aiFlyerInpaint } from "@/lib/api";

const MAX_EXPORT_W = 1024;
const MASK_UNDO_CAP = 24;
const MIN_BRUSH = 8;
const MAX_BRUSH = 80;

/** Build PNG mask: white = edit (where overlay brush alpha is visible), black = preserve */
function overlayToBinaryMaskPng(overlayCanvas: HTMLCanvasElement, w: number, h: number): Promise<Blob | null> {
  const src = overlayCanvas.getContext("2d");
  if (!src) return Promise.resolve(null);
  const im = src.getImageData(0, 0, w, h);
  const d = im.data;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d");
  if (!octx) return Promise.resolve(null);
  const outIm = octx.createImageData(w, h);
  const od = outIm.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
    const edit = (a > 22 || (a > 6 && lum > 100)) ? 255 : 0;
    od[i] = edit;
    od[i + 1] = edit;
    od[i + 2] = edit;
    od[i + 3] = 255;
  }
  octx.putImageData(outIm, 0, 0);
  return new Promise((resolve) => out.toBlob((b) => resolve(b), "image/png", 1));
}

type Props = {
  flyerImage: FlyerImage;
  resetKey: string;
  setFlyerImage: Dispatch<SetStateAction<FlyerImage | null>>;
};

/**
 * Canvas overlay editor (no Fabric bundle): translucent white brush marks edit regions;
 * flyer stays visible underneath. Export sends flyer + binary mask + prompt to backend.
 */
export default function FlyerInpaintEditor({ flyerImage, resetKey, setFlyerImage }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const exportFlyerRef = useRef<HTMLCanvasElement | null>(null);

  const [layout, setLayout] = useState<{ w: number; h: number } | null>(null);
  const [brushPx, setBrushPx] = useState(28);
  const [inpaintPrompt, setInpaintPrompt] = useState("");
  const [isInpainting, setIsInpainting] = useState(false);
  const [err, setErr] = useState("");
  const [inpaintUndoCount, setInpaintUndoCount] = useState(0);

  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const maskUndo = useRef<ImageData[]>([]);
  const flyerAfterInpaintUndo = useRef<FlyerImage[]>([]);

  const dataUrl = `data:${flyerImage.mimeType};base64,${flyerImage.base64}`;

  const pushMaskUndo = useCallback(() => {
    const c = overlayRef.current;
    if (!c || !layout) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, layout.w, layout.h);
    maskUndo.current.push(snap);
    if (maskUndo.current.length > MASK_UNDO_CAP) maskUndo.current.shift();
  }, [layout]);

  const clearOverlay = useCallback(() => {
    const c = overlayRef.current;
    if (!c || !layout) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, layout.w, layout.h);
  }, [layout]);

  const initOverlay = useCallback(() => {
    clearOverlay();
    maskUndo.current = [];
    pushMaskUndo();
  }, [clearOverlay, pushMaskUndo]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setErr("");
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      if (!nw || !nh) return;
      const w = Math.min(MAX_EXPORT_W, nw);
      const h = Math.round((w * nh) / nw);
      setLayout({ w, h });
    };
    img.onerror = () => setErr("Could not load flyer image for editor.");
    img.src = dataUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyerImage.base64, flyerImage.mimeType, resetKey]);

  useEffect(() => {
    flyerAfterInpaintUndo.current = [];
    setInpaintUndoCount(0);
  }, [resetKey]);

  useEffect(() => {
    if (!layout) return;
    const t = window.requestAnimationFrame(() => initOverlay());
    return () => window.cancelAnimationFrame(t);
  }, [layout, resetKey, initOverlay]);

  const undoMaskStroke = useCallback(() => {
    const c = overlayRef.current;
    if (!c || !layout || maskUndo.current.length < 2) return;
    maskUndo.current.pop();
    const prev = maskUndo.current[maskUndo.current.length - 1];
    const ctx = c.getContext("2d");
    if (!ctx || !prev) return;
    ctx.putImageData(prev, 0, 0);
  }, [layout]);

  const clearMask = useCallback(() => {
    initOverlay();
  }, [initOverlay]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!layout || isInpainting) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pushMaskUndo();
    drawing.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = layout.w / rect.width;
    const scaleY = layout.h / rect.height;
    lastPt.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !layout || isInpainting) return;
    const c = overlayRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const rect = c.getBoundingClientRect();
    const scaleX = layout.w / rect.width;
    const scaleY = layout.h / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const prev = lastPt.current;
    lastPt.current = { x, y };
    if (!prev) return;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = brushPx;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "source-over";
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    drawing.current = false;
    lastPt.current = null;
  };

  const undoLastInpaint = useCallback(() => {
    const prev = flyerAfterInpaintUndo.current.pop();
    if (prev) {
      setFlyerImage(prev);
      setInpaintUndoCount(flyerAfterInpaintUndo.current.length);
    }
  }, [setFlyerImage]);

  const syncExportFlyerCanvas = useCallback(() => {
    const img = imgRef.current;
    const c = exportFlyerRef.current;
    if (!img?.complete || !c || !layout) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.width = layout.w;
    c.height = layout.h;
    ctx.drawImage(img, 0, 0, layout.w, layout.h);
  }, [layout]);

  const applyInpaint = async () => {
    if (!layout || !inpaintPrompt.trim() || isInpainting) return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    setErr("");
    setIsInpainting(true);
    try {
      syncExportFlyerCanvas();
      const flyCanvas = exportFlyerRef.current;
      if (!flyCanvas) {
        setErr("Export canvas missing.");
        return;
      }
      const imageBlob = await new Promise<Blob | null>((resolve) =>
        flyCanvas.toBlob((b) => resolve(b), "image/png", 0.92)
      );
      const maskBlob = await overlayToBinaryMaskPng(overlay, layout.w, layout.h);
      if (!imageBlob || !maskBlob) {
        setErr("Could not export image or mask.");
        return;
      }
      const res = await aiFlyerInpaint({
        image: imageBlob,
        mask: maskBlob,
        prompt: inpaintPrompt.trim(),
      });
      const first = res.images?.[0];
      if (!first?.base64) {
        setErr("No image returned from inpainting.");
        return;
      }
      flyerAfterInpaintUndo.current = [...flyerAfterInpaintUndo.current, flyerImage].slice(-12);
      setInpaintUndoCount(flyerAfterInpaintUndo.current.length);
      setFlyerImage({ mimeType: first.mimeType || "image/png", base64: first.base64 });
      setInpaintPrompt("");
      initOverlay();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Inpainting failed.");
    } finally {
      setIsInpainting(false);
    }
  };

  if (err && !layout) {
    return <p className="text-xs text-[hsl(15,100%,45%)]">{err}</p>;
  }

  if (!layout) {
    return <p className="text-xs text-[hsl(0,0%,50%)]">Preparing editor…</p>;
  }

  return (
    <div className="flex w-full max-w-full flex-col gap-3">
      {err ? <p className="text-xs text-[hsl(15,100%,45%)]">{err}</p> : null}
      <div className="relative mx-auto w-full max-w-[min(100%,28rem)] overflow-hidden rounded-xl ring-1 ring-[hsl(0,0%,90%)]">
        <img
          ref={imgRef}
          src={dataUrl}
          alt="Flyer to edit"
          className="block h-auto w-full"
          style={{ aspectRatio: `${layout.w} / ${layout.h}` }}
          draggable={false}
        />
        <canvas
          ref={overlayRef}
          width={layout.w}
          height={layout.h}
          className="absolute left-0 top-0 h-full w-full cursor-crosshair touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <canvas ref={exportFlyerRef} className="hidden" aria-hidden />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-[hsl(0,0%,40%)]">
        <label className="flex items-center gap-2">
          Brush
          <input
            type="range"
            min={MIN_BRUSH}
            max={MAX_BRUSH}
            value={brushPx}
            disabled={isInpainting}
            onChange={(e) => setBrushPx(Number(e.target.value))}
            className="w-28 accent-[hsl(330,100%,45%)]"
          />
          <span className="tabular-nums text-[hsl(0,0%,25%)]">{brushPx}px</span>
        </label>
        <button
          type="button"
          disabled={isInpainting}
          onClick={undoMaskStroke}
          className="rounded-full border border-[hsl(0,0%,85%)] bg-white px-3 py-1 font-medium text-[hsl(0,0%,15%)] hover:bg-[hsl(0,0%,97%)] disabled:opacity-50"
        >
          Undo stroke
        </button>
        <button
          type="button"
          disabled={isInpainting}
          onClick={clearMask}
          className="rounded-full border border-[hsl(0,0%,85%)] bg-white px-3 py-1 font-medium text-[hsl(0,0%,15%)] hover:bg-[hsl(0,0%,97%)] disabled:opacity-50"
        >
          Clear mask
        </button>
        <button
          type="button"
          disabled={isInpainting || inpaintUndoCount === 0}
          onClick={undoLastInpaint}
          className="rounded-full border border-[hsl(0,0%,85%)] bg-white px-3 py-1 font-medium text-[hsl(0,0%,15%)] hover:bg-[hsl(0,0%,97%)] disabled:opacity-50"
        >
          Undo last inpaint
        </button>
      </div>

      <p className="text-[11px] leading-snug text-[hsl(330,100%,38%)]">
        Brush marks where the model may change pixels; the rest of the flyer should stay intact. The server uses your
        configured AI provider (<code className="rounded bg-[hsl(0,0%,94%)] px-1">AI_PROVIDER</code> /{" "}
        <code className="rounded bg-[hsl(0,0%,94%)] px-1">AI_IMAGE_MODEL</code>
        ): OpenAI uses native masked edit; Gemini uses the same flyer + mask as references with strict instructions.
      </p>

      <textarea
        value={inpaintPrompt}
        onChange={(e) => setInpaintPrompt(e.target.value)}
        disabled={isInpainting}
        placeholder="Describe the change only inside the brushed area (e.g. “remove this glare”, “warmer light here”)."
        rows={3}
        className="w-full max-w-[min(100%,28rem)] resize-none rounded-xl border border-[hsl(0,0%,85%)] bg-white px-3 py-2 text-sm text-[hsl(0,0%,10%)] outline-none placeholder:text-[hsl(0,0%,60%)] focus:border-[hsl(330,100%,80%)] disabled:opacity-50"
      />

      <button
        type="button"
        disabled={isInpainting || !inpaintPrompt.trim()}
        onClick={() => void applyInpaint()}
        className="self-start rounded-full border-none bg-[hsl(0,0%,10%)] px-4 py-2 text-xs font-medium text-white hover:bg-[hsl(0,0%,25%)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isInpainting ? "Applying inpaint…" : "Apply masked edit"}
      </button>
    </div>
  );
}
