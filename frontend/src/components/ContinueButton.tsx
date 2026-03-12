interface ContinueButtonProps {
  onClick?: () => void;
  label?: string;
}

const ContinueButton = ({ onClick, label = "Continue" }: ContinueButtonProps) => {
  return (
    <div className="flex justify-end mt-8">
      <button
        onClick={onClick}
        className="flex items-center gap-2 bg-[hsl(0,0%,10%)] text-white border-none rounded-full px-4 py-3 text-xs font-medium cursor-pointer hover:bg-[hsl(0,0%,20%)] transition-all duration-150 ease-out hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
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
