import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import CreateDesignHero from "@/components/CreateDesignHero";
import StepperProgress from "@/components/StepperProgress";
import { useCreateDesign } from "@/contexts/CreateDesignContext";

const CreateDesignStep4 = () => {
  const navigate = useNavigate();
  const { eventDetails, logos, setLogos, ministers, setMinisters, backgroundPreviewImage } = useCreateDesign();
  const missingMinisterName = ministers.length > 0 && ministers.some((m) => !m.name.trim());

  /** Same field order as before; labels match Step 1 (CreateDesign). */
  const detailRows = useMemo(() => {
    const rows: { key: string; label: string; value: string }[] = [
      { key: "churchName", label: "Ministry name", value: eventDetails.churchName?.trim() ?? "" },
      { key: "eventName", label: "Event name", value: eventDetails.eventName?.trim() ?? "" },
      { key: "theme", label: "Theme", value: eventDetails.theme?.trim() ?? "" },
      { key: "date", label: "Date", value: eventDetails.date?.trim() ?? "" },
      { key: "time", label: "Time", value: eventDetails.time?.trim() ?? "" },
      { key: "venue", label: "Venue", value: eventDetails.venue?.trim() ?? "" },
      { key: "otherInfo", label: "Other Info", value: eventDetails.otherInfo?.trim() ?? "" },
    ];
    return rows.filter((r) => r.value.length > 0);
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

          {/* Row 1: Details + Logos */}
          <div className="grid grid-cols-1 md:grid-cols-[1.4fr_0.6fr] gap-6 mb-6">
            {/* Details Card */}
            <div className="bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,95%)] rounded-2xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-sm font-semibold text-[hsl(0,0%,10%)]">Details</h3>
                <button
                  onClick={() => navigate("/create-design")}
                  className="w-7 h-7 flex items-center justify-center cursor-pointer bg-transparent border-none"
                  aria-label="Edit details"
                >
                  <img src="/Halorai Dev/Icons/lucide_edit-3.svg" alt="Edit" className="w-4 h-4" />
                </button>
              </div>
              <div className="details-scroll flex flex-col gap-3 text-sm pr-2">
                {detailRows.length ? (
                  detailRows.map((row) => (
                    <div key={row.key} className="min-w-0 text-sm text-[hsl(0,0%,25%)] leading-snug">
                      <span className="text-sm text-[hsl(0,0%,40%)]">{row.label}: </span>
                      <span className="text-sm text-[hsl(0,0%,40%)] leading-snug">{row.value}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-[hsl(0,0%,55%)]">No details yet.</span>
                )}
              </div>
            </div>

            {/* Logos Card */}
            <div className="bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,95%)] rounded-2xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-[hsl(0,0%,10%)]">Upload Logo</h3>
                <button
                  onClick={() => navigate("/create-design/step-2")}
                  className="flex items-center gap-2 border border-[hsl(0,0%,85%)] rounded-lg px-3 py-1.5 text-xs font-medium text-[hsl(0,0%,10%)] bg-white cursor-pointer hover:border-[hsl(0,0%,60%)] transition-colors"
                >
                  <img src="/Halorai Dev/Icons/material-symbols_upload-rounded.svg" alt="Upload" className="w-4 h-4" />
                  Upload
                </button>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center justify-center gap-3">
                  {logos.length ? (
                    logos.map((logo) => (
                      <div key={logo.id} className="relative">
                        <img src={logo.previewUrl} alt={logo.file.name} className="w-14 h-14 object-cover rounded-full" />
                        <button
                          onClick={() => handleRemoveLogo(logo.id)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-[hsl(15,100%,55%)] rounded-full flex items-center justify-center border-none cursor-pointer"
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
              </div>
            </div>
          </div>

          {/* Row 2: Ministers + Background Concept (equal column height) */}
          <div className="grid min-h-0 grid-cols-1 gap-6 md:grid-cols-2 md:items-stretch">
            {/* Ministers Card */}
            <div className="flex h-full min-h-0 flex-col rounded-2xl border border-[hsl(0,0%,95%)] bg-[hsl(0,0%,97%)] p-5">
              <div className="mb-4 flex shrink-0 items-center justify-between">
                <h3 className="text-sm font-semibold text-[hsl(0,0%,10%)]">Add Ministers Name</h3>
                <button
                  onClick={() => navigate("/create-design/step-2")}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-[hsl(0,0%,85%)] bg-white px-3 py-1.5 text-xs font-medium text-[hsl(0,0%,10%)] transition-colors hover:border-[hsl(0,0%,60%)]"
                >
                  <img src="/Halorai Dev/Icons/material-symbols_upload-rounded.svg" alt="Upload" className="w-4 h-4" />
                  Upload
                </button>
              </div>
              <div className="ministers-scroll flex min-h-[220px] flex-1 flex-col gap-3 overflow-y-auto pr-2">
                {ministers.length ? (
                  ministers.map((minister) => (
                    <div key={minister.id} className="flex items-center gap-3">
                      <img
                        src={minister.avatar.previewUrl}
                        alt={minister.avatar.file.name}
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                      <input
                        type="text"
                        placeholder={minister.placeholderName}
                        value={minister.name}
                        onChange={(e) => handleMinisterChange(minister.id, "name", e.target.value)}
                        className="min-w-0 flex-1 rounded-xl border border-[hsl(0,0%,85%)] bg-white px-4 py-2.5 text-xs text-[hsl(0,0%,10%)] outline-none transition-colors placeholder:text-[hsl(0,0%,70%)] focus:border-[hsl(330,100%,80%)]"
                      />
                      <input
                        type="text"
                        placeholder={minister.placeholderTitle}
                        value={minister.title}
                        onChange={(e) => handleMinisterChange(minister.id, "title", e.target.value)}
                        className="w-[30%] min-w-[80px] shrink-0 rounded-xl border border-[hsl(0,0%,85%)] bg-white px-4 py-2.5 text-xs text-[hsl(0,0%,10%)] outline-none transition-colors placeholder:text-[hsl(0,0%,70%)] focus:border-[hsl(330,100%,80%)]"
                      />
                      <button
                        onClick={() => handleDeleteMinister(minister.id)}
                        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border-none bg-[hsl(15,100%,55%)] transition-colors hover:bg-[hsl(15,100%,45%)]"
                        aria-label="Delete minister"
                      >
                        <img src="/Halorai Dev/Icons/weui_delete-on-filled.svg" alt="Delete" className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-[hsl(0,0%,55%)]">No ministers uploaded.</div>
                )}
              </div>
            </div>

            {/* Background preview (image from Step 3ii) */}
            <div className="flex h-full min-h-0 flex-col">
              <h3 className="mb-3 shrink-0 text-sm font-semibold text-[hsl(0,0%,10%)]">Background Concept</h3>
              <div className="relative min-h-[220px] flex-1 overflow-hidden rounded-xl border border-[hsl(0,0%,85%)] bg-[hsl(0,0%,92%)] ring-1 ring-[hsl(0,0%,90%)]">
                {backgroundPreviewImage ? (
                  <img
                    src={`data:${backgroundPreviewImage.mimeType};base64,${backgroundPreviewImage.base64}`}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
                    <p className="text-xs text-[hsl(0,0%,45%)]">No background image yet.</p>
                    <button
                      type="button"
                      onClick={() => navigate("/create-design/step-3ii")}
                      className="cursor-pointer rounded-full border border-[hsl(0,0%,85%)] bg-white px-3 py-1.5 text-xs font-medium text-[hsl(0,0%,10%)] hover:border-[hsl(0,0%,60%)]"
                    >
                      Go to background step
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 3: Create */}
          <div className="mt-6 flex flex-col items-end gap-2">
            {missingMinisterName ? (
              <p className="max-w-full text-right text-xs text-[hsl(15,100%,45%)]">
                Please add a Name for each uploaded minister image before creating.
              </p>
            ) : null}
            <div className="flex w-full justify-end">
              <button
                aria-label="Create"
                disabled={missingMinisterName}
                onClick={() => {
                  if (missingMinisterName) return;
                  navigate("/create-design/step-5");
                }}
                className={`shrink-0 border-none bg-transparent p-0 transition-all duration-150 ease-out ${
                  missingMinisterName
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:scale-[1.01] hover:opacity-90 active:scale-[0.99]"
                }`}
              >
                <img src="/Halorai Dev/Icons/Create button.png" alt="Create" className="h-12 w-auto object-contain" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CreateDesignStep4;