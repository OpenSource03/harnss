import { memo, useCallback } from "react";
import { ExternalLink } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface OpenInEditorButtonProps {
  filePath: string;
  line?: number;
  /** Extra classes applied to the outer wrapper. */
  className?: string;
}

export const OpenInEditorButton = memo(function OpenInEditorButton({
  filePath,
  line,
  className = "",
}: OpenInEditorButtonProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      window.claude.openInEditor(filePath, line);
    },
    [filePath, line],
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md
            text-foreground/0 transition-all duration-150
            group-hover:text-foreground/25 hover:!text-foreground/60 hover:bg-foreground/[0.06]
            active:scale-90 cursor-pointer ${className}`}
        >
          <ExternalLink className="h-3 w-3" strokeWidth={2} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        <p className="text-xs">Open in editor{line ? ` at line ${line}` : ""}</p>
      </TooltipContent>
    </Tooltip>
  );
});
