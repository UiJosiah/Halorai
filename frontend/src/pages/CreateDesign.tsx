import { Fragment, useState } from "react";
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
        className="mt-3 xs:mt-0 xs:rounded-3xl px-4 md:px-6 xl:px-12 pt-1 md:pt-2 xl:pt-3 pb-0 flex flex-col md:flex-row items-start xs:items-center md:items-start justify-between mb-6 xs:mb-8 min-h-[180px] max-[450px]:min-h-[220px] md:min-h-0 relative overflow-hidden"
        style={{
          backgroundImage: "url('/Halorai Dev/Halorai Background.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Flyer image - cropped at bottom */}
        <div className="relative z-10 w-full xs:w-full md:w-[280px] lg:w-[320px] xl:w-[450px] order-2 md:order-2 flex items-end justify-center mb-0 overflow-hidden h-[120px] max-[450px]:h-[145px] md:h-[90px] xl:h-[105px]">
          <img
            src="/Halorai Dev/Images/Group 1000006715.png"
            alt="Event flyers"
            className="w-full h-full object-cover object-top scale-[1.02] max-[450px]:scale-[1.06] md:scale-[1.08] xl:scale-[1.1]"
          />
        </div>

        {/* Text content */}
        <div className="flex-1 max-w-full md:max-w-[350px] xl:max-w-[420px] relative z-10 order-1 md:order-1 text-left md:self-center">
          <h1 className="text-3xl leading-[1.15] font-semibold text-[hsl(0,0%,10%)] mt-0 md:mt-2 tracking-tight md:text-3xl md:leading-[1.05] md:font-semibold">
            Create Design
          </h1>
        </div>
      </section>

      {/* Stepper */}
      <div className="px-4 xs:px-0 mt-6 mb-6">
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] items-center">
          {/* Leading line before step 1 */}
          <div className={`h-[2px] ${currentStep >= 1 ? "bg-[hsl(330,100%,85%)]" : "bg-[hsl(0,0%,88%)]"}`} />

          {steps.map((step, index) => (
            <Fragment key={step}>
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

              {/* Line after the circle (step 5 included) */}
              <div
                className={`h-[2px] ${
                  index === steps.length - 1
                    ? "bg-[hsl(0,0%,88%)]"
                    : step < currentStep
                      ? "bg-[hsl(330,100%,85%)]"
                      : "bg-[hsl(0,0%,88%)]"
                }`}
              />
            </Fragment>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-medium text-[hsl(0,0%,10%)] bg-[hsl(0,0%,96%)] px-3 py-2 rounded-full">Start</span>
          <span className="text-sm font-medium text-[hsl(0,0%,10%)] bg-[hsl(0,0%,96%)] px-3 py-2 rounded-full">Complete</span>
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
                className="border border-[hsl(0,0%,85%)] rounded-xl px-4 py-3.5 text-xs text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(0,0%,50%)] transition-colors bg-white"
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
                  className="border border-[hsl(0,0%,85%)] rounded-xl px-4 py-3.5 text-xs text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(0,0%,50%)] transition-colors bg-white"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[hsl(0,0%,10%)]">Time</label>
                <input
                  type="text"
                  placeholder="eg. 5pm Daily"
                  value={formData.time}
                  onChange={(e) => handleChange("time", e.target.value)}
                  className="border border-[hsl(0,0%,85%)] rounded-xl px-4 py-3.5 text-xs text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(0,0%,50%)] transition-colors bg-white"
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
                className="border border-[hsl(0,0%,85%)] rounded-xl px-4 py-3.5 text-xs text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(0,0%,50%)] transition-colors bg-white"
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
                className="border border-[hsl(0,0%,85%)] rounded-xl px-4 py-3.5 text-xs text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(0,0%,50%)] transition-colors bg-white"
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
                className="border border-[hsl(0,0%,85%)] rounded-xl px-4 py-3.5 text-xs text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(0,0%,50%)] transition-colors bg-white"
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
                className="border border-[hsl(0,0%,85%)] rounded-xl px-4 py-3.5 text-xs text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(0,0%,50%)] transition-colors bg-white"
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
