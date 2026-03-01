import { ipcMain } from "electron";
import {
  listAgents,
  saveAgent,
  deleteAgent,
  loadUserAgents,
  updateCachedConfig,
  checkBinaries,
} from "../lib/agent-registry";
import type { InstalledAgent } from "../lib/agent-registry";

export function register(): void {
  loadUserAgents();

  ipcMain.handle("agents:list", () => listAgents());
  ipcMain.handle("agents:save", (_e, agent: InstalledAgent) => {
    saveAgent(agent);
    return { ok: true };
  });
  ipcMain.handle("agents:delete", (_e, id: string) => {
    deleteAgent(id);
    return { ok: true };
  });
  ipcMain.handle("agents:update-cached-config", (_e, agentId: string, configOptions: unknown[]) => {
    updateCachedConfig(agentId, configOptions);
    return { ok: true };
  });

  // Batch-check if binary-only agents are installed on the system PATH
  ipcMain.handle(
    "agents:check-binaries",
    (_e, agents: Array<{ id: string; binary: Record<string, { cmd: string; args?: string[] }> }>) =>
      checkBinaries(agents),
  );
}
