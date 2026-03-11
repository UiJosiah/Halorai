import { useState } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="font-['Google_Sans_Flex',_'Segoe_UI',_system-ui,_sans-serif] min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Mobile hamburger button - hidden below 500px, shown 500-768px */}
      <button
        className="hidden xs:flex md:hidden fixed bottom-6 left-6 z-50 w-12 h-12 bg-[hsl(0,0%,10%)] text-white rounded-full items-center justify-center shadow-lg cursor-pointer border-none"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {sidebarOpen ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      <div className="flex flex-1 gap-0 xs:gap-4 xl:gap-6 px-0 xs:px-4 md:pl-0 md:pr-4 xl:pr-8 pt-0 xs:pt-4 pb-4 xs:pb-8 bg-white min-h-0">
        {/* Sidebar hidden below 500px */}
        <div className="hidden xs:flex">
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        </div>
        <main className="flex-1 overflow-y-auto min-h-0 xs:rounded-3xl">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
