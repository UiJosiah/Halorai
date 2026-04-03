interface ContinueButtonProps {
  onClick?: () => void;
  label?: string;
  disabled?: boolean;
}

const ContinueButton = ({ onClick, label = "Continue", disabled }: ContinueButtonProps) => {
  return (
    <div className="flex justify-end mt-8">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center gap-2 border-none rounded-full px-4 py-3 text-xs font-medium transition-all duration-150 ease-out hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] ${
          disabled
            ? "bg-[hsl(0,0%,60%)] text-white cursor-not-allowed"
            : "bg-[hsl(0,0%,10%)] text-white cursor-pointer hover:bg-[hsl(0,0%,20%)]"
        }`}
      >
        {label}
        <img
          src="/Halorai Dev/Icons/weui_arrow-outlined-forward.svg"
          alt="Forward"
          className="w-3.5 h-3.5"
        />
      </button>
    </div>
  );
};

export default ContinueButton;
