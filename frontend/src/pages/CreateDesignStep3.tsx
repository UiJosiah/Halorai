import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import CreateDesignHero from "@/components/CreateDesignHero";
import StepperProgress from "@/components/StepperProgress";
import { CUSTOM_CONCEPT_ID, useCreateDesign } from "@/contexts/CreateDesignContext";
import { aiGenerateText } from "@/lib/api";
import ArcLoader from "@/components/ArcLoader";
import { pickSingleImageFile } from "@/lib/singleImagePick";

/** Column 1: ArcLoader slot (same layout as original standalone loader). */
const LEFT_CONTENT_SLOT =
  "ml-0 flex w-full min-w-0 max-w-full min-h-[min(220px,45vw)] shrink flex-col items-center md:items-start md:ml-2 lg:ml-4";

/** Mood board in left column — same responsive card pattern as `HaloRAI` community grid. */
const BASE_COLOUR_IMAGES: { src: string; alt: string }[] = [
  { src: "/Halorai Dev/Base-colours/Base-colour_01.jpg", alt: "Colour sample" },
  { src: "/Halorai Dev/Base-colours/Base-colour_02.jpg", alt: "Colour sample" },
  { src: "/Halorai Dev/Base-colours/Base-colour_03.jpg", alt: "Colour sample" },
  { src: "/Halorai Dev/Base-colours/Base-colour_04.jpg", alt: "Colour sample" },
  { src: "/Halorai Dev/Base-colours/Base-colour_05.jpg", alt: "Colour sample" },
  { src: "/Halorai Dev/Base-colours/Base-colour_06.jpg", alt: "Colour sample" },
  { src: "/Halorai Dev/Base-colours/Base-colour_07.jpg", alt: "Colour sample" },
  { src: "/Halorai Dev/Base-colours/Base-colour_08.jpg", alt: "Colour sample" },
  { src: "/Halorai Dev/Base-colours/Base-colour_09.jpg", alt: "Colour sample" },
  { src: "/Halorai Dev/Base-colours/Base-colour_010.jpg", alt: "Colour sample" },
  { src: "/Halorai Dev/Base-colours/Base-colour_011.jpg", alt: "Colour sample" },
  { src: "/Halorai Dev/Base-colours/Base-colour_012.jpg", alt: "Colour sample" },
];

/**
 * Base colour swatches: 2 / 3 / 4 columns by width.
 * Below md (stacked layout): up to 4 across when the row is wide enough.
 * md+ (3-column page): 2 in the narrow left column, then 3 @950px, 4 @1400px.
 */
const SWATCH_GRID_CLASS =
  "grid w-full min-w-0 grid-cols-2 gap-1.5 max-md:min-[520px]:max-md:grid-cols-3 max-md:min-[700px]:max-md:grid-cols-4 md:grid-cols-2 md:gap-2 min-[950px]:grid-cols-3 min-[1400px]:grid-cols-4";

const MAX_SUGGEST_PER_THEME = 3;
const LS_SUGGEST_COUNTS_BY_THEME = "createDesign_suggestCountsByTheme_v1";

function loadSuggestCountsByTheme(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LS_SUGGEST_COUNTS_BY_THEME);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = Math.floor(v);
    }
    return out;
  } catch {
    return {};
  }
}

/** AI concepts: at most two short lines / brief phrases (enforced after parse for consistency). */
function clampConceptDescription(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const lines = t
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 2);
  const joined = lines.join(" ");
  const maxLen = 220;
  if (joined.length <= maxLen) return joined;
  const cut = joined.slice(0, maxLen).trim();
  const lastSpace = cut.lastIndexOf(" ");
  const wordSafe = lastSpace > 48 ? cut.slice(0, lastSpace) : cut;
  return `${wordSafe}…`;
}

const CreateDesignStep3 = () => {
  const navigate = useNavigate();
  const {
    eventDetails,
    concepts,
    setConcepts,
    conceptsKey,
    setConceptsKey,
    selectedConceptId,
    setSelectedConceptId,
    customConceptText,
    setCustomConceptText,
    conceptReferenceImage,
    setConceptReferenceImage,
    baseColourChoice,
    setBaseColourChoice,
  } = useCreateDesign();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string>("");
  const [suggestCountsByTheme, setSuggestCountsByTheme] = useState<Record<string, number>>(loadSuggestCountsByTheme);
  const conceptInsertInputRef = useRef<HTMLInputElement | null>(null);

  const conceptInsertPreviewUrl = useMemo(
    () => (conceptReferenceImage ? URL.createObjectURL(conceptReferenceImage) : null),
    [conceptReferenceImage]
  );

  useEffect(() => {
    return () => {
      if (conceptInsertPreviewUrl) URL.revokeObjectURL(conceptInsertPreviewUrl);
    };
  }, [conceptInsertPreviewUrl]);

  const theme = eventDetails.theme?.trim() || "";
  const eventName = eventDetails.eventName?.trim() || "";
  const desiredKey = useMemo(() => `${theme}||${eventName}`.trim(), [eventName, theme]);
  const suggestCount = theme ? (suggestCountsByTheme[theme] ?? 0) : 0;
  const atSuggestLimit = suggestCount >= MAX_SUGGEST_PER_THEME;

  const hasRequiredStep1Details = useMemo(() => {
    return (
      !!eventDetails.churchName?.trim() &&
      !!eventDetails.date?.trim() &&
      !!eventDetails.time?.trim() &&
      !!eventDetails.venue?.trim() &&
      !!eventDetails.theme?.trim()
    );
  }, [eventDetails]);

  const conceptsRef = useRef(concepts);
  const conceptsKeyRef = useRef(conceptsKey);
  const selectedConceptIdRef = useRef(selectedConceptId);
  useEffect(() => {
    conceptsRef.current = concepts;
  }, [concepts]);
  useEffect(() => {
    conceptsKeyRef.current = conceptsKey;
  }, [conceptsKey]);
  useEffect(() => {
    selectedConceptIdRef.current = selectedConceptId;
  }, [selectedConceptId]);

  const inFlightRef = useRef(false);
  const suggestCountRef = useRef(suggestCount);
  useEffect(() => {
    suggestCountRef.current = suggestCount;
  }, [suggestCount]);

  useEffect(() => {
    localStorage.setItem(LS_SUGGEST_COUNTS_BY_THEME, JSON.stringify(suggestCountsByTheme));
  }, [suggestCountsByTheme]);

  useEffect(() => {
    if (!hasRequiredStep1Details) {
      navigate("/create-design", { replace: true });
    }
  }, [hasRequiredStep1Details, navigate]);

  useEffect(() => {
    if (customConceptText.trim()) {
      setSelectedConceptId(CUSTOM_CONCEPT_ID);
    }
  }, [customConceptText, setSelectedConceptId]);

  /** No AI suggestions yet (intro: explain + suggest card + custom). Cached 3 concepts counts as ready. */
  const showIntroLayout = concepts.length === 0 && !isAnalyzing;
  const hasColourDecision = baseColourChoice !== null;
  const lockConceptActions = showIntroLayout && !hasColourDecision;

  const generateConcepts = useCallback(
    async () => {
      if (!hasRequiredStep1Details) return;
      if (inFlightRef.current) return;
      if (baseColourChoice === null) return;
      if (!theme) {
        setConcepts([]);
        setSelectedConceptId(null);
        return;
      }

      if (suggestCountRef.current >= MAX_SUGGEST_PER_THEME) {
        setError(`You've used all ${MAX_SUGGEST_PER_THEME} AI suggestions for this theme. Edit the text or change the theme on Step 1.`);
        return;
      }

      inFlightRef.current = true;
      setError("");
      setIsAnalyzing(true);

      const prompt = [
        "Generate exactly ONE visual background concept for a church event flyer.",
        "The THEME is the primary creative anchor. The event name is optional background context only — do not let long titles drive the imagery.",
        `Theme: ${JSON.stringify(theme)}`,
        eventName ? `Event name (light context only): ${JSON.stringify(eventName)}` : "",
        "",
        "Instructions (follow strictly):",
        "- The concept must express the THEME as one clear visual metaphor (a concrete scene or setting).",
        "- The `description` must be extremely concise: at most TWO lines in total, each line only a short phrase (no paragraphs, no numbered lists inside the string).",
        "- Hard cap: description under ~220 characters including spaces.",
        "- `label` must be a very short title (a few words, under ~40 characters).",
        "- Do NOT mention text, layout, typography, logos, or UI — only the visual scene.",
        "- Use simple, clear English.",
        "",
        "Output (STRICT): Return ONLY valid JSON. No markdown. No extra keys.",
        '{"label":"Suggested concept","description":"..."}',
      ]
        .filter(Boolean)
        .join("\n");

      try {
        const res = await aiGenerateText(prompt);
        const txt = (res.text || "").trim();
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(txt);
        } catch {
          parsed = null;
        }

        const asConceptArray = (value: unknown): Array<{ label?: unknown; description?: unknown; text?: unknown }> => {
          if (!Array.isArray(value)) return [];
          return value.filter((v) => v !== null && typeof v === "object") as Array<{
            label?: unknown;
            description?: unknown;
            text?: unknown;
          }>;
        };

        const parseOne = (): { label: string; description: string } | null => {
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            const o = parsed as { label?: unknown; description?: unknown; text?: unknown };
            const description = clampConceptDescription(
              String(o.description ?? o.text ?? "")
            );
            if (!description) return null;
            return {
              label: String(o.label ?? "Suggested concept").trim().slice(0, 48) || "Suggested concept",
              description,
            };
          }
          const fromArr = asConceptArray(parsed);
          if (fromArr.length) {
            const c = fromArr[0];
            const description = clampConceptDescription(
              String(c.description ?? c.text ?? "")
            );
            if (!description) return null;
            return {
              label: String(c.label ?? "Suggested concept").trim().slice(0, 48) || "Suggested concept",
              description,
            };
          }
          const line = txt
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)[0];
          if (!line) return null;
          return {
            label: "Suggested concept",
            description: clampConceptDescription(line.replace(/^[-*\d.)\s]+/, "")),
          };
        };

        const one =
          parseOne() ?? {
            label: "Suggested concept",
            description: clampConceptDescription(`Warm glow and soft light echoing "${theme}".`),
          };

        if (!txt || !one.description) {
          setError("AI returned no suggestion. Showing a default concept. You can retry or edit the text.");
        }

        setConceptsKey(desiredKey);
        setConcepts([{ id: 1, label: one.label, description: one.description }]);
        setCustomConceptText(one.description);
        setSelectedConceptId(CUSTOM_CONCEPT_ID);
        setSuggestCountsByTheme((prev) => ({
          ...prev,
          [theme]: Math.min(MAX_SUGGEST_PER_THEME, (prev[theme] ?? 0) + 1),
        }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to generate concepts.";
        if (customConceptText.trim() && conceptsKeyRef.current === desiredKey) {
          setError("");
          return;
        }

        const shortMsg = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") ? "Rate limit reached. Please wait a bit and retry." : "Failed to generate concepts. Please retry.";
        setError(shortMsg);
      } finally {
        setIsAnalyzing(false);
        inFlightRef.current = false;
      }
    },
    [
      baseColourChoice,
      customConceptText,
      desiredKey,
      eventName,
      hasRequiredStep1Details,
      setConcepts,
      setConceptsKey,
      setCustomConceptText,
      setSelectedConceptId,
      theme,
    ]
  );

  const hasCustomConcept = !!customConceptText.trim();
  const canContinue = hasCustomConcept && !lockConceptActions;

  const handleConceptInputChange = (value: string) => {
    setCustomConceptText(value);
    setSelectedConceptId(CUSTOM_CONCEPT_ID);
  };

  const suggestConceptDisabled = !theme || lockConceptActions || isAnalyzing || atSuggestLimit;

  const hasAttachedReference = !!conceptReferenceImage;

  const handleConceptInsertPick = (list: FileList | null) => {
    const f = pickSingleImageFile(list);
    if (!f) return;
    setConceptReferenceImage(f);
    if (conceptInsertInputRef.current) conceptInsertInputRef.current.value = "";
  };

  const handleClearConceptInsert = () => {
    setConceptReferenceImage(null);
    if (conceptInsertInputRef.current) conceptInsertInputRef.current.value = "";
  };

  /** Left-column analyzer: show while generating and after a suggestion is ready. */
  const showLeftAnalyzer = isAnalyzing || hasCustomConcept;

  return (
    <AppLayout>
      <CreateDesignHero title="Create Design" />
      <StepperProgress currentStep={3} />

      <div className="px-4 xs:px-0">
        <div className="min-w-0 overflow-hidden border border-[hsl(0,0%,80%)] rounded-2xl p-4 sm:p-6 md:p-8">
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,auto)] md:items-stretch lg:gap-8">
            {/* Left Column */}
            <div className="flex min-w-0 w-full max-w-full flex-col">
              <h2 className="mb-1 text-lg font-semibold text-[hsl(0,0%,10%)] md:mb-5 md:text-xl">
                Background Concept
              </h2>
              <p className="mb-8 max-w-full text-sm text-[hsl(0,0%,55%)] md:mb-12">
                Pick a base colour, then describe your background or use Suggest concept
              </p>

              <div className="mt-4 flex w-full min-w-0 flex-col items-start justify-start gap-6">
                {showLeftAnalyzer ? (
                  <div className={LEFT_CONTENT_SLOT}>
                    <div className="flex flex-1 flex-col items-center justify-start pt-0">
                      <div className="w-full max-w-[min(100%,11.25rem)]">
                      <ArcLoader
                        fluid
                        size={180}
                        label={
                          isAnalyzing ? (
                            <span>
                              Analyzing
                              <br />
                              your theme...
                            </span>
                          ) : (
                            <img src="/Halorai Dev/Images/checkmark.svg" alt="Done" className="w-14 h-14" />
                          )
                        }
                        spinning={isAnalyzing}
                        spinDurationMs={2600}
                      />
                      </div>
                    </div>
                  </div>
                ) : null}

              <h2 className="text-lg font-semibold text-[hsl(0,0%,10%)] md:text-xl">
                Select Base Colour
              </h2>
                <div className="ml-0 w-full min-w-0 max-w-full md:ml-2 lg:ml-4">
                  <div className={SWATCH_GRID_CLASS}>
                    {BASE_COLOUR_IMAGES.map((item) => {
                      const selected = baseColourChoice === item.src;
                      return (
                        <button
                          key={item.src}
                          type="button"
                          aria-pressed={selected}
                          aria-label={`Use ${item.alt}`}
                          onClick={() => setBaseColourChoice(item.src)}
                          className={`group relative aspect-square w-full min-w-0 cursor-pointer overflow-hidden rounded-lg border-2 border-transparent p-0 shadow-[0_1px_8px_rgba(0,0,0,0.08)] outline-none transition-[transform,box-shadow,ring] xs:rounded-xl focus-visible:ring-2 focus-visible:ring-[hsl(330,100%,70%)] focus-visible:ring-offset-2 ${
                            selected
                              ? "z-[1] ring-2 ring-[hsl(330,100%,78%)] ring-offset-2 ring-offset-[hsl(0,0%,100%)] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.18)]"
                              : "hover:z-[1] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-12px_rgba(0,0,0,0.2)] hover:ring-1 hover:ring-[hsl(0,0%,78%)]"
                          }`}
                        >
                          <img
                            src={item.src}
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.04]"
                            loading="lazy"
                            decoding="async"
                          />
                          {selected ? (
                            <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-inset ring-[hsl(330,100%,88%)]" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    aria-pressed={baseColourChoice === "skip"}
                    onClick={() => setBaseColourChoice("skip")}
                    className={`mt-3 w-full rounded-xl border-2 px-3 py-2.5 text-sm font-medium outline-none transition-[background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-[hsl(330,100%,70%)] focus-visible:ring-offset-2 ${
                      baseColourChoice === "skip"
                        ? "border-[hsl(330,100%,78%)] bg-[hsl(330,100%,97%)] text-[hsl(0,0%,10%)] shadow-[0_0_0_1px_hsl(330,100%,85%)]"
                        : "border-[hsl(0,0%,85%)] bg-[hsl(0,0%,98%)] text-[hsl(0,0%,35%)] hover:border-[hsl(0,0%,68%)] hover:bg-[hsl(0,0%,100%)]"
                    }`}
                  >
                    Skip — let AI choose colours
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column — concept composer (Step 3ii-style) + AI suggestions */}
            <div className="flex min-w-0 w-full max-w-full flex-col gap-4">
              <h2 className="text-base font-bold text-[hsl(0,0%,10%)] md:text-lg lg:text-xl">Create Background Concept</h2>
              <p className="max-w-full text-sm text-[hsl(0,0%,55%)]">
                Prompt it, edit it, attach one reference image, and shape the background exactly how you imagine it
              </p>

              {lockConceptActions ? (
                <p className="text-xs text-[hsl(330,100%,38%)]">Select a base colour on the left to continue.</p>
              ) : null}

              <div className="flex min-h-[min(220px,40vh)] w-full min-w-0 max-w-full flex-col rounded-2xl border border-[hsl(0,0%,92%)] bg-[hsl(0,0%,97%)] p-3 sm:p-4">
                <input
                  ref={conceptInsertInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleConceptInsertPick(e.target.files)}
                />
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  {conceptInsertPreviewUrl ? (
                    <div className="relative inline-flex shrink-0 self-start">
                      <img
                        src={conceptInsertPreviewUrl}
                        alt=""
                        className="h-14 w-14 rounded-lg border border-[hsl(0,0%,88%)] object-cover"
                      />
                      <button
                        type="button"
                        onClick={handleClearConceptInsert}
                        disabled={lockConceptActions || isAnalyzing}
                        className="absolute -right-0.5 -top-0.5 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border-none bg-[hsl(15,100%,55%)] disabled:opacity-50"
                        aria-label="Remove image"
                      >
                        <img src="/Halorai Dev/Icons/cancel.svg" alt="" className="h-2 w-2 brightness-0 invert" />
                      </button>
                    </div>
                  ) : null}
                  <textarea
                    value={customConceptText}
                    disabled={lockConceptActions || isAnalyzing}
                    onChange={(e) => handleConceptInputChange(e.target.value)}
                    onFocus={() => {
                      if (!lockConceptActions) setSelectedConceptId(CUSTOM_CONCEPT_ID);
                    }}
                    placeholder="e.g A wall of fire... add fire sparks, flames"
                    className="min-h-[120px] w-full flex-1 resize-none border-none bg-transparent text-sm text-[hsl(0,0%,10%)] outline-none placeholder:text-[hsl(0,0%,55%)] disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </div>
                <div className="mt-2 flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      disabled={suggestConceptDisabled}
                      onClick={() => void generateConcepts()}
                      aria-label={`Suggest concept (${suggestCount} of ${MAX_SUGGEST_PER_THEME} used for this theme)`}
                      aria-busy={isAnalyzing}
                      className={`shrink-0 border-none bg-transparent p-0 transition-opacity ${
                        isAnalyzing
                          ? "cursor-not-allowed"
                          : suggestConceptDisabled
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer hover:opacity-80"
                      }`}
                    >
                      <img
                        src="/Halorai Dev/Icons/suggest concept.png"
                        alt=""
                        className={`h-9 w-auto object-contain sm:h-10 ${isAnalyzing ? "animate-suggest-blink" : ""}`}
                      />
                    </button>
                    <span
                      className={`text-[11px] font-medium tabular-nums sm:text-xs ${
                        atSuggestLimit ? "text-[hsl(330,100%,42%)]" : "text-[hsl(0,0%,50%)]"
                      }`}
                      aria-live="polite"
                    >
                      {suggestCount}/{MAX_SUGGEST_PER_THEME}
                    </span>
                  </div>
                  <button
                    type="button"
                    title={
                      hasAttachedReference
                        ? "Remove the image above to attach a different one"
                        : "Attach one reference image for the AI"
                    }
                    disabled={lockConceptActions || isAnalyzing || hasAttachedReference}
                    onClick={() => conceptInsertInputRef.current?.click()}
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
                </div>
              </div>

              {error ? (
                <div className="flex w-full min-w-0 max-w-full flex-col gap-2 text-sm text-[hsl(0,0%,40%)]">
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => void generateConcepts()}
                    disabled={suggestConceptDisabled}
                    className="w-fit rounded-full border-none bg-[hsl(0,0%,10%)] px-4 py-2 text-xs font-medium text-white hover:bg-[hsl(0,0%,20%)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Retry suggestions
                  </button>
                </div>
              ) : null}
            </div>

            {/* Third column — navigation fixed to bottom of card */}
            <div className="flex w-full min-w-0 max-w-full flex-col justify-end md:min-h-full">
              <div className="flex flex-wrap items-center justify-end gap-2 max-md:pt-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/create-design/step-2")}
                  className="flex min-w-0 shrink items-center gap-1.5 rounded-full bg-[hsl(0,0%,95%)] px-3 py-2.5 text-[11px] font-medium text-[hsl(0,0%,10%)] transition-all duration-150 ease-out hover:scale-[1.01] hover:opacity-90 active:scale-[0.99] sm:gap-2 sm:px-4 sm:py-3 sm:text-xs cursor-pointer"
                >
                  <img
                    src="/Halorai Dev/Icons/weui_arrow-outlined.svg"
                    alt="Back"
                    className="w-3.5 h-3.5 brightness-0"
                  />
                  Go back
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/create-design/step-3ii")}
                  disabled={isAnalyzing || !canContinue}
                  className={`flex min-w-0 shrink items-center gap-1.5 rounded-full border-none px-3 py-2.5 text-[11px] font-medium transition-all duration-150 ease-out hover:scale-[1.01] hover:opacity-90 active:scale-[0.99] sm:gap-2 sm:px-4 sm:py-3 sm:text-xs ${
                    isAnalyzing || !canContinue
                      ? "cursor-not-allowed bg-[hsl(0,0%,60%)] text-white"
                      : "cursor-pointer bg-[hsl(0,0%,10%)] text-white hover:bg-[hsl(0,0%,20%)]"
                  }`}
                >
                  Continue
                  <img
                    src="/Halorai Dev/Icons/weui_arrow-outlined-forward.svg"
                    alt="Forward"
                    className="w-3.5 h-3.5"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CreateDesignStep3;
