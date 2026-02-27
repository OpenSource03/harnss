import { useState, useCallback } from "react";
import { Map, ChevronDown, ChevronUp, Rocket } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { ProposedPlan } from "@/lib/plan-parser";

const REMARK_PLUGINS = [remarkGfm];

interface ProposedPlanCardProps {
  plan: ProposedPlan;
  onImplement?: (planContent: string) => void;
  isStreaming?: boolean;
}

/**
 * Collapsible card that renders a `<proposed_plan>` block extracted from
 * an assistant message. Shows title, markdown-rendered plan content,
 * and an "Implement this plan" button when the plan is fully streamed.
 *
 * Used by both Claude and Codex engines — the plan format is identical.
 */
export function ProposedPlanCard({ plan, onImplement, isStreaming }: ProposedPlanCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleImplement = useCallback(() => {
    onImplement?.(plan.content);
  }, [onImplement, plan.content]);

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-blue-500/20 bg-blue-500/5">
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-start transition-colors hover:bg-blue-500/10"
      >
        <Map className="h-4 w-4 shrink-0 text-blue-400" />
        <span className="flex-1 text-sm font-medium text-foreground">
          {plan.title}
        </span>
        {isStreaming && (
          <span className="text-xs text-blue-400/70 animate-pulse">Writing plan…</span>
        )}
        {isExpanded ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Collapsible body */}
      {isExpanded && (
        <div className="border-t border-blue-500/10">
          <div className="px-4 py-3">
            <div className="prose prose-invert prose-sm max-w-none text-foreground">
              <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>
                {plan.content}
              </ReactMarkdown>
            </div>
          </div>

          {/* Footer with Implement button — only shown when not streaming */}
          {!isStreaming && onImplement && (
            <div className="border-t border-blue-500/10 px-4 py-3">
              <button
                type="button"
                onClick={handleImplement}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25",
                )}
              >
                <Rocket className="h-3.5 w-3.5" />
                Implement this plan
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
