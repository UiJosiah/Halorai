import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";

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
  const navigate = useNavigate();

  return (
    <AppLayout>
      {/* Hero Section */}
      <section
        className="xs:rounded-3xl px-4 md:px-6 xl:px-12 pt-7 pb-6 md:pt-7 md:pb-8 xl:pt-7 xl:pb-10 flex flex-col md:flex-row items-center justify-between mb-6 xs:mb-8 md:mb-16 min-h-0 xs:min-h-[200px] md:min-h-[260px] xl:min-h-[300px] relative overflow-hidden"
        style={{
          backgroundImage: "url('/Halorai Dev/Halorai Background.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* On mobile (<500px): flyer image first, then text below */}
        {/* On desktop: text left, flyer right */}
        
        {/* Flyer - shown first on mobile (order-1), second on desktop */}
        <div className="relative z-10 w-full xs:w-full md:w-[280px] lg:w-[320px] xl:w-[450px] order-1 xs:order-2 md:order-2 flex items-center justify-center mb-4 xs:mb-0">
          <img
            src="/Halorai Dev/Images/Group 1000006715.png"
            alt="Event flyer 1"
            className="w-[85%] xs:w-full h-full object-contain md:object-right"
          />
        </div>

        {/* Text content - shown second on mobile (order-2), first on desktop */}
        <div className="flex-1 max-w-full md:max-w-[350px] xl:max-w-[420px] relative z-10 order-2 xs:order-1 md:order-1">
          {/* Welcome text - only on mobile */}
          <p className="text-sm text-[hsl(0,0%,55%)] font-light mb-1 block xs:hidden">
            Welcome back, <span className="text-[hsl(0,0%,30%)]">Johnny</span>
          </p>
          <h1 className="text-[28px] leading-[1.15] xs:text-xl md:text-2xl xl:text-3xl font-medium text-[hsl(0,0%,10%)] xs:leading-tight mt-0 md:mt-2 xl:mt-4 mb-5 xs:mb-8 md:mb-24 xl:mb-32 tracking-tight">
            Design Your Next Event Today
          </h1>
          <button className="border-none bg-transparent p-0 cursor-pointer w-full xs:w-auto" onClick={() => navigate("/create-design")}>
            <img
              src="/Halorai Dev/Icons/Create Design button.png"
              alt="Create Design"
              className="h-12 xs:h-10 md:h-12 xl:h-16 w-[70%] xs:w-auto object-contain object-left"
            />
          </button>
        </div>
      </section>

      {/* Community Section */}
      <section className="mt-2 px-4 xs:px-0">
        <div className="flex flex-col items-start justify-between mb-4 xs:mb-6 gap-3 xs:gap-4 md:flex-row md:items-center">
          <h2 className="text-lg xs:text-base md:text-lg font-medium text-[hsl(0,0%,10%)]">Results from our Community</h2>
          <div className="flex gap-2 md:gap-2.5 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`px-3 xs:px-3 md:px-5 py-2 md:py-2.5 rounded-[28px] text-[11px] md:text-xs cursor-pointer transition-all ${
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 xs:gap-4">
          {communityDesigns.map((design) => (
            <div
              key={design.id}
              className="rounded-xl xs:rounded-2xl overflow-hidden aspect-[3/4] shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-transform"
            >
              <img src={design.image} alt={design.alt} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </section>
    </AppLayout>
  );
};

export default HaloRAI;
