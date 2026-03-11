import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";

const steps = [1, 2, 3, 4, 5];

const CreateDesign = () => {
  const navigate = useNavigate();
  const [currentStep] = useState(1);
  const [formData, setFormData] = useState({
    churchName: "",
    date: "",
    time: "",
    eventName: "",
    venue: "",
    theme: "",
    otherInfo: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <AppLayout>
      {/* Hero Section - same as HaloRAI but no button, image cropped at bottom */}
      <section
        className="xs:rounded-3xl px-4 md:px-6 xl:px-12 pt-1 md:pt-2 xl:pt-3 pb-0 flex flex-col md:flex-row items-center md:items-start justify-between mb-6 xs:mb-8 min-h-0 relative overflow-hidden"
        style={{
          backgroundImage: "url('/Halorai Dev/Halorai Background.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Flyer image - cropped at bottom */}
        <div className="relative z-10 w-full xs:w-full md:w-[280px] lg:w-[320px] xl:w-[450px] order-1 xs:order-2 md:order-2 flex items-end justify-center mb-0 overflow-hidden h-[80px] md:h-[110px] xl:h-[130px]">
          <img
            src="/Halorai Dev/Images/Group 1000006715.png"
            alt="Event flyers"
            className="w-[85%] xs:w-full h-full object-cover object-top scale-[1.08]"
          />
        </div>

        {/* Text content */}
        <div className="flex-1 max-w-full md:max-w-[350px] xl:max-w-[420px] relative z-10 order-2 xs:order-1 md:order-1">
          <h1 className="text-[28px] leading-[1.15] xs:text-xl md:text-2xl xl:text-3xl font-medium text-[hsl(0,0%,10%)] xs:leading-tight mt-6 md:mt-8 xl:mt-10 tracking-tight">
            Create Design
          </h1>
        </div>
      </section>

      {/* Stepper */}
      <div className="px-4 xs:px-0 mt-6 mb-6">
        <div className="flex items-center">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              {/* Line BEFORE the number */}
              <div
                className={`flex-1 h-[2px] ${
                  step <= currentStep ? "bg-[hsl(330,100%,85%)]" : "bg-[hsl(0,0%,88%)]"
                }`}
              />
              {/* Number circle */}
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium border-2 shrink-0 ${
                  step <= currentStep
                    ? "bg-[hsl(330,100%,93%)] border-[hsl(330,100%,85%)] text-[hsl(0,0%,10%)]"
                    : "bg-white border-[hsl(0,0%,85%)] text-[hsl(0,0%,50%)]"
                }`}
              >
                {step}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs font-medium text-[hsl(0,0%,10%)] bg-[hsl(0,0%,96%)] px-3 py-1.5 rounded-md">Start</span>
          <span className="text-xs font-medium text-[hsl(0,0%,10%)] bg-[hsl(0,0%,96%)] px-3 py-1.5 rounded-md">Complete</span>
        </div>
      </div>

      {/* Form */}
      <div className="px-4 xs:px-0">
        <div className="border border-[hsl(0,0%,90%)] rounded-2xl p-6 md:p-8">
          <h2 className="text-lg md:text-xl font-semibold text-[hsl(0,0%,10%)] mb-6">
            Enter Event Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            {/* Church/Ministry Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[hsl(0,0%,10%)]">Church/Ministry Name</label>
              <input
                type="text"
                placeholder="e.g House of Fire Ministry"
                value={formData.churchName}
                onChange={(e) => handleChange("churchName", e.target.value)}
                className="border border-[hsl(0,0%,85%)] rounded-xl px-4 py-3 text-sm text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(0,0%,50%)] transition-colors bg-white"
              />
            </div>

            {/* Date and Time in same row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[hsl(0,0%,10%)]">Date</label>
                <input
                  type="text"
                  placeholder="eg. 20th-30th March, 2026"
                  value={formData.date}
                  onChange={(e) => handleChange("date", e.target.value)}
                  className="border border-[hsl(0,0%,85%)] rounded-xl px-4 py-3 text-sm text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(0,0%,50%)] transition-colors bg-white"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[hsl(0,0%,10%)]">Time</label>
                <input
                  type="text"
                  placeholder="eg. 5pm Daily"
                  value={formData.time}
                  onChange={(e) => handleChange("time", e.target.value)}
                  className="border border-[hsl(0,0%,85%)] rounded-xl px-4 py-3 text-sm text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(0,0%,50%)] transition-colors bg-white"
                />
              </div>
            </div>

            {/* Event Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[hsl(0,0%,10%)]">Event Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g 7 Nights of Glory"
                value={formData.eventName}
                onChange={(e) => handleChange("eventName", e.target.value)}
                className="border border-[hsl(0,0%,85%)] rounded-xl px-4 py-3 text-sm text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(0,0%,50%)] transition-colors bg-white"
              />
            </div>

            {/* Venue */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[hsl(0,0%,10%)]">Venue</label>
              <input
                type="text"
                placeholder="eg. HOF Auditorium, Mainland, Lagos"
                value={formData.venue}
                onChange={(e) => handleChange("venue", e.target.value)}
                className="border border-[hsl(0,0%,85%)] rounded-xl px-4 py-3 text-sm text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(0,0%,50%)] transition-colors bg-white"
              />
            </div>

            {/* Theme */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[hsl(0,0%,10%)]">Theme</label>
              <input
                type="text"
                placeholder="e.g Flames of Fire"
                value={formData.theme}
                onChange={(e) => handleChange("theme", e.target.value)}
                className="border border-[hsl(0,0%,85%)] rounded-xl px-4 py-3 text-sm text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(0,0%,50%)] transition-colors bg-white"
              />
            </div>

            {/* Other Info */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[hsl(0,0%,10%)]">Other Info</label>
              <input
                type="text"
                placeholder="Enter any other instructions or Info you want to add"
                value={formData.otherInfo}
                onChange={(e) => handleChange("otherInfo", e.target.value)}
                className="border border-[hsl(0,0%,85%)] rounded-xl px-4 py-3 text-sm text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(0,0%,50%)] transition-colors bg-white"
              />
            </div>
          </div>

          {/* Continue Button */}
          <div className="flex justify-end mt-8">
            <button className="flex items-center gap-2 bg-[hsl(0,0%,10%)] text-white border-none rounded-full px-6 py-3 text-sm font-medium cursor-pointer hover:bg-[hsl(0,0%,20%)] transition-colors">
              Continue
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CreateDesign;
