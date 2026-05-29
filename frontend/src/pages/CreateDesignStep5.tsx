import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppLayout from "@/components/AppLayout";
import CreateDesignHero from "@/components/CreateDesignHero";
import StepperProgress from "@/components/StepperProgress";
import { useCreateDesign } from "@/contexts/CreateDesignContext";
import { aiFlyerEdit, aiFlyerInpaint, aiGenerateFlyer } from "@/lib/api";
import { downloadFlyer } from "@/lib/downloadFlyer";
import ArcLoader from "@/components/ArcLoader";
import FlyerEditCanvas, { type PendingFlyerRegion } from "@/components/FlyerEditCanvas";
import FlyerEditPanel, {
  FLYER_EDIT_MAX_REGIONS,
  type FlyerEditRegion,
} from "@/components/FlyerEditPanel";
import { FLYER_SKETCH_DEFAULT_COLOR, buildBatchRegionPrompt, flyerImageToPngBlob, mergeMaskBlobs } from "@/lib/flyerEditGeometry";
import { createAttachedImages, revokeAttachedImages, type AttachedImage } from "@/lib/imageAttach";
import type { FlyerImage } from "@/contexts/CreateDesignContext";

type FlyerHistEntry = { image: FlyerImage; key: string };
type FlyerHistState = { entries: FlyerHistEntry[]; index: number };

function buildNextFlyerHist(
  h: FlyerHistState,
  image: FlyerImage,
  key: string
): { next: FlyerHistState; changed: boolean } {
  if (h.entries.length === 0) {
    return { next: { entries: [{ image, key }], index: 0 }, changed: true };
  }
  const tip = Math.max(0, h.entries.length - 1);
  const end = Math.max(h.index, tip);
  const truncated = h.entries.slice(0, end + 1);
  const last = truncated[truncated.length - 1];
  if (last && last.image.base64 === image.base64 && last.key === key) {
    return { next: h, changed: false };
  }
  const entries = [...truncated, { image, key }];
  return { next: { entries, index: entries.length - 1 }, changed: true };
}

function flyerImageToFile(img: FlyerImage): File {
  const binary = atob(img.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const ext =
    img.mimeType === "image/jpeg" || img.mimeType === "image/jpg"
      ? "jpg"
      : img.mimeType === "image/webp"
        ? "webp"
        : "png";
  return new File([bytes], `background.${ext}`, { type: img.mimeType || "image/png" });
}

const CreateDesignStep5 = () => {
  const [message, setMessage] = useState("");
  const [isPreparing, setIsPreparing] = useState(false);
  const [isApplyingEdits, setIsApplyingEdits] = useState(false);
  const [error, setError] = useState<string>("");
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [regions, setRegions] = useState<FlyerEditRegion[]>([]);
  const [circleMode, setCircleMode] = useState(false);
  const [sketchColor, setSketchColor] = useState<string>(FLYER_SKETCH_DEFAULT_COLOR);
  const [directInsertItems, setDirectInsertItems] = useState<AttachedImage[]>([]);
  const [flyerHist, setFlyerHist] = useState<FlyerHistState>({ entries: [], index: -1 });
  const flyerHistRef = useRef(flyerHist);
  const historyInitRef = useRef(false);

  const {
    assetsHydrated,
    eventDetails,
    logos,
    ministers,
    concepts,
    selectedConceptId,
    selectedConceptDescription,
    flyerImage,
    setFlyerImage,
    flyerKey,
    setFlyerKey,
    backgroundRefinementNotes,
    backgroundPreviewImage,
    backgroundPreviewKey,
  } = useCreateDesign();
  const conceptDescription = selectedConceptDescription;
  const filenameBase = useMemo(() => {
    return eventDetails.eventName?.trim() || eventDetails.theme?.trim() || "flyer";
  }, [eventDetails.eventName, eventDetails.theme]);

  const generationKey = useMemo(() => {
    const safeEvent = {
      churchName: eventDetails.churchName?.trim() || "",
      eventName: eventDetails.eventName?.trim() || "",
      theme: eventDetails.theme?.trim() || "",
      date: eventDetails.date?.trim() || "",
      time: eventDetails.time?.trim() || "",
      venue: eventDetails.venue?.trim() || "",
      otherInfo: eventDetails.otherInfo?.trim() || "",
    };
    const logoMeta = (logos ?? []).map((l) => ({
      name: l.file?.name || "",
      size: l.file?.size || 0,
      lastModified: l.file?.lastModified || 0,
    }));
    const ministerMeta = (ministers ?? []).map((m) => ({
      name: m.name || "",
      title: m.title || "",
      file: {
        name: m.avatar.file?.name || "",
        size: m.avatar.file?.size || 0,
        lastModified: m.avatar.file?.lastModified || 0,
      },
    }));
    return JSON.stringify({
      event: safeEvent,
      concept: conceptDescription || "",
      backgroundRefinement: backgroundRefinementNotes?.trim() || "",
      backgroundKey: backgroundPreviewKey || "",
      logos: logoMeta,
      ministers: ministerMeta,
    });
  }, [backgroundPreviewKey, backgroundRefinementNotes, conceptDescription, eventDetails, logos, ministers]);

  const canGenerate = useMemo(() => {
    const requiredStep1Ok =
      !!eventDetails.churchName?.trim() &&
      !!eventDetails.date?.trim() &&
      !!eventDetails.time?.trim() &&
      !!eventDetails.venue?.trim() &&
      !!eventDetails.theme?.trim();

    const step3Ok = !!conceptDescription.trim() && (selectedConceptId != null || concepts.length > 0);
    const ministersOk = ministers.length === 0 || ministers.every((m) => !!m.name.trim());
    const hasBackground = !!backgroundPreviewImage?.base64?.trim();
    return assetsHydrated && requiredStep1Ok && step3Ok && ministersOk && hasBackground;
  }, [
    assetsHydrated,
    backgroundPreviewImage,
    conceptDescription,
    concepts.length,
    eventDetails,
    ministers,
    selectedConceptId,
  ]);

  const clearEditSession = useCallback(() => {
    setRegions([]);
    setCircleMode(false);
    setMessage("");
    setDirectInsertItems((prev) => {
      revokeAttachedImages(prev);
      return [];
    });
  }, []);

  useEffect(() => {
    clearEditSession();
  }, [flyerKey, clearEditSession]);

  useEffect(() => {
    flyerHistRef.current = flyerHist;
  }, [flyerHist]);

  useEffect(() => {
    setFlyerHist({ entries: [], index: -1 });
    historyInitRef.current = false;
  }, [generationKey]);

  useEffect(() => {
    if (historyInitRef.current) return;
    if (!flyerImage?.base64?.trim() || !flyerKey.trim()) return;
    if (flyerHist.entries.length > 0) return;
    historyInitRef.current = true;
    setFlyerHist({ entries: [{ image: flyerImage, key: flyerKey }], index: 0 });
  }, [flyerImage, flyerKey, flyerHist.entries.length]);

  const commitFlyerVersion = useCallback(
    (image: FlyerImage, key: string) => {
      setFlyerImage(image);
      setFlyerKey(key);
      setFlyerHist((h) => buildNextFlyerHist(h, image, key).next);
      clearEditSession();
    },
    [clearEditSession, setFlyerImage, setFlyerKey]
  );

  const generateFlyer = useCallback(async (opts?: { message?: string; keepExisting?: boolean; force?: boolean }) => {
    const force = !!opts?.force;
    const keepExisting = !!opts?.keepExisting;
    if (!canGenerate) {
      setIsPreparing(false);
      setFlyerImage(null);
      setError(
        "Missing required info. Go back to Step 1, pick a concept on Step 3, generate your background on Step 3ii, and confirm ministers on Step 4."
      );
      return;
    }

    if (!force && flyerImage && flyerKey === generationKey) {
      setError("");
      setIsPreparing(false);
      return;
    }

    setError("");
    if (!keepExisting) setFlyerImage(null);
    setIsPreparing(true);

    try {
      if (!backgroundPreviewImage) {
        setError("No background image. Complete Step 3ii first.");
        return;
      }
      const res = await aiGenerateFlyer({
        eventDetails,
        concept: conceptDescription,
        message: opts?.message,
        backgroundImage: flyerImageToFile(backgroundPreviewImage),
        ministersMeta: ministers.map((m) => ({ name: m.name, title: m.title })),
        logos: logos.map((l) => l.file),
        ministers: ministers.map((m) => m.avatar.file),
      });
      const first = res.images?.[0];
      if (!first?.base64) {
        setError("AI returned no image. Please retry.");
        return;
      }
      commitFlyerVersion(first, generationKey);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to generate flyer.";
      setError(msg);
    } finally {
      setIsPreparing(false);
    }
  }, [
    backgroundPreviewImage,
    canGenerate,
    commitFlyerVersion,
    conceptDescription,
    eventDetails,
    flyerImage,
    flyerKey,
    generationKey,
    logos,
    ministers,
    setFlyerImage,
    setFlyerKey,
  ]);

  useEffect(() => {
    if (!canGenerate) return;
    const h = flyerHistRef.current;
    if (h.entries.length > 0 && h.index >= 0 && h.index < h.entries.length - 1) return;
    void generateFlyer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canGenerate, generationKey]);

  const handleHistoryBack = () => {
    const h = flyerHistRef.current;
    if (busy || !assetsHydrated || h.entries.length <= 1 || h.index <= 0) return;
    const ni = h.index - 1;
    const entry = h.entries[ni];
    setFlyerImage(entry.image);
    setFlyerKey(entry.key);
    setFlyerHist({ ...h, index: ni });
    setIsDownloadOpen(false);
    setError("");
  };

  const handleHistoryForward = () => {
    const h = flyerHistRef.current;
    if (busy || !assetsHydrated || h.entries.length <= 1 || h.index >= h.entries.length - 1) return;
    const ni = h.index + 1;
    const entry = h.entries[ni];
    setFlyerImage(entry.image);
    setFlyerKey(entry.key);
    setFlyerHist({ ...h, index: ni });
    setIsDownloadOpen(false);
    setError("");
  };

  const handleDownload = async (format: "png" | "jpg" | "pdf") => {
    if (!flyerImage) return;
    setIsDownloadOpen(false);
    setIsDownloading(true);
    try {
      await downloadFlyer({ flyer: flyerImage, filenameBase, format });
    } finally {
      setIsDownloading(false);
    }
  };

  const hasRegions = regions.length > 0;
  const maxRegionsReached = regions.length >= FLYER_EDIT_MAX_REGIONS;
  const plusDisabled = hasRegions || circleMode;
  const circleDisabled = directInsertItems.length > 0;
  const textareaDisabled = hasRegions;
  const busy = isPreparing || isApplyingEdits;

  const handleAddDirectInsert = (files: File[]) => {
    if (!files.length) return;
    setDirectInsertItems((prev) => [...prev, ...createAttachedImages(files, prev.length)]);
    setCircleMode(false);
  };

  const handleRemoveDirectInsert = (id: string) => {
    setDirectInsertItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const clearDirectInsert = useCallback(() => {
    setDirectInsertItems((prev) => {
      revokeAttachedImages(prev);
      return [];
    });
  }, []);

  const handleAddRegion = (pending: PendingFlyerRegion) => {
    if (regions.length >= FLYER_EDIT_MAX_REGIONS) return;
    setRegions((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        previewUrl: pending.previewUrl,
        maskBlob: pending.maskBlob,
        prompt: pending.prompt,
        referenceImages: pending.referenceImages,
      },
    ]);
    setCircleMode(false);
    clearDirectInsert();
  };

  const handleRemoveRegion = (id: string) => {
    setRegions((prev) => prev.filter((r) => r.id !== id));
  };

  const applyRegionEdits = async () => {
    if (!flyerImage || regions.length === 0) return;
    setError("");
    setIsApplyingEdits(true);
    try {
      const imageBlob = await flyerImageToPngBlob(flyerImage);
      const mergedMask = await mergeMaskBlobs(regions.map((r) => r.maskBlob));
      if (!mergedMask) {
        setError("Could not build edit mask. Please retry.");
        return;
      }

      const { prompt, referenceImages } = buildBatchRegionPrompt(
        regions.map((r) => ({ prompt: r.prompt, referenceImages: r.referenceImages }))
      );

      const res = await aiFlyerInpaint({
        image: imageBlob,
        mask: mergedMask,
        prompt,
        regionMasks: regions.length > 1 ? regions.map((r) => r.maskBlob) : undefined,
        referenceImages: referenceImages.length ? referenceImages : undefined,
      });

      const next = res.images?.[0];
      if (!next?.base64) {
        setError("AI returned no image for region edits. Please retry.");
        return;
      }
      commitFlyerVersion(next, `${generationKey}#edit-${Date.now()}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to apply region edits.";
      setError(msg);
    } finally {
      setIsApplyingEdits(false);
    }
  };

  const handleSidebarEdit = async () => {
    if (!flyerImage) return;
    const trimmed = message.trim();
    if (!trimmed) return;

    setError("");
    setIsApplyingEdits(true);
    try {
      const flyerBlob = await flyerImageToPngBlob(flyerImage);
      const res = await aiFlyerEdit({
        flyerImage: flyerBlob,
        message: trimmed,
        referenceImages: directInsertItems.map((item) => item.file),
      });
      const next = res.images?.[0];
      if (!next?.base64) {
        setError("AI returned no image. Please retry.");
        return;
      }
      commitFlyerVersion(next, `${generationKey}#edit-${Date.now()}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to apply flyer edit.";
      setError(msg);
    } finally {
      setIsApplyingEdits(false);
    }
  };

  const handleSend = async () => {
    if (!canGenerate || !flyerImage || busy) return;

    if (hasRegions) {
      await applyRegionEdits();
      return;
    }

    await handleSidebarEdit();
  };

  const sendDisabled = useMemo(() => {
    if (!canGenerate || !flyerImage || busy) return true;
    if (hasRegions) return false;
    return !message.trim();
  }, [busy, canGenerate, flyerImage, hasRegions, message]);

  return (
    <AppLayout>
      <CreateDesignHero title="Create Design" />
      <StepperProgress currentStep={5} />

      <div className="px-4 xs:px-0">
        <div className="rounded-2xl border border-[hsl(0,0%,80%)] p-6 md:p-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[0.35fr_0.45fr_0.35fr] md:gap-4">
            {/* Left Column - Analysing theme */}
            <div className="items-center justify-center">
              <h2 className="mb-6 text-lg font-semibold text-[hsl(0,0%,10%)] md:text-xl">Preparing Your Design</h2>

              <div className="my-20 pl-4">
                <ArcLoader
                  size={220}
                  label={
                    !assetsHydrated ? (
                      "Loading..."
                    ) : isPreparing || isApplyingEdits ? (
                      <span>
                        {isApplyingEdits ? (
                          <>
                            Applying
                            <br />
                            your edits...
                          </>
                        ) : (
                          <>
                            Compositing
                            <br />
                            your flyer...
                          </>
                        )}
                      </span>
                    ) : canGenerate ? (
                      <img src="/Halorai Dev/Images/checkmark.svg" alt="Done" className="h-14 w-14" />
                    ) : (
                      "Missing info"
                    )
                  }
                  spinning={!assetsHydrated || isPreparing || isApplyingEdits}
                  spinDurationMs={3200}
                />
              </div>
            </div>

            {/* Middle Column — flyer preview + circle overlay + download */}
            <div className="flex min-h-0 items-center justify-center px-2">
              <div className="inline-flex max-w-full flex-col items-stretch">
                <div className="relative overflow-hidden rounded-xl bg-[hsl(0,0%,94%)] ring-1 ring-[hsl(0,0%,92%)]">
                  {flyerImage ? (
                    <>
                      <img
                        src={`data:${flyerImage.mimeType};base64,${flyerImage.base64}`}
                        alt="Design Preview"
                        className="block h-auto max-h-[min(75vh,640px)] w-auto max-w-full object-contain"
                      />
                      <FlyerEditCanvas
                        flyerImage={flyerImage}
                        resetKey={flyerKey}
                        circleMode={circleMode}
                        sketchColor={sketchColor}
                        disabled={busy || maxRegionsReached}
                        onAddRegion={handleAddRegion}
                      />
                    </>
                  ) : (
                    <div
                      className="aspect-[4/5] w-full min-w-[240px] bg-transparent sm:min-w-[280px] md:min-w-[320px] lg:min-w-[380px] xl:min-w-[440px]"
                      aria-label="Design preview loading"
                    />
                  )}
                </div>

                <div className="mt-4 flex w-full items-center justify-between gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Previous flyer version"
                      title="Previous version (no new AI call)"
                      disabled={
                        busy ||
                        !assetsHydrated ||
                        flyerHist.entries.length <= 1 ||
                        flyerHist.index <= 0
                      }
                      onClick={handleHistoryBack}
                      className="cursor-pointer rounded-full border-none bg-[hsl(0,0%,94%)] p-2 transition-opacity hover:bg-[hsl(0,0%,90%)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <img
                        src="/Halorai Dev/Icons/grommet-icons_revert.svg"
                        alt=""
                        className="h-5 w-5"
                        aria-hidden
                      />
                    </button>
                    <button
                      type="button"
                      aria-label="Next flyer version"
                      title="Next version (no new AI call)"
                      disabled={
                        busy ||
                        !assetsHydrated ||
                        flyerHist.entries.length <= 1 ||
                        flyerHist.index >= flyerHist.entries.length - 1
                      }
                      onClick={handleHistoryForward}
                      className="cursor-pointer rounded-full border-none bg-[hsl(0,0%,94%)] p-2 transition-opacity hover:bg-[hsl(0,0%,90%)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <img
                        src="/Halorai Dev/Icons/grommet-icons_revert.svg"
                        alt=""
                        className="h-5 w-5 scale-x-[-1]"
                        aria-hidden
                      />
                    </button>
                  </div>

                  <div className="relative inline-flex">
                    {isDownloadOpen && flyerImage ? (
                      <div
                        className="absolute right-full top-0 z-20 mr-0 min-w-[11rem] rounded-2xl border border-[hsl(0,0%,90%)] bg-white p-2 shadow-lg"
                        role="menu"
                      >
                        <span
                          className="pointer-events-none absolute -right-[4px] top-3 box-border h-2.5 w-2.5 rotate-45 border border-[hsl(0,0%,90%)] border-b-0 border-l-0 bg-white"
                          aria-hidden
                        />
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void handleDownload("png")}
                          className="w-full rounded-xl px-3 py-2 text-left text-sm text-[hsl(0,0%,10%)] transition-colors hover:bg-[hsl(0,0%,97%)]"
                        >
                          PNG
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void handleDownload("jpg")}
                          className="w-full rounded-xl px-3 py-2 text-left text-sm text-[hsl(0,0%,10%)] transition-colors hover:bg-[hsl(0,0%,97%)]"
                        >
                          JPG
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void handleDownload("pdf")}
                          className="w-full rounded-xl px-3 py-2 text-left text-sm text-[hsl(0,0%,10%)] transition-colors hover:bg-[hsl(0,0%,97%)]"
                        >
                          PDF (clear view)
                        </button>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      disabled={!canGenerate || !flyerImage || isDownloading}
                      onClick={() => setIsDownloadOpen((v) => !v)}
                      className={`inline-flex items-center justify-center gap-2 rounded-full border-none px-6 py-3 text-sm font-regular transition-colors ${
                        !canGenerate || !flyerImage || isDownloading
                          ? "cursor-not-allowed bg-[hsl(0,0%,60%)] text-white"
                          : "cursor-pointer bg-[hsl(0,0%,10%)] text-white hover:bg-[hsl(0,0%,20%)]"
                      }`}
                    >
                      {isDownloading ? "Preparing..." : "Download"}
                      <img
                        src="/Halorai Dev/Icons/weui_arrow-outlined-forward.svg"
                        alt=""
                        className="h-4 w-4 pl-1"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column — edit panel */}
            <div className="flex h-full flex-col items-center md:justify-center">
              <FlyerEditPanel
                regions={regions}
                onRemoveRegion={handleRemoveRegion}
                message={message}
                onMessageChange={setMessage}
                textareaDisabled={textareaDisabled}
                directInsertItems={directInsertItems}
                onAddDirectInsert={handleAddDirectInsert}
                onRemoveDirectInsert={handleRemoveDirectInsert}
                plusDisabled={plusDisabled}
                circleMode={circleMode}
                onCircleModeToggle={() => setCircleMode((v) => !v)}
                circleDisabled={circleDisabled}
                maxRegionsReached={maxRegionsReached}
                onSend={() => void handleSend()}
                sendDisabled={sendDisabled}
                isApplying={isApplyingEdits}
                sketchColor={sketchColor}
                onSketchColorChange={setSketchColor}
                sketchColorDisabled={circleDisabled}
              />

              {error ? (
                <div className="mt-3 w-full max-w-[420px]">
                  <div className="text-xs text-[hsl(15,100%,45%)]">{error}</div>
                  {canGenerate ? (
                    <button
                      onClick={() => void generateFlyer()}
                      className="mt-3 inline-flex items-center justify-center rounded-full border-none bg-[hsl(0,0%,10%)] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[hsl(0,0%,20%)]"
                    >
                      Retry
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CreateDesignStep5;
