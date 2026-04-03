import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import CreateDesignHero from "@/components/CreateDesignHero";
import StepperProgress from "@/components/StepperProgress";
import { useCreateDesign } from "@/contexts/CreateDesignContext";

const CreateDesignStep4 = () => {
  const navigate = useNavigate();
  const { eventDetails, logos, setLogos, ministers, setMinisters, concepts, selectedConceptId } = useCreateDesign();
  const selectedConcept = concepts.find((c) => c.id === selectedConceptId) || concepts[0];
  const conceptDescription = selectedConcept?.description || "";
  const missingMinisterTitle = ministers.length > 0 && ministers.some((m) => !m.title.trim());

  const detailLines = useMemo(() => {
    const lines = [
      eventDetails.churchName?.trim(),
      eventDetails.eventName?.trim(),
      eventDetails.theme?.trim(),
      eventDetails.date?.trim(),
      eventDetails.time?.trim(),
      eventDetails.venue?.trim(),
      eventDetails.otherInfo?.trim(),
    ].filter(Boolean) as string[];
    return lines;
  }, [eventDetails]);

  const handleRemoveLogo = (id: string) => {
    setLogos((prev) => {
      const target = prev.find((l) => l.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((l) => l.id !== id);
    });
  };

  const handleDeleteMinister = (id: string) => {
    setMinisters((prev) => {
      const target = prev.find((m) => m.id === id);
      if (target) URL.revokeObjectURL(target.avatar.previewUrl);
      return prev.filter((m) => m.id !== id);
    });
  };

  const handleMinisterChange = (id: string, field: "name" | "title", value: string) => {
    setMinisters((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  return (
    <AppLayout>
      <CreateDesignHero title="Create Design" />
      <StepperProgress currentStep={4} />

      <div className="px-4 xs:px-0">
        <div className="border border-[hsl(0,0%,80%)] rounded-2xl p-6 md:p-8">
          <h2 className="text-lg md:text-xl font-semibold text-[hsl(0,0%,10%)] mb-6">
            Please Confirm all details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-[0.35fr_0.3fr_0.9fr] gap-8 md:gap-6">
            {/* Details Card */}
            <div className="bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,95%)] rounded-2xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-sm font-medium text-[hsl(0,0%,40%)]">Details</h3>
                <button
                  onClick={() => navigate("/create-design")}
                  className="w-7 h-7 flex items-center justify-center cursor-pointer bg-transparent border-none"
                  aria-label="Edit details"
                >
                  <img src="/Halorai Dev/Icons/lucide_edit-3.svg" alt="Edit" className="w-4 h-4" />
                </button>
              </div>
              <div className="details-scroll flex flex-col gap-1.5 text-sm text-[hsl(0,0%,45%)] pr-2">
                {detailLines.length ? (
                  detailLines.map((line, idx) => <span key={idx}>{line}</span>)
                ) : (
                  <span className="text-[hsl(0,0%,55%)]">No details yet.</span>
                )}
              </div>
            </div>

            {/* Logos Card */}
            <div className="bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,95%)] rounded-2xl p-5 flex flex-col">
              <h3 className="text-sm font-medium text-[hsl(0,0%,40%)] mb-5">Logos</h3>
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="flex items-center justify-center gap-3 mb-10">
                  {logos.length ? (
                    logos.map((logo) => (
                      <div key={logo.id} className="relative">
                        <img src={logo.previewUrl} alt={logo.file.name} className="w-10 h-10 object-cover rounded-full" />
                        <button
                          onClick={() => handleRemoveLogo(logo.id)}
                          className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[hsl(15,100%,55%)] rounded-full flex items-center justify-center border-none cursor-pointer"
                          aria-label="Remove logo"
                        >
                          <img src="/Halorai Dev/Icons/cancel.svg" alt="Remove" className="w-2.5 h-2.5 brightness-0 invert" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-[hsl(0,0%,55%)]">No logos uploaded.</div>
                  )}
                </div>
                <button
                  onClick={() => navigate("/create-design/step-2")}
                  className="flex items-center gap-2 border border-[hsl(0,0%,85%)] rounded-lg px-3 py-1.5 text-xs font-medium text-[hsl(0,0%,10%)] bg-white cursor-pointer hover:border-[hsl(0,0%,60%)] transition-colors w-fit"
                >
                  <img src="/Halorai Dev/Icons/material-symbols_upload-rounded.svg" alt="Upload" className="w-4 h-4" />
                  Upload
                </button>
              </div>
            </div>

            {/* Ministers Card */}
            <div className="flex flex-col bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,95%)] rounded-2xl p-5">
              <div className="flex items-center justify-between ">
                <h3 className="text-sm font-medium text-[hsl(0,0%,40%)] mb-10">Ministers</h3>
                <button
                  onClick={() => navigate("/create-design/step-2")}
                  className="flex items-center gap-2 border border-[hsl(0,0%,85%)] rounded-lg px-3 py-1.5 text-xs font-medium text-[hsl(0,0%,10%)] bg-white cursor-pointer hover:border-[hsl(0,0%,60%)] transition-colors"
                >
                  <img src="/Halorai Dev/Icons/material-symbols_upload-rounded.svg" alt="Upload" className="w-4 h-4" />
                  Upload
                </button>
              </div>
              <div className="ministers-scroll flex flex-col gap-3 md:max-h-[200px] md:overflow-y-auto md:pr-8">
                {ministers.length ? (
                  ministers.map((minister) => (
                    <div key={minister.id} className="flex items-center gap-3">
                      <img
                        src={minister.avatar.previewUrl}
                        alt={minister.avatar.file.name}
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                      <input
                        type="text"
                        placeholder={minister.placeholderName}
                        value={minister.name}
                        onChange={(e) => handleMinisterChange(minister.id, "name", e.target.value)}
                        className="flex-1 border border-[hsl(0,0%,85%)] rounded-xl px-4 py-2.5 text-xs text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(330,100%,80%)] transition-colors bg-white min-w-0"
                      />
                      <input
                        type="text"
                        placeholder={minister.placeholderTitle}
                        value={minister.title}
                        onChange={(e) => handleMinisterChange(minister.id, "title", e.target.value)}
                        className="w-[25%] min-w-[160px] shrink-0 border border-[hsl(0,0%,85%)] rounded-xl px-4 py-2.5 text-xs text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(330,100%,80%)] transition-colors bg-white"
                      />
                      <button
                        onClick={() => handleDeleteMinister(minister.id)}
                        className="w-8 h-8 shrink-0 bg-[hsl(15,100%,55%)] rounded-xl flex items-center justify-center cursor-pointer hover:bg-[hsl(15,100%,45%)] transition-colors border-none"
                        aria-label="Delete minister"
                      >
                        <img src="/Halorai Dev/Icons/weui_delete-on-filled.svg" alt="Delete" className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-[hsl(0,0%,55%)]">No ministers uploaded.</div>
                )}
              </div>
            </div>
          </div>

          {/* Background Concept */}
          <div className="mt-8">
            <h3 className="text-sm font-medium text-[hsl(0,0%,40%)] mb-3">Background Concept</h3>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="flex-1 border border-[hsl(0,0%,85%)] rounded-xl px-5 py-3 text-sm text-[hsl(0,0%,45%)] bg-white">
                {conceptDescription}
              </div>
              <button
                aria-label="Create"
                disabled={missingMinisterTitle}
                onClick={() => {
                  if (missingMinisterTitle) return;
                  navigate("/create-design/step-5");
                }}
                className={`border-none bg-transparent p-0 transition-all duration-150 ease-out shrink-0 ${
                  missingMinisterTitle
                    ? "opacity-60 cursor-not-allowed"
                    : "cursor-pointer hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
                }`}
              >
                <img src="/Halorai Dev/Icons/Create button.png" alt="Create" className="h-12 w-auto object-contain" />
              </button>
            </div>
            {missingMinisterTitle ? (
              <div className="mt-3 text-xs text-[hsl(15,100%,45%)]">
                Please add a Title/Role for each uploaded minister image before creating.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CreateDesignStep4;