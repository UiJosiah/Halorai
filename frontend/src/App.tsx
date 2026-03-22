import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HaloRAI from "./pages/HaloRAI";
import CreateDesign from "./pages/CreateDesign";
import CreateDesignStep2 from "./pages/CreateDesignStep2";
import CreateDesignStep3 from "./pages/CreateDesignStep3";
import CreateDesignStep4 from "./pages/CreateDesignStep4";
import CreateDesignStep5 from "./pages/CreateDesignStep5";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HaloRAI />} />
          <Route path="/create-design" element={<CreateDesign />} />
          <Route path="/create-design/step-2" element={<CreateDesignStep2 />} />
          <Route path="/create-design/step-3" element={<CreateDesignStep3 />} />
          <Route path="/create-design/step-4" element={<CreateDesignStep4 />} />
          <Route path="/create-design/step-5" element={<CreateDesignStep5 />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
