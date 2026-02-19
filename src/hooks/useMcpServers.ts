import { useState, useCallback, useEffect } from "react";
import type { McpServerConfig } from "@/types";

export function useMcpServers(projectId: string | null) {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setServers([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    window.claude.mcp
      .list(projectId)
      .then((s) => {
        if (!cancelled) setServers(s);
      })
      .catch(() => {
        /* IPC failure — leave empty */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const addServer = useCallback(
    async (server: McpServerConfig) => {
      if (!projectId) return;
      await window.claude.mcp.add(projectId, server);
      setServers((prev) => {
        const idx = prev.findIndex((s) => s.name === server.name);
        if (idx >= 0) return prev.map((s, i) => (i === idx ? server : s));
        return [...prev, server];
      });
    },
    [projectId],
  );

  const removeServer = useCallback(
    async (name: string) => {
      if (!projectId) return;
      await window.claude.mcp.remove(projectId, name);
      setServers((prev) => prev.filter((s) => s.name !== name));
    },
    [projectId],
  );

  return { servers, loading, addServer, removeServer };
}
