import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import CreateDesignHero from "@/components/CreateDesignHero";
import StepperProgress from "@/components/StepperProgress";

interface Minister {
  slotId: number;
  name: string;
  title: string;
  placeholderName: string;
  placeholderTitle: string;
  avatar: string;
}

const initialMinisters: Minister[] = [
  {
    slotId: 1,
    name: "",
    title: "",
    placeholderName: "Pastor John Michael",
    placeholderTitle: "Guest Speaker",
    avatar: "/Halorai Dev/Images/Ellipse 1.png",
  },
  {
    slotId: 2,
    name: "",
    title: "",
    placeholderName: "Pastor Drake Akinola",
    placeholderTitle: "Host",
    avatar: "/Halorai Dev/Images/Ellipse 2.png",
  },
  {
    slotId: 3,
    name: "",
    title: "",
    placeholderName: "Mrs Sonia Precious",
    placeholderTitle: "Guest Speaker",
    avatar: "/Halorai Dev/Images/Ellipse 3.png",
  },
  {
    slotId: 4,
    name: "",
    title: "",
    placeholderName: "Pst (Mrs) Funke Tojuola (JP)",
    placeholderTitle: "Special Guest",
    avatar: "/Halorai Dev/Images/Ellipse 4.png",
  },
  {
    slotId: 5,
    name: "",
    title: "",
    placeholderName: "Pastor John Michael 2",
    placeholderTitle: "Guest Speaker",
    avatar: "/Halorai Dev/Images/Ellipse 1.png",
  },
  {
    slotId: 6,
    name: "",
    title: "",
    placeholderName: "Pastor Drake Akinola 2",
    placeholderTitle: "Host",
    avatar: "/Halorai Dev/Images/Ellipse 2.png",
  },
];

const CreateDesignStep2 = () => {
  const navigate = useNavigate();
  const [ministers, setMinisters] = useState<Minister[]>(initialMinisters);

  const handleDeleteMinister = (slotId: number) => {
    setMinisters((prev) => prev.filter((m) => m.slotId !== slotId));
  };

  const handleMinisterChange = (slotId: number, field: "name" | "title", value: string) => {
    setMinisters((prev) =>
      prev.map((m) => (m.slotId === slotId ? { ...m, [field]: value } : m))
    );
  };

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
                  <button className="flex items-center gap-2 border border-[hsl(0,0%,85%)] rounded-xl px-4 py-2.5 text-xs font-medium text-[hsl(0,0%,10%)] bg-white cursor-pointer shadow-lg hover:shadow-md hover:-translate-y-[1px] hover:border-[hsl(0,0%,60%)] transition-all duration-150 ease-out active:translate-y-0">
                    <img src="/Halorai Dev/Icons/material-symbols_upload-rounded.svg" alt="Upload" className="w-4 h-4" />
                    Upload
                  </button>
                  {/* Uploaded logo thumbnails with red X badges */}
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <img src="/Halorai Dev/Icons/blue cross.svg" alt="Logo 1" className="w-9 h-9 rounded-full object-cover" />
                      <button className="absolute -top-1 -right-1 w-3 h-3 bg-[hsl(15,100%,55%)] rounded-full flex items-center justify-center">
                        <img src="/Halorai Dev/Icons/cancel.svg" alt="Remove" className="w-2 h-2 brightness-0 invert" />
                      </button>
                    </div>
                    <div className="relative">
                      <img src="/Halorai Dev//Icons/black cross.svg" alt="Logo 2" className="w-9 h-9 rounded-full object-cover" />
                      <button className="absolute -top-1 -right-1 w-3 h-3 bg-[hsl(15,100%,55%)] rounded-full flex items-center justify-center">
                        <img src="/Halorai Dev/Icons/cancel.svg" alt="Remove" className="w-2 h-2 brightness-0 invert" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload Ministers Pictures */}
              <div className="mt-8">
                <h3 className="text-sm font-regular text-[hsl(0,0%,10%)] mb-1">Upload Ministers Pictures</h3>
                <p className="text-xs text-[hsl(0,0%,55%)] mb-3">Click the button below to upload Minister(s) pictures</p>
                <div className="border border-1 border-[hsl(0,0%,90%)] bg-[hsl(0,0%,99%)] rounded-xl p-6 flex flex-col items-center gap-2">
                  <button className="flex items-center gap-2 border border-[hsl(0,0%,85%)] rounded-xl px-4 py-2 text-xs font-medium text-[hsl(0,0%,10%)] bg-white cursor-pointer hover:border-[hsl(0,0%,60%)] transition-colors">
                    <img src="/Halorai Dev/Icons/material-symbols_upload-rounded.svg" alt="Upload" className="w-4 h-4" />
                    Upload
                  </button>
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
              <h3 className="text-sm font-semibold text-[hsl(0,0%,10%)] mb-1">Add Ministers Name</h3>
              <p className="text-xs text-[hsl(0,0%,55%)] mb-4">Enter Name and Title (Title is Optional)</p>
              <div
                className="flex flex-col gap-3 md:h-[220px] lg:h-[210px] xl:h-[200px] md:overflow-y-scroll md:pr-6 md:border-r-2 md:border-[hsl(0,0%,90%)]"
                style={{ scrollbarGutter: "stable" }}
              >
                {ministers.map((minister) => (
                  <div key={minister.slotId} className="flex items-center gap-3">
                    <img
                      src={minister.avatar}
                      alt={minister.placeholderName}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                    <input
                      type="text"
                      placeholder={minister.placeholderName}
                      value={minister.name}
                      onChange={(e) => handleMinisterChange(minister.slotId, "name", e.target.value)}
                      className="flex-1 border border-[hsl(0,0%,85%)] rounded-xl px-4 py-3.5 text-xs text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(330,100%,80%)] transition-colors bg-white min-w-0"
                    />
                    <input
                      type="text"
                      placeholder={minister.placeholderTitle}
                      value={minister.title}
                      onChange={(e) => handleMinisterChange(minister.slotId, "title", e.target.value)}
                      className="w-[25%] shrink-0 border border-[hsl(0,0%,85%)] rounded-xl px-4 py-3.5 text-xs text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(330,100%,80%)] transition-colors bg-white"
                    />
                    <button
                      onClick={() => handleDeleteMinister(minister.slotId)}
                      className="w-10 h-10 shrink-0 bg-[hsl(15,100%,55%)] rounded-xl flex items-center justify-center cursor-pointer hover:bg-[hsl(15,100%,45%)] transition-colors"
                    >
                      <img src="/Halorai Dev/Icons/weui_delete-on-filled.svg" alt="Delete" className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>

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
                  onClick={() => {}}
                  className="flex items-center gap-2 bg-[hsl(0,0%,10%)] text-white border-none rounded-full px-4 py-3 text-xs font-medium cursor-pointer hover:bg-[hsl(0,0%,20%)] transition-all duration-150 ease-out hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
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
