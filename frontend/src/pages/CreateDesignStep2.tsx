import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import CreateDesignHero from "@/components/CreateDesignHero";
import StepperProgress from "@/components/StepperProgress";
import MinisterDragHandle from "@/components/MinisterDragHandle";
import { useCreateDesign, type LocalFileItem, type MinisterLocalRow } from "@/contexts/CreateDesignContext";
import { useMinistersReorder } from "@/hooks/useMinistersReorder";
import { MAX_MINISTERS } from "@/lib/limits";

const placeholderPairs = [
  { placeholderName: "Pastor John Michael", placeholderTitle: "Guest Speaker" },
  { placeholderName: "Pastor Drake Akinola", placeholderTitle: "Host" },
  { placeholderName: "Mrs Sonia Precious", placeholderTitle: "Guest Speaker" },
  { placeholderName: "Pst (Mrs) Funke Tojuola (JP)", placeholderTitle: "Special Guest" },
];

const CreateDesignStep2 = () => {
  const navigate = useNavigate();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const ministerInputRef = useRef<HTMLInputElement | null>(null);

  const { logos, setLogos, ministers, setMinisters } = useCreateDesign();
  const [didContinue, setDidContinue] = useState(false);
  const ministersReorder = useMinistersReorder(setMinisters);

  const canAddMoreLogos = logos.length < 2;
  const remainingLogoSlots = Math.max(0, 2 - logos.length);

  const canAddMoreMinisters = ministers.length < MAX_MINISTERS;
  const remainingMinisterSlots = Math.max(0, MAX_MINISTERS - ministers.length);

  const nextPlaceholder = useMemo(() => {
    return (idx: number) => placeholderPairs[idx] ?? { placeholderName: "Minister name", placeholderTitle: "Role/Title" };
  }, []);

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

  const handleAddLogos = (files: File[]) => {
    const slice = files.slice(0, remainingLogoSlots);
    if (!slice.length) return;
    const items: LocalFileItem[] = slice.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setLogos((prev) => [...prev, ...items].slice(0, 2));
  };

  const handleRemoveLogo = (id: string) => {
    setLogos((prev) => {
      const target = prev.find((l) => l.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((l) => l.id !== id);
    });
  };

  const handleAddMinisterImages = (files: File[]) => {
    const slice = files.slice(0, remainingMinisterSlots);
    if (!slice.length) return;
    setMinisters((prev) => {
      const startIdx = prev.length;
      const newRows: MinisterLocalRow[] = slice.map((file, i) => {
        const ph = nextPlaceholder(startIdx + i);
        const avatar: LocalFileItem = {
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        };
        return {
          id: crypto.randomUUID(),
          avatar,
          name: "",
          title: "",
          placeholderName: ph.placeholderName,
          placeholderTitle: ph.placeholderTitle,
        };
      });
      return [...prev, ...newRows];
    });
  };

  const missingMinisterName = useMemo(() => {
    if (!ministers.length) return false;
    return ministers.some((m) => !m.name.trim());
  }, [ministers]);

  const canContinue = !missingMinisterName;

  return (
    <AppLayout>
      <CreateDesignHero title="Create Design" />
      <StepperProgress currentStep={2} />

      {/* Form */}
      <div className="px-4 xs:px-0">
        <div className="border border-[hsl(0,0%,80%)] rounded-2xl p-6 md:p-8">
          <h2 className="text-lg md:text-xl font-semibold text-[hsl(0,0%,10%)] mb-6">
            Upload Assets
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-[0.6fr_1fr] gap-x-0 gap-y-8 relative">
            {/* Divider (only below the top row, touches bottom border) */}
            <div className="hidden md:block absolute top-0 bottom-[-2rem] left-[37.5%] w-px bg-[hsl(0,0%,90%)]" aria-hidden="true" />
            {/* Left Column */}
            <div className="flex flex-col gap-8 md:pr-12 xl:pr-14">
              {/* Upload Logo */}
              <div>
                <h3 className="text-sm font-semibold text-[hsl(0,0%,10%)] mb-1">Upload Logo</h3>
                <p className="text-xs text-[hsl(0,0%,55%)] mb-3">Click the button below to upload your logo(s)</p>
                <div className="flex items-center gap-3">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      e.target.value = "";
                      handleAddLogos(files);
                    }}
                  />
                  <button
                    disabled={!canAddMoreLogos}
                    onClick={() => logoInputRef.current?.click()}
                    className={`flex items-center gap-2 border border-[hsl(0,0%,85%)] rounded-xl px-4 py-2.5 text-xs font-medium text-[hsl(0,0%,10%)] bg-white shadow-lg hover:shadow-md hover:-translate-y-[1px] hover:border-[hsl(0,0%,60%)] transition-all duration-150 ease-out active:translate-y-0 ${
                      !canAddMoreLogos ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    <img src="/Halorai Dev/Icons/material-symbols_upload-rounded.svg" alt="Upload" className="w-4 h-4" />
                    Upload
                  </button>
                  {/* Uploaded logo thumbnails with red X badges */}
                  <div className="flex items-center gap-2">
                    {logos.map((logo) => (
                      <div key={logo.id} className="relative">
                        <img src={logo.previewUrl} alt={logo.file.name} className="w-9 h-9 rounded-full object-cover" />
                        <button
                          onClick={() => handleRemoveLogo(logo.id)}
                          className="absolute -top-0 -right-0 w-3 h-3 bg-[hsl(15,100%,55%)] rounded-full flex items-center justify-center border-none cursor-pointer"
                          aria-label="Remove logo"
                        >
                          <img src="/Halorai Dev/Icons/cancel.svg" alt="Remove" className="w-2 h-2 brightness-0 invert" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Upload Ministers Pictures */}
              <div className="mt-8">
                <h3 className="text-sm font-regular text-[hsl(0,0%,10%)] mb-1">Upload Ministers Pictures</h3>
                <p className="text-xs text-[hsl(0,0%,55%)] mb-3">
                  Click the button below to upload Minister(s) pictures (max {MAX_MINISTERS})
                </p>
                <div className="border border-1 border-[hsl(0,0%,90%)] bg-[hsl(0,0%,99%)] rounded-xl p-6 flex flex-col items-center gap-2">
                  <input
                    ref={ministerInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      e.target.value = "";
                      handleAddMinisterImages(files);
                    }}
                  />
                  <button
                    disabled={!canAddMoreMinisters}
                    onClick={() => {
                      if (!canAddMoreMinisters) return;
                      ministerInputRef.current?.click();
                    }}
                    className={`flex items-center gap-2 border border-[hsl(0,0%,85%)] rounded-xl px-4 py-2 text-xs font-medium text-[hsl(0,0%,10%)] bg-white transition-colors ${
                      canAddMoreMinisters ? "cursor-pointer hover:border-[hsl(0,0%,60%)]" : "opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <img src="/Halorai Dev/Icons/material-symbols_upload-rounded.svg" alt="Upload" className="w-4 h-4" />
                    Upload
                  </button>
                  {!canAddMoreMinisters ? (
                    <p className="text-[11px] text-[hsl(15,100%,45%)] text-center">
                      You’ve reached the maximum of {MAX_MINISTERS} minister images.
                    </p>
                  ) : null}
                  <p className="text-[11px] text-[hsl(0,0%,50%)] text-center">
                    Choose images or drag & drop it here
                  </p>
                  <p className="text-[10px] text-[hsl(0,0%,65%)] text-center -mt-2">
                    JPG, JPEG, and PNG - Max 20 MB
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column - Ministers Names */}
            <div className="md:pl-12 xl:pl-14">
              <h3 className="text-sm font-semibold text-[hsl(0,0%,10%)] mb-1">Add Ministers Name <span className="text-xs text-[hsl(0,0%,55%)]">(In Order of Importance, Starting With The Most Prominent)</span></h3>
              <p className="text-xs text-[hsl(0,0%,55%)] mb-4">
                Enter Name and Title (Title is optional).{" "}
                {ministers.length > 1 ? (
                  <span className="text-[hsl(330,100%,38%)]">Use the drag handle on the left to reorder rows (top = most prominent).</span>
                ) : null}
              </p>
              <div
                className="flex flex-col gap-3 md:h-[220px] lg:h-[210px] xl:h-[200px] md:overflow-y-auto md:pr-6 ministers-scroll"
              >
                {ministers.map((minister, index) => (
                  <div
                    key={minister.id}
                    className={`flex items-start gap-3 lg:items-center ${ministersReorder.rowVisualClass(index)}`}
                    {...ministersReorder.rowDragHandlers(index)}
                  >
                    {ministers.length > 1 ? (
                      <MinisterDragHandle
                        onDragStart={ministersReorder.handleDragStart(index)}
                        onDragEnd={ministersReorder.handleDragEnd}
                      />
                    ) : (
                      <span className="w-4 shrink-0" aria-hidden />
                    )}
                    <img src={minister.avatar.previewUrl} alt={minister.avatar.file.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
                      <input
                        type="text"
                        placeholder={minister.placeholderName}
                        value={minister.name}
                        onChange={(e) => handleMinisterChange(minister.id, "name", e.target.value)}
                        className={`w-full lg:flex-1 border rounded-xl px-4 py-3.5 text-xs text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none transition-colors bg-white min-w-0 ${
                          didContinue && !minister.name.trim()
                            ? "border-[hsl(15,100%,55%)] focus:border-[hsl(15,100%,55%)]"
                            : "border-[hsl(0,0%,85%)] focus:border-[hsl(330,100%,80%)]"
                        }`}
                      />
                      <input
                        type="text"
                        placeholder={minister.placeholderTitle}
                        value={minister.title}
                        onChange={(e) => handleMinisterChange(minister.id, "title", e.target.value)}
                        className="w-[70%] sm:w-[60%] lg:w-[25%] min-w-[160px] border border-[hsl(0,0%,85%)] rounded-xl px-4 py-3.5 text-xs text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(330,100%,80%)] transition-colors bg-white"
                      />
                    </div>
                    <button
                      onClick={() => handleDeleteMinister(minister.id)}
                      className="w-10 h-10 shrink-0 self-start lg:self-center bg-[hsl(15,100%,55%)] rounded-xl flex items-center justify-center cursor-pointer hover:bg-[hsl(15,100%,45%)] transition-colors border-none"
                      aria-label="Delete minister"
                    >
                      <img src="/Halorai Dev/Icons/weui_delete-on-filled.svg" alt="Delete" className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>

              {didContinue && missingMinisterName ? (
                <div className="mt-3 text-xs text-[hsl(15,100%,45%)]">
                  Please enter a Name for each uploaded minister image to continue.
                </div>
              ) : null}

              {/* Navigation Buttons (kept under right column) */}
              <div className="flex items-center justify-end gap-3 mt-8">
                <button
                  onClick={() => navigate("/create-design")}
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
                  onClick={() => {
                    setDidContinue(true);
                    if (!canContinue) return;
                    navigate("/create-design/step-3");
                  }}
                  className={`flex items-center gap-2 border-none rounded-full px-4 py-3 text-xs font-medium transition-all duration-150 ease-out hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] ${
                    canContinue
                      ? "bg-[hsl(0,0%,10%)] text-white cursor-pointer hover:bg-[hsl(0,0%,20%)]"
                      : "bg-[hsl(0,0%,60%)] text-white cursor-not-allowed"
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

export default CreateDesignStep2;
