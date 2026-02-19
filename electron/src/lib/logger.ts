import path from "path";
import fs from "fs";
import { app } from "electron";

const logsDir = app.isPackaged
  ? path.join(app.getPath("userData"), "logs")
  : path.join(__dirname, "..", "..", "logs");
fs.mkdirSync(logsDir, { recursive: true });

const logFile = path.join(logsDir, `main-${Date.now()}.log`);
const logStream = fs.createWriteStream(logFile, { flags: "a" });

export function log(label: string, data: unknown): void {
  const ts = new Date().toISOString();
  const line = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  logStream.write(`[${ts}] [${label}] ${line}\n`);
}
