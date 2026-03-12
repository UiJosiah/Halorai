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
        className="mt-3 xs:mt-0 xs:rounded-3xl pl-5 md:px-6 xl:px-12 py-6 xs:py-0 md:py-1 xl:py-2 flex flex-col md:flex-row items-start xs:items-center justify-between mb-6 xs:mb-8 md:mb-16 min-h-0 xs:min-h-[180px] md:min-h-[220px] xl:min-h-[260px] relative overflow-hidden"
        style={{
          backgroundImage: "url('/Halorai Dev/Halorai Background.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Text content - shown first on mobile, first on desktop */}
        <div className="flex-1 max-w-full md:max-w-[400px] xl:max-w-[450px] relative z-10 order-1 md:order-1 text-left">
          {/* Welcome text - only on mobile */}
          <p className="text-lg text-[hsl(0,0%,55%)] font-light mb-1 block xs:hidden">
            Welcome back, <span className="text-[hsl(0,0%,30%)]">Johnny</span>
          </p>
          <h1 className="text-5xl leading-[1.05] xs:text-3xl md:text-3xl xl:text-3xl font-semibold xs:font-semibold text-[hsl(0,0%,10%)] xs:leading-tight mt-0 md:mt-2 xl:mt-2 mb-5 xs:mb-8 md:mb-24 xl:mb-32 tracking-tight pr-4">
            Design Your Next Event Today
          </h1>
          <button
            className="border-none bg-transparent p-0 cursor-pointer w-[80%] xs:w-auto transition-transform duration-150 ease-out hover:scale-[1.02] active:scale-[0.99] mb-6 xs:mb-0"
            onClick={() => navigate("/create-design")}
          >
            <img
              src="/Halorai Dev/Icons/Create Design button.png"
              alt="Create Design"
              className="h-16 xs:h-12 md:h-14 xl:h-18 w-full xs:w-auto object-contain object-left transition-opacity duration-150 ease-out hover:opacity-90"
            />
          </button>
        </div>

        {/* Flyer - shown second on mobile, second on desktop. Cropped right on mobile */}
        <div className="relative z-10 w-full xs:w-full md:w-[280px] lg:w-[320px] xl:w-[450px] order-2 md:order-2 flex items-center justify-center overflow-hidden">
          <img
            src="/Halorai Dev/Images/Group 1000006715.png"
            alt="Event flyer 1"
            className="w-full xs:w-full h-full object-contain md:object-right translate-x-[16%] xs:translate-x-0"
          />
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
