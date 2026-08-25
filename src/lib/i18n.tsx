import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Language = "en" | "zh";

const LANGUAGE_STORAGE_KEY = "harnss-language";
const SOURCE_TEXT_BY_NODE = new WeakMap<Text, string>();
const SOURCE_ATTRIBUTE_BY_ELEMENT = new WeakMap<Element, Map<string, string>>();

const TRANSLATIONS: Record<string, string> = {
  Settings: "设置",
  "Add project": "添加项目",
  "Add a project to get started": "添加一个项目开始使用",
  "No projects in this space": "此空间中没有项目",
  "Harnss is in early beta": "Harnss 处于早期测试阶段",
  "Report a bug": "报告问题",
  "Search chats...": "搜索聊天记录…",
  Searching: "搜索中",
  "No results found": "未找到结果",
  Chats: "聊天",
  Messages: "消息",
  Today: "今天",
  Yesterday: "昨天",
  "Last 7 Days": "最近 7 天",
  Older: "更早",
  "New Chat": "新聊天",
  "Create Space": "创建空间",
  "New space": "新建空间",
  Edit: "编辑",
  "Delete Space": "删除空间",
  "Projects in this space will be moved to General.": "此空间中的项目将移至“常规”。",
  "Are you sure you want to delete": "确定要删除",
  Delete: "删除",
  Cancel: "取消",
  General: "常规",
  Appearance: "外观",
  Notifications: "通知",
  Analytics: "分析",
  "ACP Agents": "ACP 代理",
  "MCP Servers": "MCP 服务器",
  Engines: "引擎",
  Skills: "技能",
  Agents: "代理",
  Advanced: "高级",
  About: "关于",
  Soon: "即将推出",
  "Application-wide preferences": "应用级偏好设置",
  Updates: "更新",
  "Include pre-release updates": "包含预发布更新",
  "Receive beta versions with the latest features. Disable to only get stable releases.": "接收包含最新功能的测试版本。关闭后仅接收稳定版本。",
  Sidebar: "侧边栏",
  "Recent chats per project": "每个项目显示的最近聊天数",
  "Number of chats shown by default in each project. Click 'Show more' in the sidebar to load additional chats.": "每个项目默认显示的聊天数量。点击侧边栏中的“显示更多”以加载其他聊天。",
  Editor: "编辑器",
  "Default editor": "默认编辑器",
  "Choose which editor opens when you click 'Open in Editor'. Auto tries Cursor, VS Code, then Zed.": "选择点击“在编辑器中打开”时使用的编辑器。自动模式会依次尝试 Cursor、VS Code 和 Zed。",
  "Voice Dictation": "语音听写",
  "Dictation mode": "听写模式",
  "Native uses your OS dictation (macOS only). Whisper runs a local AI model for speech-to-text on all platforms (~40 MB download on first use).": "原生模式使用操作系统听写（仅限 macOS）。Whisper 在本地运行 AI 语音转文字模型（首次使用约下载 40 MB）。",
  "Customize the look and feel of the interface": "自定义界面的外观和体验",
  Theme: "主题",
  "Color theme": "颜色主题",
  "Choose between light and dark appearance, or follow your system setting.": "选择浅色或深色外观，也可以跟随系统设置。",
  Dark: "深色",
  Light: "浅色",
  System: "系统",
  Tools: "工具",
  "Auto-group tools": "自动分组工具",
  "Collapse consecutive tool calls into a single group. Disable to keep every tool call and in-between thinking row visible on its own.": "将连续的工具调用折叠为一个分组。关闭后，每个工具调用和其中的思考行都会单独显示。",
  "Avoid grouping edits": "不分组编辑操作",
  "Treat Edit and Write tool calls as standalone rows, even when auto-grouping is enabled. Reads before and after an edit will form separate groups.": "即使启用了自动分组，也将 Edit 和 Write 工具调用单独显示。编辑前后的读取操作会形成独立分组。",
  "Auto-expand tool results": "自动展开工具结果",
  "Temporarily expand completed tool calls, then collapse them again after a short delay. Disable to keep tool rows stable unless you open them yourself.": "暂时展开已完成的工具调用，短暂延迟后再次折叠。关闭后，除非手动打开，否则工具行保持稳定。",
  Layout: "布局",
  "Window layout": "窗口布局",
  "Choose how panels are arranged in the window.": "选择窗口中面板的排列方式。",
  Islands: "岛式",
  Flat: "平面",
  "Colored sidebar icons": "彩色侧边栏图标",
  "Tint tool picker and panel header icons with per-tool colors. Disable for neutral monochrome icons.": "使用各工具的颜色为工具选择器和面板标题图标着色。关闭后使用中性的单色图标。",
  Transparency: "透明度",
  "Window transparency": "窗口透明度",
  "Allow the desktop to show through the window background. Uses Liquid Glass on macOS or Mica on Windows.": "允许透过窗口背景显示桌面。macOS 使用 Liquid Glass，Windows 使用 Mica。",
  "Window transparency is not available on this platform.": "此平台不支持窗口透明度。",
  Model: "模型",
  Plan: "计划",
  Permissions: "权限",
  Cost: "费用",
  Session: "会话",
  "Ask Before Edits": "编辑前询问",
  "Accept Edits": "接受编辑",
  "Allow All": "全部允许",
  "Auto Accept": "自动接受",
  Ask: "询问",
  "Language: English": "语言：英语",
  "Switch to Chinese": "切换到中文",
  "Language: Chinese": "语言：中文",
  "Switch to English": "切换到英语",
  Language: "语言",
  "Interface language": "界面语言",
  "Choose the language used for Harnss interface labels and settings.": "选择 Harnss 界面标签和设置所使用的语言。",
  English: "英语",
  Chinese: "中文",
  Auto: "自动",
  "Native (OS)": "原生（系统）",
  "Whisper (Local AI)": "Whisper（本地 AI）",
  Hue: "色相",
  Intensity: "强度",
  Gradient: "渐变",
  "Gradient Hue": "渐变色相",
  Preview: "预览",
  Opacity: "不透明度",
  Local: "本地",
  Remote: "远程",
  "No matching branches": "没有匹配的分支",
  "Commit message…": "提交信息…",
  Generate: "生成",
  "AI commit message": "AI 提交信息",
  "Respects CLAUDE.md rules": "遵循 CLAUDE.md 规则",
  Commit: "提交",
  Fetch: "获取",
  Pull: "拉取",
  Push: "推送",
  Staged: "已暂存",
  Changes: "更改",
  Untracked: "未跟踪",
  "Working tree clean": "工作树干净",
  Commits: "提交记录",
  "Source Control": "源代码管理",
  "No project open": "没有打开项目",
  "Refresh All": "全部刷新",
  "Agent Worktree": "代理工作树",
  "Create Worktree": "创建工作树",
  "Remove Worktree": "移除工作树",
  "Scanning repositories...": "正在扫描仓库…",
  "No git repos found": "未找到 Git 仓库",
  "Source Repository": "源仓库",
  Branch: "分支",
  "Worktree Path": "工作树路径",
  "From Ref (optional)": "基准引用（可选）",
  Repository: "仓库",
  Worktree: "工作树",
  Discard: "丢弃",
  Stage: "暂存",
  Unstage: "取消暂存",
  "Stage All": "全部暂存",
  "Unstage All": "全部取消暂存",
  Color: "颜色",
  Custom: "自定义",
  "Stroke width": "描边宽度",
  Undo: "撤销",
  Redo: "重做",
  "Bottom panel": "底部面板",
  "Open in Editor": "在编辑器中打开",
  "Right-click for options": "右键查看选项",
  "No accessible resources": "没有可访问的资源",
  "No libraries found": "未找到库",
  "No documentation found": "未找到文档",
  "No spaces found": "未找到空间",
  "No descendants found": "未找到子页面",
  "No pages found": "未找到页面",
  "No issues found": "未找到问题",
  "No projects found": "未找到项目",
  "No transitions available": "没有可用的流转",
  Description: "描述",
  "Image preview": "图片预览",
  Queued: "已排队",
  "Send next": "发送下一条",
  Unqueue: "取消排队",
  "Revert to here": "恢复到此处",
  "Revert files only": "仅恢复文件",
  "Revert files + chat": "恢复文件和聊天",
  "Open in editor": "在编辑器中打开",
  "Content truncated": "内容已截断",
  "No matches": "没有匹配项",
  "Web search": "网页搜索",
  "Open Files": "打开的文件",
  Tasks: "任务",
  "Background Agents": "后台代理",
  Terminal: "终端",
  Browser: "浏览器",
  "Project Files": "项目文件",
  "New Terminal": "新建终端",
  "Restoring terminals...": "正在恢复终端…",
  "Refresh files": "刷新文件",
  "No project selected": "未选择项目",
  "No files found": "未找到文件",
  "Open a project to manage MCP servers": "打开项目以管理 MCP 服务器",
  "Refresh status": "刷新状态",
  "No MCP servers": "没有 MCP 服务器",
  Authenticated: "已认证",
  "Token expired": "令牌已过期",
  "Add MCP Server": "添加 MCP 服务器",
  Name: "名称",
  Transport: "传输方式",
  Command: "命令",
  URL: "URL",
  "Close": "关闭",
  "No agents found": "未找到代理",
  "Remove agent": "移除代理",
  "No agents configured": "未配置代理",
  "Edit Agent": "编辑代理",
  "Add Agent": "添加代理",
  "Saving...": "保存中…",
  "Save Changes": "保存更改",
  "Delete Agent": "删除代理",
  "Codex Authentication": "Codex 身份验证",
  "API Key": "API 密钥",
  "Use an OpenAI API key": "使用 OpenAI API 密钥",
  "ChatGPT Login": "ChatGPT 登录",
  "Login with your ChatGPT account": "使用 ChatGPT 账户登录",
  "Search or enter URL": "搜索或输入 URL",
  "Search or enter URL…": "搜索或输入 URL…",
  "Grab element": "抓取元素",
  "Cancel inspect": "取消检查",
  "Loading...": "加载中…",
  "Loading models…": "正在加载模型…",
  "Loading Codex models...": "正在加载 Codex 模型…",
  "Loading agent options...": "正在加载代理选项…",
  Current: "当前",
  Beta: "测试版",
  "Input tokens": "输入令牌",
  "Cache read": "缓存读取",
  "Cache creation": "缓存创建",
  "Output tokens": "输出令牌",
  "Total / Window": "总计 / 窗口",
  "Large Context Warning": "上下文过大警告",
  "Note: Some files will be skipped:": "注意：部分文件将被跳过：",
  "Permission Request": "权限请求",
  "No approval prompts": "不显示审批提示",
  "Open a new chat without sending anything to the agent": "打开新聊天，不向代理发送内容",
  "No results": "没有结果",
  "Show more": "显示更多",
  "Show less": "显示更少",
  "Show full plan": "显示完整计划",
  Collapse: "折叠",
  "Show full result": "显示完整结果",
  "Open Jira board": "打开 Jira 看板",
  "Open in Jira": "在 Jira 中打开",
  "Assigned to: ": "负责人：",
  "No description provided": "未提供描述",
  "Loading comments...": "正在加载评论…",
  "Jira Project Filter": "Jira 项目筛选",
  "Jira Board": "Jira 看板",
  "No boards found for this Jira account.": "此 Jira 账户未找到看板。",
  "Select a board": "选择看板",
  "Select sprint": "选择迭代",
  Done: "完成",
  "Create a file": "创建文件",
  "Give feedback to refine the plan...": "提供反馈以完善计划…",
  "Answer: ": "回答：",
  "Error": "错误",
  Result: "结果",
  "Open project": "打开项目",
  "Choose a folder to anchor your sessions, tools, and file context.": "选择一个文件夹，用于存放会话、工具和文件上下文。",
  "Choose folder": "选择文件夹",
  "your threads are in the sidebar": "你的会话在线程侧边栏中",
  "Spaces": "空间",
  "Tool Panels": "工具面板",
  "Rounded, separated": "圆角分离",
  "Edge-to-edge": "贴合边缘",
  "Run commands and scripts": "运行命令和脚本",
  "Commits, branches, diffs": "提交、分支和差异",
  "Preview and inspect": "预览和检查",
  "Track accessed files": "跟踪访问过的文件",
  "Browse file tree": "浏览文件树",
  "Transparent tool picker": "透明工具选择器",
  "Remove the background from the right-side tool picker strip so icons float directly over the window.": "移除右侧工具选择器条的背景，让图标直接浮在窗口上。",
  "New branch name…": "新分支名称…",
  "Select...": "选择…",
  "Select": "选择",
  "Type here...": "在此输入…",
  "Search icons...": "搜索图标…",
  "Search icons…": "搜索图标…",
  "e.g. Work, Personal, Side Project": "例如：工作、个人、副项目",
  "No permission prompts": "不显示权限提示",
  "Saves to .claude/settings.local.json (gitignored)": "保存到 .claude/settings.local.json（已加入 Git 忽略）",
  "Saves to .claude/settings.json (shared with team)": "保存到 .claude/settings.json（与团队共享）",
  "Saves to ~/.claude/settings.json": "保存到 ~/.claude/settings.json",
  "Write": "写入",
  "Show permission prompt": "显示权限提示",
  "Auto-approve each tool call": "自动批准每次工具调用",
  "Auto-approve with always-allow": "自动批准并始终允许",
  "Prompt before commands and file edits": "在命令和文件编辑前询问",
  "Auto-approve trusted edits; prompt for untrusted actions": "自动批准可信编辑，对不可信操作询问",
  "No files matching": "没有匹配的文件",
  "Download...": "下载中…",
  "Downloading...": "正在下载…",
  "Always accessible": "始终可访问",
  "Live status monitoring": "实时状态监控",
  "Per-project configuration": "按项目配置",
  "Free and open-source software": "免费开源软件",
  "Source code, issues & releases": "源代码、问题和版本发布",
  "GitHub Repository": "GitHub 仓库",
  "MIT License": "MIT 许可证",
  "Send anonymous analytics": "发送匿名分析数据",
  "Share anonymous usage data to help us understand how people use Harnss and improve the app. We collect app version, platform, and basic feature usage. No code, prompts, or personal data is collected.": "分享匿名使用数据，帮助我们了解 Harnss 的使用方式并改进应用。我们收集应用版本、平台和基础功能使用情况，不收集代码、提示词或个人数据。",
  "App version and platform (macOS, Windows, Linux)": "应用版本和平台（macOS、Windows、Linux）",
  "Daily active users (to measure engagement)": "每日活跃用户（用于衡量使用情况）",
  "Basic feature usage (e.g., which engines are used)": "基础功能使用情况（例如使用了哪些引擎）",
  "Your code, prompts, or conversations with AI": "你的代码、提示词或与 AI 的对话",
  "File paths, project names, or repository URLs": "文件路径、项目名称或仓库 URL",
  "Any personal or identifying information": "任何个人信息或可识别信息",
  "API keys or credentials": "API 密钥或凭据",
  "OS Notification": "系统通知",
  Sound: "声音",
  "Claude binary source": "Claude 程序来源",
  "Choose how Harnss resolves the Claude executable.": "选择 Harnss 如何定位 Claude 可执行文件。",
  "Custom Claude path": "自定义 Claude 路径",
  "Absolute path to claude executable (claude or claude.exe).": "claude 可执行文件的绝对路径（claude 或 claude.exe）。",
  "Absolute path to claude executable": "claude 可执行文件的绝对路径",
  "Client name": "客户端名称",
  "How this app identifies itself to Codex servers during the handshake. Changes take effect on new sessions.": "此应用在握手期间向 Codex 服务器标识自己的名称。更改将在新会话中生效。",
  "Show Dev Fill in chat title bar": "在聊天标题栏显示开发填充",
  "Enable developer seeding actions in the active chat title bar. Hidden by default.": "在当前聊天标题栏启用开发填充操作。默认隐藏。",
  "Enable Jira board": "启用 Jira 看板",
  "Show the Jira board UI in project sidebars and chats. This is a developer preview.": "在项目侧边栏和聊天中显示 Jira 看板界面。这是开发者预览功能。",
  "Replay welcome wizard": "重新播放欢迎向导",
  "Reset the onboarding flag and relaunch the welcome wizard.": "重置引导状态并重新打开欢迎向导。",
  "Codex binary source": "Codex 程序来源",
  "Choose how Harnss resolves the Codex executable.": "选择 Harnss 如何定位 Codex 可执行文件。",
  "Custom Codex path": "自定义 Codex 路径",
  "Absolute path to codex executable (codex or codex.exe).": "codex 可执行文件的绝对路径（codex 或 codex.exe）。",
  "Absolute path to codex executable": "codex 可执行文件的绝对路径",
  "Create, install, and manage agent skills that extend what your AI coding agents can do.": "创建、安装和管理扩展 AI 编码代理能力的技能。",
  "Build and configure custom agents with specialized tools, prompts, and workflows.": "使用专用工具、提示词和工作流构建并配置自定义代理。",
  "Agent Client Protocol": "代理客户端协议",
  "Stop agent": "停止代理",
  "View transcript": "查看记录",
  "Generating title...": "正在生成标题…",
  "Thinking...": "思考中…",
  Thought: "思考",
  "attached image": "附加图片",
};

const SOURCE_BY_TRANSLATION = new Map(
  Object.entries(TRANSLATIONS).map(([source, translated]) => [translated, source]),
);

export function translate(text: string, language: Language): string {
  return language === "zh" ? TRANSLATIONS[text] ?? text : text;
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === "zh" ? "zh" : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "zh" : "en");
  }, [language, setLanguage]);

  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage, t: (text: string) => translate(text, language) }),
    [language, setLanguage, toggleLanguage],
  );

  useEffect(() => {
    const ignoredSelector = "script,style,pre,code,textarea,input,select,svg,[data-no-translate],[contenteditable='true']";

    const translateTextNodes = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode() as Text | null;
      while (node) {
        const parent = node.parentElement;
        if (parent && !parent.closest(ignoredSelector)) {
          const raw = node.nodeValue ?? "";
          const trimmed = raw.trim();
          const source =
            SOURCE_TEXT_BY_NODE.get(node) ??
            (language === "en" ? SOURCE_BY_TRANSLATION.get(trimmed) : undefined) ??
            trimmed;
          if (trimmed && (language === "en" || TRANSLATIONS[source])) {
            SOURCE_TEXT_BY_NODE.set(node, source);
            const next = translate(source, language);
            if (next !== trimmed) {
              const start = raw.indexOf(trimmed);
              node.nodeValue = `${raw.slice(0, start)}${next}${raw.slice(start + trimmed.length)}`;
            }
          }
        }
        node = walker.nextNode() as Text | null;
      }

      const elements: Element[] = [];
      if (root instanceof Element) elements.push(root);
      if (root instanceof Document || root instanceof Element) {
        elements.push(...root.querySelectorAll("*"));
      }
      for (const element of elements) {
        if (element.closest(ignoredSelector)) continue;
        const attributes = SOURCE_ATTRIBUTE_BY_ELEMENT.get(element) ?? new Map<string, string>();
        for (const attribute of ["placeholder", "title", "aria-label"]) {
          const current = element.getAttribute(attribute);
          if (!current) continue;
          const source =
            attributes.get(attribute) ??
            (language === "en" ? SOURCE_BY_TRANSLATION.get(current) : undefined) ??
            current;
          if (language === "en" || TRANSLATIONS[source]) {
            attributes.set(attribute, source);
            element.setAttribute(attribute, translate(source, language));
          }
        }
        if (attributes.size > 0) SOURCE_ATTRIBUTE_BY_ELEMENT.set(element, attributes);
      }
    };

    translateTextNodes(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          translateTextNodes(mutation.target);
        } else {
          for (const addedNode of mutation.addedNodes) {
            translateTextNodes(addedNode);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
