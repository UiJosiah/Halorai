import { useRef } from "react";
import { pickSingleImageFile } from "@/lib/singleImagePick";
import { FLYER_SKETCH_COLORS } from "@/lib/flyerEditGeometry";

export const FLYER_EDIT_COST_PER_REGION = 30;
export const FLYER_EDIT_MAX_REGIONS = 3;

export type FlyerEditRegion = {
  id: string;
  previewUrl: string;
  maskBlob: Blob;
  prompt: string;
  referenceImage: File | null;
};

type Props = {
  regions: FlyerEditRegion[];
  onRemoveRegion: (id: string) => void;
  message: string;
  onMessageChange: (v: string) => void;
  textareaDisabled: boolean;
  directInsertImage: File | null;
  directInsertPreviewUrl: string | null;
  onPickDirectInsert: (file: File) => void;
  onClearDirectInsert: () => void;
  plusDisabled: boolean;
  circleMode: boolean;
  onCircleModeToggle: () => void;
  circleDisabled: boolean;
  maxRegionsReached: boolean;
  onSend: () => void;
  sendDisabled: boolean;
  isApplying: boolean;
  editCost: number;
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
  directInsertImage,
  directInsertPreviewUrl,
  onPickDirectInsert,
  onClearDirectInsert,
  plusDisabled,
  circleMode,
  onCircleModeToggle,
  circleDisabled,
  maxRegionsReached,
  onSend,
  sendDisabled,
  isApplying,
  editCost,
  sketchColor,
  onSketchColorChange,
  sketchColorDisabled,
}: Props) {
  const plusInputRef = useRef<HTMLInputElement | null>(null);
  const hasRegions = regions.length > 0;

  return (
    <div className="flex w-full max-w-[420px] flex-col">
      <div
        className="flex min-h-[min(260px,42vh)] flex-col rounded-2xl border border-[hsl(330,60%,92%)] bg-white p-3 sm:p-4"
        style={{
          boxShadow:
            "0 0 0 1px hsl(330, 85%, 88%), 0 0 20px 6px hsl(330, 100%, 90%), 0 4px 24px -4px hsl(330, 80%, 85%)",
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
                  <img src="/Halorai Dev/Icons/cancel.svg" alt="" className="h-2 w-2 brightness-0 invert" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {directInsertPreviewUrl && !hasRegions ? (
          <div className="relative mb-2 inline-flex shrink-0 self-start">
            <img
              src={directInsertPreviewUrl}
              alt=""
              className="h-14 w-14 rounded-lg border border-[hsl(0,0%,88%)] object-cover"
            />
            <button
              type="button"
              disabled={isApplying || plusDisabled}
              onClick={onClearDirectInsert}
              className="absolute -right-0.5 -top-0.5 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border-none bg-[hsl(15,100%,55%)] disabled:opacity-50"
              aria-label="Remove image"
            >
              <img src="/Halorai Dev/Icons/cancel.svg" alt="" className="h-3 w-3 brightness-0 invert" />
            </button>
          </div>
        ) : null}

        <textarea
          value={message}
          disabled={textareaDisabled || isApplying}
          onChange={(e) => onMessageChange(e.target.value)}
          placeholder={
            hasRegions
              ? "Sketch regions on the flyer, then send to apply all requests…"
              : "Put the logo on the right hand, and Remove the..."
          }
          className="min-h-[120px] w-full flex-1 resize-none border-none bg-transparent text-sm text-[hsl(0,0%,10%)] outline-none placeholder:text-[hsl(0,0%,55%)] disabled:cursor-not-allowed disabled:opacity-60"
        />

        <div className="mt-2 flex items-center gap-2">
          <span className="shrink-0 text-[11px] text-[hsl(0,0%,50%)]">Pencil</span>
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
          className="hidden"
          onChange={(e) => {
            const f = pickSingleImageFile(e.target.files);
            e.target.value = "";
            if (f) onPickDirectInsert(f);
          }}
        />

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            title={plusDisabled ? "Unavailable while region edits are active" : "Attach image and send with text"}
            disabled={plusDisabled || isApplying}
            onClick={() => plusInputRef.current?.click()}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-[hsl(0,0%,94%)] text-lg font-light text-[hsl(0,0%,25%)] hover:bg-[hsl(0,0%,90%)] disabled:cursor-not-allowed disabled:opacity-40"
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
            <span>₦{editCost || FLYER_EDIT_COST_PER_REGION}</span>
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

      {directInsertImage && !hasRegions ? (
        <p className="mt-2 text-xs text-[hsl(0,0%,50%)]">Quick edit: describe the change and send. Circle to Edit is off.</p>
      ) : null}
    </div>
  );
}
