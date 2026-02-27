# Plan: Add Codex App-Server as First-Class Engine + Plugin Architecture Refactor

## Context

OpenACP UI currently supports two engines: **Claude** (via `@anthropic-ai/claude-agent-sdk`) and **ACP** (generic Agent Client Protocol agents). The codebase uses a boolean `isACP` dispatch pattern that doesn't scale to a third engine. We're adding **OpenAI Codex** as a third first-class engine via its `app-server` JSON-RPC protocol, and simultaneously refactoring the engine system into a proper plugin architecture so future engines are trivial to add.

**Key decisions made:**
- Auto-download `codex` binary via npm `@openai/codex` on first use (stored in app data dir)
- Generate TypeScript types via `codex app-server generate-ts` into our project for type safety
- Full plugin architecture where engines register themselves as self-contained modules
- Auth dialog on first use (API key or ChatGPT OAuth)
- Dual persistence: our UIMessage format + Codex's native `thread/resume`

---

## Phase 0: Engine Plugin Architecture

**Goal:** Replace the `isACP` boolean dispatch with a plugin system. Each engine becomes a self-contained module that registers its IPC handlers, renderer hook, and UI components.

### 0.1 Define the Engine Plugin Interface

**New file: `src/types/engine.ts`**

```typescript
export type EngineId = "claude" | "acp" | "codex";

/** What every engine hook must return — the contract between engine and session manager */
export interface EngineHookState {
  messages: UIMessage[];
  setMessages: Dispatch<SetStateAction<UIMessage[]>>;
  isProcessing: boolean;
  setIsProcessing: Dispatch<SetStateAction<boolean>>;
  isConnected: boolean;
  setIsConnected: Dispatch<SetStateAction<boolean>>;
  sessionInfo: SessionInfo | null;
  setSessionInfo: Dispatch<SetStateAction<SessionInfo | null>>;
  totalCost: number;
  setTotalCost: Dispatch<SetStateAction<number>>;
  contextUsage: ContextUsage | null;
  isCompacting: boolean;
  pendingPermission: PermissionRequest | null;
  respondPermission: (behavior: string, ...args: unknown[]) => Promise<void>;
}
```

### 0.2 Expand Engine Type Across Codebase

**Files to modify:**
- `src/types/ui.ts` — `ChatSession.engine`, `PersistedSession.engine`, `StartOptions.engine`: change `"claude" | "acp"` → `EngineId`
- `electron/src/lib/agent-registry.ts` — `AgentDefinition.engine`: same change + add built-in Codex agent
- `src/types/window.d.ts` — all engine type refs

### 0.3 Refactor useSessionManager Engine Dispatch

**File: `src/hooks/useSessionManager.ts`**

Replace:
```typescript
const isACP = activeEngine === "acp";
const engine = isACP ? acp : claude;
```

With engine-enum dispatch:
```typescript
const activeEngine: EngineId = ...;
const claudeId = activeEngine === "claude" ? activeSessionId : null;
const acpId = activeEngine === "acp" ? activeSessionId : null;
const codexId = activeEngine === "codex" ? activeSessionId : null;

const claude = useClaude({ sessionId: claudeId, ... });
const acp = useACP({ sessionId: acpId, ... });
const codex = useCodex({ sessionId: codexId, ... });

const engineMap: Record<EngineId, EngineHookState> = { claude, acp, codex };
const engine = engineMap[activeEngine];
```

Every `if (isACP)` becomes a switch on `activeEngine`. Key locations (~20 sites):
- `createSession` (eager start logic)
- `materializeDraft` (start call)
- `send` (message dispatch)
- `deleteSession` (stop call)
- `reviveSession` (revival logic)
- `setActiveModel` / `setActivePermissionMode`
- Background event routing (useEffect listeners)
- Queue drain effect
- Return values (`compact`, `mcpServerStatuses`, etc.)

### 0.4 Refactor Background Session Store

**File: `src/lib/background-session-store.ts`**

Currently has `handleEvent()` (Claude) and `handleACPEvent()` (ACP). Add `handleCodexEvent()` following the same pattern. Consider a shared `handleEngineEvent(engine, event)` dispatcher if the patterns converge enough.

---

## Phase 1: Codex Binary Management

### 1.1 Auto-Download Module

**New file: `electron/src/lib/codex-binary.ts`**

Resolves the `codex` binary, downloading via npm if not found:

1. **Search order:** `CODEX_CLI_PATH` env var → app data dir (`{userData}/openacpui-data/bin/codex`) → system PATH (`which codex`) → known paths (`/opt/homebrew/bin/codex`, `/Applications/Codex.app/Contents/Resources/codex`)
2. **Auto-download:** If not found anywhere, download `@openai/codex` via npm to a temp dir, extract the platform-specific binary, move to `{userData}/openacpui-data/bin/codex`
3. **Version check:** Cache version, periodically check npm for updates
4. **Platform tags:** `@openai/codex` publishes platform dist-tags: `darwin-arm64`, `darwin-x64`, `linux-arm64`, `linux-x64`, `win32-x64`, `win32-arm64`

```
npm pack @openai/codex@latest-darwin-arm64 → extract bin/codex → move to app data
```

Expose: `getCodexBinaryPath(): Promise<string>` (async — may need to download), `isCodexInstalled(): boolean` (sync check).

### 1.2 Register Built-in Codex Agent

**File: `electron/src/lib/agent-registry.ts`**

```typescript
const BUILTIN_CODEX: AgentDefinition = {
  id: "codex",
  name: "Codex",
  engine: "codex",
  builtIn: true,
  icon: "zap", // or custom codex icon
};
agents.set(BUILTIN_CODEX.id, BUILTIN_CODEX);
```

Update `saveAgent` validation: Codex agents don't need `binary` (auto-resolved).

---

## Phase 2: Generated TypeScript Types

### 2.1 Generate and Commit Protocol Types

**New directory: `src/types/codex-protocol/`**

Run `codex app-server generate-ts --out src/types/codex-protocol/` to generate the full protocol schema. These are auto-generated `.ts` files with 100+ types covering every message, notification, and item type.

Key types we'll use:
- `ServerNotification` — discriminated union of all server notifications
- `ServerRequest` — server-initiated requests (approvals)
- `ClientRequest` — all requests we can send
- `v2/ThreadItem` — all item types (agentMessage, commandExecution, fileChange, etc.)
- `v2/TurnStartParams`, `v2/ThreadStartParams` — request params
- `v2/CommandExecutionRequestApprovalParams`, `v2/FileChangeRequestApprovalParams` — approval types
- `InitializeParams`, `InitializeResponse` — handshake types

These types are committed to the repo. To regenerate after a Codex update: `codex app-server generate-ts --out src/types/codex-protocol/`

### 2.2 Re-export Convenience Types

**New file: `src/types/codex.ts`**

Thin re-export layer with convenience aliases and our own additions (e.g., `CodexSessionEvent` wrapper with `_sessionId` tag).

---

## Phase 3: Main Process — Codex IPC Handler

### 3.1 JSON-RPC Transport Layer

**New file: `electron/src/lib/codex-rpc.ts`**

Lightweight JSON-RPC 2.0 client over stdio (JSONL):

- `send(method, params)` → returns `Promise<result>` (tracks by request `id`)
- `notify(method, params)` → fire-and-forget (no `id`)
- `respondToServer(id, result)` → respond to server-initiated requests
- `onNotification` callback — for `item/*`, `turn/*`, `thread/*`, etc.
- `onServerRequest` callback — for `item/commandExecution/requestApproval`, `item/fileChange/requestApproval`
- Line framing: split on `\n`, parse JSON, dispatch by message shape (response vs notification vs server-request)
- Request timeout with configurable ms

Uses the generated types from Phase 2 for type-safe message construction.

### 3.2 Codex Sessions IPC Module

**New file: `electron/src/ipc/codex-sessions.ts`**

Pattern follows `acp-sessions.ts`. Session state per connection:

```typescript
interface CodexSession {
  rpc: CodexRpcClient;
  process: ChildProcess;
  internalId: string;
  threadId: string | null;
  eventCounter: number;
  pendingApprovals: Map<number, { resolve: (decision: unknown) => void }>;
  model?: string;
  cwd: string;
}
const codexSessions = new Map<string, CodexSession>();
```

**IPC channels registered:**

| Channel | Action |
|---------|--------|
| `codex:start(options)` | Spawn binary, `initialize` + `initialized` handshake, `account/read` auth check, `model/list`, `thread/start` |
| `codex:send({ sessionId, text, images })` | `turn/start` with user input |
| `codex:stop(sessionId)` | Kill process, clean up |
| `codex:interrupt({ sessionId, threadId, turnId })` | `turn/interrupt` |
| `codex:approval_response({ sessionId, rpcId, decision })` | Respond to server-initiated approval request |
| `codex:compact(sessionId)` | `thread/compact/start` |
| `codex:list-models()` | `model/list` |
| `codex:auth-status()` | `account/read` |
| `codex:login(options)` | `account/login/start` |
| `codex:resume({ sessionId, threadId })` | Spawn new process, `initialize`, `thread/resume` |
| `codex:set-model({ sessionId, model })` | Model override on next `turn/start` |

**Event forwarding:** Notifications → `codex:event` IPC channel. Server requests → `codex:approval_request` channel. Process exit → `codex:exit` channel.

**Lifecycle on `codex:start`:**
1. Resolve binary via `getCodexBinaryPath()` (may download)
2. `spawn(codexPath, ["app-server"], { stdio: ["pipe", "pipe", "pipe"] })`
3. Create `CodexRpcClient` on the process
4. `rpc.send("initialize", { clientInfo: { name: "openacpui", title: "OpenACP UI", version: pkg.version }, capabilities: { experimentalApi: true } })`
5. `rpc.notify("initialized", {})`
6. `rpc.send("account/read", { refreshToken: false })` → check auth state
7. If not authenticated, send `codex:auth_required` event to renderer, await auth completion
8. `rpc.send("model/list", { includeHidden: false })` → available models
9. `rpc.send("thread/start", { model, cwd, approvalPolicy, personality })` → get threadId
10. Start forwarding notifications to renderer

### 3.3 Register in Main Process

**File: `electron/src/main.ts`**

```typescript
import * as codexSessionsIpc from "./ipc/codex-sessions";
codexSessionsIpc.register(getMainWindow);
```

---

## Phase 4: Preload Bridge

### 4.1 Add Codex Namespace

**File: `electron/src/preload.ts`**

Add `codex` under the existing `window.claude` namespace, same pattern as `acp`:

```typescript
codex: {
  start, send, stop, interrupt, respondApproval, compact,
  listModels, authStatus, login, resume, setModel,
  onEvent, onApprovalRequest, onExit,
}
```

### 4.2 Update Window Types

**File: `src/types/window.d.ts`**

Add `codex` sub-namespace type declarations under `Window["claude"]`.

---

## Phase 5: Codex Event Adapter

### 5.1 Notification → UIMessage Translation

**New file: `src/lib/codex-adapter.ts`**

Translates Codex server notifications into our `UIMessage` format.

**Key mappings:**

| Codex Notification | UIMessage | Notes |
|---|---|---|
| `item/started` (agentMessage) | `assistant` role | Create streaming message |
| `item/agentMessage/delta` | Append to streaming buffer | rAF flush to React state |
| `item/completed` (agentMessage) | Finalize assistant message | |
| `item/started` (commandExecution) | `tool_call`, toolName=`"Bash"` | `toolInput = { command }` |
| `item/commandExecution/outputDelta` | Update tool_call output | Live streaming output |
| `item/completed` (commandExecution) | Finalize tool_call | `toolResult` with stdout/exitCode |
| `item/started` (fileChange) | `tool_call`, toolName=`"Edit"` or `"Write"` | Map from change kind |
| `item/fileChange/outputDelta` | Update tool_call | |
| `item/completed` (fileChange) | Finalize tool_call | `toolResult` with diff |
| `item/started` (mcpToolCall) | `tool_call`, toolName=`"mcp__{server}__{tool}"` | Reuse MCP renderer system |
| `item/started` (reasoning) | Thinking block on streaming message | |
| `item/reasoning/summaryTextDelta` | Append to thinking text | |
| `item/started` (webSearch) | `tool_call`, toolName=`"WebSearch"` | |
| `item/started` (contextCompaction) | `summary` role | Compaction marker |
| `turn/started` | Set isProcessing=true | |
| `turn/completed` | Finalize all, isProcessing=false | |
| `turn/plan/updated` | Todo items | Map plan steps to TodoItem[] |
| `thread/tokenUsage/updated` | ContextUsage | Map token counts |
| `error` | Error message display | |

**Approval policy mapping:**

| Codex `approvalPolicy` | UI Display | Closest Claude Equivalent |
|---|---|---|
| `"onRequest"` | "Ask First" | `default` |
| `"unlessTrusted"` | "Accept Trusted" | `acceptEdits` |
| `"never"` | "Allow All" | `bypassPermissions` |

---

## Phase 6: Renderer Hook

### 6.1 useCodex Hook

**New file: `src/hooks/useCodex.ts`**

Same return shape as `useClaude`/`useACP` (implements `EngineHookState`). Key internals:

- **State:** messages, isProcessing, isConnected, sessionInfo, totalCost, contextUsage, isCompacting, pendingPermission, codexModels
- **Refs:** StreamingBuffer (reuse pattern from useACP), itemMap (Codex itemId → UIMessage id), codexApprovalRef (pending server request id)
- **Event listeners:** `window.claude.codex.onEvent`, `onApprovalRequest`, `onExit`
- **Notification dispatch:** Switch on `event.method` → call appropriate handler
- **rAF streaming flush:** Same pattern as useClaude/useACP — accumulate deltas in refs, flush to React state at 60fps
- **Approval handling:** Convert `CommandExecutionRequestApprovalParams`/`FileChangeRequestApprovalParams` to common `PermissionRequest` format. On response, call `window.claude.codex.respondApproval()`.
- **Codex-specific:** `codexModels` state from `model/list`, `authRequired` state for auth dialog trigger

---

## Phase 7: Session Manager Integration

**File: `src/hooks/useSessionManager.ts`**

Major changes (building on Phase 0.3 refactoring):

1. **Hook instantiation:** Add `const codex = useCodex({ sessionId: codexId, ... })`
2. **Background event routing:** Add `codex:event`, `codex:approval_request`, `codex:exit` listeners in the useEffect for background sessions
3. **`createSession`:** When engine=`"codex"`, no eager start (needs auth check first)
4. **`materializeDraft`:** Add codex branch — call `window.claude.codex.start()`, handle `auth_required` by showing auth dialog
5. **`send`:** Add codex branch — call `window.claude.codex.send()` or `reviveCodexSession()`
6. **`reviveCodexSession`:** New function — spawn new process, call `thread/resume` with stored `codexThreadId`
7. **`deleteSession`:** Call `window.claude.codex.stop()` for codex sessions
8. **`setActiveModel`:** For codex, call `window.claude.codex.setModel()`
9. **`compact`:** For codex, call `window.claude.codex.compact()`
10. **Session persistence:** Store `codexThreadId` in `PersistedSession` for revival

---

## Phase 8: UI Components

### 8.1 ToolCall.tsx — Minimal Changes

Codex items map to existing tool names (`Bash`, `Edit`, `Write`, `WebSearch`), so existing renderers work. Changes:
- Ensure `commandExecution` output streaming displays properly (live terminal-like output for Bash tool cards)
- Codex `fileChange` diffs render via existing `DiffViewer`

### 8.2 PermissionPrompt.tsx — Add "Accept for Session"

Codex offers `acceptForSession` as an approval decision. Conditionally show a third button when engine=`"codex"`:
```
[Allow] [Allow for Session] [Deny]
```

### 8.3 InputBar.tsx — Codex Controls

- Add Codex approval policy dropdown (when engine=`"codex"`): "Ask First" / "Accept Trusted" / "Allow All"
- Model dropdown: populated from `model/list` response (stored in useCodex state)
- Reasoning effort dropdown if model supports it

### 8.4 ChatHeader.tsx — Codex Display

- Show Codex model name and approval policy label
- Token usage from `thread/tokenUsage/updated`

### 8.5 Auth Dialog

**New file: `src/components/CodexAuthDialog.tsx`**

Modal shown when Codex session requires authentication:
- **API Key tab:** Text input for OpenAI API key, "Connect" button
- **ChatGPT Login tab:** "Login with ChatGPT" button → opens browser (Codex provides OAuth URL), shows "Waiting for login..." state
- Triggered from session manager when `codex:auth_required` event received
- On success: `account/login/completed` notification → dismiss dialog, continue session start

### 8.6 Agent Settings

**File: `src/components/settings/AgentSettings.tsx`**

- Show Codex built-in agent card (like Claude's)
- Show auth status for Codex (authenticated or not)
- Show binary version / download status

### 8.7 AppSidebar.tsx

- Codex sessions show Codex icon in sidebar
- Already works via `session.engine` + agent icon mapping

---

## Phase 9: Persistence

### 9.1 Dual Persistence Strategy

**Our format:** Save `UIMessage[]` to `sessions/{projectId}/{id}.json` (for sidebar, search, offline viewing). Same as Claude/ACP.

**Codex format:** Codex stores threads as JSONL on disk. `thread/resume` restores server-side context. Store `codexThreadId` in our `PersistedSession`.

**Revival flow:**
1. Spawn new `codex app-server` process
2. `initialize` + `initialized` handshake
3. `thread/resume` with stored threadId → Codex restores full context
4. Our `initialMessages` from disk restore the UI immediately
5. New events from resumed thread append to UI

**File: `src/types/ui.ts`** — Add to PersistedSession:
```typescript
codexThreadId?: string; // For thread/resume on revival
```

---

## Phase 10: Title Generation

**File: `electron/src/ipc/title-gen.ts`**

For Codex sessions, use the existing Claude Haiku path for title generation (simplest — titles don't need Codex). Alternative: start a utility Codex thread with a title-gen prompt to a fast model, similar to ACP utility sessions.

---

## File Summary

### New Files (10)
| File | Purpose |
|---|---|
| `src/types/engine.ts` | Engine plugin interface + EngineId type |
| `src/types/codex.ts` | Codex-specific type re-exports + wrappers |
| `src/types/codex-protocol/` | Auto-generated protocol types (100+ files via `codex app-server generate-ts`) |
| `electron/src/lib/codex-binary.ts` | Binary resolution + auto-download |
| `electron/src/lib/codex-rpc.ts` | JSON-RPC 2.0 stdio transport client |
| `electron/src/ipc/codex-sessions.ts` | Main process IPC handler (start/send/stop/etc.) |
| `src/lib/codex-adapter.ts` | Notification → UIMessage translation |
| `src/hooks/useCodex.ts` | Renderer hook (state + event handling) |
| `src/components/CodexAuthDialog.tsx` | Auth dialog (API key / ChatGPT OAuth) |

### Modified Files (~15)
| File | Changes |
|---|---|
| `src/types/ui.ts` | Engine type expansion, `codexThreadId` on PersistedSession |
| `src/types/window.d.ts` | Add `codex` sub-namespace types |
| `electron/src/lib/agent-registry.ts` | Engine type expansion, built-in Codex agent |
| `electron/src/preload.ts` | Add `codex` to contextBridge |
| `electron/src/main.ts` | Register codex-sessions IPC |
| `src/hooks/useSessionManager.ts` | Tri-engine dispatch (largest change) |
| `src/lib/background-session-store.ts` | Add `handleCodexEvent` |
| `src/components/ToolCall.tsx` | Minor: Codex output streaming |
| `src/components/PermissionPrompt.tsx` | Add "Accept for Session" for Codex |
| `src/components/InputBar.tsx` | Codex approval policy + model dropdowns |
| `src/components/ChatHeader.tsx` | Codex model/policy display |
| `src/components/AppLayout.tsx` | Engine dispatch updates |
| `src/components/settings/AgentSettings.tsx` | Codex agent card + auth status |
| `electron/src/ipc/title-gen.ts` | Codex title generation branch |

---

## Implementation Order

```
Phase 0  ─── Engine plugin architecture refactor (types + session manager)
  │
Phase 1  ─── Binary management (codex-binary.ts)
Phase 2  ─── Generate + commit protocol types (codex app-server generate-ts)
  │         (Phases 1-2 can be done in parallel with Phase 0)
  │
Phase 3  ─── Main process IPC (codex-rpc.ts + codex-sessions.ts)
Phase 4  ─── Preload bridge (preload.ts + window.d.ts)
  │         (Phases 3-4 are sequential)
  │
Phase 5  ─── Event adapter (codex-adapter.ts)
Phase 6  ─── Renderer hook (useCodex.ts)
  │         (Phases 5-6 can be parallel)
  │
Phase 7  ─── Session manager integration (depends on Phase 0 + 6)
Phase 8  ─── UI components (depends on Phase 7)
Phase 9  ─── Persistence (depends on Phase 7)
Phase 10 ─── Title generation (low priority, can be last)
```

---

## Verification

1. **Binary resolution:** Start app → select Codex agent → verify binary downloads if not found → verify version logged
2. **Auth flow:** Start Codex session without auth → verify auth dialog appears → enter API key → verify `account/login/completed` → session proceeds
3. **Basic chat:** Send a message → verify `turn/start` sent → verify `item/agentMessage/delta` streams → verify message appears in UI with streaming animation
4. **Tool approvals:** Have Codex run a command → verify `item/commandExecution/requestApproval` shows permission prompt → approve → verify command output streams → verify `item/completed` finalizes
5. **File edits:** Have Codex edit a file → verify `item/fileChange/requestApproval` shows → approve → verify diff renders in DiffViewer
6. **Session persistence:** Close and reopen a Codex session → verify messages load from disk → verify `thread/resume` restores context → verify new messages work
7. **Session switching:** Switch between Claude and Codex sessions → verify background store accumulates events → verify switching back restores state
8. **Model selection:** Change model in Codex session → verify next turn uses new model
9. **Context compaction:** Trigger `thread/compact/start` → verify compaction indicator shows
10. **Interrupt:** Interrupt a running Codex turn → verify `turn/interrupt` sent → verify `turn/completed` with `status: "interrupted"`
