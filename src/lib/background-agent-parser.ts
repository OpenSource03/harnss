import type { BackgroundAgentActivity } from "@/types";

interface ParseResult {
  activities: BackgroundAgentActivity[];
  lastAssistantText?: string;
}

/**
 * Parse JSONL output file from a background agent.
 *
 * The file is the subagent's conversation transcript (NOT the stream-json
 * protocol). Each line is a JSON object with:
 *   - type: "user" | "assistant" | "progress"
 *   - message: { role, content } — content is string or block array
 *
 * There is no "result" event. Completion is detected externally via file
 * stability (line count unchanged across consecutive polls).
 */
export function parseBackgroundAgentOutput(
  content: string,
  startLine: number,
): ParseResult {
  const lines = content.split("\n").filter((l) => l.trim());
  const newLines = lines.slice(startLine);
  const activities: BackgroundAgentActivity[] = [];
  let lastAssistantText: string | undefined;

  for (const line of newLines) {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    const now = Date.now();

    if (event.type === "assistant") {
      const message = event.message as {
        content?: string | Array<{ type: string; [key: string]: unknown }>;
      };
      if (!message?.content || typeof message.content === "string") continue;

      for (const block of message.content) {
        if (block.type === "tool_use") {
          const input = block.input as Record<string, unknown> | undefined;
          activities.push({
            type: "tool_call",
            toolName: block.name as string,
            summary: formatToolSummary(block.name as string, input),
            timestamp: now,
          });
        } else if (block.type === "text") {
          const text = String(block.text ?? "").trim();
          if (text) {
            lastAssistantText = text;
            activities.push({
              type: "text",
              summary: text.length > 100 ? text.slice(0, 100) + "..." : text,
              timestamp: now,
            });
          }
        }
      }
    }
    // "progress" and "user" events are skipped — no useful activity info
  }

  return { activities, lastAssistantText };
}

/** Total line count for tracking parsed progress. */
export function countLines(content: string): number {
  return content.split("\n").filter((l) => l.trim()).length;
}

function formatToolSummary(
  toolName: string,
  input?: Record<string, unknown>,
): string {
  if (!input) return toolName;
  if (input.file_path) return String(input.file_path).split("/").pop() ?? "";
  if (input.command) return String(input.command).split("\n")[0].slice(0, 80);
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
