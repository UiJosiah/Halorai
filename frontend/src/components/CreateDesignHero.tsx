interface CreateDesignHeroProps {
  title: string;
}

const CreateDesignHero = ({ title }: CreateDesignHeroProps) => {
  return (
    <section
      className="mt-3 xs:mt-0 xs:rounded-3xl px-4 md:px-6 xl:px-12 pt-1 md:pt-2 xl:pt-3 pb-0 flex flex-col md:flex-row items-start xs:items-center md:items-start justify-between mb-6 xs:mb-8 min-h-[180px] max-[450px]:min-h-[220px] md:min-h-0 relative overflow-hidden"
      style={{
        backgroundImage: "url('/Halorai Dev/Halorai Background.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="relative z-10 w-full xs:w-full md:w-[280px] lg:w-[320px] xl:w-[450px] order-2 md:order-2 flex items-end justify-center mb-0 overflow-hidden h-[120px] max-[450px]:h-[145px] md:h-[90px] xl:h-[105px]">
        <img
          src="/Halorai Dev/Images/Group 1000006715.png"
          alt="Event flyers"
          className="w-full h-full object-cover object-top scale-[1.02] max-[450px]:scale-[1.06] md:scale-[1.08] xl:scale-[1.1]"
        />
      </div>

      <div className="flex-1 max-w-full md:max-w-[350px] xl:max-w-[420px] relative z-10 order-1 md:order-1 text-left md:self-center">
        <h1 className="text-3xl leading-[1.15] font-semibold text-[hsl(0,0%,10%)] mt-0 md:mt-2 tracking-tight md:text-3xl md:leading-[1.05] md:font-semibold">
          {title}
        </h1>
      </div>
    </section>
  );
};

export default CreateDesignHero;
