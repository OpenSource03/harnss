type QueryHandle = AsyncGenerator & {
  close: () => void;
  interrupt: () => Promise<void>;
  setPermissionMode: (mode: string) => Promise<void>;
  mcpServerStatus?: () => Promise<unknown[]>;
  reconnectMcpServer?: (serverName: string) => Promise<void>;
};

type QueryFn = (args: { prompt: unknown; options: unknown }) => QueryHandle;

let _sdkQuery: QueryFn | null = null;

export type { QueryHandle };

export async function getSDK(): Promise<QueryFn> {
  if (!_sdkQuery) {
    const sdk = await import("@anthropic-ai/claude-agent-sdk");
    _sdkQuery = sdk.query as unknown as QueryFn;
  }
  return _sdkQuery;
}
