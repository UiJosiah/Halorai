import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import CreateDesignHero from "@/components/CreateDesignHero";
import StepperProgress from "@/components/StepperProgress";
import { CUSTOM_CONCEPT_ID, useCreateDesign } from "@/contexts/CreateDesignContext";
import { aiGenerateText } from "@/lib/api";
import ArcLoader from "@/components/ArcLoader";

/** Fixed slot for column 1: same footprint for intro copy and ArcLoader (no extra panel — matches previous Step 3). */
const LEFT_CONTENT_SLOT = "ml-2 md:ml-4 w-[220px] min-h-[220px] shrink-0 flex flex-col";

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

  const generateConcepts = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = !!opts?.force;
      if (!hasRequiredStep1Details) return;
      if (inFlightRef.current) return;
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
        "Generate 3 powerful visual concepts based on the provided church event theme.",
        "Goal: translate the theme into strong, symbolic imagery for a flyer background idea.",
        `Theme: ${JSON.stringify(theme)}`,
        eventName ? `Event name (optional context): ${JSON.stringify(eventName)}` : "",
        "",
        "Instructions (follow strictly):",
        "- Each concept must represent the theme using a clear visual metaphor (a real scene).",
        "- Focus on emotionally strong and visually striking scenes.",
        "- Avoid generic ideas; each concept must feel unique and meaningful.",
        "- Keep descriptions short and vivid (1–2 lines each).",
        "- Do NOT mention design elements like text, layout, or typography.",
        "- Focus only on the main visual scene or subject.",
        "- Make it cinematic and dramatic (not ordinary or everyday scenes).",
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
                  label: String((c.label as string | undefined) || `Concept ${idx + 1}`),
                  description: String((c.description as string | undefined) || (c.text as string | undefined) || "").trim(),
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
          { id: 1, label: "Concept 1", description: `A clean background with a warm glow and simple light rays to match "${theme}".` },
          { id: 2, label: "Concept 2", description: `A calm sky with soft clouds and gentle light, matching "${theme}".` },
          { id: 3, label: "Concept 3", description: `A bold abstract background with smooth shapes and a strong light focus for "${theme}".` },
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
            description: "A premium, modern abstract background that matches the theme mood.",
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

  return (
    <AppLayout>
      <CreateDesignHero title="Create Design" />
      <StepperProgress currentStep={3} />

      <div className="px-4 xs:px-0">
        <div className="border border-[hsl(0,0%,80%)] rounded-2xl p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-[0.54fr_1fr] gap-y-8 md:gap-x-6">
            {/* Left Column */}
            <div className="flex flex-col">
              <h2 className="text-lg md:text-xl font-semibold text-[hsl(0,0%,10%)] mb-1">
                Background Concept
              </h2>
              <p className="text-sm text-[hsl(0,0%,55%)] mb-8 max-w-[280px]">
                Please Pick a concept from the suggestions or enter your preferred concept
              </p>

              <div className="mt-4 flex items-start justify-start">
                <div className={LEFT_CONTENT_SLOT}>
                  {showIntroLayout ? (
                    <div className="w-full text-left text-xs leading-relaxed text-[hsl(0,0%,40%)]">
                      <p className="mb-2 font-medium text-[hsl(0,0%,22%)]">What is a concept?</p>
                      <p className="mb-2">
                        A <span className="font-semibold text-[hsl(0,0%,18%)]">concept</span> is the visual idea for your flyer
                        background—mood, scene, and symbolism that match your event theme. It is not the final artwork yet; it guides
                        the next step where a background image is created.
                      </p>
                      <p>
                        You can <span className="font-semibold text-[hsl(0,0%,18%)]">write your own</span> in Custom, or use{" "}
                        <span className="font-semibold text-[hsl(0,0%,18%)]">Suggest concept</span> to have three options generated
                        from your event details (only when you choose—no automatic request).
                      </p>
                    </div>
                  ) : (
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
                  )}
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
                      disabled={!theme}
                      onClick={() => void generateConcepts()}
                      className={`flex w-full max-w-full flex-col text-left border rounded-2xl p-5 transition-all duration-150 ease-out md:max-w-[440px] ${
                        !theme
                          ? "cursor-not-allowed border-[hsl(0,0%,85%)] bg-[hsl(0,0%,92%)] opacity-70"
                          : "cursor-pointer border-[hsl(0,0%,85%)] bg-[hsl(0,0%,95%)] hover:border-[hsl(0,0%,70%)]"
                      }`}
                    >
                      <span className="mb-8 inline-block w-fit max-w-[min(100%,240px)] shrink-0 self-start rounded-full bg-white px-3 py-1.5 text-sm font-medium text-[hsl(0,0%,10%)]">
                        Suggest concept
                      </span>
                      <p className="text-sm text-[hsl(0,0%,40%)]">
                        Click to get suggestions based on your event details.
                      </p>
                    </button>

                    <div
                      role="presentation"
                      onClick={() => setSelectedConceptId(CUSTOM_CONCEPT_ID)}
                      className={`w-full md:max-w-[440px] text-left border rounded-2xl p-4 cursor-pointer transition-all duration-150 ease-out flex flex-col ${
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
                        className="w-full h-[50px] bg-transparent text-sm text-[hsl(0,0%,40%)] placeholder:text-[hsl(0,0%,65%)] outline-none cursor-text"
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
                        className={`flex w-full max-w-full flex-col text-left border rounded-2xl p-5 cursor-pointer transition-all duration-150 ease-out md:max-w-[440px] ${
                          selected === concept.id
                            ? "border-[hsl(330,100%,85%)] shadow-[0_0_0_1px_hsl(330,100%,85%)] bg-[hsl(0,0%,100%)]"
                            : "bg-[hsl(0,0%,95%)] border-[hsl(0,0%,85%)] hover:border-[hsl(0,0%,70%)]"
                        }`}
                      >
                        <span
                          className={`mb-4 inline-block w-fit max-w-[min(100%,240px)] shrink-0 self-start rounded-full px-3 py-1.5 text-sm font-medium ${
                            selected === concept.id
                              ? "bg-[hsl(330,100%,93%)] text-[hsl(0,0%,10%)]"
                              : "bg-white text-[hsl(0,0%,10%)]"
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
