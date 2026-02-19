import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";

export function App() {
  useEffect(() => {
    window.claude.getGlassEnabled().then((enabled) => {
      if (enabled) {
        document.documentElement.classList.add("glass-enabled");
      }
    });
  }, []);

  return (
    <TooltipProvider>
      <AppLayout />
    </TooltipProvider>
  );
}
