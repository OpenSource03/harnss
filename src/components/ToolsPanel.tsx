import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal as TerminalIcon, Plus, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TerminalTab {
  id: string;
  terminalId: string;
  label: string;
}

interface ToolsPanelProps {
  cwd?: string;
}

export function ToolsPanel({ cwd }: ToolsPanelProps) {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Track tabs in ref so the unmount cleanup always sees the latest list
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  // Destroy all PTY processes when the panel unmounts (e.g., session deselected)
  useEffect(() => {
    return () => {
      for (const tab of tabsRef.current) {
        window.claude.terminal.destroy(tab.terminalId);
      }
    };
  }, []);

  const createTerminal = useCallback(async () => {
    const result = await window.claude.terminal.create({
      cwd: cwd || undefined,
      cols: 80,
      rows: 24,
    });
    if (result.error || !result.terminalId) return;

    const tabId = crypto.randomUUID();
    const tab: TerminalTab = {
      id: tabId,
      terminalId: result.terminalId,
      label: `Terminal ${tabs.length + 1}`,
    };
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tabId);
  }, [cwd, tabs.length]);

  // Auto-create first terminal
  useEffect(() => {
    if (tabs.length === 0) {
      createTerminal();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const closeTab = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (tab) {
        await window.claude.terminal.destroy(tab.terminalId);
      }
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== tabId);
        if (activeTabId === tabId) {
          setActiveTabId(next.length > 0 ? next[next.length - 1].id : null);
        }
        return next;
      });
    },
    [tabs, activeTabId],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header with tabs */}
      <div className="flex items-center gap-1 px-2 pt-2 pb-1">
        <div className="flex items-center gap-1.5 ps-1.5">
          <TerminalIcon className="h-3.5 w-3.5 text-foreground/50" />
          <span className="text-xs font-medium text-foreground/60">Tools</span>
        </div>

        <div className="ms-2 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTabId(tab.id)}
              className={`group flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors cursor-pointer ${
                tab.id === activeTabId
                  ? "bg-foreground/[0.08] text-foreground/90"
                  : "text-foreground/45 hover:text-foreground/65 hover:bg-foreground/[0.04]"
              }`}
            >
              <ChevronDown className="h-2.5 w-2.5 opacity-50" />
              <span className="truncate max-w-20">{tab.label}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }
                }}
                className="ms-0.5 rounded p-0.5 opacity-0 transition-opacity hover:bg-foreground/10 group-hover:opacity-100"
              >
                <X className="h-2.5 w-2.5" />
              </span>
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 text-foreground/40 hover:text-foreground/70"
          onClick={createTerminal}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Separator */}
      <div className="border-t border-foreground/[0.08]" />

      {/* Terminal content */}
      <div className="relative min-h-0 flex-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`absolute inset-0 ${tab.id === activeTabId ? "visible" : "invisible"}`}
          >
            <TerminalInstance terminalId={tab.terminalId} isVisible={tab.id === activeTabId} />
          </div>
        ))}
        {tabs.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <button
              type="button"
              onClick={createTerminal}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-foreground/40 transition-colors hover:bg-foreground/[0.04] hover:text-foreground/60 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              New Terminal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TerminalInstance({
  terminalId,
  isVisible,
}: {
  terminalId: string;
  isVisible: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const fitAddonRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null);
  const [ready, setReady] = useState(false);

  // Initialize xterm
  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    let unsubData: (() => void) | null = null;
    let unsubExit: (() => void) | null = null;

    (async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

      if (disposed) return;

      const fitAddon = new FitAddon();
      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: "bar",
        fontSize: 12,
        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', Menlo, monospace",
        lineHeight: 1.35,
        letterSpacing: 0,
        allowProposedApi: true,
        allowTransparency: true,
        scrollback: 5000,
        theme: {
          background: "#00000000",
          foreground: "#c8c8c8",
          cursor: "#c8c8c8",
          cursorAccent: "#1a1a1a",
          selectionBackground: "rgba(255, 255, 255, 0.12)",
          selectionForeground: undefined,
          // Muted, desaturated terminal palette
          black: "#1a1a1a",
          red: "#c47070",
          green: "#7aab7a",
          yellow: "#bba86e",
          blue: "#7090b5",
          magenta: "#a07aa8",
          cyan: "#6ea5a5",
          white: "#c8c8c8",
          brightBlack: "#555555",
          brightRed: "#d48a8a",
          brightGreen: "#95c495",
          brightYellow: "#d0c48e",
          brightBlue: "#8daac8",
          brightMagenta: "#b898bf",
          brightCyan: "#8dbfbf",
          brightWhite: "#e8e8e8",
        },
      });

      term.loadAddon(fitAddon);
      term.open(containerRef.current!);

      // Defer fit to next frame to ensure dimensions are available
      requestAnimationFrame(() => {
        if (disposed) return;
        try {
          fitAddon.fit();
        } catch {
          // Container may not be sized yet
        }
      });

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Wire up input → PTY
      term.onData((data) => {
        window.claude.terminal.write(terminalId, data);
      });

      // Wire up PTY → xterm
      unsubData = window.claude.terminal.onData(({ terminalId: id, data }) => {
        if (id === terminalId && !disposed) {
          term.write(data);
        }
      });

      unsubExit = window.claude.terminal.onExit(({ terminalId: id }) => {
        if (id === terminalId && !disposed) {
          term.write("\r\n\x1b[2m[process exited]\x1b[0m\r\n");
        }
      });

      // Report initial size to PTY
      const dims = fitAddon.proposeDimensions();
      if (dims) {
        window.claude.terminal.resize(terminalId, dims.cols, dims.rows);
      }

      setReady(true);
    })();

    return () => {
      disposed = true;
      unsubData?.();
      unsubExit?.();
      xtermRef.current?.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [terminalId]);

  // Refit on visibility change or container resize
  useEffect(() => {
    if (!ready || !isVisible) return;

    const fit = () => {
      try {
        fitAddonRef.current?.fit();
        const dims = fitAddonRef.current?.proposeDimensions();
        if (dims) {
          window.claude.terminal.resize(terminalId, dims.cols, dims.rows);
        }
      } catch {
        // ignore
      }
    };

    // Fit on visibility change
    requestAnimationFrame(fit);

    // Observe container resize
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(fit);
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [ready, isVisible, terminalId]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full px-2 py-1 [&_.xterm]:h-full [&_.xterm]:!bg-transparent [&_.xterm-viewport]:!bg-transparent [&_.xterm-screen]:!bg-transparent"
    />
  );
}
