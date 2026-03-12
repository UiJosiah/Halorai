import { Fragment } from "react";

const steps = [1, 2, 3, 4, 5];

interface StepperProgressProps {
  currentStep: number;
}

const StepperProgress = ({ currentStep }: StepperProgressProps) => {
  return (
    <div className="px-4 xs:px-0 mt-6 mb-6">
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] items-center">
        <div className={`h-[2px] ${currentStep >= 1 ? "bg-[hsl(330,100%,85%)]" : "bg-[hsl(0,0%,88%)]"}`} />

        {steps.map((step, index) => (
          <Fragment key={step}>
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium border-2 shrink-0 ${
                step <= currentStep
                  ? "bg-[hsl(330,100%,93%)] border-[hsl(330,100%,85%)] text-[hsl(0,0%,10%)]"
                  : "bg-white border-[hsl(0,0%,85%)] text-[hsl(0,0%,50%)]"
              }`}
            >
              {step}
            </div>

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
  );
};

export default StepperProgress;
