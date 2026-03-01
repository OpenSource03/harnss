import type { UIMessage } from "@/types";
import { parseUnifiedDiffFromUnknown } from "@/lib/unified-diff";
import { DiffViewer } from "@/components/DiffViewer";
import { UnifiedPatchViewer } from "@/components/UnifiedPatchViewer";
import { firstDefinedString } from "@/components/lib/tool-formatting";
import { GenericContent } from "./GenericContent";

export function EditContent({ message }: { message: UIMessage }) {
  const structuredPatch = Array.isArray(message.toolResult?.structuredPatch)
    ? (message.toolResult.structuredPatch as Array<Record<string, unknown>>)
    : [];
  const matchingPatch =
    structuredPatch.find((entry) => {
      const entryPath = entry.filePath ?? entry.path;
      return typeof entryPath === "string"
        && entryPath
        && entryPath === String(message.toolInput?.file_path ?? message.toolResult?.filePath ?? "");
    }) ?? structuredPatch[0];
  const filePath = String(
    message.toolInput?.file_path
      ?? message.toolResult?.filePath
      ?? (typeof matchingPatch?.filePath === "string" ? matchingPatch.filePath : "")
      ?? "",
  );
  const parsedStructuredDiff = parseUnifiedDiffFromUnknown(matchingPatch?.diff);
  const parsedDiff = parseUnifiedDiffFromUnknown(message.toolResult?.content);
  // ACP agents put the unified diff in detailedContent — parse it for oldString/newString
  const parsedDetailedDiff = parseUnifiedDiffFromUnknown(message.toolResult?.detailedContent);
  const unifiedDiffText = firstDefinedString(
    typeof matchingPatch?.diff === "string" ? matchingPatch.diff : undefined,
    typeof message.toolResult?.content === "string" ? message.toolResult.content : undefined,
    typeof message.toolResult?.detailedContent === "string" ? message.toolResult.detailedContent : undefined,
  );
  // Prefer parsed/structured patch text first; toolInput can be a lossy representation.
  const oldStr = firstDefinedString(
    typeof matchingPatch?.oldString === "string" ? matchingPatch.oldString : undefined,
    parsedStructuredDiff?.oldString,
    parsedDiff?.oldString,
    parsedDetailedDiff?.oldString,
    message.toolResult?.oldString,
    message.toolInput?.old_string,
  );
  const newStr = firstDefinedString(
    typeof matchingPatch?.newString === "string" ? matchingPatch.newString : undefined,
    parsedStructuredDiff?.newString,
    parsedDiff?.newString,
    parsedDetailedDiff?.newString,
    message.toolResult?.newString,
    message.toolInput?.new_string,
  );

  if (!oldStr && !newStr) {
    // Fallback 1: raw diff in structuredPatch (e.g. Codex fileChange with raw content)
    const rawDiff = typeof matchingPatch?.diff === "string" ? matchingPatch.diff : "";
    if (rawDiff) {
      return <UnifiedPatchViewer diffText={rawDiff} filePath={filePath} />;
    }
    // Fallback 2: result has content or detailedContent with a diff
    const resultContent = typeof message.toolResult?.content === "string"
      ? message.toolResult.content
      : "";
    const detailedContent = typeof message.toolResult?.detailedContent === "string"
      ? message.toolResult.detailedContent
      : "";
    // ACP agents put the unified diff in detailedContent, not content
    const diffText = (detailedContent.includes("diff --git") || detailedContent.includes("@@"))
      ? detailedContent
      : resultContent;
    if (diffText) {
      return <UnifiedPatchViewer diffText={diffText} filePath={filePath} />;
    }
    return <GenericContent message={message} />;
  }

  return (
    <DiffViewer
      oldString={oldStr}
      newString={newStr}
      filePath={filePath}
      unifiedDiff={unifiedDiffText || undefined}
    />
  );
}
