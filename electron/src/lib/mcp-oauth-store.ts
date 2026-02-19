import fs from "fs";
import path from "path";
import { getDataDir } from "./data-dir";

export interface StoredOAuthData {
  tokens?: {
    access_token: string;
    token_type: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  clientInfo?: {
    client_id: string;
    client_secret?: string;
    client_id_issued_at?: number;
    client_secret_expires_at?: number;
  };
  codeVerifier?: string;
  serverUrl: string;
  storedAt: number;
}

function getOAuthDir(): string {
  const dir = path.join(getDataDir(), "mcp-oauth");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getOAuthPath(serverName: string): string {
  // Sanitize server name for use as filename
  const safe = serverName.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(getOAuthDir(), `${safe}.json`);
}

export function loadOAuthData(serverName: string): StoredOAuthData | null {
  try {
    const raw = fs.readFileSync(getOAuthPath(serverName), "utf-8");
    return JSON.parse(raw) as StoredOAuthData;
  } catch {
    return null;
  }
}

export function saveOAuthData(serverName: string, data: StoredOAuthData): void {
  const filePath = getOAuthPath(serverName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export function deleteOAuthData(serverName: string): void {
  try {
    fs.unlinkSync(getOAuthPath(serverName));
  } catch {
    // Ignore if file doesn't exist
  }
}
