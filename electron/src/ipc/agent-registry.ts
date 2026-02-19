import { ipcMain } from "electron";
import {
  listAgents,
  saveAgent,
  deleteAgent,
  loadUserAgents,
} from "../lib/agent-registry";
import type { AgentDefinition } from "../lib/agent-registry";

export function register(): void {
  loadUserAgents();

  ipcMain.handle("agents:list", () => listAgents());
  ipcMain.handle("agents:save", (_e, agent: AgentDefinition) => {
    saveAgent(agent);
    return { ok: true };
  });
  ipcMain.handle("agents:delete", (_e, id: string) => {
    deleteAgent(id);
    return { ok: true };
  });
}
