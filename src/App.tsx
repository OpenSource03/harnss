import { useEffect } from "react";
import { Toaster } from "sonner";
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
      <Toaster
        position="top-right"
        toastOptions={{
          className: "bg-background/90 backdrop-blur-md border border-border text-foreground shadow-lg",
        }}
      />
    </TooltipProvider>
  );
}
