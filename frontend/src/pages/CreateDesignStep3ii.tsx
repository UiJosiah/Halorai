import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import CreateDesignHero from "@/components/CreateDesignHero";
import StepperProgress from "@/components/StepperProgress";
import { useCreateDesign, type FlyerImage } from "@/contexts/CreateDesignContext";
import { aiGenerateImage, type AiImageReference } from "@/lib/api";
import { downloadFlyer } from "@/lib/downloadFlyer";
import ArcLoader from "@/components/ArcLoader";

function buildBackgroundPrompt(
  concept: string,
  theme: string,
  refinement: string,
  opts?: { hasReferenceImages: boolean }
): string {
  const lines = [
    "Use simple, clear English. Generate ONE portrait 4:5 image (Instagram-style aspect ratio) that is ONLY a flyer background.",
    "Rules: no text, no letters, no numbers, no logos, no faces, no watermark, no UI frames.",
    "Full-bleed background suitable for placing event text and photos on later.",
    "Strong lighting, cinematic mood, visually striking.",
  ];
  if (opts?.hasReferenceImages) {
    lines.push(
      "",
      "Reference images are attached in order. The first reference may be the current AI background to revise; any following images are user uploads (mood, palette, texture, or composition hints).",
      "Follow the user-written instructions. Output must remain a clean background with no overlaid text."
    );
  }
  lines.push("", "Core visual idea:", concept.trim());
  if (theme.trim()) {
    lines.push("", `Overall event theme for mood only (do not write this as text on the image): ${theme.trim()}`);
  }
  if (refinement.trim()) {
    lines.push("", `User instructions / edits: ${refinement.trim()}`);
  }
  return lines.join("\n");
}

function cacheKey(concept: string, theme: string, refinement: string, refExtra = ""): string {
  return JSON.stringify({ c: concept.trim(), t: theme.trim(), r: refinement.trim(), x: refExtra });
}

function parseCacheKey(key: string): { c: string; t: string; r: string; x?: string } | null {
  if (!key.trim()) return null;
  try {
    const o = JSON.parse(key) as { c?: string; t?: string; r?: string; x?: string };
    if (typeof o?.c === "string" && typeof o?.t === "string" && typeof o?.r === "string") {
      return { c: o.c, t: o.t, r: o.r, x: typeof o.x === "string" ? o.x : "" };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function sendRefExtra(insertFile: File | null, includeCurrentBackground: boolean): string {
  const a = insertFile ? `${insertFile.name}:${insertFile.size}:${insertFile.lastModified}` : "";
  return JSON.stringify({ p: includeCurrentBackground ? 1 : 0, a });
}

type BackgroundHistoryEntry = { image: FlyerImage; key: string };

type BgHistState = { entries: BackgroundHistoryEntry[]; index: number };

/** Extend history from the latest snapshot, not from `index + 1`, so a new gen never drops versions when index < tip. */
function buildNextBackgroundHist(h: BgHistState, image: FlyerImage, key: string): { next: BgHistState; changed: boolean } {
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

/** First auto-gen + two edits = 3 AI images max for this concept/theme on Step 3ii. */
const MAX_BG_GENERATIONS = 3;

const LS_STEP3II_BG_GEN_COUNT = "createDesign_step3ii_backgroundGenCount_v1";

function loadStep3iiGenCount(baseKey: string): number {
  try {
    const raw = localStorage.getItem(LS_STEP3II_BG_GEN_COUNT);
    if (!raw) return 0;
    const o = JSON.parse(raw) as { baseKey?: unknown; count?: unknown };
    if (typeof o?.baseKey === "string" && o.baseKey === baseKey && typeof o.count === "number") {
      const n = Math.floor(o.count);
      if (!Number.isFinite(n)) return 0;
      return Math.max(0, Math.min(MAX_BG_GENERATIONS, n));
    }
  } catch {
    /* ignore */
  }
  return 0;
}

function saveStep3iiGenCount(baseKey: string, count: number): void {
  try {
    const n = Math.max(0, Math.min(MAX_BG_GENERATIONS, Math.floor(count)));
    if (!Number.isFinite(n)) return;
    localStorage.setItem(LS_STEP3II_BG_GEN_COUNT, JSON.stringify({ baseKey, count: n }));
  } catch {
    /* ignore */
  }
}

async function fileToRef(file: File): Promise<AiImageReference> {
  const mimeType = file.type || "image/png";
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error || new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return { mimeType, base64 };
}

const CreateDesignStep3ii = () => {
  const navigate = useNavigate();
  const {
    assetsHydrated,
    eventDetails,
    selectedConceptDescription,
    backgroundPreviewImage,
    setBackgroundPreviewImage,
    backgroundPreviewKey,
    setBackgroundPreviewKey,
    setBackgroundRefinementNotes,
  } = useCreateDesign();

  const theme = eventDetails.theme?.trim() || "";
  const concept = selectedConceptDescription.trim();

  const filenameBase = useMemo(() => {
    return eventDetails.eventName?.trim() || eventDetails.theme?.trim() || "flyer";
  }, [eventDetails.eventName, eventDetails.theme]);

  const [message, setMessage] = useState("");
  /** At most one image from the insert control; sent with the current AI background for edits. */
  const [chatInsertImage, setChatInsertImage] = useState<File | null>(null);
  const chatInsertInputRef = useRef<HTMLInputElement | null>(null);

  const chatInsertPreviewUrl = useMemo(
    () => (chatInsertImage ? URL.createObjectURL(chatInsertImage) : null),
    [chatInsertImage]
  );

  useEffect(() => {
    return () => {
      if (chatInsertPreviewUrl) URL.revokeObjectURL(chatInsertPreviewUrl);
    };
  }, [chatInsertPreviewUrl]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const inFlightRef = useRef(false);
  const baseCacheKey = useMemo(() => cacheKey(concept, theme, "", ""), [concept, theme]);
  const [generationsUsed, setGenerationsUsed] = useState(() => loadStep3iiGenCount(baseCacheKey));
  const generationsUsedRef = useRef(0);
  generationsUsedRef.current = generationsUsed;
  const editsRemaining = Math.max(0, MAX_BG_GENERATIONS - generationsUsed);

  useEffect(() => {
    saveStep3iiGenCount(baseCacheKey, generationsUsed);
  }, [baseCacheKey, generationsUsed]);

  /** Snapshots of successful generations for back/forward within this step. */
  const [bgHist, setBgHist] = useState<BgHistState>({
    entries: [],
    index: -1,
  });
  const bgHistRef = useRef(bgHist);
  bgHistRef.current = bgHist;

  const prevBaseCacheKeyRef = useRef<string | null>(null);
  /** Prevents context-hydration effect from racing with append after a new generation. */
  const historyInitFromContextRef = useRef(false);

  useEffect(() => {
    if (prevBaseCacheKeyRef.current === null) {
      prevBaseCacheKeyRef.current = baseCacheKey;
      return;
    }
    if (prevBaseCacheKeyRef.current !== baseCacheKey) {
      prevBaseCacheKeyRef.current = baseCacheKey;
      setBgHist({ entries: [], index: -1 });
      historyInitFromContextRef.current = false;
      const nextCount = loadStep3iiGenCount(baseCacheKey);
      generationsUsedRef.current = nextCount;
      setGenerationsUsed(nextCount);
    }
  }, [baseCacheKey]);

  /** Seed history once from context when a preview exists but nothing is in the stack yet (e.g. IDB). */
  useEffect(() => {
    if (historyInitFromContextRef.current) return;
    if (!backgroundPreviewImage?.base64 || !backgroundPreviewKey.trim()) return;
    if (bgHistRef.current.entries.length > 0) {
      historyInitFromContextRef.current = true;
      return;
    }
    historyInitFromContextRef.current = true;
    setBgHist({
      entries: [{ image: backgroundPreviewImage, key: backgroundPreviewKey }],
      index: 0,
    });
    generationsUsedRef.current = Math.max(generationsUsedRef.current, 1);
    setGenerationsUsed((u) => Math.max(u, 1));
  }, [backgroundPreviewImage, backgroundPreviewKey]);

  useEffect(() => {
    if (!concept) {
      navigate("/create-design/step-3", { replace: true });
    }
  }, [concept, navigate]);

  const runGeneration = useCallback(
    async (refinement: string, requestKey: string, referenceImages?: AiImageReference[]): Promise<boolean> => {
      if (!concept.trim() || inFlightRef.current) return false;
      if (generationsUsedRef.current >= MAX_BG_GENERATIONS) {
        setError("You have used all background generations for this concept. Continue or go back to change the concept.");
        return false;
      }
      inFlightRef.current = true;
      setIsGenerating(true);
      setError("");
      try {
        const hasRefs = (referenceImages?.length ?? 0) > 0;
        const prompt = buildBackgroundPrompt(concept, theme, refinement, { hasReferenceImages: hasRefs });
        const res = await aiGenerateImage({
          prompt,
          aspectRatio: "4:5",
          numberOfImages: 1,
          ...(hasRefs ? { referenceImages } : {}),
        });
        const first = res.images?.[0];
        if (!first?.base64) {
          setError("No background image returned. Try again.");
          return false;
        }
        const nextImage = { mimeType: first.mimeType || "image/png", base64: first.base64 };
        setBackgroundPreviewImage(nextImage);
        setBackgroundPreviewKey(requestKey);
        const snap = bgHistRef.current;
        const { next: nextHist, changed } = buildNextBackgroundHist(snap, nextImage, requestKey);
        if (changed) {
          historyInitFromContextRef.current = true;
          setBgHist(nextHist);
          generationsUsedRef.current += 1;
          setGenerationsUsed(generationsUsedRef.current);
        }
        return true;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Generation failed.");
        return false;
      } finally {
        setIsGenerating(false);
        inFlightRef.current = false;
      }
    },
    [concept, setBackgroundPreviewImage, setBackgroundPreviewKey, theme]
  );

  // Auto-generate only when we still need a base image for this concept+theme.
  // Same concept+theme must never re-run AI (refinements use different keys but same c,t).
  // If `backgroundPreviewKey` is empty or not JSON, `stored` is null — we must still skip when a preview
  // exists, otherwise history navigation (back/forward) would look like "Revert calls AI again".
  useEffect(() => {
    if (!assetsHydrated || !concept.trim()) return;
    if (generationsUsedRef.current >= MAX_BG_GENERATIONS) return;
    const hist = bgHistRef.current;
    // Revert/forward only change which snapshot is shown — never treat that as "missing image" and auto-call AI.
    if (hist.entries.length > 0 && (hist.index < 0 || hist.index < hist.entries.length - 1)) return;
    const baseParts = parseCacheKey(baseCacheKey);
    const stored = backgroundPreviewKey ? parseCacheKey(backgroundPreviewKey) : null;
    const havePreview = !!backgroundPreviewImage?.base64?.trim();
    const sameConceptTheme =
      havePreview &&
      !!baseParts &&
      (!stored || (stored.c === baseParts.c && stored.t === baseParts.t));
    if (sameConceptTheme) return;
    void runGeneration("", baseCacheKey);
  }, [assetsHydrated, backgroundPreviewImage, backgroundPreviewKey, baseCacheKey, concept, runGeneration]);

  /** Text only, image only, or both; image-only requires a current AI preview to revise. */
  const atGenerationLimit = generationsUsed >= MAX_BG_GENERATIONS;
  const canSend =
    !atGenerationLimit &&
    (message.trim().length > 0 || !!chatInsertImage) &&
    (!chatInsertImage || !!backgroundPreviewImage);

  const handleSendRefinement = async () => {
    if (!canSend || !assetsHydrated || isGenerating || atGenerationLimit) return;
    const refinement = message.trim();
    const includeBg = !!backgroundPreviewImage;
    const extra = sendRefExtra(chatInsertImage, includeBg);
    const key = cacheKey(concept, theme, refinement, extra);

    const refs: AiImageReference[] = [];
    if (backgroundPreviewImage) {
      refs.push({
        mimeType: backgroundPreviewImage.mimeType,
        base64: backgroundPreviewImage.base64,
      });
    }
    if (chatInsertImage) {
      refs.push(await fileToRef(chatInsertImage));
    }
    const ok =
      refs.length === 0 ? await runGeneration(refinement, key) : await runGeneration(refinement, key, refs);
    if (ok) {
      setMessage("");
      setChatInsertImage(null);
      if (chatInsertInputRef.current) chatInsertInputRef.current.value = "";
    }
  };

  const handleHistoryBack = () => {
    const h = bgHistRef.current;
    if (isGenerating || !assetsHydrated || h.entries.length <= 1 || h.index <= 0) return;
    const ni = h.index - 1;
    const e = h.entries[ni];
    setBackgroundPreviewImage(e.image);
    setBackgroundPreviewKey(e.key);
    setBgHist({ ...h, index: ni });
  };

  const handleHistoryForward = () => {
    const h = bgHistRef.current;
    if (isGenerating || !assetsHydrated || h.entries.length <= 1 || h.index >= h.entries.length - 1) return;
    const ni = h.index + 1;
    const e = h.entries[ni];
    setBackgroundPreviewImage(e.image);
    setBackgroundPreviewKey(e.key);
    setBgHist({ ...h, index: ni });
  };

  const handleChatInsertPick = (list: FileList | null) => {
    if (!list?.length) return;
    const f = Array.from(list).find((file) => file.type.startsWith("image/"));
    if (!f) return;
    setChatInsertImage(f);
    if (chatInsertInputRef.current) chatInsertInputRef.current.value = "";
  };

  const handleClearChatInsert = () => {
    setChatInsertImage(null);
    if (chatInsertInputRef.current) chatInsertInputRef.current.value = "";
  };

  const handleDownload = async (format: "png" | "jpg" | "pdf") => {
    if (!backgroundPreviewImage) return;
    setIsDownloadOpen(false);
    setIsDownloading(true);
    try {
      await downloadFlyer({ flyer: backgroundPreviewImage, filenameBase, format });
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (isGenerating || !backgroundPreviewImage) setIsDownloadOpen(false);
  }, [isGenerating, backgroundPreviewImage]);

  const showCenterLoader = !assetsHydrated || isGenerating || (!backgroundPreviewImage && !error);

  return (
    <AppLayout>
      <CreateDesignHero title="Create Design" />
      <StepperProgress currentStep={3} />

      <div className="px-4 xs:px-0">
        <div className="border border-[hsl(0,0%,80%)] rounded-2xl p-6 md:p-8">
          <div className="grid grid-cols-1 gap-y-8 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:gap-x-6 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] max-md:items-center max-md:justify-items-center">
            {/* Left: background preview + overlay controls */}
            <div className="flex min-w-0 w-full max-w-full flex-col max-md:items-center">
              <div className="relative mx-auto aspect-[4/5] w-full max-w-[min(100%,20rem)] rounded-2xl bg-[hsl(0,0%,88%)] ring-1 ring-[hsl(0,0%,90%)] md:mx-0 md:max-w-none">
                <div className="absolute inset-0 overflow-hidden rounded-2xl">
                  {backgroundPreviewImage ? (
                    <img
                      src={`data:${backgroundPreviewImage.mimeType};base64,${backgroundPreviewImage.base64}`}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null}

                  {showCenterLoader ? (
                    <div className="absolute inset-0 z-[1] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                      <ArcLoader
                        size={180}
                        label={
                          !assetsHydrated ? (
                            "Loading..."
                          ) : (
                            <span>
                              Creating
                              <br />
                              your background...
                            </span>
                          )
                        }
                        spinning={!assetsHydrated || isGenerating}
                        spinDurationMs={2600}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[2] flex justify-end">
                  <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-white/40 px-2 py-2 shadow-lg backdrop-blur-xl">
                    <button
                      type="button"
                      aria-label="Previous generated background"
                      title="Previous version (no new AI call)"
                      disabled={
                        isGenerating || !assetsHydrated || bgHist.entries.length <= 1 || bgHist.index <= 0
                      }
                      onClick={handleHistoryBack}
                      className="cursor-pointer border-none bg-transparent p-1 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <img src="/Halorai Dev/Icons/grommet-icons_revert.svg" alt="" className="h-7 w-7" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label="Next generated background"
                      title="Next version (no new AI call)"
                      disabled={
                        isGenerating ||
                        !assetsHydrated ||
                        bgHist.entries.length <= 1 ||
                        bgHist.index < 0 ||
                        bgHist.index >= bgHist.entries.length - 1
                      }
                      onClick={handleHistoryForward}
                      className="cursor-pointer border-none bg-transparent p-1 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <img
                        src="/Halorai Dev/Icons/grommet-icons_revert.svg"
                        alt=""
                        className="h-7 w-7 scale-x-[-1]"
                        aria-hidden
                      />
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        title={isDownloading ? "Preparing download…" : "Download background"}
                        disabled={!backgroundPreviewImage || isGenerating || isDownloading || !assetsHydrated}
                        onClick={() => setIsDownloadOpen((v) => !v)}
                        className="cursor-pointer border-none bg-transparent transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <img
                          src="/Halorai Dev/Icons/material-symbols-light_download.svg"
                          alt={isDownloading ? "Preparing" : "Download"}
                          className="h-12 w-12"
                        />
                      </button>

                      {isDownloadOpen && backgroundPreviewImage ? (
                        <div className="absolute right-0 z-20 mt-2 min-w-[11rem] rounded-2xl border border-[hsl(0,0%,90%)] bg-white p-2 shadow-lg">
                          <button
                            type="button"
                            onClick={() => void handleDownload("png")}
                            className="w-full rounded-xl px-3 py-2 text-left text-sm text-[hsl(0,0%,10%)] transition-colors hover:bg-[hsl(0,0%,97%)]"
                          >
                            PNG
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDownload("jpg")}
                            className="w-full rounded-xl px-3 py-2 text-left text-sm text-[hsl(0,0%,10%)] transition-colors hover:bg-[hsl(0,0%,97%)]"
                          >
                            JPG
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDownload("pdf")}
                            className="w-full rounded-xl px-3 py-2 text-left text-sm text-[hsl(0,0%,10%)] transition-colors hover:bg-[hsl(0,0%,97%)]"
                          >
                            PDF (clear view)
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {error ? (
                <div className="mt-3 text-sm text-[hsl(15,100%,40%)]">
                  {error}
                  <button
                    type="button"
                    disabled={atGenerationLimit}
                    onClick={() => void runGeneration("", baseCacheKey)}
                    className="ml-3 rounded-full border-none bg-[hsl(0,0%,10%)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[hsl(0,0%,25%)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Retry
                  </button>
                </div>
              ) : null}
            </div>

            {/* Right Column - Create Background Concept */}
            <div className="flex min-w-0 flex-col max-md:items-center max-md:w-full">
              <h2 className="text-lg md:text-xl font-bold text-[hsl(0,0%,10%)] mb-2">
                Edit Background Concept
              </h2>
              <p className="text-sm text-[hsl(0,0%,55%)] mb-2 max-w-[420px]">
                Prompt it, edit it, upload images, and shape the background exactly how you imagine it
              </p>

              {/* Text to show generation limit */}
              <p className="mb-4 text-xs text-[hsl(0,0%,45%)] max-w-[420px]">
                {atGenerationLimit
                  ? "You have used all 3 background generations (first load + 2 edits). Use the arrows on the preview to review versions, or Continue."
                  : `${editsRemaining} generation${editsRemaining === 1 ? "" : "s"} left for this concept (first image + up to 2 edits).`}
              </p>

              {/* Chat-style textarea + single insert image */}
              <div className="flex min-h-[220px] w-full min-w-0 max-w-[min(100%,22.5rem)] flex-col rounded-2xl border border-[hsl(0,0%,92%)] bg-[hsl(0,0%,97%)] p-4 sm:max-w-[min(100%,24.5rem)] md:max-w-[min(100%,26.5rem)] lg:max-w-[min(100%,28rem)]">
                <input
                  ref={chatInsertInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleChatInsertPick(e.target.files)}
                />
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  {chatInsertPreviewUrl ? (
                    <div className="relative inline-flex shrink-0 self-start">
                      <img
                        src={chatInsertPreviewUrl}
                        alt=""
                        className="h-14 w-14 rounded-lg border border-[hsl(0,0%,88%)] object-cover"
                      />
                      <button
                        type="button"
                        onClick={handleClearChatInsert}
                        className="absolute -right-0.5 -top-0.5 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border-none bg-[hsl(15,100%,55%)]"
                        aria-label="Remove image"
                      >
                        <img
                          src="/Halorai Dev/Icons/cancel.svg"
                          alt=""
                          className="h-2 w-2 brightness-0 invert"
                        />
                      </button>
                    </div>
                  ) : null}
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={atGenerationLimit}
                    placeholder="e.g A wall of fire... add fire sparks, flames"
                    className="min-h-[120px] w-full flex-1 resize-none border-none bg-transparent text-sm text-[hsl(0,0%,10%)] outline-none placeholder:text-[hsl(0,0%,55%)] disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </div>
                <div className="mt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    title="Insert one image (reference for the AI)"
                    disabled={atGenerationLimit || isGenerating || !assetsHydrated}
                    onClick={() => chatInsertInputRef.current?.click()}
                    className="cursor-pointer rounded-full border-none bg-white p-2 transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                    disabled={!canSend || !assetsHydrated || isGenerating || atGenerationLimit}
                    onClick={() => void handleSendRefinement()}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none bg-black transition-colors hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <img src="/Halorai Dev/Icons/send Vector.svg" alt="Send" className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Buttons - inside the right column on mobile so they stay within content bounds */}
              <div className="flex items-center justify-end gap-3 pt-6 w-full max-md:max-w-[min(100%,22.5rem)]">
                <button
                  type="button"
                  onClick={() => navigate("/create-design/step-3")}
                  className="flex cursor-pointer items-center gap-2 rounded-full border-none bg-[hsl(0,0%,95%)] px-4 py-3 text-xs font-medium text-[hsl(0,0%,10%)] whitespace-nowrap transition-all duration-150 ease-out hover:scale-[1.01] hover:opacity-90 active:scale-[0.99]"
                >
                  <img src="/Halorai Dev/Icons/weui_arrow-outlined.svg" alt="Back" className="h-3.5 w-3.5 brightness-0" />
                  Go back
                </button>
                <button
                  type="button"
                  disabled={!assetsHydrated || isGenerating || !backgroundPreviewImage}
                  onClick={() => {
                    setBackgroundRefinementNotes(message.trim());
                    navigate("/create-design/step-4");
                  }}
                  className={`flex items-center gap-2 rounded-full border-none px-4 py-3 text-xs font-medium text-white whitespace-nowrap transition-all duration-150 ease-out hover:scale-[1.01] active:scale-[0.99] ${
                    !assetsHydrated || isGenerating || !backgroundPreviewImage
                      ? "cursor-not-allowed bg-[hsl(0,0%,60%)]"
                      : "cursor-pointer bg-[hsl(0,0%,10%)] hover:bg-[hsl(0,0%,20%)]"
                  }`}
                >
                  Continue
                  <img src="/Halorai Dev/Icons/weui_arrow-outlined-forward.svg" alt="Forward" className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CreateDesignStep3ii;
