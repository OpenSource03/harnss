import { memo, useMemo } from "react";
import { Terminal, Globe, GitBranch, FileText, ListTodo, Bot, Plug } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

export type ToolId = "terminal" | "browser" | "git" | "files" | "tasks" | "agents" | "mcp";

interface ToolDef {
  id: ToolId;
  label: string;
  icon: typeof Terminal;
}

const PANEL_TOOLS: ToolDef[] = [
  { id: "terminal", label: "Terminal", icon: Terminal },
  { id: "browser", label: "Browser", icon: Globe },
  { id: "git", label: "Source Control", icon: GitBranch },
  { id: "files", label: "Open Files", icon: FileText },
  { id: "mcp", label: "MCP Servers", icon: Plug },
];

const CONTEXTUAL_TOOLS: ToolDef[] = [
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "agents", label: "Background Agents", icon: Bot },
];

interface ToolPickerProps {
  activeTools: Set<ToolId>;
  onToggle: (toolId: ToolId) => void;
  /** Which contextual tools have data and should be shown */
  availableContextual?: Set<ToolId>;
}

export const ToolPicker = memo(function ToolPicker({ activeTools, onToggle, availableContextual }: ToolPickerProps) {
  const visibleContextual = useMemo(
    () => CONTEXTUAL_TOOLS.filter((t) => availableContextual?.has(t.id)),
    [availableContextual],
  );

  return (
    <div className="island flex h-full w-14 shrink-0 flex-col items-center rounded-lg bg-background pt-3 pb-3 gap-2">
      {visibleContextual.length > 0 && (
        <>
          {visibleContextual.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTools.has(tool.id);
            return (
              <Tooltip key={tool.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onToggle(tool.id)}
                    className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "bg-foreground/10 text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] ring-1 ring-foreground/[0.08]"
                        : "text-foreground/30 hover:text-foreground/60 hover:bg-foreground/[0.05]"
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" sideOffset={8}>
                  <p className="text-xs font-medium">{tool.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
          <Separator className="w-7 my-0.5" />
        </>
      )}
      {PANEL_TOOLS.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTools.has(tool.id);
        return (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onToggle(tool.id)}
                className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-foreground/10 text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] ring-1 ring-foreground/[0.08]"
                    : "text-foreground/30 hover:text-foreground/60 hover:bg-foreground/[0.05]"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={8}>
              <p className="text-xs font-medium">{tool.label}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
});
