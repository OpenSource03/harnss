<p align="center">
  <img src=".github/banner.png" alt="OpenACP UI" />
</p>

<p align="center">
  <a href="https://github.com/OpenSource03/openacpui/releases"><img alt="Latest Release" src="https://img.shields.io/github/v/release/OpenSource03/openacpui?style=flat-square&color=blue" /></a>
  <img alt="Platform" src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-brightgreen?style=flat-square" />
  <img alt="Electron" src="https://img.shields.io/badge/electron-40-47848F?style=flat-square&logo=electron&logoColor=white" />
  <img alt="License" src="https://img.shields.io/github/license/OpenSource03/openacpui?style=flat-square" />
  <a href="https://github.com/OpenSource03/openacpui/actions"><img alt="Build" src="https://img.shields.io/github/actions/workflow/status/OpenSource03/openacpui/build.yml?style=flat-square&label=build" /></a>
</p>

---

> [!WARNING]
> This project is in active development. Expect bugs, breaking changes, and missing features. Documentation is not available yet — check back soon.

Stop juggling terminals. OpenACP UI is a native desktop app that puts your AI coding agents, tools, and context in one window — with a UI that actually helps you work.

## Features

**Run multiple agents side by side** — Claude Code, ACP agents, and any compatible backend. Each session runs independently with its own state, history, and context. Switch between them instantly.

**See what tools are doing** — Every tool call renders as a rich interactive card. File edits show word-level diffs with syntax highlighting. Bash output appears inline. Subagent tasks nest with step-by-step progress tracking.

**Connect any MCP server** — Plug in external tools via the Model Context Protocol. Jira issues, Confluence pages, and other integrations render with dedicated UIs — not raw JSON. OAuth flows handled automatically.

**Built-in terminal and browser** — Full PTY terminal with multiple tabs right next to your chat. Open web pages in an embedded browser without switching windows.

**Project workspaces** — Each project maps to a folder on disk. Sessions, history, and settings stay organized per project. Git status, staging, commits, and branches built into the sidebar.

**Thinking mode** — Watch Claude reason through problems in collapsible thinking blocks before it acts.

**Glass UI on macOS** — Native liquid glass transparency on macOS Tahoe+. Looks sharp on every other platform too.

## Supported Agents

OpenACP UI works with any CLI that speaks the [Agent Client Protocol](https://agentclientprotocol.com). Each agent needs to be installed and authenticated separately. See the full [ACP Agent Registry](https://agentclientprotocol.com/get-started/registry) for all supported agents.

| Agent | Command | Notes |
|-------|---------|-------|
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `npx @zed-industries/claude-code-acp` | Native support, permission modes |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `gemini --experimental-acp` | Experimental ACP flag |
| [Codex CLI](https://github.com/openai/codex) | `codex acp` | Requires `OPENAI_API_KEY` |
| [Goose](https://github.com/block/goose) | `goose acp` | |
| [Docker cagent](https://github.com/docker/cagent) | `cagent acp agent.yml` | Container-based agents |

### Adding an agent

Agents are configured in `agents.json` at your app data directory. Each entry defines the command, args, and environment:

```json
{
  "Claude Code": {
    "command": "npx",
    "args": ["@zed-industries/claude-code-acp"],
    "env": { "ACP_PERMISSION_MODE": "acceptEdits" }
  }
}
```

You can also add agents directly from the app sidebar.

## Install

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | [`.dmg` (arm64)](https://github.com/OpenSource03/openacpui/releases/latest) |
| macOS (Intel) | [`.dmg` (x64)](https://github.com/OpenSource03/openacpui/releases/latest) |
| Windows | [`.exe` installer](https://github.com/OpenSource03/openacpui/releases/latest) |
| Linux | [`.AppImage`](https://github.com/OpenSource03/openacpui/releases/latest) / [`.deb`](https://github.com/OpenSource03/openacpui/releases/latest) |

## Development

```bash
git clone https://github.com/OpenSource03/openacpui.git
cd openacpui
pnpm install
pnpm dev
```

### Build installers

```bash
pnpm dist:mac      # macOS DMG (arm64 + x64)
pnpm dist:win      # Windows NSIS installer
pnpm dist:linux    # Linux AppImage + deb
```

## Contributing

1. Fork the repo and create a feature branch
2. Follow the conventions in `CLAUDE.md`
3. Test with `pnpm dev`
4. Open a pull request

## License

MIT

---

<p align="center">
  Built on the <a href="https://agentclientprotocol.com">Agent Client Protocol</a>
</p>
