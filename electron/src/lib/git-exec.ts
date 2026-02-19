import { execFile } from "child_process";

export const ALWAYS_SKIP = new Set([
  "node_modules", ".git", ".hg", ".svn", "dist", "build", ".next", ".nuxt",
  ".output", ".cache", ".turbo", ".parcel-cache", ".vercel", ".netlify",
  "__pycache__", ".pytest_cache", ".mypy_cache", "venv", ".venv", "env",
  ".tox", "coverage", ".nyc_output", ".angular", ".expo", "Pods",
  ".gradle", ".idea", ".vs", ".vscode", "target", "out", "bin", "obj",
]);

export function gitExec(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd, maxBuffer: 5 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr?.trim() || err.message));
      resolve(stdout);
    });
  });
}
