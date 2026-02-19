import { useState, useEffect, useCallback, useRef } from "react";
import type { UIMessage, BackgroundAgent } from "@/types";
import {
  parseBackgroundAgentOutput,
  countLines,
} from "@/lib/background-agent-parser";

const POLL_INTERVAL_MS = 3000;
/** Mark agent completed after file unchanged for this many consecutive polls */
const STABLE_POLLS_THRESHOLD = 2;

interface UseBackgroundAgentsOptions {
  messages: UIMessage[];
  sessionId: string | null;
}

export function useBackgroundAgents({ messages, sessionId }: UseBackgroundAgentsOptions) {
  const [agents, setAgents] = useState<BackgroundAgent[]>([]);
  const registeredIds = useRef(new Set<string>());
  // Track consecutive polls where the file didn't change (per toolUseId)
  const stablePollCounts = useRef(new Map<string, number>());

  // Reset on session change
  useEffect(() => {
    setAgents([]);
    registeredIds.current.clear();
    stablePollCounts.current.clear();
  }, [sessionId]);

  // Detect new bg agents from messages
  useEffect(() => {
    for (const msg of messages) {
      if (
        msg.role === "tool_call" &&
        msg.toolName === "Task" &&
        msg.toolResult?.isAsync &&
        msg.toolResult?.outputFile
      ) {
        const toolUseId = msg.id.replace("tool-", "");
        if (registeredIds.current.has(toolUseId)) continue;
        registeredIds.current.add(toolUseId);

        const agent: BackgroundAgent = {
          agentId: msg.toolResult.agentId ?? toolUseId,
          description: String(
            msg.toolInput?.description ?? msg.toolInput?.prompt ?? "Background agent",
          ),
          prompt: String(msg.toolInput?.prompt ?? ""),
          outputFile: msg.toolResult.outputFile,
          launchedAt: msg.timestamp,
          status: "running",
          activity: [],
          lastParsedLineCount: 0,
          toolUseId,
        };

        setAgents((prev) => {
          if (prev.some((a) => a.toolUseId === agent.toolUseId)) return prev;
          return [...prev, agent];
        });
      }
    }
  }, [messages]);

  // Poll running agents
  const pollAgent = useCallback(async (agent: BackgroundAgent) => {
    try {
      const { content, error } = await window.claude.readFile(agent.outputFile);
      if (error || !content) return;

      const totalLines = countLines(content);

      // File hasn't changed since last parse — track stability
      if (totalLines <= agent.lastParsedLineCount) {
        const count = (stablePollCounts.current.get(agent.toolUseId) ?? 0) + 1;
        stablePollCounts.current.set(agent.toolUseId, count);

        if (count >= STABLE_POLLS_THRESHOLD && totalLines > 0) {
          // File stable for 2+ polls — agent is done.
          // Extract the result text from the last assistant text block.
          const { lastAssistantText } = parseBackgroundAgentOutput(content, 0);
          setAgents((prev) =>
            prev.map((a) => {
              if (a.toolUseId !== agent.toolUseId || a.status !== "running") return a;
              return {
                ...a,
                status: "completed" as const,
                result: lastAssistantText || undefined,
              };
            }),
          );
        }
        return;
      }

      // New content — reset stability counter and parse new lines
      stablePollCounts.current.set(agent.toolUseId, 0);

      const { activities } = parseBackgroundAgentOutput(content, agent.lastParsedLineCount);

      if (activities.length === 0) return;

      setAgents((prev) =>
        prev.map((a) => {
          if (a.toolUseId !== agent.toolUseId) return a;
          return {
            ...a,
            activity: [...a.activity, ...activities],
            lastParsedLineCount: totalLines,
          };
        }),
      );
    } catch {
      // File not ready yet — ignore
    }
  }, []);

  useEffect(() => {
    const hasRunning = agents.some((a) => a.status === "running");
    if (!hasRunning) return;

    const poll = () => {
      // Read the latest agent state to avoid stale closures
      setAgents((prev) => {
        for (const agent of prev) {
          if (agent.status === "running") {
            pollAgent(agent);
          }
        }
        return prev;
      });
    };

    const intervalId = setInterval(poll, POLL_INTERVAL_MS);
    // Also poll immediately
    poll();

    return () => clearInterval(intervalId);
  }, [agents.filter((a) => a.status === "running").length, pollAgent]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissAgent = useCallback((agentId: string) => {
    setAgents((prev) => prev.filter((a) => a.agentId !== agentId));
  }, []);

  return { agents, dismissAgent };
}
