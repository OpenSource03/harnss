import { useState, useEffect, useCallback, useRef } from "react";
import type { RegistryAgent, RegistryData } from "@/types";

const REGISTRY_URL =
  "https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json";
const CACHE_KEY = "harnss-agent-store-cache";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry {
  data: RegistryData;
  timestamp: number;
}

export interface BinaryCheckResult {
  path: string;
  args?: string[];
}

/**
 * Fetches the ACP agent registry from the CDN.
 * Uses sessionStorage cache (15 min TTL) to avoid re-fetching on every settings open.
 * After registry loads, checks which binary-only agents are installed on the system PATH.
 */
export function useAgentStore() {
  const [registryAgents, setRegistryAgents] = useState<RegistryAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [binaryPaths, setBinaryPaths] = useState<Record<string, BinaryCheckResult>>({});

  // Track latest agents for the binary check effect to avoid stale closures
  const latestAgentsRef = useRef<RegistryAgent[]>([]);
  latestAgentsRef.current = registryAgents;

  const checkBinaries = useCallback(async (agents: RegistryAgent[]) => {
    // Collect binary-only agents (have binary distribution, no npx)
    const binaryAgents = agents
      .filter((a) => !a.distribution.npx && a.distribution.binary)
      .map((a) => ({ id: a.id, binary: a.distribution.binary! }));

    if (binaryAgents.length === 0) {
      setBinaryPaths({});
      return;
    }

    try {
      const results = await window.claude.agents.checkBinaries(binaryAgents);
      // Only keep agents that were found on the system
      const found: Record<string, BinaryCheckResult> = {};
      for (const [id, result] of Object.entries(results)) {
        if (result) found[id] = result;
      }
      setBinaryPaths(found);
    } catch {
      // Silently fail — binary detection is best-effort
      setBinaryPaths({});
    }
  }, []);

  const fetchRegistry = useCallback(async (force?: boolean) => {
    // Check sessionStorage cache first (skip if force refresh)
    if (!force) {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const entry: CacheEntry = JSON.parse(cached);
          if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
            setRegistryAgents(entry.data.agents);
            setIsLoading(false);
            return;
          }
        }
      } catch {
        /* ignore cache parse errors */
      }
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(REGISTRY_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: RegistryData = await res.json();
      setRegistryAgents(data.agents);
      // Persist to sessionStorage for cache
      try {
        sessionStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ data, timestamp: Date.now() } satisfies CacheEntry),
        );
      } catch {
        /* sessionStorage might be full or disabled */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch registry");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegistry();
  }, [fetchRegistry]);

  // Run binary checks in the background after registry loads
  useEffect(() => {
    if (registryAgents.length > 0) {
      checkBinaries(registryAgents);
    }
  }, [registryAgents, checkBinaries]);

  return {
    registryAgents,
    isLoading,
    error,
    /** Map of agent id → resolved binary path + args for agents found on the system. */
    binaryPaths,
    /** Re-fetch registry, bypassing cache */
    refresh: useCallback(() => fetchRegistry(true), [fetchRegistry]),
  };
}
