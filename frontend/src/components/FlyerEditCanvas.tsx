import { useCallback, useEffect, useRef, useState } from "react";
import type { FlyerImage } from "@/contexts/CreateDesignContext";
import {
  createAttachedImages,
  MAX_ATTACH_IMAGES,
  pickImageFiles,
  revokeAttachedImages,
  type AttachedImage,
} from "@/lib/imageAttach";
import {
  cropSketchPreviewUrl,
  drawSketchPreview,
  isSketchValid,
  layoutFromImage,
  sketchStrokeWidth,
  sketchToMaskBlob,
  type FlyerLayout,
  type FlyerPoint,
  type FlyerSketch,
} from "@/lib/flyerEditGeometry";

export type PendingFlyerRegion = {
  layout: FlyerLayout;
  maskBlob: Blob;
  previewUrl: string;
  prompt: string;
  referenceImages: File[];
};

type Props = {
  flyerImage: FlyerImage;
  resetKey: string;
  circleMode: boolean;
  sketchColor: string;
  disabled?: boolean;
  onAddRegion: (region: PendingFlyerRegion) => void;
};

const MIN_POINT_DIST = 2;
const PENCIL_CURSOR = 'url("/Halorai Dev/Icons/lucide_edit-2.svg") 2 18, crosshair';

export default function FlyerEditCanvas({ flyerImage, resetKey, circleMode, sketchColor, disabled, onAddRegion }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const interactCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sketchPointsRef = useRef<FlyerSketch>([]);
  const [layout, setLayout] = useState<FlyerLayout | null>(null);
  const [popup, setPopup] = useState<{
    layout: FlyerLayout;
    maskBlob: Blob;
    previewUrl: string;
    left: number;
    top: number;
  } | null>(null);
  const [popupPrompt, setPopupPrompt] = useState("");
  const [popupRefs, setPopupRefs] = useState<AttachedImage[]>([]);
  const popupInsertRef = useRef<HTMLInputElement | null>(null);

  const drawing = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const dataUrl = `data:${flyerImage.mimeType};base64,${flyerImage.base64}`;

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setLayout(layoutFromImage(img.naturalWidth, img.naturalHeight));
    };
    img.src = dataUrl;
  }, [dataUrl, resetKey]);

  const clearSketchCanvas = useCallback(() => {
    const canvas = interactCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !layout) return;
    ctx.clearRect(0, 0, layout.w, layout.h);
  }, [layout]);

  useEffect(() => {
    sketchPointsRef.current = [];
    clearSketchCanvas();
    setPopup(null);
    setPopupPrompt("");
    setPopupRefs((prev) => {
      revokeAttachedImages(prev);
      return [];
    });
  }, [resetKey, circleMode, clearSketchCanvas]);

  const toCanvasPoint = useCallback(
    (e: React.PointerEvent, el: HTMLElement) => {
      if (!layout) return null;
      const rect = el.getBoundingClientRect();
      const scaleX = layout.w / rect.width;
      const scaleY = layout.h / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    [layout]
  );

  const redrawDraftSketch = useCallback(() => {
    const canvas = interactCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !layout) return;
    const strokeWidth = sketchStrokeWidth(layout);
    drawSketchPreview(ctx, layout, sketchPointsRef.current, strokeWidth, sketchColor);
  }, [layout, sketchColor]);

  useEffect(() => {
    if (drawing.current && sketchPointsRef.current.length > 0) {
      redrawDraftSketch();
    }
  }, [sketchColor, redrawDraftSketch]);

  const appendPoint = useCallback((pt: FlyerPoint) => {
    const pts = sketchPointsRef.current;
    const last = pts[pts.length - 1];
    if (last) {
      const dx = pt.x - last.x;
      const dy = pt.y - last.y;
      if (dx * dx + dy * dy < MIN_POINT_DIST * MIN_POINT_DIST) return;
    }
    pts.push(pt);
  }, []);

  const closePopup = useCallback(() => {
    setPopup(null);
    setPopupPrompt("");
    setPopupRefs((prev) => {
      revokeAttachedImages(prev);
      return [];
    });
    sketchPointsRef.current = [];
    clearSketchCanvas();
    if (popupInsertRef.current) popupInsertRef.current.value = "";
  }, [clearSketchCanvas]);

  const removePopupRef = useCallback((id: string) => {
    setPopupRefs((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
    if (popupInsertRef.current) popupInsertRef.current.value = "";
  }, []);

  const openPopupForSketch = useCallback(
    async (points: FlyerSketch) => {
      const img = imgRef.current;
      if (!img || !layout || !containerRef.current) return;
      const strokeWidth = sketchStrokeWidth(layout);
      const previewUrl = cropSketchPreviewUrl(img, layout, points, strokeWidth);
      const maskBlob = await sketchToMaskBlob(layout, points, strokeWidth);
      if (!previewUrl || !maskBlob) return;

      const pad = Math.ceil(strokeWidth / 2) + 4;
      let minX = Infinity;
      let minY = Infinity;
      for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
      }

      const rect = containerRef.current.getBoundingClientRect();
      const scaleX = rect.width / layout.w;
      const scaleY = rect.height / layout.h;
      const left = Math.min(Math.max(8, (minX - pad) * scaleX), rect.width - 280);
      const top = Math.min(Math.max(8, (minY - pad) * scaleY), rect.height - 200);

      clearSketchCanvas();
      setPopup({ layout, maskBlob, previewUrl, left, top });
      setPopupPrompt("");
      setPopupRefs((prev) => {
        revokeAttachedImages(prev);
        return [];
      });
    },
    [layout, clearSketchCanvas]
  );

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!circleMode || disabled || !layout || popup) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = toCanvasPoint(e, e.currentTarget);
    if (!pt) return;
    drawing.current = true;
    sketchPointsRef.current = [pt];
    redrawDraftSketch();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !layout) return;
    const pt = toCanvasPoint(e, e.currentTarget);
    if (!pt) return;
    appendPoint(pt);
    redrawDraftSketch();
  };

  const onPointerUp = async (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!drawing.current) return;
    drawing.current = false;
    const pt = toCanvasPoint(e, e.currentTarget);
    if (pt) appendPoint(pt);

    const points = [...sketchPointsRef.current];
    sketchPointsRef.current = [];
    if (!isSketchValid(points)) {
      clearSketchCanvas();
      return;
    }
    await openPopupForSketch(points);
  };

  const handleAddRequest = () => {
    if (!popup || !popupPrompt.trim()) return;
    onAddRegion({
      layout: popup.layout,
      maskBlob: popup.maskBlob,
      previewUrl: popup.previewUrl,
      prompt: popupPrompt.trim(),
      referenceImages: popupRefs.map((item) => item.file),
    });
    closePopup();
  };

  const popupAttachFull = popupRefs.length >= MAX_ATTACH_IMAGES;

  if (!layout) return null;

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0">
      {circleMode ? (
        <canvas
          ref={interactCanvasRef}
          width={layout.w}
          height={layout.h}
          className="pointer-events-auto absolute inset-0 h-full w-full touch-none"
          style={{ cursor: disabled ? "not-allowed" : PENCIL_CURSOR }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      ) : null}

      {popup ? (
        <div
          className="pointer-events-auto absolute z-30 w-[min(100%,17.5rem)] rounded-2xl border border-[hsl(0,0%,90%)] bg-white p-3 shadow-lg"
          style={{ left: popup.left, top: popup.top }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {popupRefs.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-2">
              {popupRefs.map((item) => (
                <div key={item.id} className="relative inline-flex shrink-0 self-start">
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="h-8 w-8 rounded-lg border border-[hsl(0,0%,88%)] object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePopupRef(item.id)}
                    className="absolute -right-0.5 -top-0.5 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border-none bg-[hsl(15,100%,55%)]"
                    aria-label="Remove image"
                  >
                    <img src="/Halorai Dev/Icons/cancel.svg" alt="" className="h-3 w-3 brightness-0 invert" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <textarea
            value={popupPrompt}
            onChange={(e) => setPopupPrompt(e.target.value)}
            rows={2}
            placeholder="Describe what to change in this area…"
            className="mb-2 min-h-[2.75rem] w-full resize-none border-none bg-transparent text-sm text-[hsl(0,0%,10%)] outline-none placeholder:text-[hsl(0,0%,55%)]"
          />
          <input
            ref={popupInsertRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = pickImageFiles(e.target.files, MAX_ATTACH_IMAGES - popupRefs.length);
              e.target.value = "";
              if (!files.length) return;
              setPopupRefs((prev) => [...prev, ...createAttachedImages(files, prev.length)]);
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              title={popupAttachFull ? `Maximum ${MAX_ATTACH_IMAGES} images` : "Insert reference image"}
              disabled={popupAttachFull}
              onClick={() => popupInsertRef.current?.click()}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none bg-[hsl(0,0%,96%)] hover:bg-[hsl(0,0%,92%)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M21.44 11.05L12.25 20.24C11.1242 21.3658 9.59723 21.9983 8.005 21.9983C6.41277 21.9983 4.88583 21.3658 3.76 20.24C2.63417 19.1142 2.00166 17.5872 2.00166 15.995C2.00166 14.4028 2.63417 12.8758 3.76 11.75L12.33 3.18C13.0806 2.42975 14.0938 2.00916 15.15 2.00916C16.2062 2.00916 17.2194 2.42975 17.97 3.18C18.7202 3.93063 19.1408 4.94382 19.1408 6C19.1408 7.05618 18.7202 8.06937 17.97 8.82L9.37 17.42C8.99469 17.7953 8.48809 18.0056 7.96 18.0056C7.43191 18.0056 6.92531 17.7953 6.55 17.42C6.17469 17.0447 5.96438 16.5381 5.96438 16.01C5.96438 15.4819 6.17469 14.9753 6.55 14.6L15.07 6.1"
                  stroke="hsl(0,0%,20%)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              disabled={!popupPrompt.trim()}
              onClick={handleAddRequest}
              className="rounded-full border-none bg-[hsl(0,0%,10%)] px-4 py-2 text-xs font-medium text-white hover:bg-[hsl(0,0%,25%)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Add Request
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
