/**
 * Codex event adapter — translates Codex app-server notifications into UIMessages.
 *
 * The Codex protocol uses item-based events (item/started, item/completed, deltas).
 * Each item type maps to a UIMessage role + toolName for the existing ToolCall UI.
 */

import type { TodoItem, ModelInfo, ImageAttachment, ToolUseResult } from "@/types";
import type { CodexThreadItem } from "@/types/codex";
import type { Model as CodexModel } from "@/types/codex-protocol/v2/Model";
import { parseUnifiedDiff } from "@/lib/unified-diff";

// ── Streaming buffer (reuses ACPStreamingBuffer pattern) ──

export class CodexStreamingBuffer {
  messageId: string | null = null;
  private textChunks: string[] = [];
  private thinkingChunks: string[] = [];
  thinkingComplete = false;

  appendText(text: string): void { this.textChunks.push(text); }
  appendThinking(text: string): void { this.thinkingChunks.push(text); }

  getText(): string { return this.textChunks.join(""); }
  getThinking(): string { return this.thinkingChunks.join(""); }

  reset(): void {
    this.messageId = null;
    this.textChunks = [];
    this.thinkingChunks = [];
    this.thinkingComplete = false;
  }
}

// ── Item type → tool name mapping ──

/**
 * Map a Codex ThreadItem type to a tool name for the existing ToolCall.tsx renderers.
 * Returns null for item types that don't map to tool calls (agentMessage, reasoning, etc.).
 */
export function codexItemToToolName(item: CodexThreadItem): string | null {
  switch (item.type) {
    case "commandExecution":
      return "Bash";
    case "fileChange":
      return inferFileChangeTool(item);
    case "mcpToolCall":
      return `mcp__${item.server}__${item.tool}`;
    case "webSearch":
      return "WebSearch";
    case "imageView":
      return "Read"; // reuse Read renderer for image display
    default:
      return null;
  }
}

/** Infer whether a fileChange is a Write (new file) or Edit (modify existing). */
function inferFileChangeTool(item: Extract<CodexThreadItem, { type: "fileChange" }>): string {
  if (!item.changes || item.changes.length === 0) return "Edit";
  const kinds = item.changes
    .map((change) => getPatchChangeKind(change as Record<string, unknown>))
    .filter((kind): kind is "add" | "delete" | "update" => kind !== null);
  return kinds.length > 0 && kinds.every((kind) => kind === "add")
    ? "Write"
    : "Edit";
}

function getPatchChangeKind(change: Record<string, unknown>): "add" | "delete" | "update" | null {
  const rawKind = change.kind;
  if (typeof rawKind === "string") {
    if (rawKind === "add" || rawKind === "create") return "add";
    if (rawKind === "delete" || rawKind === "remove") return "delete";
    if (rawKind === "update" || rawKind === "modify" || rawKind === "modified") return "update";
    return null;
  }

  if (typeof rawKind === "object" && rawKind !== null) {
    const kindType = (rawKind as Record<string, unknown>).type;
    if (kindType === "add" || kindType === "delete" || kindType === "update") {
      return kindType;
    }
  }

  return null;
}

// ── Item → tool input mapping ──

/** Extract structured tool input from a Codex item for ToolCall.tsx renderers. */
export function codexItemToToolInput(item: CodexThreadItem): Record<string, unknown> {
  switch (item.type) {
    case "commandExecution":
      return {
        command: item.command ?? "",
        ...(item.cwd ? { description: `cwd: ${item.cwd}` } : {}),
      };
    case "fileChange": {
      const firstChange = item.changes?.[0] as Record<string, unknown> | undefined;
      const firstDiff = typeof firstChange?.diff === "string"
        ? parseUnifiedDiff(firstChange.diff)
        : null;
      const firstKind = firstChange ? getPatchChangeKind(firstChange) : null;
      const input: Record<string, unknown> = {
        file_path: firstChange?.path ?? "",
      };

      if (firstDiff) {
        if (firstKind === "add") {
          input.content = firstDiff.newString;
        } else {
          input.old_string = firstDiff.oldString;
          input.new_string = firstDiff.newString;
        }
      } else if (typeof firstChange?.diff === "string" && firstChange.diff) {
        // Fallback: diff is raw file content (not unified format) — derive old/new from kind
        if (firstKind === "add") {
          input.content = firstChange.diff;
        } else if (firstKind === "delete") {
          input.old_string = firstChange.diff;
          input.new_string = "";
        }
      }
      if (item.changes?.length && item.changes.length > 1) {
        input.description = `${item.changes.length} files`;
      }
      return input;
    }
    case "mcpToolCall":
      return (item.arguments ?? {}) as Record<string, unknown>;
    case "webSearch":
      return { query: item.query ?? "" };
    case "imageView":
      return { file_path: item.path ?? "" };
    default:
      return {};
  }
}

// ── Item → tool result mapping ──

/** Extract structured tool result from a completed Codex item. */
export function codexItemToToolResult(item: CodexThreadItem): ToolUseResult | undefined {
  switch (item.type) {
    case "commandExecution": {
      const lines: string[] = [];
      if (item.aggregatedOutput) lines.push(item.aggregatedOutput);
      if (item.exitCode != null) lines.push(`Exit code: ${item.exitCode}`);
      if (item.durationMs != null) lines.push(`Duration: ${item.durationMs}ms`);
      if (lines.length === 0) return undefined;

      return {
        type: "text",
        stdout: lines.join("\n"),
        ...(item.exitCode != null ? { exitCode: item.exitCode } : {}),
        ...(item.durationMs != null ? { durationMs: item.durationMs } : {}),
      };
    }
    case "fileChange": {
      const parsedChanges = (item.changes ?? []).map((rawChange) => {
        const change = rawChange as Record<string, unknown>;
        const diffText = typeof change.diff === "string" ? change.diff : "";
        return {
          filePath: typeof change.path === "string" ? change.path : "",
          kind: getPatchChangeKind(change),
          diffText,
          parsedDiff: diffText ? parseUnifiedDiff(diffText) : null,
        };
      });

      const firstParsed = parsedChanges.find((change) => change.parsedDiff) ?? null;
      const firstPath = parsedChanges.find((change) => change.filePath)?.filePath ?? "";
      const diffSummary = parsedChanges
        .map((change) => {
          if (change.diffText) return change.diffText;
          const kindLabel = change.kind ?? "modified";
          return `${kindLabel}: ${change.filePath}`;
        })
        .join("\n\n");
      if (!diffSummary) return undefined;

      const result: ToolUseResult = {
        content: diffSummary,
        ...(firstPath ? { filePath: firstPath } : {}),
        structuredPatch: parsedChanges.map((change) => ({
          filePath: change.filePath,
          kind: change.kind,
          diff: change.diffText,
          // When parseUnifiedDiff fails (raw content), derive old/new from kind
          oldString: change.parsedDiff?.oldString
            ?? (change.kind === "delete" ? change.diffText : undefined),
          newString: change.parsedDiff?.newString
            ?? (change.kind === "add" ? change.diffText : undefined),
        })),
      };
      const firstWithDiff = firstParsed
        ?? parsedChanges.find((change) => change.diffText);
      if (firstParsed?.parsedDiff) {
        result.oldString = firstParsed.parsedDiff.oldString;
        result.newString = firstParsed.parsedDiff.newString;
      } else if (firstWithDiff) {
        // Fallback: derive from kind when unified diff parsing failed
        if (firstWithDiff.kind === "delete") {
          result.oldString = firstWithDiff.diffText;
          result.newString = "";
        } else if (firstWithDiff.kind === "add") {
          result.oldString = "";
          result.newString = firstWithDiff.diffText;
        }
      }
      return result;
    }
    case "mcpToolCall": {
      if (item.error) {
        return { content: `Error: ${JSON.stringify(item.error)}` };
      }
      if (item.result) {
        return { content: typeof item.result === "string" ? item.result : JSON.stringify(item.result) };
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

// ── Approval policy mapping ──

/**
 * Map Codex approval policy names to UI-friendly labels.
 * Codex uses: "untrusted" | "on-failure" | "on-request" | "reject" | "never"
 */
export const CODEX_APPROVAL_LABELS: Record<string, string> = {
  "on-request": "Ask First",
  untrusted: "Accept Trusted",
  "on-failure": "Ask On Failure",
  reject: "Reject",
  never: "Allow All",
};

/**
 * Map Harnss permission modes to Codex approvalPolicy values.
 * Keep this in sync with src/types/codex-protocol/v2/AskForApproval.ts.
 */
export function permissionModeToCodexPolicy(mode: string): string | undefined {
  switch (mode) {
    case "default":
      return "on-request";
    case "acceptEdits":
      return "untrusted";
    case "bypassPermissions":
      return "never";
    default:
      return undefined;
  }
}

// ── Turn plan → TodoItem mapping ──

/** Convert Codex turn/plan/updated steps to TodoItem[] for the TodoPanel. */
export function codexPlanToTodos(
  planSteps: Array<{ step: string; status: string }>,
): TodoItem[] {
  return planSteps.map((s) => ({
    content: s.step,
    status: (() => {
      const normalized = s.status.trim().toLowerCase();
      if (normalized === "completed") return "completed";
      if (normalized === "inprogress" || normalized === "in_progress" || normalized === "in-progress") {
        return "in_progress";
      }
      return "pending";
    })(),
  }));
}

// ── Command output delta accumulation ──

/**
 * Accumulate command execution output deltas into a running string.
 * Codex streams `item/commandExecution/outputDelta` with { itemId, delta }.
 */
export function appendCommandOutput(
  existing: string | undefined,
  delta: string,
): string {
  return (existing ?? "") + delta;
}

// ── Model mapping ──

/** Convert Codex `model/list` response items to our common ModelInfo format. */
export function codexModelsToModelInfo(models: CodexModel[]): ModelInfo[] {
  return models.map((m) => ({
    value: m.id,
    displayName: m.displayName,
    description: m.description ?? "",
  }));
}

export type CodexImageInput =
  | { type: "image"; url: string }
  | { type: "localImage"; path: string };

/** Convert UI image attachments to Codex turn/start image inputs. */
export function imageAttachmentsToCodexInputs(
  images?: ImageAttachment[],
): CodexImageInput[] | undefined {
  if (!images || images.length === 0) return undefined;
  return images.map((img) => ({
    type: "image",
    url: `data:${img.mediaType};base64,${img.data}`,
  }));
}
