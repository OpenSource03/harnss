import fs from "fs";
import path from "path";
import { getDataDir } from "./data-dir";

export interface McpServerConfig {
  name: string;
  transport: "stdio" | "sse" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

function getMcpDir(): string {
  const dir = path.join(getDataDir(), "mcp");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getMcpPath(projectId: string): string {
  return path.join(getMcpDir(), `${projectId}.json`);
}

export function loadMcpServers(projectId: string): McpServerConfig[] {
  try {
    return JSON.parse(fs.readFileSync(getMcpPath(projectId), "utf-8"));
  } catch {
    return [];
  }
}

export function saveMcpServers(projectId: string, servers: McpServerConfig[]): void {
  const filePath = getMcpPath(projectId);
  const tempPath = filePath + ".tmp";
  fs.writeFileSync(tempPath, JSON.stringify(servers, null, 2));
  fs.renameSync(tempPath, filePath);
}

export function addMcpServer(projectId: string, server: McpServerConfig): void {
  const servers = loadMcpServers(projectId);
  const idx = servers.findIndex((s) => s.name === server.name);
  if (idx >= 0) servers[idx] = server;
  else servers.push(server);
  saveMcpServers(projectId, servers);
}

export function removeMcpServer(projectId: string, name: string): void {
  const servers = loadMcpServers(projectId).filter((s) => s.name !== name);
  saveMcpServers(projectId, servers);
}
