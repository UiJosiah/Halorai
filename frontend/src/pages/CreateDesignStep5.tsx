import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import CreateDesignHero from "@/components/CreateDesignHero";
import StepperProgress from "@/components/StepperProgress";

const CreateDesignStep5 = () => {
  const [message, setMessage] = useState("");
  const hasMessage = message.trim().length > 0;

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
              
              <img
                src="/Halorai Dev/Images/analysing theme 2.png"
                alt="Analyzing your theme"
                className="w-48 h-48 md:w-64 md:h-48 object-contain my-20 pl-4"
              />
            </div>

            {/* Middle Column - Design Preview */}
            <div className="flex items-center justify-center">
              <img
                src="/Halorai Dev/Images/Easter retreat.png"
                alt="Design Preview"
                className="w-full max-w-[280px] h-auto rounded-xl object-contain"
              />
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

              <div className="w-full max-w-[420px] flex items-center gap-4 mt-4">
                <button className="flex-1 flex items-center justify-center gap-2 bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,95%)] rounded-full px-6 py-3 text-sm font-regular text-[hsl(0,0%,10%)] cursor-pointer hover:border-[hsl(0,0%,60%)] transition-colors">
                  <img src="/Halorai Dev/Icons/lucide_edit-3.svg" alt="Edit" className="w-4 h-4" />
                  Edit
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 bg-[hsl(0,0%,10%)] text-white border-none rounded-full px-6 py-3 text-sm font-regular cursor-pointer hover:bg-[hsl(0,0%,20%)] transition-colors">
                  Download
                  <img
                    src="/Halorai Dev/Icons/weui_arrow-outlined-forward.svg"
                    alt="Forward"
                    className="w-4 h-4 pl-1"
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

export default CreateDesignStep5;
