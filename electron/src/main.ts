import { app, BrowserWindow, globalShortcut } from "electron";
import path from "path";
import http from "http";
import { log } from "./lib/logger";
import { glassEnabled, liquidGlass } from "./lib/glass";
import { initAutoUpdater } from "./lib/updater";
import { sessions } from "./ipc/claude-sessions";
import { acpSessions } from "./ipc/acp-sessions";
import { terminals } from "./ipc/terminal";

// IPC module registrations
import * as spacesIpc from "./ipc/spaces";
import * as projectsIpc from "./ipc/projects";
import * as sessionsIpc from "./ipc/sessions";
import * as ccImportIpc from "./ipc/cc-import";
import * as filesIpc from "./ipc/files";
import * as claudeSessionsIpc from "./ipc/claude-sessions";
import * as titleGenIpc from "./ipc/title-gen";
import * as terminalIpc from "./ipc/terminal";
import * as gitIpc from "./ipc/git";
import * as agentRegistryIpc from "./ipc/agent-registry";
import * as acpSessionsIpc from "./ipc/acp-sessions";
import * as mcpIpc from "./ipc/mcp";
import { ipcMain } from "electron";

// --- Liquid Glass command-line switches (must be set before app.whenReady()) ---
if (glassEnabled) {
  app.commandLine.appendSwitch("remote-debugging-port", "9222");
  app.commandLine.appendSwitch("remote-allow-origins", "*");
}

let mainWindow: BrowserWindow | null = null;

function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function createWindow(): void {
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      devTools: !glassEnabled,
    },
  };

  if (glassEnabled) {
    windowOptions.titleBarStyle = "hidden";
    windowOptions.transparent = true;
    windowOptions.trafficLightPosition = { x: 16, y: 16 };
  } else {
    windowOptions.titleBarStyle = "hiddenInset";
    windowOptions.trafficLightPosition = { x: 16, y: 16 };
    windowOptions.backgroundColor = "#18181b";
  }

  mainWindow = new BrowserWindow(windowOptions);

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  if (glassEnabled) {
    mainWindow.webContents.once("did-finish-load", () => {
      const glassId = liquidGlass!.addView(mainWindow!.getNativeWindowHandle(), {});
      log("GLASS", `Liquid glass applied, viewId=${glassId}`);
    });
  }
}

// --- Liquid Glass IPC ---
ipcMain.handle("app:getGlassEnabled", () => {
  return !!glassEnabled;
});

// --- Register all IPC modules ---
spacesIpc.register();
projectsIpc.register(getMainWindow);
sessionsIpc.register();
ccImportIpc.register();
filesIpc.register();
claudeSessionsIpc.register(getMainWindow);
titleGenIpc.register();
terminalIpc.register(getMainWindow);
gitIpc.register();
agentRegistryIpc.register();
acpSessionsIpc.register(getMainWindow);
mcpIpc.register();

// --- DevTools in separate window via remote debugging ---
let devToolsWindow: BrowserWindow | null = null;

function openDevToolsWindow(): void {
  if (!glassEnabled) {
    mainWindow?.webContents.openDevTools({ mode: "detach" });
    return;
  }

  if (devToolsWindow && !devToolsWindow.isDestroyed()) {
    devToolsWindow.focus();
    return;
  }

  http.get("http://127.0.0.1:9222/json", (res) => {
    let body = "";
    res.on("data", (chunk: Buffer) => { body += chunk; });
    res.on("end", () => {
      try {
        const targets = JSON.parse(body) as Array<{ type: string; webSocketDebuggerUrl?: string }>;
        const page = targets.find((t) => t.type === "page");
        if (!page) {
          log("DEVTOOLS", "No debuggable page target found");
          return;
        }

        const wsUrl = page.webSocketDebuggerUrl;
        if (!wsUrl) {
          log("DEVTOOLS", "No webSocketDebuggerUrl in target");
          return;
        }

        const wsParam = encodeURIComponent(wsUrl.replace("ws://", ""));
        const fullUrl = `devtools://devtools/bundled/inspector.html?ws=${wsParam}`;

        devToolsWindow = new BrowserWindow({
          width: 1000,
          height: 700,
          title: "OpenACP UI DevTools",
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
          },
        });

        devToolsWindow.loadURL(fullUrl);
        devToolsWindow.on("closed", () => {
          devToolsWindow = null;
        });

        log("DEVTOOLS", `Opened DevTools window: ${fullUrl}`);
      } catch (err) {
        log("DEVTOOLS_ERR", `Failed to parse targets: ${(err as Error).message}`);
      }
    });
  }).on("error", (err) => {
    log("DEVTOOLS_ERR", `Remote debugging not available: ${err.message}`);
  });
}

// --- App lifecycle ---
app.whenReady().then(() => {
  createWindow();
  initAutoUpdater(getMainWindow);

  const shortcuts = ["CommandOrControl+Alt+I", "F12", "CommandOrControl+Shift+J"];
  for (const shortcut of shortcuts) {
    const ok = globalShortcut.register(shortcut, () => {
      log("DEVTOOLS", `Shortcut ${shortcut} triggered`);
      openDevToolsWindow();
    });
    log("DEVTOOLS", `Register ${shortcut}: ${ok ? "OK" : "FAILED"}`);
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  for (const [sessionId, session] of sessions) {
    log("CLEANUP", `Closing session ${sessionId.slice(0, 8)}`);
    session.channel.close();
    session.queryHandle?.close();
  }
  sessions.clear();

  for (const [sessionId, entry] of acpSessions) {
    log("CLEANUP", `Stopping ACP session ${sessionId.slice(0, 8)}`);
    entry.process?.kill();
  }
  acpSessions.clear();

  for (const [terminalId, term] of terminals) {
    log("CLEANUP", `Killing terminal ${terminalId.slice(0, 8)}`);
    term.pty.kill();
  }
  terminals.clear();

  app.quit();
});
