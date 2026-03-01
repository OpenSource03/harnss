import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { app } from "electron";

const execFileAsync = promisify(execFile);

export type EngineId = "claude" | "acp" | "codex";

export interface InstalledAgent {
  id: string;
  name: string;
  engine: EngineId;
  binary?: string;
  args?: string[];
  env?: Record<string, string>;
  icon?: string;
  builtIn?: boolean;
  /** Matching id from the ACP registry (for update detection) */
  registryId?: string;
  /** Version from the registry at install time */
  registryVersion?: string;
  /** Description from the registry, shown in agent cards */
  description?: string;
  /** Cached config options from the last ACP session — shown before session starts */
  cachedConfigOptions?: unknown[];
}

const BUILTIN_CLAUDE: InstalledAgent = {
  id: "claude-code",
  name: "Claude Code",
  engine: "claude",
  builtIn: true,
  icon: "brain",
};

const BUILTIN_CODEX: InstalledAgent = {
  id: "codex",
  name: "Codex",
  engine: "codex",
  builtIn: true,
  icon: "zap",
};

const BUILTIN_IDS = new Set([BUILTIN_CLAUDE.id, BUILTIN_CODEX.id]);

const agents = new Map<string, InstalledAgent>();
agents.set(BUILTIN_CLAUDE.id, BUILTIN_CLAUDE);
agents.set(BUILTIN_CODEX.id, BUILTIN_CODEX);

function getConfigPath(): string {
  return path.join(app.getPath("userData"), "openacpui-data", "agents.json");
}

export function loadUserAgents(): void {
  try {
    const data = JSON.parse(fs.readFileSync(getConfigPath(), "utf-8"));
    for (const agent of data) {
      if (!BUILTIN_IDS.has(agent.id)) agents.set(agent.id, agent);
    }
  } catch {
    /* no config yet */
  }
}

export function getAgent(id: string): InstalledAgent | undefined {
  return agents.get(id);
}

export function listAgents(): InstalledAgent[] {
  return Array.from(agents.values());
}

export function saveAgent(agent: InstalledAgent): void {
  if (BUILTIN_IDS.has(agent.id)) return; // Protect built-in agents
  if (!agent.id?.trim() || !agent.name?.trim()) throw new Error("Agent must have id and name");
  if (agent.engine === "acp" && !agent.binary?.trim()) throw new Error("ACP agents require a binary");
  agents.set(agent.id, agent);
  persistUserAgents();
}

export function deleteAgent(id: string): void {
  if (BUILTIN_IDS.has(id)) return;
  agents.delete(id);
  persistUserAgents();
}

/** Update only the cached config options for an agent (fire-and-forget from renderer) */
export function updateCachedConfig(id: string, configOptions: unknown[]): void {
  const agent = agents.get(id);
  if (!agent || agent.builtIn) return;
  agent.cachedConfigOptions = configOptions;
  persistUserAgents();
}

function persistUserAgents(): void {
  const userAgents = listAgents().filter((a) => !a.builtIn);
  const dir = path.dirname(getConfigPath());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(userAgents, null, 2));
}

// ── Binary detection helpers ──

/** Map process.platform + process.arch to the registry's platform key format. */
export function getRegistryPlatformKey(): string | null {
  const archMap: Record<string, string> = { arm64: "aarch64", x64: "x86_64" };
  const platformMap: Record<string, string> = { darwin: "darwin", linux: "linux", win32: "windows" };
  const platform = platformMap[process.platform];
  const arch = archMap[process.arch];
  if (!platform || !arch) return null;
  return `${platform}-${arch}`;
}

/** Resolve a command name to its absolute path via `which` (or `where` on Windows). */
async function resolveWhich(cmd: string): Promise<string | null> {
  try {
    const whichCmd = process.platform === "win32" ? "where" : "which";
    const { stdout } = await execFileAsync(whichCmd, [cmd]);
    // `where` on Windows may return multiple lines; take the first
    return stdout.trim().split("\n")[0] || null;
  } catch {
    return null; // command not found
  }
}

/** Strip leading "./" and trailing ".exe" from a registry cmd to get the bare binary name. */
function extractBinaryName(cmd: string): string {
  return cmd.replace(/^\.\//, "").replace(/\.exe$/i, "");
}

export interface BinaryCheckResult {
  path: string;
  args?: string[];
}

/**
 * Batch-check which binary-only agents have their command available on the system PATH.
 * Receives raw binary distribution maps from registry agents, resolves the current platform,
 * and runs `which`/`where` for each matching command.
 */
export async function checkBinaries(
  agents: Array<{ id: string; binary: Record<string, { cmd: string; args?: string[] }> }>,
): Promise<Record<string, BinaryCheckResult | null>> {
  const key = getRegistryPlatformKey();
  if (!key) return {};

  const results: Record<string, BinaryCheckResult | null> = {};
  await Promise.all(
    agents.map(async ({ id, binary }) => {
      const target = binary[key];
      if (!target) {
        results[id] = null;
        return;
      }
      const cmdName = extractBinaryName(target.cmd);
      const resolved = await resolveWhich(cmdName);
      results[id] = resolved ? { path: resolved, args: target.args } : null;
    }),
  );
  return results;
}
