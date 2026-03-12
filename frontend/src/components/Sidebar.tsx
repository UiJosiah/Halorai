interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed md:relative z-50 md:z-auto
          top-0 left-0 h-full md:top-auto md:left-auto md:h-auto md:self-start
          w-[260px] md:w-[200px] xl:w-[240px]
          min-w-0 md:min-w-[180px] xl:min-w-[220px]
          p-4 xl:p-5 pt-7
          flex flex-col
          bg-[#F8F8F8] md:rounded-3xl
          shrink-0
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        <div className="flex flex-col">
          <h2 className="text-[22px] text-[hsl(0,0%,10%)] leading-tight mb-16 mt-5">
            <span className="font-light">Welcome back,</span><br />
            <span className="font-medium">Johnny </span>
          </h2>
          <nav className="flex flex-col gap-1">
            <a href="#" className="flex items-center gap-2 px-3.5 py-3 rounded-full text-xs font-medium text-[hsl(0,0%,10%)] bg-white no-underline">
              <img src="/Halorai Dev/Icons/solar_home-2-linear.svg" alt="Home" className="w-3 h-3" />
              Home
            </a>
            <a href="#" className="flex items-center gap-2 px-3.5 py-3 rounded-full text-xs text-[hsl(0,0%,58%)] no-underline bg-transparent hover:bg-white transition-colors">
              <img src="/Halorai Dev/Icons/lsicon_folder-files-filled.svg" alt="Projects" className="w-3 h-3" />
              Your Projects
            </a>
            <a href="#" className="flex items-center gap-2 px-3.5 py-3 rounded-full text-xs text-[hsl(0,0%,58%)] no-underline bg-transparent hover:bg-white transition-colors">
              <img src="/Halorai Dev/Icons/hugeicons_chat-feedback.svg" alt="Feedback" className="w-3 h-3" />
              Give Feedback
            </a>
          </nav>
        </div>


        {/* Upgrade Card */}
        <div className="mt-8 md:mt-10 lg:mt-12 xl:mt-14 bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,100%)] rounded-2xl p-5">
          <div className="w-10 h-10 bg-[hsl(16,100%,93%)] rounded-full flex items-center justify-center mb-3.5">
            <img src="/Halorai Dev/Icons/material-symbols_crown-rounded.svg" alt="Crown" className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-normal text-[hsl(0,0%,20%)] mb-3">Upgrade to Pro</h3>
          <ul className="list-none p-0 m-0 mb-4 flex flex-col gap-2">
            <li className="flex items-center gap-2 text-xs font-normal text-[hsl(0,0%,40%)]">
              <img src="/Halorai Dev/Icons/pepicons-pencil_checkmark-filled.svg" alt="Check" className="w-3.5 h-3.5" />
              Premium Design
            </li>
            <li className="flex items-center gap-2 text-xs font-normal text-[hsl(0,0%,40%)]">
              <img src="/Halorai Dev/Icons/pepicons-pencil_checkmark-filled.svg" alt="Check" className="w-3.5 h-3.5" />
              High Export for Print
            </li>
            <li className="flex items-center gap-2 text-xs font-normal text-[hsl(0,0%,40%)]">
              <img src="/Halorai Dev/Icons/pepicons-pencil_checkmark-filled.svg" alt="Check" className="w-3.5 h-3.5" />
              Advance Editing
            </li>
          </ul>
          <button className="bg-[hsl(0,0%,0%)] text-[hsl(0,0%,50%)] border-none rounded-full py-2.5 min-w-[85%] text-xs font-normal cursor-pointer transition-all duration-150 ease-out hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]">
            Coming soon
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
