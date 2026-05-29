import { useRef } from "react";
import {
  createAttachedImages,
  MAX_ATTACH_IMAGES,
  pickImageFiles,
  type AttachedImage,
} from "@/lib/imageAttach";
import { FLYER_SKETCH_COLORS } from "@/lib/flyerEditGeometry";

export const FLYER_EDIT_COST = 30;
export const FLYER_EDIT_MAX_REGIONS = 3;

export type FlyerEditRegion = {
  id: string;
  previewUrl: string;
  maskBlob: Blob;
  prompt: string;
  referenceImages: File[];
};

type Props = {
  regions: FlyerEditRegion[];
  onRemoveRegion: (id: string) => void;
  message: string;
  onMessageChange: (v: string) => void;
  textareaDisabled: boolean;
  directInsertItems: AttachedImage[];
  onAddDirectInsert: (files: File[]) => void;
  onRemoveDirectInsert: (id: string) => void;
  plusDisabled: boolean;
  circleMode: boolean;
  onCircleModeToggle: () => void;
  circleDisabled: boolean;
  maxRegionsReached: boolean;
  onSend: () => void;
  sendDisabled: boolean;
  isApplying: boolean;
  sketchColor: string;
  onSketchColorChange: (color: string) => void;
  sketchColorDisabled?: boolean;
};

export default function FlyerEditPanel({
  regions,
  onRemoveRegion,
  message,
  onMessageChange,
  textareaDisabled,
  directInsertItems,
  onAddDirectInsert,
  onRemoveDirectInsert,
  plusDisabled,
  circleMode,
  onCircleModeToggle,
  circleDisabled,
  maxRegionsReached,
  onSend,
  sendDisabled,
  isApplying,
  sketchColor,
  onSketchColorChange,
  sketchColorDisabled,
}: Props) {
  const plusInputRef = useRef<HTMLInputElement | null>(null);
  const hasRegions = regions.length > 0;
  const attachFull = directInsertItems.length >= MAX_ATTACH_IMAGES;

  return (
    <div className="flex w-full max-w-[420px] flex-col">
      <div
        className="flex min-h-[min(260px,42vh)] flex-col rounded-2xl border border-[hsl(330,60%,92%)] bg-white p-3 sm:p-4"
        style={{
          boxShadow:
            "0 0 0 1px hsl(330, 50%, 92%), 0 0 6px 1px hsl(330, 70%, 94%), 0 2px 10px -4px hsl(330, 50%, 90%)",
        }}
      >
        {hasRegions ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {regions.map((r) => (
              <div key={r.id} className="relative inline-flex shrink-0">
                <img
                  src={r.previewUrl}
                  alt=""
                  className="h-14 w-14 rounded-xl border border-[hsl(0,0%,90%)] object-cover"
                />
                <button
                  type="button"
                  disabled={isApplying}
                  onClick={() => onRemoveRegion(r.id)}
                  className="absolute -right-1 -top-1 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border-none bg-[hsl(15,100%,55%)] disabled:opacity-50"
                  aria-label="Remove region"
                >
                  <img src="/Halorai Dev/Icons/cancel.svg" alt="" className="h-3 w-3 brightness-0 invert" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {directInsertItems.length > 0 && !hasRegions ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {directInsertItems.map((item) => (
              <div key={item.id} className="relative inline-flex shrink-0 self-start">
                <img
                  src={item.previewUrl}
                  alt=""
                  className="h-14 w-14 rounded-lg border border-[hsl(0,0%,88%)] object-cover"
                />
                <button
                  type="button"
                  disabled={isApplying || plusDisabled}
                  onClick={() => onRemoveDirectInsert(item.id)}
                  className="absolute -right-0.5 -top-0.5 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border-none bg-[hsl(15,100%,55%)] disabled:opacity-50"
                  aria-label="Remove image"
                >
                  <img src="/Halorai Dev/Icons/cancel.svg" alt="" className="h-3 w-3 brightness-0 invert" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <textarea
          value={message}
          disabled={textareaDisabled || isApplying}
          onChange={(e) => onMessageChange(e.target.value)}
          className="min-h-[120px] w-full flex-1 resize-none border-none bg-transparent text-sm text-[hsl(0,0%,10%)] outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />

        <div className="mt-2 flex items-center gap-2">
          <img
            src="/Halorai Dev/Icons/lucide_edit-2.svg"
            alt=""
            className="h-4 w-4 shrink-0 opacity-60"
            aria-hidden
          />
          {FLYER_SKETCH_COLORS.map((c) => {
            const selected = sketchColor === c.value;
            return (
              <button
                key={c.id}
                type="button"
                title={c.label}
                disabled={sketchColorDisabled || isApplying}
                aria-label={`${c.label} pencil`}
                aria-pressed={selected}
                onClick={() => onSketchColorChange(c.value)}
                className={`h-5 w-5 shrink-0 rounded-full border-2 transition-transform disabled:cursor-not-allowed disabled:opacity-40 ${
                  selected ? "scale-110 border-[hsl(0,0%,20%)]" : "border-[hsl(0,0%,88%)] hover:scale-105"
                }`}
                style={{ backgroundColor: c.value }}
              />
            );
          })}
        </div>

        <input
          ref={plusInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = pickImageFiles(e.target.files, MAX_ATTACH_IMAGES - directInsertItems.length);
            e.target.value = "";
            if (files.length) onAddDirectInsert(files);
          }}
        />

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            title={
              plusDisabled
                ? "Unavailable while region edits are active"
                : attachFull
                  ? `Maximum ${MAX_ATTACH_IMAGES} images`
                  : "Attach image and send with text"
            }
            disabled={plusDisabled || isApplying || attachFull}
            onClick={() => plusInputRef.current?.click()}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-[hsl(0,0%,94%)] text-xl font-light text-[hsl(0,0%,25%)] hover:bg-[hsl(0,0%,90%)] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Add image"
          >
            +
          </button>

          <button
            type="button"
            disabled={circleDisabled || isApplying || maxRegionsReached}
            onClick={onCircleModeToggle}
            className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-none px-3 py-2 text-xs font-medium transition-colors ${
              circleMode
                ? "bg-[hsl(210,100%,95%)] text-[hsl(210,80%,35%)] ring-1 ring-[hsl(210,80%,75%)]"
                : "bg-[hsl(0,0%,94%)] text-[hsl(0,0%,25%)] hover:bg-[hsl(0,0%,90%)]"
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <img src="/Halorai Dev/Icons/lucide_edit-2.svg" alt="" className="h-3.5 w-3.5" />
            Circle to Edit
          </button>

          <div className="flex shrink-0 items-center gap-1 text-xs font-medium text-[hsl(330,100%,45%)]">
            <img
              src="/Halorai Dev/Icons/mdi_coins-outline.svg"
              alt=""
              className="h-5 w-5 shrink-0"
              aria-hidden
            />
            <span>₦{FLYER_EDIT_COST}</span>
          </div>

          <div className="ml-auto flex shrink-0">
            <button
              type="button"
              disabled={sendDisabled || isApplying}
              onClick={onSend}
              className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none transition-colors ${
                !sendDisabled && !isApplying
                  ? "bg-[hsl(0,0%,10%)] hover:bg-[hsl(0,0%,25%)]"
                  : "cursor-not-allowed bg-[hsl(0,0%,60%)]"
              }`}
              aria-label="Send"
            >
              <img
                src="/Halorai Dev/Icons/send Vector.svg"
                alt=""
                className={`h-4 w-4 ${!sendDisabled && !isApplying ? "brightness-0 invert" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      {maxRegionsReached ? (
        <p className="mt-2 text-xs text-[hsl(0,0%,50%)]">Maximum {FLYER_EDIT_MAX_REGIONS} regions. Remove one to add another.</p>
      ) : null}

      {circleMode && !circleDisabled ? (
        <p className="mt-2 text-xs text-[hsl(210,70%,40%)]">Sketch on the flyer to mark an area and open the edit popup.</p>
      ) : null}

      {directInsertItems.length > 0 && !hasRegions ? (
        <p className="mt-2 text-xs text-[hsl(0,0%,50%)]">Quick edit: describe the change and send. Circle to Edit is off.</p>
      ) : null}
    </div>
  );
}
