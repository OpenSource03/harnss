import { useState, useEffect, useCallback } from "react";
import type { AgentDefinition } from "@/types";

export function useAgentRegistry() {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);

  const refresh = useCallback(async () => {
    const list = await window.claude.agents.list();
    setAgents(list);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { agents, refresh };
}
