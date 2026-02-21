import { useMemo, useState, useEffect, useCallback, memo } from "react";
import { diffLines, diffWords } from "diff";
import { Copy, Check, ChevronDown } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { OpenInEditorButton } from "./OpenInEditorButton";
import { getLanguageFromPath, INLINE_HIGHLIGHT_STYLE, INLINE_CODE_TAG_STYLE } from "@/lib/languages";

// ── Types ──

interface DiffViewerProps {
  oldString: string;
  newString: string;
  filePath: string;
}

interface DiffLine {
  type: "added" | "removed" | "context";
  content: string;
  lineNum?: number;
  highlights?: WordHighlight[];
}

interface CollapsedLine {
  type: "collapsed";
  count: number;
}

type DisplayLine = DiffLine | CollapsedLine;

interface WordHighlight {
  value: string;
  type: "added" | "removed" | "unchanged";
}

const CONTEXT_LINES = 3;

// ── Inline syntax highlighting for diff lines ──

/** Renders code with syntax highlighting as inline content (not block) */
const HighlightedCode = memo(function HighlightedCode({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  if (!code) return <>{" "}</>;
  if (language === "text") return <>{code}</>;

  return (
    <SyntaxHighlighter
      language={language}
      style={oneDark}
      customStyle={INLINE_HIGHLIGHT_STYLE}
      codeTagProps={{ style: INLINE_CODE_TAG_STYLE }}
      PreTag="span"
      CodeTag="span"
    >
      {code}
    </SyntaxHighlighter>
  );
});

// ── Main component ──

export function DiffViewer({ oldString, newString, filePath }: DiffViewerProps) {
  const [fullFileContent, setFullFileContent] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  const fileName = filePath.split("/").pop() ?? filePath;
  const language = getLanguageFromPath(filePath);

  // Auto-load full file on mount
  useEffect(() => {
    let cancelled = false;
    window.claude
      .readFile(filePath)
      .then((result) => {
        if (!cancelled && result.content != null) {
          setFullFileContent(result.content);
        }
      })
      .catch(() => {
        // File not readable — stay with change-only diff
      });
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  // Compute raw diff lines
  const { allLines, stats } = useMemo(() => {
    if (fullFileContent !== null) {
      return computeFullFileDiff(fullFileContent, oldString, newString);
    }
    return computeDiffLines(oldString, newString);
  }, [oldString, newString, fullFileContent]);

  // Collapse context runs (respecting expanded sections)
  const displayLines = useMemo(
    () => collapseContext(allLines, CONTEXT_LINES, expandedSections),
    [allLines, expandedSections],
  );

  const expandSection = useCallback((sectionIdx: number) => {
    setExpandedSections((prev) => new Set(prev).add(sectionIdx));
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(newString);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [newString]);

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden font-mono text-[12px] leading-[1.55] bg-black/20">
      {/* Header */}
      <div className="group/diff flex items-center gap-3 px-3 py-1.5 bg-foreground/[0.04] border-b border-border/40">
        <span className="text-foreground/80 truncate flex-1">{fileName}</span>
        <OpenInEditorButton filePath={filePath} className="group-hover/diff:text-foreground/25" />

        <div className="flex items-center gap-1.5 text-[11px] shrink-0 tabular-nums">
          {stats.added > 0 && (
            <span className="text-emerald-400">+{stats.added}</span>
          )}
          {stats.removed > 0 && (
            <span className="text-red-400">-{stats.removed}</span>
          )}
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center justify-center h-6 w-6 rounded text-muted-foreground/50 hover:text-muted-foreground/80 hover:bg-accent/30 transition-colors shrink-0"
          title="Copy new content"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Diff body */}
      <div className="overflow-auto max-h-[28rem]">
        {displayLines.map((line, i) =>
          line.type === "collapsed" ? (
            <CollapsedRow
              key={`col-${i}`}
              count={line.count}
              onExpand={() => expandSection(i)}
            />
          ) : (
            <DiffLineRow key={i} line={line} language={language} />
          ),
        )}
      </div>
    </div>
  );
}

// ── Diff line row ──

function DiffLineRow({ line, language }: { line: DiffLine; language: string }) {
  // Left accent: thin colored border on changed lines
  const accentClass =
    line.type === "removed"
      ? "border-s-2 border-s-red-500/70"
      : line.type === "added"
        ? "border-s-2 border-s-emerald-500/70"
        : "border-s-2 border-s-transparent";

  const bgClass =
    line.type === "removed"
      ? "bg-red-500/[0.12]"
      : line.type === "added"
        ? "bg-emerald-500/[0.14]"
        : "";

  const numClass =
    line.type === "removed"
      ? "text-red-400/50"
      : line.type === "added"
        ? "text-emerald-400/50"
        : "text-muted-foreground/35";

  const contentClass =
    line.type === "removed"
      ? "text-foreground/70"
      : line.type === "added"
        ? "text-foreground/85"
        : "text-foreground/60";

  return (
    <div className={`flex ${accentClass} ${bgClass}`}>
      {/* Line number */}
      <span
        className={`w-10 shrink-0 text-right pe-3 py-px select-none ${numClass}`}
      >
        {line.lineNum ?? ""}
      </span>
      {/* Content — syntax highlighted with diff background colors */}
      <span
        className={`flex-1 px-3 py-px whitespace-pre-wrap wrap-break-word ${contentClass}`}
      >
        {line.highlights ? (
          line.highlights.map((part, j) => (
            <span
              key={j}
              className={
                part.type === "removed"
                  ? "bg-red-400/30 rounded-[2px]"
                  : part.type === "added"
                    ? "bg-emerald-400/30 rounded-[2px]"
                    : ""
              }
            >
              <HighlightedCode code={part.value} language={language} />
            </span>
          ))
        ) : (
          <HighlightedCode code={line.content} language={language} />
        )}
      </span>
    </div>
  );
}

// ── Collapsed context ──

function CollapsedRow({
  count,
  onExpand,
}: {
  count: number;
  onExpand: () => void;
}) {
  return (
    <button
      onClick={onExpand}
      className="flex w-full items-center justify-center gap-1 py-0.5 bg-foreground/[0.02] hover:bg-foreground/[0.05] transition-colors text-[10px] text-foreground/30 hover:text-foreground/50 border-s-2 border-s-transparent"
    >
      <ChevronDown className="h-2.5 w-2.5" />
      <span>
        {count} unchanged line{count !== 1 ? "s" : ""}
      </span>
    </button>
  );
}

// ── Diff computation ──

function computeDiffLines(
  oldStr: string,
  newStr: string,
): { allLines: DiffLine[]; stats: { added: number; removed: number } } {
  const changes = diffLines(oldStr, newStr);
  const result: DiffLine[] = [];
  let oldNum = 1;
  let newNum = 1;
  let added = 0;
  let removed = 0;

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const changeLines = splitLines(change.value);

    if (change.removed) {
      removed += changeLines.length;

      const nextChange = changes[i + 1];
      const hasMatchingAdd = nextChange?.added === true;
      const addedLines = hasMatchingAdd ? splitLines(nextChange.value) : [];
      const maxPaired = Math.min(changeLines.length, addedLines.length);

      for (let j = 0; j < changeLines.length; j++) {
        const wordDiffs =
          j < maxPaired
            ? computeWordHighlights(changeLines[j], addedLines[j])
            : undefined;
        result.push({
          type: "removed",
          content: changeLines[j],
          lineNum: oldNum++,
          highlights: wordDiffs?.removed,
        });
      }

      if (hasMatchingAdd) {
        added += addedLines.length;
        for (let j = 0; j < addedLines.length; j++) {
          const wordDiffs =
            j < maxPaired
              ? computeWordHighlights(changeLines[j], addedLines[j])
              : undefined;
          result.push({
            type: "added",
            content: addedLines[j],
            lineNum: newNum++,
            highlights: wordDiffs?.added,
          });
        }
        i++;
      }
    } else if (change.added) {
      added += changeLines.length;
      for (const line of changeLines) {
        result.push({ type: "added", content: line, lineNum: newNum++ });
      }
    } else {
      for (const line of changeLines) {
        result.push({
          type: "context",
          content: line,
          lineNum: newNum++,
        });
        oldNum++;
      }
    }
  }

  return { allLines: result, stats: { added, removed } };
}

function computeFullFileDiff(
  fileContent: string,
  oldStr: string,
  newStr: string,
): { allLines: DiffLine[]; stats: { added: number; removed: number } } {
  // The edit has already been applied — fileContent is the NEW file.
  // Reconstruct the old file by reversing the edit.
  const idx = fileContent.indexOf(newStr);
  if (idx !== -1) {
    const oldFileContent =
      fileContent.slice(0, idx) + oldStr + fileContent.slice(idx + newStr.length);
    return computeDiffLines(oldFileContent, fileContent);
  }

  // Maybe the file hasn't been written yet — old_string might still be in the file
  const oldIdx = fileContent.indexOf(oldStr);
  if (oldIdx !== -1) {
    const newFileContent =
      fileContent.slice(0, oldIdx) +
      newStr +
      fileContent.slice(oldIdx + oldStr.length);
    return computeDiffLines(fileContent, newFileContent);
  }

  // Can't locate edit in file — fall back to change-only diff
  return computeDiffLines(oldStr, newStr);
}

function collapseContext(
  lines: DiffLine[],
  keep: number,
  expanded: Set<number>,
): DisplayLine[] {
  const result: DisplayLine[] = [];
  let contextRun: DiffLine[] = [];
  let contextStartIdx = result.length;

  const flushContext = () => {
    const insertIdx = contextStartIdx;
    if (contextRun.length <= keep * 2 + 2 || expanded.has(insertIdx + keep)) {
      result.push(...contextRun);
    } else {
      result.push(...contextRun.slice(0, keep));
      result.push({ type: "collapsed", count: contextRun.length - keep * 2 });
      result.push(...contextRun.slice(-keep));
    }
    contextRun = [];
  };

  for (const line of lines) {
    if (line.type === "context") {
      if (contextRun.length === 0) contextStartIdx = result.length;
      contextRun.push(line);
    } else {
      if (contextRun.length > 0) flushContext();
      result.push(line);
    }
  }
  if (contextRun.length > 0) flushContext();

  return result;
}

// ── Word-level highlighting ──

function computeWordHighlights(
  oldLine: string,
  newLine: string,
): { removed: WordHighlight[]; added: WordHighlight[] } {
  const diffs = diffWords(oldLine, newLine);
  const removed: WordHighlight[] = [];
  const added: WordHighlight[] = [];

  for (const d of diffs) {
    if (d.removed) {
      removed.push({ value: d.value, type: "removed" });
    } else if (d.added) {
      added.push({ value: d.value, type: "added" });
    } else {
      removed.push({ value: d.value, type: "unchanged" });
      added.push({ value: d.value, type: "unchanged" });
    }
  }

  return { removed, added };
}

function splitLines(value: string): string[] {
  const lines = value.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}
