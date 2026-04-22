import { useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import CreateDesignHero from "@/components/CreateDesignHero";
import StepperProgress from "@/components/StepperProgress";
import { useCreateDesign } from "@/contexts/CreateDesignContext";
import { aiGenerateFlyer } from "@/lib/api";
import { downloadFlyer } from "@/lib/downloadFlyer";
import ArcLoader from "@/components/ArcLoader";
import type { FlyerImage } from "@/contexts/CreateDesignContext";

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
  const hasMessage = message.trim().length > 0;
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string>("");
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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

    // If we already have an image for this key, do not regenerate unless forced.
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
      setFlyerKey(generationKey);
      setFlyerImage(first);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to generate flyer.";
      setError(msg);
    } finally {
      setIsPreparing(false);
    }
  }, [
    backgroundPreviewImage,
    canGenerate,
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
    // Generate once when required inputs become available, unless already generated.
    if (!canGenerate) return;
    void generateFlyer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canGenerate, generationKey]);

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

  const handleEdit = async () => {
    if (!canGenerate) return;
    // Keep current flyer visible while we request an edited version.
    await generateFlyer({ message: message.trim(), keepExisting: true, force: true });
  };

  return (
    <AppLayout>
      <CreateDesignHero title="Create Design" />
      <StepperProgress currentStep={5} />

      <div className="px-4 xs:px-0">
        <div className="border border-[hsl(0,0%,80%)] rounded-2xl p-6 md:p-8">

          <div className="grid grid-cols-1 md:grid-cols-[0.35fr_0.45fr_0.35fr] gap-6 md:gap-4">
            {/* Left Column - Analysing theme */}
            <div className=" items-center justify-center">
              <h2 className="text-lg md:text-xl font-semibold text-[hsl(0,0%,10%)] mb-6">
                Preparing Your Design
              </h2>

              <div className="my-20 pl-4">
                <ArcLoader
                  size={220}
                  label={
                    !assetsHydrated ? (
                      "Loading..."
                    ) : isPreparing ? (
                        <span>
                          Compositing
                          <br />
                          your flyer...
                        </span>
                    ) : canGenerate ? (
                      <img src="/Halorai Dev/Images/checkmark.svg" alt="Done" className="w-14 h-14" />
                    ) : (
                      "Missing info"
                    )
                  }
                  spinning={!assetsHydrated || isPreparing}
                  spinDurationMs={3200}
                />
              </div>
            </div>

            {/* Middle Column - Design Preview (Instagram-style 4:5 portrait) */}
            <div className="flex items-center justify-center">
              <div className="relative w-full max-w-[280px] aspect-[4/5] overflow-hidden rounded-xl bg-[hsl(0,0%,94%)] ring-1 ring-[hsl(0,0%,92%)]">
                {flyerImage ? (
                  <img
                    src={`data:${flyerImage.mimeType};base64,${flyerImage.base64}`}
                    alt="Design Preview"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-transparent" aria-label="Design preview loading" />
                )}
              </div>
            </div>

            {/* Right Column - Chat/Edit input + Buttons */}
            <div className="flex flex-col items-center h-full md:justify-center">
              <div className="w-full max-w-[420px] bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,95%)] rounded-2xl p-4 flex flex-col min-h-[240px]">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Put the logo on the right hand, and Remove the..."
                  className="flex-1 w-full resize-none border-none outline-none text-sm text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,65%)] bg-transparent"
                />
                <div className="flex justify-end mt-2">
                  <button
                    disabled={!canGenerate}
                    className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors border-none ${
                      hasMessage
                        ? "bg-[hsl(25,100%,35%)] hover:bg-[hsl(25,100%,30%)]"
                        : "bg-[hsl(0,0%,60%)] hover:bg-[hsl(0,0%,55%)]"
                    }`}
                  >
                    <img src="/Halorai Dev/Icons/send Vector.svg" alt="Send" className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {error ? (
                <div className="w-full max-w-[420px] mt-3">
                  <div className="text-xs text-[hsl(15,100%,45%)]">{error}</div>
                  {canGenerate ? (
                    <button
                      onClick={() => void generateFlyer()}
                      className="mt-3 inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-medium bg-[hsl(0,0%,10%)] text-white hover:bg-[hsl(0,0%,20%)] transition-colors border-none"
                    >
                      Retry
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="w-full max-w-[420px] flex items-center gap-4 mt-4">
                <button
                  disabled={!canGenerate || isPreparing || !hasMessage}
                  onClick={() => void handleEdit()}
                  className={`flex-1 flex items-center justify-center gap-2 border rounded-full px-6 py-3 text-sm font-regular transition-colors ${
                    !canGenerate || isPreparing || !hasMessage
                      ? "bg-[hsl(0,0%,97%)] border-[hsl(0,0%,95%)] text-[hsl(0,0%,40%)] cursor-not-allowed"
                      : "bg-[hsl(0,0%,97%)] border-[hsl(0,0%,95%)] text-[hsl(0,0%,10%)] cursor-pointer hover:border-[hsl(0,0%,60%)]"
                  }`}
                >
                  <img src="/Halorai Dev/Icons/lucide_edit-3.svg" alt="Edit" className="w-4 h-4" />
                  Edit
                </button>
                <div className="flex-1 relative">
                  <button
                    disabled={!canGenerate || !flyerImage || isDownloading}
                    onClick={() => setIsDownloadOpen((v) => !v)}
                    className={`w-full flex items-center justify-center gap-2 border-none rounded-full px-6 py-3 text-sm font-regular transition-colors ${
                      !canGenerate || !flyerImage || isDownloading
                        ? "bg-[hsl(0,0%,60%)] text-white cursor-not-allowed"
                        : "bg-[hsl(0,0%,10%)] text-white cursor-pointer hover:bg-[hsl(0,0%,20%)]"
                    }`}
                  >
                    {isDownloading ? "Preparing..." : "Download"}
                    <img
                      src="/Halorai Dev/Icons/weui_arrow-outlined-forward.svg"
                      alt="Forward"
                      className="w-4 h-4 pl-1"
                    />
                  </button>

                  {isDownloadOpen && flyerImage ? (
                    <div className="absolute right-0 mt-2 w-full bg-white border border-[hsl(0,0%,90%)] rounded-2xl shadow-lg p-2 z-20">
                      <button
                        onClick={() => void handleDownload("png")}
                        className="w-full text-left px-3 py-2 rounded-xl text-sm text-[hsl(0,0%,10%)] hover:bg-[hsl(0,0%,97%)] transition-colors"
                      >
                        PNG
                      </button>
                      <button
                        onClick={() => void handleDownload("jpg")}
                        className="w-full text-left px-3 py-2 rounded-xl text-sm text-[hsl(0,0%,10%)] hover:bg-[hsl(0,0%,97%)] transition-colors"
                      >
                        JPG
                      </button>
                      <button
                        onClick={() => void handleDownload("pdf")}
                        className="w-full text-left px-3 py-2 rounded-xl text-sm text-[hsl(0,0%,10%)] hover:bg-[hsl(0,0%,97%)] transition-colors"
                      >
                        PDF (clear view)
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CreateDesignStep5;
