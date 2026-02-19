import { app } from "electron";
import path from "path";
import fs from "fs";

export function getDataDir(): string {
  const dir = path.join(app.getPath("userData"), "openacpui-data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getProjectSessionsDir(projectId: string): string {
  const dir = path.join(getDataDir(), "sessions", projectId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getSessionFilePath(projectId: string, sessionId: string): string {
  return path.join(getProjectSessionsDir(projectId), `${sessionId}.json`);
}
