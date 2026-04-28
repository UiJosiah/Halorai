import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import CreateDesignHero from "@/components/CreateDesignHero";
import StepperProgress from "@/components/StepperProgress";
import { CUSTOM_CONCEPT_ID, useCreateDesign } from "@/contexts/CreateDesignContext";
import { aiGenerateText } from "@/lib/api";
import ArcLoader from "@/components/ArcLoader";

/** Column 1: ArcLoader slot (same layout as original standalone loader). */
const LEFT_CONTENT_SLOT = "ml-2 md:ml-4 w-[220px] min-h-[220px] shrink-0 flex flex-col";

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
    baseColourChoice,
    setBaseColourChoice,
  } = useCreateDesign();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string>("");

  const theme = eventDetails.theme?.trim() || "";
  const eventName = eventDetails.eventName?.trim() || "";
  const desiredKey = useMemo(() => `${theme}||${eventName}`.trim(), [eventName, theme]);

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

  useEffect(() => {
    if (!hasRequiredStep1Details) {
      navigate("/create-design", { replace: true });
    }
  }, [hasRequiredStep1Details, navigate]);

  /** No AI suggestions yet (intro: explain + suggest card + custom). Cached 3 concepts counts as ready. */
  const showIntroLayout = concepts.length === 0 && !isAnalyzing;
  const hasColourDecision = baseColourChoice !== null;
  const lockConceptActions = showIntroLayout && !hasColourDecision;

  const generateConcepts = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = !!opts?.force;
      if (!hasRequiredStep1Details) return;
      if (inFlightRef.current) return;
      if (baseColourChoice === null) return;
      if (!theme) {
        setConcepts([]);
        setSelectedConceptId(null);
        return;
      }

      if (!force && conceptsKeyRef.current === desiredKey && conceptsRef.current.length === 3) {
        if (!selectedConceptIdRef.current) setSelectedConceptId(conceptsRef.current[0]?.id ?? 1);
        return;
      }

      inFlightRef.current = true;
      setError("");
      setIsAnalyzing(true);
      setConcepts([]);
      setSelectedConceptId(null);

      const prompt = [
        "Generate exactly 3 visual background concepts for a church event flyer.",
        "The THEME is the primary creative anchor. The event name is optional background context only — do not let long titles drive the imagery.",
        `Theme: ${JSON.stringify(theme)}`,
        eventName ? `Event name (light context only): ${JSON.stringify(eventName)}` : "",
        "",
        "Instructions (follow strictly):",
        "- Each concept must express the THEME as one clear visual metaphor (a concrete scene or setting).",
        "- Each `description` must be extremely concise: at most TWO lines in total, each line only a short phrase (no paragraphs, no numbered lists inside the string).",
        "- Hard cap: each description under ~220 characters including spaces; if you would exceed that, stop earlier.",
        "- Each `label` must be a very short title (a few words, under ~40 characters).",
        "- The three concepts must be clearly different from each other; avoid generic stock ideas.",
        "- Do NOT mention text, layout, typography, logos, or UI — only the visual scene.",
        "- Use simple, clear English.",
        "",
        "Output (STRICT): Return ONLY valid JSON. No markdown. No extra keys.",
        '[{"label":"Concept 1","description":"..."},{"label":"Concept 2","description":"..."},{"label":"Concept 3","description":"..."}]',
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

        const next =
          asConceptArray(parsed).length
            ? asConceptArray(parsed)
                .slice(0, 3)
                .map((c, idx: number) => ({
                  id: idx + 1,
                  label: String((c.label as string | undefined) || `Concept ${idx + 1}`).trim().slice(0, 48),
                  description: clampConceptDescription(
                    String((c.description as string | undefined) || (c.text as string | undefined) || "")
                  ),
                }))
                .filter((c) => c.description)
            : txt
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)
                .slice(0, 3)
                .map((line, idx) => ({
                  id: idx + 1,
                  label: `Concept ${idx + 1}`,
                  description: line.replace(/^[-*\d.)\s]+/, "").trim(),
                }))
                .filter((c) => c.description);

        const fallback = [
          { id: 1, label: "Concept 1", description: clampConceptDescription(`Warm glow and soft light rays echoing "${theme}".`) },
          { id: 2, label: "Concept 2", description: clampConceptDescription(`Open sky, gentle clouds, quiet light for "${theme}".`) },
          { id: 3, label: "Concept 3", description: clampConceptDescription(`Bold abstract shapes and a strong focal light for "${theme}".`) },
        ];

        const hasAny = next.some((c) => c.description && c.description.trim().length > 0);
        if (!txt || !hasAny) {
          setError("AI returned no suggestions. Showing default concepts. You can retry.");
        }

        const filled = hasAny ? [...next] : [...fallback];
        while (filled.length < 3) {
          filled.push({
            id: filled.length + 1,
            label: `Concept ${filled.length + 1}`,
            description: clampConceptDescription("A premium, modern abstract background that matches the theme mood."),
          });
        }

        setConceptsKey(desiredKey);
        setConcepts(filled.slice(0, 3));
        setSelectedConceptId(filled[0]?.id ?? 1);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to generate concepts.";
        if (conceptsRef.current.length > 0 && conceptsKeyRef.current === desiredKey && !force) {
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
      desiredKey,
      eventName,
      hasRequiredStep1Details,
      setConcepts,
      setConceptsKey,
      setSelectedConceptId,
      theme,
    ]
  );

  const selected = selectedConceptId ?? concepts[0]?.id ?? null;
  const canContinue =
    !!selected && !(selected === CUSTOM_CONCEPT_ID && !customConceptText.trim());

  /** Left-column analyzer: show while generating and keep visible after concepts load (done state). */
  const showLeftAnalyzer = isAnalyzing || concepts.length > 0;

  return (
    <AppLayout>
      <CreateDesignHero title="Create Design" />
      <StepperProgress currentStep={3} />

      <div className="px-4 xs:px-0">
        <div className="border border-[hsl(0,0%,80%)] rounded-2xl p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-[0.54fr_1fr] gap-y-8 md:gap-x-6">
            {/* Left Column */}
            <div className="flex min-w-0 flex-col">
              <h2 className="mb-1 text-lg font-semibold text-[hsl(0,0%,10%)] md:mb-5 md:text-xl">
                Background Concept
              </h2>
              <p className="text-sm text-[hsl(0,0%,55%)] mb-12 max-w-[280px]">
                Please Pick a concept from the suggestions or enter your preferred concept
              </p>

              <div className="mt-4 flex w-full min-w-0 flex-col items-start justify-start gap-6">
                {showLeftAnalyzer ? (
                  <div className={LEFT_CONTENT_SLOT}>
                    <div className="flex flex-1 flex-col items-center justify-start pt-0">
                      <ArcLoader
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
                ) : null}

              <h2 className="text-lg font-semibold text-[hsl(0,0%,10%)] md:text-xl">
                Select Base Colour
              </h2>
                <div className="ml-0 w-full min-w-0 max-w-full md:ml-4 md:max-w-[min(100%,340px)] lg:max-w-[min(100%,360px)] xl:max-w-[min(100%,380px)]">
                  <div className="grid w-full grid-cols-4 gap-1.5 md:grid-cols-2 md:gap-2 min-[950px]:grid-cols-3 min-[1400px]:grid-cols-4">
                    {BASE_COLOUR_IMAGES.map((item) => {
                      const selected = baseColourChoice === item.src;
                      return (
                        <button
                          key={item.src}
                          type="button"
                          aria-pressed={selected}
                          aria-label={`Use ${item.alt}`}
                          onClick={() => setBaseColourChoice(item.src)}
                          className={`group relative aspect-square cursor-pointer overflow-hidden rounded-lg border-2 border-transparent p-0 shadow-[0_1px_8px_rgba(0,0,0,0.08)] outline-none transition-[transform,box-shadow,ring] xs:rounded-xl focus-visible:ring-2 focus-visible:ring-[hsl(330,100%,70%)] focus-visible:ring-offset-2 ${
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

            {/* Right Column - Concept Cards */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4">
                {error && concepts.length === 0 ? (
                  <div className="w-full md:max-w-[440px] border border-[hsl(0,0%,85%)] bg-[hsl(0,0%,97%)] rounded-2xl p-5">
                    <div className="text-sm text-[hsl(0,0%,40%)]">{error}</div>
                    <button
                      type="button"
                      onClick={() => void generateConcepts({ force: true })}
                      className="mt-3 inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-medium bg-[hsl(0,0%,10%)] text-white hover:bg-[hsl(0,0%,20%)] transition-colors border-none"
                    >
                      Retry
                    </button>
                  </div>
                ) : null}

                {error && concepts.length > 0 ? (
                  <div className="w-full md:max-w-[440px] -mt-1 text-xs text-[hsl(0,0%,45%)] flex items-center justify-between">
                    <span>{error}</span>
                    <button
                      type="button"
                      onClick={() => void generateConcepts({ force: true })}
                      className="ml-3 px-3 py-1.5 rounded-full bg-[hsl(0,0%,10%)] text-white hover:bg-[hsl(0,0%,20%)] transition-colors border-none"
                    >
                      Retry
                    </button>
                  </div>
                ) : null}

                {showIntroLayout ? (
                  <>
                    <button
                      type="button"
                      disabled={!theme || lockConceptActions}
                      onClick={() => void generateConcepts()}
                      className={`group flex w-full max-w-full flex-col text-left border rounded-2xl p-5 transition-all duration-200 ease-out md:max-w-[440px] ${
                        !theme || lockConceptActions
                          ? "cursor-not-allowed border-[hsl(0,0%,85%)] bg-[hsl(0,0%,92%)] opacity-70"
                          : "cursor-pointer border-[hsl(0,0%,85%)] bg-[hsl(0,0%,95%)] hover:border-[hsl(0,0%,68%)] hover:bg-[hsl(0,0%,97%)] hover:shadow-[0_12px_40px_-16px_rgba(0,0,0,0.1)] hover:-translate-y-px active:translate-y-0 active:shadow-[0_4px_16px_-12px_rgba(0,0,0,0.06)]"
                      }`}
                    >
                      <span className="mb-8 inline-block w-fit max-w-[min(100%,240px)] shrink-0 self-start rounded-full bg-white px-3 py-1.5 text-sm font-medium text-[hsl(0,0%,10%)] shadow-sm ring-1 ring-transparent transition-[box-shadow,ring-color,transform] duration-200 group-hover:shadow-md group-hover:ring-[hsl(0,0%,88%)]">
                        Suggest concept
                      </span>
                      <p className="text-sm text-[hsl(0,0%,40%)]">
                        Click to get suggestions based on your event details.
                      </p>
                    </button>

                    <div
                      role="presentation"
                      aria-disabled={lockConceptActions}
                      onClick={() => {
                        if (lockConceptActions) return;
                        setSelectedConceptId(CUSTOM_CONCEPT_ID);
                      }}
                      className={`w-full md:max-w-[440px] text-left border rounded-2xl p-4 transition-all duration-150 ease-out flex flex-col ${
                        lockConceptActions
                          ? "pointer-events-none cursor-not-allowed opacity-55 border-[hsl(0,0%,88%)] bg-[hsl(0,0%,96%)]"
                          : selected === CUSTOM_CONCEPT_ID
                            ? "cursor-pointer border-[hsl(330,100%,85%)] shadow-[0_0_0_1px_hsl(330,100%,85%)] bg-[hsl(0,0%,100%)]"
                            : "cursor-pointer bg-[hsl(0,0%,95%)] border-[hsl(0,0%,85%)] hover:border-[hsl(0,0%,70%)]"
                      }`}
                    >
                      <span
                        className={`mb-3 inline-block w-fit max-w-[min(100%,240px)] shrink-0 self-start rounded-full px-3 py-1.5 text-sm font-medium ${
                          selected === CUSTOM_CONCEPT_ID
                            ? "bg-[hsl(330,100%,93%)] text-[hsl(0,0%,10%)]"
                            : "bg-white text-[hsl(0,0%,10%)]"
                        }`}
                      >
                        Custom
                      </span>
                      <textarea
                        value={customConceptText}
                        disabled={lockConceptActions}
                        onChange={(e) => {
                          setCustomConceptText(e.target.value);
                          setSelectedConceptId(CUSTOM_CONCEPT_ID);
                        }}
                        onFocus={() => setSelectedConceptId(CUSTOM_CONCEPT_ID)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Input your own concept..."
                        rows={4}
                        className="w-full h-[50px] bg-transparent text-sm text-[hsl(0,0%,40%)] placeholder:text-[hsl(0,0%,65%)] outline-none cursor-text disabled:cursor-not-allowed"
                      />
                    </div>
                  </>
                ) : !isAnalyzing ? (
                  <>
                    {concepts.map((concept) => (
                      <button
                        key={concept.id}
                        type="button"
                        onClick={() => setSelectedConceptId(concept.id)}
                        className={`group flex w-full max-w-full flex-col text-left border rounded-2xl p-5 cursor-pointer transition-all duration-200 ease-out md:max-w-[440px] ${
                          selected === concept.id
                            ? "border-[hsl(330,100%,85%)] shadow-[0_0_0_1px_hsl(330,100%,85%)] bg-[hsl(0,0%,100%)] hover:border-[hsl(330,100%,78%)] hover:shadow-[0_12px_36px_-16px_rgba(0,0,0,0.09)] hover:-translate-y-px active:translate-y-0 active:shadow-[0_0_0_1px_hsl(330,100%,85%)]"
                            : "bg-[hsl(0,0%,95%)] border-[hsl(0,0%,85%)] hover:border-[hsl(0,0%,68%)] hover:bg-[hsl(0,0%,97%)] hover:shadow-[0_12px_40px_-16px_rgba(0,0,0,0.1)] hover:-translate-y-px active:translate-y-0 active:shadow-[0_4px_16px_-12px_rgba(0,0,0,0.06)]"
                        }`}
                      >
                        <span
                          className={`mb-4 inline-block w-fit max-w-[min(100%,240px)] shrink-0 self-start rounded-full px-3 py-1.5 text-sm font-medium shadow-sm ring-1 ring-transparent transition-[box-shadow,ring-color] duration-200 group-hover:shadow-md ${
                            selected === concept.id
                              ? "bg-[hsl(330,100%,93%)] text-[hsl(0,0%,10%)] group-hover:ring-[hsl(330,100%,82%)]"
                              : "bg-white text-[hsl(0,0%,10%)] group-hover:ring-[hsl(0,0%,88%)]"
                          }`}
                        >
                          {concept.label}
                        </span>
                        <p className="text-sm text-[hsl(0,0%,40%)]">{concept.description}</p>
                      </button>
                    ))}

                    <div
                      role="presentation"
                      onClick={() => setSelectedConceptId(CUSTOM_CONCEPT_ID)}
                      className={`flex w-full max-w-full flex-col text-left border rounded-2xl p-4 cursor-pointer transition-all duration-150 ease-out md:max-w-[440px] ${
                        selected === CUSTOM_CONCEPT_ID
                          ? "border-[hsl(330,100%,85%)] shadow-[0_0_0_1px_hsl(330,100%,85%)] bg-[hsl(0,0%,100%)]"
                          : "bg-[hsl(0,0%,95%)] border-[hsl(0,0%,85%)] hover:border-[hsl(0,0%,70%)]"
                      }`}
                    >
                      <span
                        className={`mb-3 inline-block w-fit max-w-[min(100%,240px)] shrink-0 self-start rounded-full px-3 py-1.5 text-sm font-medium ${
                          selected === CUSTOM_CONCEPT_ID
                            ? "bg-[hsl(330,100%,93%)] text-[hsl(0,0%,10%)]"
                            : "bg-white text-[hsl(0,0%,10%)]"
                        }`}
                      >
                        Custom
                      </span>
                      <textarea
                        value={customConceptText}
                        onChange={(e) => {
                          setCustomConceptText(e.target.value);
                          setSelectedConceptId(CUSTOM_CONCEPT_ID);
                        }}
                        onFocus={() => setSelectedConceptId(CUSTOM_CONCEPT_ID)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Input your own concept..."
                        rows={4}
                        className="w-full h-[60px] bg-transparent text-sm text-[hsl(0,0%,40%)] placeholder:text-[hsl(0,0%,65%)] outline-none cursor-text"
                      />
                    </div>
                  </>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/create-design/step-2")}
                  className="flex items-center gap-2 bg-[hsl(0,0%,95%)] text-[hsl(0,0%,10%)] rounded-full px-4 py-3 text-xs font-medium cursor-pointer transition-all duration-150 ease-out hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
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
                  className={`flex items-center gap-2 border-none rounded-full px-4 py-3 text-xs font-medium transition-all duration-150 ease-out hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] ${
                    isAnalyzing || !canContinue
                      ? "bg-[hsl(0,0%,60%)] text-white cursor-not-allowed"
                      : "bg-[hsl(0,0%,10%)] text-white cursor-pointer hover:bg-[hsl(0,0%,20%)]"
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
