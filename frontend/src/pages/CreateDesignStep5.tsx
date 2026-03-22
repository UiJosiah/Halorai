import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import CreateDesignHero from "@/components/CreateDesignHero";
import StepperProgress from "@/components/StepperProgress";

const CreateDesignStep5 = () => {
  const [message, setMessage] = useState("");

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
            <div className="flex flex-col justify-between">
              <div className="border border-[hsl(330,100%,85%)] rounded-2xl p-4 flex flex-col h-full min-h-[260px]">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Put the logo on the right hand, and Remove the..."
                  className="flex-1 w-full resize-none border-none outline-none text-sm text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,65%)] bg-transparent"
                />
                <div className="flex justify-end mt-2">
                  <button className="w-10 h-10 rounded-full bg-[hsl(0,0%,75%)] flex items-center justify-center cursor-pointer hover:bg-[hsl(0,0%,60%)] transition-colors border-none">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 12L3 21L21 12L3 3L5 12ZM5 12H13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button className="flex items-center gap-2 border border-[hsl(0,0%,80%)] rounded-full px-6 py-3 text-sm font-medium text-[hsl(0,0%,10%)] bg-white cursor-pointer hover:border-[hsl(0,0%,60%)] transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 20H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16.5 3.50023C16.8978 3.1024 17.4374 2.87891 18 2.87891C18.2786 2.87891 18.5544 2.93378 18.8118 3.04038C19.0692 3.14699 19.303 3.30317 19.5 3.50023C19.697 3.69729 19.8532 3.93106 19.9598 4.18849C20.0665 4.44591 20.1213 4.72169 20.1213 5.00023C20.1213 5.27877 20.0665 5.55455 19.9598 5.81197C19.8532 6.0694 19.697 6.30317 19.5 6.50023L7 19.0002L3 20.0002L4 16.0002L16.5 3.50023Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Edit
                </button>
                <button className="flex items-center gap-2 bg-[hsl(0,0%,10%)] text-white border-none rounded-full px-6 py-3 text-sm font-medium cursor-pointer hover:bg-[hsl(0,0%,20%)] transition-colors">
                  Download
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 18L15 12L9 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
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
