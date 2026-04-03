import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import CreateDesignHero from "@/components/CreateDesignHero";
import StepperProgress from "@/components/StepperProgress";
import ContinueButton from "@/components/ContinueButton";
import { useCreateDesign } from "@/contexts/CreateDesignContext";

const CreateDesign = () => {
  const navigate = useNavigate();
  const [currentStep] = useState(1);
  const { eventDetails: formData, setEventDetails: setFormData } = useCreateDesign();
  const [didSubmit, setDidSubmit] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const required = {
    churchName: formData.churchName.trim(),
    date: formData.date.trim(),
    time: formData.time.trim(),
    venue: formData.venue.trim(),
    theme: formData.theme.trim(),
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  const isValid = missing.length === 0;
  const showErrors = didSubmit && !isValid;

  const inputClass = (field: string) =>
    `border rounded-xl px-4 py-3.5 text-xs text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none transition-colors bg-white ${
      showErrors && missing.includes(field)
        ? "border-[hsl(15,100%,55%)] focus:border-[hsl(15,100%,55%)]"
        : "border-[hsl(0,0%,85%)] focus:border-[hsl(330,100%,80%)]"
    }`;

  const handleContinue = async () => {
    setDidSubmit(true);
    if (!isValid) return;

    // Frontend-only until Gemini call; user can move back/forward quickly.
    localStorage.setItem("createDesign_eventDetails", JSON.stringify(formData));
    navigate("/create-design/step-2");
  };

  return (
    <AppLayout>
      <CreateDesignHero title="Create Design" />
      <StepperProgress currentStep={currentStep} />

      {/* Form */}
      <div className="px-4 xs:px-0">
        <div className="border border-[hsl(0,0%,80%)] rounded-2xl p-6 md:p-8">
          <h2 className="text-lg md:text-xl font-semibold text-[hsl(0,0%,10%)] mb-6">
            Enter Event Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div className="flex flex-col gap-1.5 order-1 md:order-1">
              <label className="text-sm font-medium text-[hsl(0,0%,10%)]">Church/Ministry Name</label>
              <input
                type="text"
                placeholder="e.g House of Fire Ministry"
                value={formData.churchName}
                onChange={(e) => handleChange("churchName", e.target.value)}
                className={inputClass("churchName")}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 order-4 md:order-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[hsl(0,0%,10%)]">Date</label>
                <input
                  type="text"
                  placeholder="eg. 20th-30th March, 2026"
                  value={formData.date}
                  onChange={(e) => handleChange("date", e.target.value)}
                  className={inputClass("date")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[hsl(0,0%,10%)]">Time</label>
                <input
                  type="text"
                  placeholder="eg. 5pm Daily"
                  value={formData.time}
                  onChange={(e) => handleChange("time", e.target.value)}
                  className={inputClass("time")}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 order-2 md:order-3">
              <label className="text-sm font-medium text-[hsl(0,0%,10%)]">Event Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g 7 Nights of Glory"
                value={formData.eventName}
                onChange={(e) => handleChange("eventName", e.target.value)}
                className="border border-[hsl(0,0%,85%)] rounded-xl px-4 py-3.5 text-xs text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(330,100%,80%)] transition-colors bg-white"
              />
            </div>

            <div className="flex flex-col gap-1.5 order-5 md:order-4">
              <label className="text-sm font-medium text-[hsl(0,0%,10%)]">Venue</label>
              <input
                type="text"
                placeholder="eg. HOF Auditorium, Mainland, Lagos"
                value={formData.venue}
                onChange={(e) => handleChange("venue", e.target.value)}
                className={inputClass("venue")}
              />
            </div>

            <div className="flex flex-col gap-1.5 order-3 md:order-5">
              <label className="text-sm font-medium text-[hsl(0,0%,10%)]">Theme</label>
              <input
                type="text"
                placeholder="e.g Flames of Fire"
                value={formData.theme}
                onChange={(e) => handleChange("theme", e.target.value)}
                className={inputClass("theme")}
              />
            </div>

            <div className="flex flex-col gap-1.5 order-6 md:order-6">
              <label className="text-sm font-medium text-[hsl(0,0%,10%)]">Other Info</label>
              <input
                type="text"
                placeholder="Enter any other instructions or Info you want to add"
                value={formData.otherInfo}
                onChange={(e) => handleChange("otherInfo", e.target.value)}
                className="border border-[hsl(0,0%,85%)] rounded-xl px-4 py-3.5 text-xs text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,70%)] outline-none focus:border-[hsl(330,100%,80%)] transition-colors bg-white"
              />
            </div>
          </div>

          {showErrors ? (
            <div className="mt-4 text-xs text-[hsl(15,100%,45%)]">
              Please fill the required fields to continue.
            </div>
          ) : null}

          <ContinueButton onClick={handleContinue} label="Continue" disabled={!isValid} />
        </div>
      </div>
    </AppLayout>
  );
};

export default CreateDesign;
