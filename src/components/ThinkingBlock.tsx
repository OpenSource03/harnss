import { Minus, Loader2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState, useRef, useEffect, useCallback } from "react";

interface ThinkingBlockProps {
  thinking: string;
  isStreaming?: boolean;
  thinkingComplete?: boolean;
}

export function ThinkingBlock({ thinking, isStreaming, thinkingComplete }: ThinkingBlockProps) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  // Tracks whether user manually scrolled up in the inner thinking div
  const userScrolledRef = useRef(false);
  const isThinking = isStreaming && !thinkingComplete && thinking.length > 0;

  const handleScroll = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 40;
    userScrolledRef.current = !isNearBottom;
  }, []);

  // Auto-scroll inner thinking div as content streams in (unless user scrolled up)
  useEffect(() => {
    if (!open || userScrolledRef.current) return;
    const el = contentRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [thinking, open]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      userScrolledRef.current = false;
      // Scroll inner div to bottom after collapsible content renders
      requestAnimationFrame(() => {
        const el = contentRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    }
  }, []);

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange} className="mb-2">
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
        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="mt-1 max-h-60 overflow-auto border-s-2 border-foreground/10 ps-3 py-1 text-xs text-foreground/40 whitespace-pre-wrap"
        >
          {thinking}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
