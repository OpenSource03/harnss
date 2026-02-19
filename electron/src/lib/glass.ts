import os from "os";

let liquidGlass: { addView: (handle: Buffer, opts: object) => number } | null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  liquidGlass = require("electron-liquid-glass");
} catch {
  liquidGlass = null;
}

function isMacOSTahoeOrLater(): boolean {
  if (process.platform !== "darwin") return false;
  const major = parseInt(os.release().split(".")[0], 10);
  return major >= 25;
}

export const glassEnabled = !!(liquidGlass && isMacOSTahoeOrLater());
export { liquidGlass };
