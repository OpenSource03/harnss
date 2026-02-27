import { memo } from "react";
import { OpenInEditorButton } from "./OpenInEditorButton";

interface UnifiedPatchViewerProps {
  diffText: string;
  filePath?: string;
}

function getLineClass(line: string): string {
  if (line.startsWith("@@")) return "text-blue-400/60";
  if (line.startsWith("+")) return "text-emerald-400/75";
  if (line.startsWith("-")) return "text-red-400/75";
  if (
    line.startsWith("diff --git ")
    || line.startsWith("index ")
    || line.startsWith("--- ")
    || line.startsWith("+++ ")
  ) {
    return "text-foreground/45";
  }
  if (line.startsWith("\\ No newline at end of file")) return "text-foreground/30 italic";
  return "text-foreground/60";
}

export const UnifiedPatchViewer = memo(function UnifiedPatchViewer({
  diffText,
  filePath,
}: UnifiedPatchViewerProps) {
  const lines = diffText.replace(/\r\n/g, "\n").split("\n");
  const fileName = filePath ? filePath.split("/").pop() : null;

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden font-mono text-[12px] leading-[1.55] bg-black/20">
      {fileName && (
        <div className="group/diff flex items-center gap-3 px-3 py-1.5 bg-foreground/[0.04] border-b border-border/40">
          <span className="text-foreground/80 truncate flex-1">{fileName}</span>
          {filePath ? <OpenInEditorButton filePath={filePath} className="group-hover/diff:text-foreground/25" /> : null}
        </div>
      )}
      <div className="max-h-[28rem] overflow-auto px-3 py-2">
        {lines.map((line, idx) => (
          <div
            key={`${idx}-${line.length}`}
            className={`whitespace-pre-wrap wrap-break-word ${getLineClass(line)}`}
          >
            {line || " "}
          </div>
        ))}
      </div>
    </div>
  );
});
