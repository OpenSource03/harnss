# Code Reviewer Memory - OpenACP UI

## Architecture Patterns

### Background Session Store
- `BackgroundSessionStore` mirrors `useClaude`/`useACP` event processing for non-active sessions
- Located: `src/lib/background-session-store.ts`
- Known gap: ACP `turn_complete` not handled (see review 2026-02-18)
- Known gap: ACP `closePendingTools` behavior not mirrored (review 2026-02-18)
- Known gap: `system` event subtypes (status, compact_boundary) not distinguished from init
- Pattern: `initFromState` / `consume` lifecycle uses shared references, not clones

### Streaming Buffers
- Two parallel implementations: `StreamingBuffer` (Claude SDK) and `ACPStreamingBuffer` (ACP)
- Both have public mutable fields (`messageId`, `thinkingComplete`) -- design debt
- `StreamingBuffer` uses Map<index, string> for block tracking; ACP version is simpler (string[] chunks)
- rAF flush pattern used by both `useClaude` and `useACP` hooks

### ACP Adapter (`src/lib/acp-adapter.ts`)
- `deriveToolName` maps ACP `kind` to SDK-equivalent tool names
- `delete` kind maps to `Write` (potentially confusing, may be intentional for renderer reuse)
- `normalizeToolInput` missing null check (`typeof null === "object"`)
- `normalizeToolResult` uses `as` cast for content items -- should use type guard

### Protocol Helpers (`src/lib/protocol.ts`)
- `normalizeToolResult` can produce `[object Object]` on unexpected input shapes
- `extractTextContent`/`extractThinkingContent` iterate same array separately
- `getParentId` uses `in` operator check -- clean pattern for optional field access

## Type Patterns
- `ClaudeEvent` is discriminated union on `type` field
- `system` events have sub-discrimination on `subtype` (init/status/compact_boundary)
- `ToolUseResult` has index signature `[key: string]: unknown` -- very permissive
- ACP types in `src/types/acp.ts` use `sessionUpdate` as discriminator

## Common Issues Found
- `as` casts in adapter code for `Record<string, unknown>` -- prefer runtime narrowing
- `Date.now()` used for message IDs in tight loops -- collision risk
- Background store doesn't clone arrays on capture/consume -- shared reference risk
- ACP background handling incomplete vs live hook handling (missing turn_complete, closePendingTools, thinkingComplete, already-completed tools)
