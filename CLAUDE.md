# Harnss

Open-source desktop client for the Agent Client Protocol. Uses the `@anthropic-ai/claude-agent-sdk` to programmatically manage Claude sessions via `query()`. Supports multiple concurrent sessions with persistent chat history, project workspaces, background agents, tool permissions, and context compaction.

## Tech Stack

- **Runtime**: Electron 40 (main process) + React 19 (renderer)
- **Build**: Vite 7, TypeScript 5.9, tsup (electron TS→JS)
- **Styling**: Tailwind CSS v4 + ShadCN UI (includes Preflight — no CSS resets needed)
- **UI Components**: ShadCN (Button, Badge, ScrollArea, Tooltip, Collapsible, Separator, DropdownMenu, Avatar)
- **Icons**: lucide-react
- **Markdown**: react-markdown + remark-gfm + react-syntax-highlighter + @tailwindcss/typography
- **Diff**: diff (word-level diff rendering)
- **Glass effect**: electron-liquid-glass (macOS Tahoe+ transparency)
- **SDK**: @anthropic-ai/claude-agent-sdk (ESM-only, async-imported from CommonJS)
- **Terminal**: node-pty (main process) + @xterm/xterm + @xterm/addon-fit (renderer)
- **Browser**: Electron `<webview>` tag (requires `webviewTag: true` in webPreferences)
- **Package manager**: pnpm
- **Path aliases**: `@/` → `./src/`, `@shared/` → `./shared/`

## Project Structure

```
shared/
└── types/             # Types shared between electron and renderer processes
    ├── codex-protocol/  # Auto-generated Codex protocol types (from codex app-server)
    │   ├── v2/          # Modern v2 API types
    │   └── serde_json/  # JSON value types
    ├── codex.ts         # Codex type re-exports with Codex-prefixed aliases
    ├── engine.ts        # EngineId, AppPermissionBehavior, SessionMeta, EngineHookState
    ├── acp.ts           # ACP session update types
    └── registry.ts      # Agent registry types

electron/
├── dist/       # tsup build output (gitignored)
└── src/
    ├── ipc/    # IPC handlers (claude-sessions, projects, sessions, settings, terminal, git, etc.)
    └── lib/    # Main-process utilities (logger, async-channel, data-dir, app-settings, sdk, error-utils, etc.)

src/
├── components/
│   ├── git/           # GitPanel decomposed (GitPanel, RepoSection, BranchPicker, CommitInput, etc.)
│   ├── mcp-renderers/ # MCP tool renderers (jira, confluence, atlassian, context7)
│   ├── tool-renderers/# Built-in tool renderers (BashContent, EditContent, TaskTool, etc.)
│   ├── sidebar/       # AppSidebar decomposed (ProjectSection, SessionItem, CCSessionList)
│   ├── lib/           # Component-local utilities (tool-metadata, tool-formatting)
│   ├── settings/      # Settings sub-views + shared SettingRow/SettingsSelect
│   └── ui/            # ShadCN base components (auto-generated)
├── hooks/
│   ├── session/       # useSessionManager decomposed (lifecycle, persistence, draft, revival, queue)
│   └── ...            # React hooks (useEngineBase, useClaude, useAppOrchestrator, usePanelResize, etc.)
├── lib/               # Renderer utilities (protocol, streaming-buffer, message-factory, background stores, etc.)
└── types/             # Renderer-side types (protocol, ui, window.d.ts) + re-export shims for shared/
```

## How to Run

```bash
pnpm install
pnpm dev       # Starts Vite dev server + tsup watch + Electron
pnpm build     # tsup (electron/) + Vite (renderer) production build
pnpm start     # Run Electron with pre-built dist/
```

## Architecture

### SDK-Based Session Management

The main process uses `@anthropic-ai/claude-agent-sdk` (ESM-only, loaded via `await import()`). Each session runs a long-lived SDK `query()` with an `AsyncChannel` for multi-turn input.

**Session Map**: `Map<sessionId, { channel, queryHandle, eventCounter, pendingPermissions }>`

- `channel` — AsyncChannel (push-based async iterable) for sending user messages to SDK
- `queryHandle` — SDK query handle for interrupt/close/setPermissionMode
- `pendingPermissions` — Map<requestId, { resolve }> for bridging SDK permission callbacks to UI

**IPC API — Claude Sessions:**

- `claude:start(options)` → spawns SDK query with AsyncChannel, returns `{ sessionId, pid }`
  - Options: `cwd`, `model`, `permissionMode`, `resume` (session continuation)
  - Configures `canUseTool` callback for permission bridging
  - Thinking: `{ type: "enabled", budgetTokens: 16000 }`
- `claude:send({ sessionId, message })` → pushes user message to session's AsyncChannel
- `claude:stop(sessionId)` → closes channel + query handle, removes from Map
- `claude:interrupt(sessionId)` → denies all pending permissions, calls `queryHandle.interrupt()`
- `claude:permission_response(sessionId, requestId, ...)` → resolves pending permission Promise
- `claude:set-permission-mode(sessionId, mode)` → calls `queryHandle.setPermissionMode()`
- `claude:generate-title(message, cwd?)` → one-shot Haiku query for chat title
- Events sent to renderer via `claude:event` tagged with `_sessionId`
- Permission requests sent via `claude:permission_request` with requestId

**IPC API — Projects:**

- `projects:list` / `projects:create` / `projects:delete` / `projects:rename`

**IPC API — Session Persistence:**

- `sessions:save(data)` — writes to `{userData}/openacpui-data/sessions/{projectId}/{id}.json` (`openacpui-data` kept for backward compatibility)
- `sessions:load(projectId, id)` — reads session file
- `sessions:list(projectId)` — returns session metadata sorted by date
- `sessions:delete(projectId, id)` — removes session file

**IPC API — Claude Code Import:**

- `cc-sessions:list(projectPath)` — lists JSONL files in `~/.claude/projects/{hash}`
- `cc-sessions:import(projectPath, ccSessionId)` — converts JSONL transcript to UIMessage[]

**IPC API — File Operations:**

- `files:list(cwd)` — git ls-files respecting .gitignore, returns `{ files, dirs }`
- `files:read-multiple(cwd, paths)` — batch read with path validation and size limits
- `file:read(filePath)` — single file read (used for diff context)
- `file:open-in-editor({ filePath, line? })` — opens file in external editor (tries cursor, code, zed CLIs with `--goto`, falls back to OS default)

**IPC API — Terminal (PTY):**

- `terminal:create({ cwd, cols, rows })` → spawns shell via node-pty, returns `{ terminalId }`
- `terminal:write({ terminalId, data })` → sends keystrokes to PTY
- `terminal:resize({ terminalId, cols, rows })` → resizes PTY dimensions
- `terminal:destroy(terminalId)` → kills the PTY process
- Events: `terminal:data` (PTY output), `terminal:exit` (process exit)

**IPC API — App Settings:**

- `settings:get` — returns full `AppSettings` object (JSON file in data dir)
- `settings:set(patch)` — merges partial update, persists to disk, notifies in-process listeners

### Settings Architecture

Two tiers of settings storage, each suited to different access patterns:

1. **`useSettings` hook** (renderer, localStorage) — UI preferences that only the renderer needs: model, permissionMode, panel widths, active tools, thinking toggle. Per-project settings keyed by `harnss-{projectId}-*`, global settings keyed by `harnss-*`.

2. **`AppSettings` store** (main process, JSON file) — settings that the main process needs at startup before any BrowserWindow exists (e.g. `autoUpdater.allowPrerelease`). File location: `{userData}/openacpui-data/settings.json` (`openacpui-data` kept for backward compatibility). Accessed via `getAppSettings()`/`setAppSettings()` in `electron/src/lib/app-settings.ts`. The `settings` IPC module exposes `settings:get`/`settings:set` to the renderer and fires `onSettingsChanged` listeners for in-process consumers (e.g. the updater).

**When to use which:** Use `useSettings` for renderer-only preferences. Use `AppSettings` when the main process must read the value synchronously at startup or react to changes (e.g. updater config, window behavior).

### State Architecture

**Hook composition** — large hooks are decomposed into focused sub-hooks:

- `useAppOrchestrator` — wires together all top-level state (session manager, project manager, space manager, settings, agents, notifications) and provides ~30 callbacks to `AppLayout`
- `useSessionManager` — slim orchestrator (~400 lines) composing 5 sub-hooks:
  - `useSessionLifecycle` — session CRUD (create, switch, delete, rename, deselect)
  - `useSessionPersistence` — auto-save with debounce, background store seeding/consuming
  - `useDraftMaterialization` — draft-to-live session transitions for all 3 engines
  - `useSessionRevival` — per-engine revival (reconnecting to existing sessions)
  - `useMessageQueue` — message queuing and drain for not-yet-ready sessions
- `useEngineBase` — shared foundation for all engine hooks (state, rAF flush, reset effect)
- `useClaude` / `useACP` / `useCodex` — engine-specific event handling built on `useEngineBase`
- `useSpaceTheme` — space color tinting via CSS custom properties
- `usePanelResize` — all resize handle logic (right panel, tools panel, splits)
- `useStreamingTextReveal` — per-token fade-in animation via DOM text node splitting
- `useProjectManager` — project CRUD via IPC
- `useBackgroundAgents` — polls async Task agent output files every 3s, marks complete after 2 stable polls
- `useSidebar` — sidebar open/close with localStorage persistence

**BackgroundSessionStore** — accumulates events for non-active sessions to prevent state loss when switching. On switch-away, session state is captured into the store; on switch-back, state is consumed from the store (or loaded from disk if no live process). Event handling is split into per-engine handler modules (`background-claude-handler.ts`, `background-acp-handler.ts`, `background-codex-handler.ts`).

### Claude CLI Stream-JSON Protocol

Key event types in order:

- `system` (init) — session metadata, model, tools, permissionMode, version
- `system` (status) — status updates
- `system` (compact_boundary) — context compaction marker
- `stream_event` wrapping: `message_start` → `content_block_start` → `content_block_delta` (repeated) → `content_block_stop` → `message_delta` → `message_stop`
- `assistant` — complete message snapshot (with `includePartialMessages`, sent after thinking and after text)
- `user` (tool_result) — tool execution results with `tool_use_result` metadata
- `result` — turn complete with cost/duration/modelUsage

### Key Patterns

**rAF streaming flush**: React 19 batches rapid `setState` calls into a single render. When SDK events arrive in a tight loop, all IPC-fired `setState` calls merge into one render → text appears all at once. Fix: accumulate deltas in `StreamingBuffer` (refs), schedule a single `requestAnimationFrame` to flush to React state at ~60fps.

**Subagent routing via `parent_tool_use_id`**: Events from Task subagents have `parent_tool_use_id` set to the Task tool_use block's `id`. A `parentToolMap` (Map<string, string>) maps this ID to the tool_call message ID in the UI, allowing subagent activity to be routed to the correct Task card with `subagentSteps`.

**Thinking with `includePartialMessages`**: Two `assistant` events per turn — first contains only thinking blocks, second contains only text blocks. The hook merges both into the same streaming message.

**Permission bridging**: SDK's async `canUseTool` callback creates a Promise stored in `pendingPermissions` Map. Main process sends `claude:permission_request` to renderer. UI shows `PermissionPrompt`. User decision sent back via `claude:permission_response`, resolving the stored Promise to allow/deny the tool.

**Background session store**: When switching sessions, the active session's state (messages, processing flag, sessionInfo, cost) is captured into `BackgroundSessionStore`. Events for non-active sessions route to the store instead of React state. On switch-back, state is consumed from the store to restore the UI instantly.

**Glass morphism**: On macOS Tahoe+, uses `electron-liquid-glass` for native transparency. DevTools opened via remote debugging on a separate window to avoid Electron bug #42846 (transparent + frameless + DevTools = broken clicks).

### Tools Panel System

The right side of the layout has a **ToolPicker** strip (vertical icon bar, always visible) that toggles tool panels on/off. Active tools state (`Set<ToolId>`) is persisted to localStorage.

**Layout**: `Sidebar | Chat | Tasks/Agents | [Tool Panels] | ToolPicker`

Tool panels share a resizable column. When multiple tools are active, they split vertically with a draggable divider (ratio persisted to localStorage, clamped 20%–80%). The column width is also resizable (280–800px).

**Terminal** (`ToolsPanel`): Multi-tab xterm.js instances. Each tab spawns a node-pty process in the main process via IPC. Uses `allowTransparency: true` + `background: "#00000000"` for transparent canvas that inherits the island's `bg-background`. The FitAddon + ResizeObserver auto-sizes the terminal on panel resize.

**Browser** (`BrowserPanel`): Multi-tab Electron `<webview>` with URL bar, back/forward/reload, HTTPS indicator. Smart URL input: bare domains get `https://` prefix, non-URL text becomes a Google search.

**Open Files** (`FilesPanel`): Derives accessed files from the session's `UIMessage[]` array — no IPC needed. Scans `tool_call` messages for `Read`/`Edit`/`Write`/`NotebookEdit` tools + subagent steps. Tracks per-file access type (read/modified/created), deduplicates by path keeping highest access level, sorts by most recently accessed. Clicking a file scrolls to its last tool_call in chat.

### MCP Tool Rendering System

MCP tool calls are rendered with rich, tool-specific UIs via `McpToolContent.tsx`. The system supports both SDK sessions (`mcp__Server__tool`) and ACP sessions (`Tool: Server/tool`).

**Detection**: `ToolCall.tsx` detects MCP tools by checking if `toolName` starts with `"mcp__"` or `"Tool: "`, then delegates to `<McpToolContent>`.

**Registry** (`McpToolContent.tsx`): Two-tier lookup:
1. **Exact match map** — `MCP_RENDERERS: Map<string, Component>` keyed by canonical tool suffix (e.g., `"searchJiraIssuesUsingJql"`)
2. **Pattern match array** — `MCP_RENDERER_PATTERNS: Array<{ pattern: RegExp, component }>` using `[/_]+` character class to match both `__` (SDK) and `/` (ACP) separators

Tool name normalization: `extractMcpToolName(toolName)` strips the `"mcp__Server__"` or `"Tool: Server/"` prefix to get the base tool name for registry lookup.

**Data extraction**: `extractMcpData(toolResult)` handles both SDK and ACP response shapes:
- SDK: `toolResult.content` (string or `[{ type: "text", text }]` array)
- ACP: flat objects with `{ key, fields, renderedFields }` (no wrapper)
- Atlassian wraps Jira responses in `{ issues: { totalCount, nodes: [...] } }` — use `unwrapJiraIssues()` to normalize

**Adding a new MCP tool renderer**:
1. Create a component in `src/components/mcp-renderers/` that accepts `{ data: unknown }`
2. Register in `MCP_RENDERERS` (exact name) and/or `MCP_RENDERER_PATTERNS` (regex with `[/_]+`) in `McpToolContent.tsx`
3. Also add to `getMcpCompactSummary()` for collapsed tool card summaries

**Tool naming conventions**:
- SDK engine: `mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql`
- ACP engine: `Tool: Atlassian/searchJiraIssuesUsingJql`
- All regex patterns use `Atlassian[/_]+` to match both
- Label/formatting logic in `src/components/lib/tool-metadata.ts` (`getMcpToolLabel`, `MCP_TOOL_LABELS`) handles both prefixes
- Compact summaries in `src/components/lib/tool-formatting.ts` (`formatCompactSummary`)

**Text-based tools**: Some MCP tools (e.g., Context7) return plain text/markdown instead of JSON. `extractMcpText()` extracts the raw text, passed to renderers as `rawText` prop alongside `data` (which will be `null` for non-JSON responses). Text-based renderers should parse the `rawText` string themselves.

**Existing renderers** (in `src/components/mcp-renderers/`):
- `jira.tsx` — `JiraIssueList` (search), `JiraIssueDetail` (getJiraIssue/fetch), `JiraProjectList`, `JiraTransitions`
- `confluence.tsx` — `ConfluenceSearchResults`, `ConfluenceSpaces`
- `atlassian.tsx` — `RovoSearchResults`, `RovoFetchResult`, `AtlassianResourcesList`
- `context7.tsx` — `Context7LibraryList` (resolve-library-id), `Context7DocsResult` (query-docs)

## Reference Documentation

When working on engine-related code, always consult these local docs:

- **Claude Agent SDK (Anthropic engine)**: `docs/ai-sdk/` — covers `query()`, MCP config, permissions, streaming, session management, subagents, etc.
- **ACP TypeScript SDK**: `docs/typescript-sdk-main/` — the `@anthropic-ai/agent-client-protocol` package, ACP client/server types, transport
- **Agent Client Protocol spec**: `docs/agent-client-protocol-main/` — ACP protocol spec, schema definitions, event types

Always search the web when needed for up-to-date API references, Electron APIs, or third-party package docs.

## Release Conventions

**Title format**: `v{X.Y.Z} — Short descriptive phrase` (e.g., `v0.8.0 — Git Worktrees, ACP Utility Sessions & Streaming Polish`)

**Release notes format**:
- Start with `## What's New` (for feature releases) or `## Changes` (for smaller releases)
- Group changes under `### Emoji Section Title` headers (e.g., `### 🌳 Git Worktree Management`)
- Each bullet: **bold the feature name**, then describe what it does
- End with `---` separator and `**Full Changelog**: https://github.com/OpenSource03/harnss/compare/v{prev}...v{current}`
- Use `gh release create` with tag, then `gh release edit` to set title + notes

**Commit message format** (conventional commits):
- `feat: short description` — new features
- `fix: short description` — bug fixes
- `chore: short description` — maintenance (version bumps, dep updates, CI)
- First line: imperative, lowercase, no period, under ~72 chars
- Body (optional): blank line after subject, then explain **why** not what, wrap at ~80 chars
- Examples from repo: `feat: git worktree management, ACP utility sessions, and streaming UI overhaul`, `fix: build both mac arches in one job to prevent latest-mac.yml race`

**Version bumping**:
1. Check for latest `@anthropic-ai/claude-agent-sdk` version and update in `package.json` if newer
2. Bump `version` in `package.json` (electron-builder uses this, NOT the git tag)
3. Commit: `chore: bump version to X.Y.Z`
4. Tag: `git tag vX.Y.Z HEAD && git push origin vX.Y.Z`
5. Create release: `gh release create vX.Y.Z --title "..." --notes "..."`

## Shared Types Architecture

Types shared between electron and renderer live in `shared/types/`. Both tsconfigs include this directory via `@shared/*` path alias.

- **`shared/types/codex-protocol/`** — auto-generated from `codex app-server generate-ts`. Contains v1, v2, and serde_json type families. Used by both electron Codex handlers and renderer hooks.
- **`shared/types/codex.ts`** — re-exports with `Codex`-prefixed aliases (e.g., `CodexThreadItem`, `CodexSessionEvent`) plus Harnss-specific wrappers (`CodexApprovalRequest`, `CodexRequestUserInputRequest`).
- **`shared/types/engine.ts`** — `EngineId`, `AppPermissionBehavior`, `SessionMeta`, `EngineHookState`, `RespondPermissionFn`. Imports UI types from `../../src/types/ui`.
- **`shared/types/acp.ts`** — ACP session update discriminated union types.
- **`shared/types/registry.ts`** — agent registry types (`RegistryAgent`, `RegistryData`).

**Backward compatibility**: `src/types/` contains re-export shims (`export * from "../../shared/types/..."`) so existing `@/types/*` imports continue to work. New code can use either `@/types/` or `@shared/types/`.

**Key type naming**:
- `InstalledAgent` (was `AgentDefinition` — renamed to avoid SDK clash)
- `AppPermissionBehavior` (was `PermissionBehavior` — renamed to avoid SDK clash)
- `SessionBase` — shared base for `ChatSession` and `PersistedSession`
- `SessionMeta` — `{ isProcessing, isConnected, sessionInfo, totalCost }` snapshot for background store

**Electron SDK types**: `electron/src/lib/sdk.ts` imports `Query` and `query` types directly from `@anthropic-ai/claude-agent-sdk` (no more manual type definitions or double-casts). ACP connection is typed as `ClientSideConnection` from `@agentclientprotocol/sdk`.

### Shared Utilities

- **`src/lib/message-factory.ts`** — `createSystemMessage()`, `createUserMessage()`, `formatResultError()` — replaces 20+ inline UIMessage constructions
- **`src/lib/streaming-buffer.ts`** — `StreamingBuffer` (Claude) + `SimpleStreamingBuffer` (ACP/Codex, merged from two identical copies)
- **`src/lib/file-access.ts`** — pure data transformation for file access tracking (extracted from FilesPanel)
- **`src/lib/mcp-utils.ts`** — `toMcpStatusState()` (moved from types/ui.ts)
- **`src/lib/acp-utils.ts`** — `flattenConfigOptions()` (moved from types/acp.ts)
- **`electron/src/lib/error-utils.ts`** — `extractErrorMessage()` (replaces 3 duplicated implementations)

### Electron Session Handler Patterns

The three session IPC handlers share extracted utilities:
- **`createAcpConnection()`** — factory for ACP process spawn + ClientSideConnection setup (eliminates duplication between `acp:start` and `acp:revive-session`)
- **`setupCodexHandlers()`** — wires RPC handlers for Codex sessions (shared between `codex:start` and `codex:resume`)
- **`startEventLoop()`** — iterates SDK QueryHandle async generator with event forwarding (shared between `claude:start` and `restartSession`)
- **`oneShotSdkQuery()`** — fire-and-forget SDK query with timeout (shared between title gen and commit message gen)

## Coding Conventions

- **Tailwind v4** — no CSS resets, Preflight handles normalization
- **ShadCN UI** — use `@/components/ui/*` for base components
- **Path aliases** — `@/` for renderer src/, `@shared/` for shared types
- **Logical margins** — use `ms-*`/`me-*` instead of `ml-*`/`mr-*`
- **Text overflow** — use `wrap-break-word` on containers with user content
- **No `any`** — use proper types, never `as any`
- **No unsafe `as` casts** — use discriminated unions and type guards instead of `as Record<string, unknown>`
- **pnpm** — always use pnpm for package management
- **Memo optimization** — components use `React.memo` with custom comparators for performance
- **Component decomposition** — large components are split into focused sub-components in subdirectories (git/, tool-renderers/, mcp-renderers/, sidebar/)
- **Hook decomposition** — large hooks are split into focused sub-hooks (session/, useEngineBase)
- **Shared components** — reusable UI patterns extracted to shared components (`TabBar`, `PanelHeader`, `SettingRow`)