import type { BrowserWindow } from "electron";

// Guard IPC sends against a destroyed window.
// PTY onData, SDK event loops, and ACP callbacks fire asynchronously —
// they can outlive the BrowserWindow on quit, causing "Object has been destroyed" crashes.
export function safeSend(
  getMainWindow: () => BrowserWindow | null,
  channel: string,
  ...args: unknown[]
): void {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}
