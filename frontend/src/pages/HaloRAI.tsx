import { useState } from "react";

const categories = ["Fellowship", "Love", "Prayer Retreat", "Conference", "Birthday"];

const communityDesigns = [
  { id: 1, image: "/Halorai Dev/Images/1.png", alt: "Design 1" },
  { id: 2, image: "/Halorai Dev/Images/2.png", alt: "Design 2" },
  { id: 3, image: "/Halorai Dev/Images/3.png", alt: "Design 3" },
  { id: 4, image: "/Halorai Dev/Images/4.png", alt: "Design 4" },
  { id: 5, image: "/Halorai Dev/Images/5.png", alt: "Design 5" },
];

const HaloRAI = () => {
  const [activeCategory, setActiveCategory] = useState("Prayer Retreat");

  return (
    <div className="font-['Google_Sans_Flex',_'Segoe_UI',_system-ui,_sans-serif] min-h-screen flex flex-col bg-white">
      {/* Navbar */}
      <nav
        className="flex items-center justify-between px-12 py-3 sticky top-0 z-50 border-b border-[hsl(0,0%,94%)]"
        style={{
          backgroundImage: "url('/Halorai Dev/Halorai Background.png')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      >
        <div className="flex items-center gap-0.5">
          <img src="/Halorai Dev/Logos/Halorai Logo-.png" alt="Halorai Logo" className="h-7" />
        </div>
        <div className="flex items-center gap-5">
          <span className="text-[15px] font-regular text-[hsl(0,0%,10%)] cursor-pointer">Pricing</span>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full overflow-hidden">
              <img
                src="/Halorai Dev/Images/user avatar.png"
                alt="User avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[15px] font-regular text-[hsl(0,0%,10%)]">Johnny Adams</span>
          </div>
          <button className="bg-[#FCFCFC] border-none rounded-full cursor-pointer p-1 flex items-center">
            <img src="/Halorai Dev/Icons/material-symbols_dark-mode.svg" alt="Dark mode" className="w-[16px] h-[16px]" />
          </button>
          <button className="flex items-center gap-2 bg-[hsl(0,0%,10%)] text-white border-none rounded-3xl px-5 py-2.5 text-sm font-regular cursor-pointer">
            <img src="/Halorai Dev/Icons/cuida_logout-outline.svg" alt="Logout" className="w-[18px] h-[18px]" />
            Logout
          </button>
        </div>
      </nav>

      <div className="flex flex-1 gap-6 pr-8 pt-4 pb-8 bg-white min-h-0">
        {/* Sidebar */}
        <aside className="w-[240px] min-w-[220px] p-5 pt-7 flex flex-col justify-between bg-[#F8F8F8] rounded-3xl">
          <div className="flex flex-col">
            <h2 className="text-[22px] text-[hsl(0,0%,10%)] leading-tight mb-16">
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
          <div className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,100%)] rounded-2xl p-5">
            <div className="w-12 h-12 bg-[hsl(16,100%,93%)] rounded-full flex items-center justify-center mb-3.5">
              <img src="/Halorai Dev/Icons/material-symbols_crown-rounded.svg" alt="Crown" className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-regular text-[hsl(0,0%,20%)] mb-3">Upgrade to Pro</h3>
            <ul className="list-none p-0 m-0 mb-4 flex flex-col gap-2">
              <li className="flex items-center gap-2 text-xs font-regular text-[hsl(0,0%,40%)]">
                <img src="/Halorai Dev/Icons/pepicons-pencil_checkmark-filled.svg" alt="Check" className="w-3.5 h-3.5" />
                Premium Design
              </li>
              <li className="flex items-center gap-2 text-xs font-regular text-[hsl(0,0%,40%)]">
                <img src="/Halorai Dev/Icons/pepicons-pencil_checkmark-filled.svg" alt="Check" className="w-3.5 h-3.5" />
                High Export for Print
              </li>
              <li className="flex items-center gap-2 text-xs font-regular text-[hsl(0,0%,40%)]">
                <img src="/Halorai Dev/Icons/pepicons-pencil_checkmark-filled.svg" alt="Check" className="w-3.5 h-3.5" />
                Advance Editing
              </li>
            </ul>
            <button className="w-full bg-[hsl(0,0%,0%)] text-[hsl(0,0%,50%)] border-none rounded-full py-2.5 text-xs font-regular cursor-pointer">
              Coming soon
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto min-h-0 rounded-3xl">
          {/* Hero Section */}
          <section
            className="rounded-3xl px-12 py-10 flex items-center justify-between mb-16 min-h-[300px] relative overflow-hidden"
            style={{
              backgroundImage: "url('/Halorai Dev/Halorai Background.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            
            <div className="flex-1 max-w-[420px] relative z-10">
              <h1 className="text-3xl font-medium text-[hsl(0,0%,10%)] leading-tight mt-8 mb-32 tracking-tight">
                Design Your Next Event Today
              </h1>
              <button className="border-none bg-transparent p-0 cursor-pointer">
                <img
                  src="/Halorai Dev/Icons/Create Design button.png"
                  alt="Create Design"
                  className="h-16"
                />
              </button>
            </div>
            <div className="relative z-10 w-[450px] h-full flex items-center justify-center">
              <img
                src="/Halorai Dev/Images/Group 1000006715.png"
                alt="Event flyer 1"
                className="w-full h-full object-contain object-right"
              />
            </div>
          </section>

          {/* Community Section */}
          <section className="mt-2">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <h2 className="text-lg font-medium text-[hsl(0,0%,10%)]">Results from our Community</h2>
              <div className="flex gap-2.5 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    className={`px-5 py-2.5 rounded-[28px] text-xs cursor-pointer transition-all ${
                      activeCategory === cat
                        ? "bg-[hsl(0,0%,10%)] text-white border border-[hsl(0,0%,10%)]"
                        : "bg-white text-[hsl(0,0%,33%)] border border-[hsl(0,0%,88%)] hover:border-[hsl(0,0%,60%)]"
                    }`}
                    onClick={() => setActiveCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-5 gap-4">
              {communityDesigns.map((design) => (
                <div
                  key={design.id}
                  className="rounded-2xl overflow-hidden aspect-[3/4] shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-transform"
                >
                  <img src={design.image} alt={design.alt} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default HaloRAI;
