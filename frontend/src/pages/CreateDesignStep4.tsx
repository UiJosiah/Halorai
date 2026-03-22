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
    placeholderName: "Pastor John Michael",
    placeholderTitle: "Guest Speaker",
    avatar: "/Halorai Dev/Images/Ellipse 1.png",
  },
  {
    slotId: 6,
    name: "",
    title: "",
    placeholderName: "Pastor Drake Akinola",
    placeholderTitle: "Host",
    avatar: "/Halorai Dev/Images/Ellipse 2.png",
  },
];

const CreateDesignStep4 = () => {
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
                <button className="w-7 h-7 flex items-center justify-center cursor-pointer bg-transparent border-none">
                  <img src="/Halorai Dev/Icons/lucide_edit-3.svg" alt="Edit" className="w-4 h-4" />
                </button>
              </div>
              <div className="details-scroll flex flex-col gap-1.5 text-sm text-[hsl(0,0%,45%)] pr-2">
                <span>House of Fire Ministry</span>
                <span>7 Nights of Glory</span>
                <span>Flames of Fire</span>
                <span>20th-30th March, 2026</span>
                <span>5pm Daily</span>
                <span>HOF Auditorium</span>
              </div>
            </div>

            {/* Logos Card */}
            <div className="bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,95%)] rounded-2xl p-5 flex flex-col">
              <h3 className="text-sm font-medium text-[hsl(0,0%,40%)] mb-5">Logos</h3>
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="flex items-center justify-center gap-3 mb-10">
                  <div className="relative">
                    <img src="/Halorai Dev/Icons/blue cross.svg" alt="Logo 1" className="w-10 h-10 object-cover" />
                    <button className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[hsl(15,100%,55%)] rounded-full flex items-center justify-center border-none cursor-pointer">
                      <img src="/Halorai Dev/Icons/cancel.svg" alt="Remove" className="w-2.5 h-2.5 brightness-0 invert" />
                    </button>
                  </div>
                  <div className="relative">
                    <img src="/Halorai Dev/Icons/black cross.svg" alt="Logo 2" className="w-10 h-10 object-cover" />
                    <button className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[hsl(15,100%,55%)] rounded-full flex items-center justify-center border-none cursor-pointer">
                      <img src="/Halorai Dev/Icons/cancel.svg" alt="Remove" className="w-2.5 h-2.5 brightness-0 invert" />
                    </button>
                  </div>
                </div>
                <button className="flex items-center gap-2 border border-[hsl(0,0%,85%)] rounded-lg px-3 py-1.5 text-xs font-medium text-[hsl(0,0%,10%)] bg-white cursor-pointer hover:border-[hsl(0,0%,60%)] transition-colors w-fit">
                  <img src="/Halorai Dev/Icons/material-symbols_upload-rounded.svg" alt="Upload" className="w-4 h-4" />
                  Upload
                </button>
              </div>
            </div>

            {/* Ministers Card */}
            <div className="flex flex-col bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,95%)] rounded-2xl p-5">
              <div className="flex items-center justify-between ">
                <h3 className="text-sm font-medium text-[hsl(0,0%,40%)] mb-10">Ministers</h3>
                <button className="flex items-center gap-2 border border-[hsl(0,0%,85%)] rounded-lg px-3 py-1.5 text-xs font-medium text-[hsl(0,0%,10%)] bg-white cursor-pointer hover:border-[hsl(0,0%,60%)] transition-colors">
                  <img src="/Halorai Dev/Icons/material-symbols_upload-rounded.svg" alt="Upload" className="w-4 h-4" />
                  Upload
                </button>
              </div>
              <div className="ministers-scroll flex flex-col gap-3 md:max-h-[200px] md:overflow-y-auto md:pr-8">
                {ministers.map((minister) => (
                  <div key={minister.slotId} className="flex items-center gap-3">
                    <img
                      src={minister.avatar}
                      alt={minister.placeholderName}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                    <input
                      type="text"
                      placeholder={minister.placeholderName}
                      value={minister.name}
                      onChange={(e) => handleMinisterChange(minister.slotId, "name", e.target.value)}
                      className="flex-1 border border-[hsl(0,0%,85%)] rounded-xl px-4 py-2.5 text-xs text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(330,100%,80%)] transition-colors bg-white min-w-0"
                    />
                    <input
                      type="text"
                      placeholder={minister.placeholderTitle}
                      value={minister.title}
                      onChange={(e) => handleMinisterChange(minister.slotId, "title", e.target.value)}
                      className="w-[25%] shrink-0 border border-[hsl(0,0%,85%)] rounded-xl px-4 py-2.5 text-xs text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(330,100%,80%)] transition-colors bg-white"
                    />
                    <button
                      onClick={() => handleDeleteMinister(minister.slotId)}
                      className="w-8 h-8 shrink-0 bg-[hsl(15,100%,55%)] rounded-xl flex items-center justify-center cursor-pointer hover:bg-[hsl(15,100%,45%)] transition-colors border-none"
                    >
                      <img src="/Halorai Dev/Icons/weui_delete-on-filled.svg" alt="Delete" className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Background Concept */}
          <div className="mt-8">
            <h3 className="text-sm font-medium text-[hsl(0,0%,40%)] mb-3">Background Concept</h3>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="flex-1 border border-[hsl(0,0%,85%)] rounded-xl px-5 py-3 text-sm text-[hsl(0,0%,45%)] bg-white">
                Fierce Fire Burning on a Mountain
              </div>
              <button
                aria-label="Create"
                onClick={() => navigate("/create-design/step-5")}
                className="border-none bg-transparent p-0 cursor-pointer transition-all duration-150 ease-out hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] shrink-0"
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