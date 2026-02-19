import { useState, memo } from "react";
import {
  Terminal,
  FileText,
  FileEdit,
  Search,
  FolderSearch,
  Globe,
  Bot,
  Wrench,
  ChevronRight,
  ListChecks,
  Circle,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { UIMessage, SubagentToolStep, TodoItem } from "@/types";
import { DiffViewer } from "./DiffViewer";
import { OpenInEditorButton } from "./OpenInEditorButton";
import { McpToolContent, hasMcpRenderer, getMcpCompactSummary } from "./McpToolContent";

// ── Stable style constants (avoid re-creating on every render) ──

const WRITE_SYNTAX_STYLE: React.CSSProperties = {
  margin: 0,
  borderRadius: "6px",
  fontSize: "11px",
  padding: "10px 12px",
  background: "rgba(255,255,255,0.04)",
};

const WRITE_LINE_NUMBER_STYLE: React.CSSProperties = {
  color: "rgba(255,255,255,0.2)",
  fontSize: "10px",
  minWidth: "2em",
  paddingRight: "1em",
};

const REMARK_PLUGINS = [remarkGfm];

// ── Tool metadata ──

const TOOL_ICONS: Record<string, typeof Terminal> = {
  Bash: Terminal,
  Read: FileText,
  Write: FileEdit,
  Edit: FileEdit,
  Grep: Search,
  Glob: FolderSearch,
  WebSearch: Globe,
  WebFetch: Globe,
  Task: Bot,
  TodoWrite: ListChecks,
};

function getToolIcon(toolName: string) {
  return TOOL_ICONS[toolName] ?? Wrench;
}

const TOOL_PAST: Record<string, string> = {
  Bash: "Ran",
  Read: "Read",
  Write: "Wrote",
  Edit: "Edited",
  Grep: "Searched",
  Glob: "Found",
  WebSearch: "Searched web",
  WebFetch: "Fetched",
  TodoWrite: "Updated tasks",
};

const TOOL_ACTIVE: Record<string, string> = {
  Bash: "Running",
  Read: "Reading",
  Write: "Writing",
  Edit: "Editing",
  Grep: "Searching",
  Glob: "Finding",
  WebSearch: "Searching web",
  WebFetch: "Fetching",
  TodoWrite: "Updating tasks",
};

// MCP tool friendly names — pattern-matched for different server name prefixes
const MCP_TOOL_LABELS: Array<{ pattern: RegExp; past: string; active: string }> = [
  { pattern: /searchJiraIssuesUsingJql$/, past: "Searched Jira", active: "Searching Jira" },
  { pattern: /getJiraIssue$/, past: "Fetched issue", active: "Fetching issue" },
  { pattern: /getVisibleJiraProjects$/, past: "Listed projects", active: "Listing projects" },
  { pattern: /createJiraIssue$/, past: "Created issue", active: "Creating issue" },
  { pattern: /editJiraIssue$/, past: "Updated issue", active: "Updating issue" },
  { pattern: /transitionJiraIssue$/, past: "Transitioned issue", active: "Transitioning issue" },
  { pattern: /addCommentToJiraIssue$/, past: "Added comment", active: "Adding comment" },
  { pattern: /getTransitionsForJiraIssue$/, past: "Got transitions", active: "Getting transitions" },
  { pattern: /lookupJiraAccountId$/, past: "Looked up user", active: "Looking up user" },
  { pattern: /getConfluencePage$/, past: "Fetched page", active: "Fetching page" },
  { pattern: /searchConfluenceUsingCql$/, past: "Searched Confluence", active: "Searching Confluence" },
  { pattern: /getConfluenceSpaces$/, past: "Listed spaces", active: "Listing spaces" },
  { pattern: /createConfluencePage$/, past: "Created page", active: "Creating page" },
  { pattern: /updateConfluencePage$/, past: "Updated page", active: "Updating page" },
  { pattern: /getAccessibleAtlassianResources$/, past: "Got resources", active: "Getting resources" },
  { pattern: /atlassianUserInfo$/, past: "Got user info", active: "Getting user info" },
  { pattern: /Atlassian[/_]+search$/, past: "Searched Atlassian", active: "Searching Atlassian" },
  { pattern: /Atlassian[/_]+fetch$/, past: "Fetched resource", active: "Fetching resource" },
  // Context7
  { pattern: /resolve-library-id$/, past: "Resolved library", active: "Resolving library" },
  { pattern: /query-docs$/, past: "Queried docs", active: "Querying docs" },
];

function getMcpToolLabel(toolName: string, type: "past" | "active"): string | null {
  for (const { pattern, past, active } of MCP_TOOL_LABELS) {
    if (pattern.test(toolName)) return type === "past" ? past : active;
  }
  // Generic fallback for any MCP tool (mcp__Server__tool) or ACP tool (Tool: Server/tool)
  if (toolName.startsWith("mcp__")) {
    const parts = toolName.split("__");
    const server = parts[1] ?? "MCP";
    return type === "past" ? `Called ${server}` : `Calling ${server}`;
  }
  if (toolName.startsWith("Tool: ")) {
    const server = toolName.slice(6).split("/")[0] ?? "MCP";
    return type === "past" ? `Called ${server}` : `Calling ${server}`;
  }
  return null;
}

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    py: "python", rs: "rust", go: "go", java: "java", kt: "kotlin",
    css: "css", scss: "scss", html: "html", json: "json",
    md: "markdown", yaml: "yaml", yml: "yaml",
    sh: "bash", bash: "bash", zsh: "bash",
    sql: "sql", graphql: "graphql", xml: "xml",
    toml: "toml", ini: "ini",
    c: "c", cpp: "cpp", h: "c", hpp: "cpp",
    rb: "ruby", php: "php", swift: "swift",
  };
  return map[ext] ?? "text";
}

// ── Main entry ──

export const ToolCall = memo(function ToolCall({ message }: { message: UIMessage }) {
  const isTask = message.toolName === "Task";

  return (
    <div className="flex justify-start px-4 py-0.5">
      <div className="min-w-0 max-w-[85%]">
        {isTask ? (
          <TaskTool message={message} />
        ) : (
          <RegularTool message={message} />
        )}
      </div>
    </div>
  );
}, (prev, next) =>
  prev.message.toolResult === next.message.toolResult &&
  prev.message.toolError === next.message.toolError &&
  prev.message.subagentSteps === next.message.subagentSteps &&
  prev.message.subagentStatus === next.message.subagentStatus,
);

// ── Regular tool (Read, Write, Edit, Bash, Grep, Glob, etc.) ──

function RegularTool({ message }: { message: UIMessage }) {
  const isEditLike = message.toolName === "Edit" || message.toolName === "Write";
  const [expanded, setExpanded] = useState(isEditLike);
  const hasResult = !!message.toolResult;
  const isRunning = !hasResult;
  const isError = !!message.toolError;
  const Icon = getToolIcon(message.toolName ?? "");
  const summary = formatCompactSummary(message);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="group relative flex w-full items-center gap-2 py-1 text-[13px] hover:text-foreground transition-colors cursor-pointer overflow-hidden">
        {isRunning && <div className="tool-shimmer" />}

        <div className="relative flex items-center gap-2 min-w-0">
          {isRunning && (
            <span className="flex h-3.5 w-3.5 items-center justify-center shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-pulse" />
            </span>
          )}
          {isError ? (
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400/70" />
          ) : (
            <Icon className="h-3.5 w-3.5 shrink-0 text-foreground/35" />
          )}
          <span className={`shrink-0 whitespace-nowrap font-medium ${isError ? "text-red-400/70" : "text-foreground/75"}`}>
            {isRunning
              ? (TOOL_ACTIVE[message.toolName ?? ""] ?? getMcpToolLabel(message.toolName ?? "", "active") ?? message.toolName)
              : isError
                ? `Failed to ${(TOOL_ACTIVE[message.toolName ?? ""] ?? getMcpToolLabel(message.toolName ?? "", "active") ?? message.toolName).toLowerCase()}`
                : (TOOL_PAST[message.toolName ?? ""] ?? getMcpToolLabel(message.toolName ?? "", "past") ?? message.toolName)}
          </span>
          <span className="truncate text-foreground/40">{summary}</span>
        </div>

        {hasResult && (
          <ChevronRight
            className={`ms-auto h-3 w-3 shrink-0 text-foreground/30 opacity-0 group-hover:opacity-100 transition-all duration-200 ${
              expanded ? "rotate-90" : ""
            }`}
          />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 mb-2">
          <ExpandedToolContent message={message} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Expanded content router ──

function ExpandedToolContent({ message }: { message: UIMessage }) {
  switch (message.toolName) {
    case "Bash":
      return <BashContent message={message} />;
    case "Write":
      return <WriteContent message={message} />;
    case "Edit":
      return <EditContent message={message} />;
    case "Read":
      return <ReadContent message={message} />;
    case "Grep":
    case "Glob":
      return <SearchContent message={message} />;
    case "TodoWrite":
      return <TodoWriteContent message={message} />;
    default:
      // Check for specialized MCP tool renderers
      if (message.toolName && hasMcpRenderer(message.toolName)) {
        const mcpResult = <McpToolContent message={message} />;
        if (mcpResult) return mcpResult;
      }
      return <GenericContent message={message} />;
  }
}

// ── Bash: terminal style ──

function BashContent({ message }: { message: UIMessage }) {
  const command = message.toolInput?.command;
  const result = message.toolResult;

  return (
    <div className="space-y-1.5 text-xs">
      {!!command && (
        <div className="rounded-md bg-foreground/[0.04] px-3 py-2 font-mono text-[11px] text-foreground/90 whitespace-pre-wrap wrap-break-word">
          <span className="text-foreground/40 select-none">$ </span>
          {String(command)}
        </div>
      )}
      {result && (
        <div className="max-h-48 overflow-auto rounded-md bg-foreground/[0.03] px-3 py-2 font-mono text-[11px] text-foreground/50 whitespace-pre-wrap wrap-break-word">
          {formatBashResult(result)}
        </div>
      )}
    </div>
  );
}

// ── Write: syntax-highlighted file content ──

function WriteContent({ message }: { message: UIMessage }) {
  const filePath = String(message.toolInput?.file_path ?? "");
  const content = String(message.toolInput?.content ?? "");
  const language = getLanguageFromPath(filePath);

  if (!content) return <GenericContent message={message} />;

  const truncated = content.length > 3000;
  const displayContent = truncated ? content.slice(0, 3000) : content;

  return (
    <div className="space-y-1.5 text-xs">
      <div className="group/write flex items-center gap-1.5 text-foreground/50 font-mono text-[11px]">
        {filePath.split("/").pop()}
        <OpenInEditorButton filePath={filePath} className="group-hover/write:text-foreground/25" />
      </div>
      <div className="max-h-64 overflow-auto rounded-md overflow-hidden">
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          customStyle={WRITE_SYNTAX_STYLE}
          showLineNumbers
          lineNumberStyle={WRITE_LINE_NUMBER_STYLE}
          wrapLongLines
        >
          {displayContent}
        </SyntaxHighlighter>
      </div>
      {truncated && (
        <p className="text-[10px] text-foreground/30 italic">Content truncated</p>
      )}
    </div>
  );
}

// ── Edit: proper diff viewer ──

function EditContent({ message }: { message: UIMessage }) {
  const filePath = String(
    message.toolInput?.file_path ?? message.toolResult?.filePath ?? "",
  );
  const oldStr = String(message.toolInput?.old_string ?? "");
  const newStr = String(message.toolInput?.new_string ?? "");

  if (!oldStr && !newStr) return <GenericContent message={message} />;

  return <DiffViewer oldString={oldStr} newString={newStr} filePath={filePath} />;
}

// ── Read: compact file info ──

function ReadContent({ message }: { message: UIMessage }) {
  const result = message.toolResult;
  const filePath = String(message.toolInput?.file_path ?? "");

  if (result?.file) {
    const { startLine, numLines, totalLines } = result.file;
    const endLine = startLine + numLines - 1;
    const isFull = startLine === 1 && numLines >= totalLines;
    return (
      <div className="group/read flex items-center gap-1.5 text-xs text-foreground/50 font-mono text-[11px]">
        {filePath.split("/").pop()}
        <span className="text-foreground/30">
          {isFull
            ? `${totalLines} lines`
            : `L${startLine}–${endLine} of ${totalLines}`}
        </span>
        <OpenInEditorButton filePath={filePath} line={startLine} className="group-hover/read:text-foreground/25" />
      </div>
    );
  }

  return <GenericContent message={message} />;
}

// ── Grep / Glob: search results ──

function SearchContent({ message }: { message: UIMessage }) {
  const pattern = String(message.toolInput?.pattern ?? "");
  const result = message.toolResult;

  return (
    <div className="space-y-1.5 text-xs">
      {pattern && (
        <div className="font-mono text-[11px] text-foreground/50">
          {pattern}
        </div>
      )}
      {result && (
        <pre className="max-h-48 overflow-auto rounded-md bg-foreground/[0.04] px-3 py-2 text-[11px] text-foreground/50 whitespace-pre-wrap wrap-break-word">
          {formatResult(result)}
        </pre>
      )}
    </div>
  );
}

// ── Generic fallback ──

function GenericContent({ message }: { message: UIMessage }) {
  return (
    <div className="space-y-1.5 text-xs">
      {message.toolInput && (
        <pre className="max-h-32 overflow-auto rounded-md bg-foreground/[0.04] px-3 py-2 text-[11px] text-foreground/50 whitespace-pre-wrap wrap-break-word">
          {formatInput(message.toolInput)}
        </pre>
      )}
      {message.toolResult && (
        <pre className="max-h-48 overflow-auto rounded-md bg-foreground/[0.04] px-3 py-2 text-[11px] text-foreground/50 whitespace-pre-wrap wrap-break-word">
          {formatResult(message.toolResult)}
        </pre>
      )}
    </div>
  );
}

// ── Task / Subagent tool ──

function TaskTool({ message }: { message: UIMessage }) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = message.subagentStatus === "running";
  const isCompleted = message.subagentStatus === "completed";
  const hasSteps = message.subagentSteps && message.subagentSteps.length > 0;
  const stepCount = message.subagentSteps?.length ?? 0;
  const showCard = isRunning || expanded;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className={showCard ? "rounded-md border border-foreground/[0.06] overflow-hidden" : ""}>
        <CollapsibleTrigger className={`group relative flex w-full items-center gap-2 text-[13px] hover:text-foreground transition-colors cursor-pointer overflow-hidden ${
          showCard ? "px-3 py-1.5" : "py-1"
        }`}>
          {isRunning && <div className="tool-shimmer" />}

          <div className="relative flex items-center gap-2 min-w-0 flex-1">
            {isRunning && (
              <span className="flex h-3.5 w-3.5 items-center justify-center shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-pulse" />
              </span>
            )}
            {showCard && (
              <ChevronRight
                className={`h-3 w-3 shrink-0 text-foreground/30 transition-transform duration-200 ${
                  expanded ? "rotate-90" : ""
                }`}
              />
            )}
            <Bot className="h-3.5 w-3.5 shrink-0 text-foreground/35" />
            {isCompleted && !expanded ? (
              <>
                <span className="shrink-0 font-medium text-foreground/75">Used agent</span>
                <span className="truncate text-foreground/40">{formatTaskSummary(message)}</span>
              </>
            ) : (
              <span className="font-medium text-foreground/75 truncate">
                {isRunning ? formatTaskRunningTitle(message) : formatTaskTitle(message)}
              </span>
            )}
            {stepCount > 0 && (
              <span className="shrink-0 text-foreground/40 text-xs">
                ({stepCount} step{stepCount !== 1 ? "s" : ""})
              </span>
            )}
          </div>

          {message.subagentDurationMs != null && (
            <span className="relative text-[11px] text-foreground/30 tabular-nums shrink-0">
              {formatDuration(message.subagentDurationMs)}
            </span>
          )}

          {isCompleted && !expanded && (
            <ChevronRight
              className="ms-auto h-3 w-3 shrink-0 text-foreground/30 opacity-0 group-hover:opacity-100 transition-all duration-200"
            />
          )}
        </CollapsibleTrigger>

        {/* Live step indicator when collapsed & running */}
        {isRunning && !expanded && hasSteps && (
          <div className="border-t border-foreground/[0.06] px-3 ps-8 py-1 text-xs text-foreground/30">
            <span className="animate-pulse">{formatLatestStep(message.subagentSteps!)}</span>
          </div>
        )}

        <CollapsibleContent>
          <TaskExpandedContent message={message} />
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function TaskExpandedContent({ message }: { message: UIMessage }) {
  return (
    <>
      {/* Prompt */}
      {message.toolInput && (
        <div className="ps-5 py-1.5">
          <p className="mb-1 text-[10px] font-medium text-foreground/30 uppercase tracking-wider">
            Prompt
          </p>
          <p className="max-h-20 overflow-auto text-xs text-foreground/60 whitespace-pre-wrap wrap-break-word">
            {String(message.toolInput.prompt ?? message.toolInput.description ?? "")}
          </p>
        </div>
      )}

      {/* Steps */}
      {message.subagentSteps && message.subagentSteps.length > 0 && (
        <div className="border-t border-foreground/[0.06] ps-5 py-1.5">
          <p className="mb-1.5 text-[10px] font-medium text-foreground/30 uppercase tracking-wider">
            Steps
          </p>
          <div>
            {message.subagentSteps.map((step) => (
              <SubagentStepRow key={step.toolUseId} step={step} />
            ))}
          </div>
        </div>
      )}

      {/* Result — rendered as markdown */}
      {message.subagentStatus === "completed" && message.toolResult?.content && (
        <div className="border-t border-foreground/[0.06] ps-5 py-1.5">
          <p className="mb-1 text-[10px] font-medium text-foreground/30 uppercase tracking-wider">
            Result
          </p>
          <div className="prose prose-invert prose-sm max-w-none text-foreground">
            <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>
              {formatTaskResult(message.toolResult.content)}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </>
  );
}

function SubagentStepRow({ step }: { step: SubagentToolStep }) {
  const [open, setOpen] = useState(false);
  const hasResult = !!step.toolResult;
  const isError = !!step.toolError;
  const Icon = getToolIcon(step.toolName);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex w-full items-center gap-1.5 py-0.5 text-xs hover:text-foreground transition-colors">
        {!hasResult && (
          <span className="flex h-3 w-3 items-center justify-center shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-pulse" />
          </span>
        )}
        {isError ? (
          <AlertCircle className="h-3 w-3 shrink-0 text-red-400/70" />
        ) : (
          <Icon className="h-3 w-3 shrink-0 text-foreground/35" />
        )}
        <span className={isError ? "text-red-400/70" : "text-foreground/75"}>
          {hasResult
            ? isError
              ? `Failed to ${(TOOL_ACTIVE[step.toolName] ?? step.toolName).toLowerCase()}`
              : (TOOL_PAST[step.toolName] ?? step.toolName)
            : (TOOL_ACTIVE[step.toolName] ?? step.toolName)}
        </span>
        <span className="truncate text-foreground/40 ms-0.5">
          {formatStepSummary(step)}
        </span>
        {hasResult && (
          <ChevronRight
            className={`ms-auto h-2.5 w-2.5 shrink-0 text-foreground/30 opacity-0 group-hover:opacity-100 transition-all duration-200 ${
              open ? "rotate-90" : ""
            }`}
          />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ms-5 mt-0.5 mb-1 border-s border-foreground/10 ps-2.5 text-[11px]">
          <pre className="max-h-32 overflow-auto text-foreground/40 whitespace-pre-wrap wrap-break-word">
            {formatInput(step.toolInput)}
          </pre>
          {step.toolResult && (
            <>
              <div className="my-0.5 text-[10px] font-medium text-foreground/30 uppercase tracking-wider">
                Result
              </div>
              <pre className="max-h-32 overflow-auto text-foreground/40 whitespace-pre-wrap wrap-break-word">
                {formatResult(step.toolResult)}
              </pre>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── TodoWrite: checklist view ──

function TodoWriteContent({ message }: { message: UIMessage }) {
  const todos = (message.toolInput?.todos ?? []) as TodoItem[];

  return (
    <div className="space-y-0.5 text-xs">
      {todos.map((todo, i) => (
        <div key={i} className="flex items-start gap-2 py-0.5">
          <div className="mt-[1px] shrink-0">
            {todo.status === "completed" ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-500/60" />
            ) : todo.status === "in_progress" ? (
              <Loader2 className="h-3 w-3 text-blue-400/60 animate-spin" />
            ) : (
              <Circle className="h-3 w-3 text-foreground/20" />
            )}
          </div>
          <span
            className={
              todo.status === "completed"
                ? "text-foreground/30 line-through"
                : todo.status === "in_progress"
                  ? "text-foreground/60"
                  : "text-foreground/40"
            }
          >
            {todo.content}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Formatting helpers ──

function formatTaskTitle(message: UIMessage): string {
  const input = message.toolInput;
  if (!input) return "Task";
  const desc = String(input.description ?? "");
  const agentType = String(input.subagent_type ?? input.subagentType ?? "");
  if (agentType && desc) return `${agentType}: ${desc}`;
  if (desc) return `Task: ${desc}`;
  return "Task";
}

function formatTaskRunningTitle(message: UIMessage): string {
  const input = message.toolInput;
  if (!input) return "Running agent...";
  const agentType = String(input.subagent_type ?? input.subagentType ?? "");
  const desc = String(input.description ?? "");
  if (agentType) return `Running ${agentType}...`;
  if (desc) return `Running: ${desc}`;
  return "Running agent...";
}

function formatTaskSummary(message: UIMessage): string {
  const input = message.toolInput;
  if (!input) return "task";
  const agentType = String(input.subagent_type ?? input.subagentType ?? "");
  const desc = String(input.description ?? "");
  if (agentType && desc) return `${agentType} to ${desc}`;
  if (agentType) return agentType;
  if (desc) return desc;
  return "task";
}

function formatCompactSummary(message: UIMessage): string {
  const input = message.toolInput;
  const toolName = message.toolName ?? "";
  if (!input) return "";

  // MCP tools (mcp__Server__tool) or ACP tools (Tool: Server/tool) — delegate to specialized summaries
  if (toolName.startsWith("mcp__") || toolName.startsWith("Tool: ")) {
    const mcpSummary = getMcpCompactSummary(toolName, input);
    if (mcpSummary) return mcpSummary;
    // Fallback: show the MCP tool's short name
    if (toolName.startsWith("mcp__")) {
      const parts = toolName.split("__");
      return parts.length >= 3 ? parts.slice(2).join("__") : toolName;
    }
    const slashParts = toolName.slice(6).split("/");
    return slashParts.length >= 2 ? slashParts.slice(1).join("/") : toolName;
  }

  if (input.todos && Array.isArray(input.todos)) {
    const todos = input.todos as TodoItem[];
    const completed = todos.filter((t) => t.status === "completed").length;
    return `${completed}/${todos.length} completed`;
  }
  if (input.command) return String(input.command).split("\n")[0].slice(0, 80);
  if (input.file_path) return String(input.file_path).split("/").pop() ?? "";
  if (input.pattern) return String(input.pattern);
  if (input.query) return String(input.query).slice(0, 60);
  if (input.url) {
    try {
      return new URL(String(input.url)).hostname;
    } catch {
      return String(input.url).slice(0, 60);
    }
  }
  return "";
}

function formatLatestStep(steps: SubagentToolStep[]): string {
  const last = steps[steps.length - 1];
  if (!last) return "";
  return `${last.toolName} ${formatStepSummary(last)}`;
}

function formatStepSummary(step: SubagentToolStep): string {
  const input = step.toolInput;
  if (input.file_path) return String(input.file_path).split("/").pop() ?? "";
  if (input.command) return String(input.command).split("\n")[0].slice(0, 60);
  if (input.pattern) return String(input.pattern);
  return "";
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTaskResult(content: string | Array<{ type: string; text: string }>): string {
  if (typeof content === "string") return content.slice(0, 3000);
  return content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .slice(0, 3000);
}

function formatInput(input: Record<string, unknown>): string {
  if (input.file_path && Object.keys(input).length <= 3) {
    const parts = [`file: ${input.file_path}`];
    if (input.command) parts.push(`command: ${input.command}`);
    return parts.join("\n");
  }
  if (input.command && Object.keys(input).length === 1) {
    return String(input.command);
  }
  return JSON.stringify(input, null, 2);
}

function formatBashResult(result: UIMessage["toolResult"]): string {
  if (!result) return "";
  const parts: string[] = [];
  if (result.stdout) parts.push(result.stdout);
  if (result.stderr) parts.push(result.stderr);
  return parts.join("\n") || "(no output)";
}

function formatResult(result: UIMessage["toolResult"]): string {
  if (!result) return "";

  if (result.file) {
    const { filePath, numLines, totalLines } = result.file;
    return `${filePath} (${numLines}/${totalLines} lines)`;
  }

  if (result.stdout !== undefined) {
    const parts: string[] = [];
    if (result.stdout) parts.push(result.stdout);
    if (result.stderr) parts.push(`stderr: ${result.stderr}`);
    return parts.join("\n") || "(no output)";
  }

  if (result.filePath && result.newString !== undefined) {
    return `Edited ${result.filePath}`;
  }

  if (result.isAsync) {
    return `Launched agent ${result.agentId ?? ""} (${result.status})`;
  }

  return JSON.stringify(result, null, 2);
}
