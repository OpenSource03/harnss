import { Minus, Loader2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

interface ThinkingBlockProps {
  thinking: string;
  isStreaming?: boolean;
  thinkingComplete?: boolean;
}

export function ThinkingBlock({ thinking, isStreaming, thinkingComplete }: ThinkingBlockProps) {
  const [open, setOpen] = useState(false);
  const isThinking = isStreaming && !thinkingComplete && thinking.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-2">
      <CollapsibleTrigger className="flex items-center gap-1.5 py-1 text-xs text-foreground/40 hover:text-foreground/70 transition-colors">
        {isThinking ? (
          <Loader2 className="h-3 w-3 animate-spin text-foreground/40" />
        ) : (
          <Minus className="h-3 w-3 text-foreground/30" />
        )}
        <span className="italic">
          {isThinking ? "Thinking..." : "Thought"}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 max-h-60 overflow-auto border-s-2 border-foreground/10 ps-3 py-1 text-xs text-foreground/40 whitespace-pre-wrap">
          {thinking}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
