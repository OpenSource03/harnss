import { shell } from "electron";
import { loadOAuthData, saveOAuthData, type StoredOAuthData } from "./mcp-oauth-store";
import type {
  OAuthClientProvider,
  OAuthTokens,
  OAuthClientInformation,
  OAuthClientInformationFull,
} from "@modelcontextprotocol/sdk/shared/auth.js";

export class ElectronOAuthClientProvider implements OAuthClientProvider {
  private serverName: string;
  private serverUrl: string;
  private callbackPort: number;
  private stored: StoredOAuthData | null;

  constructor(serverName: string, serverUrl: string, callbackPort: number) {
    this.serverName = serverName;
    this.serverUrl = serverUrl;
    this.callbackPort = callbackPort;
    this.stored = loadOAuthData(serverName);
  }

  get redirectUrl(): string {
    return `http://localhost:${this.callbackPort}/callback`;
  }

  get clientMetadata(): {
    redirect_uris: string[];
    client_name: string;
    grant_types: string[];
    response_types: string[];
    token_endpoint_auth_method: string;
  } {
    return {
      redirect_uris: [this.redirectUrl],
      client_name: "OpenACP UI",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };
  }

  clientInformation(): OAuthClientInformation | undefined {
    return this.stored?.clientInfo as OAuthClientInformation | undefined;
  }

  saveClientInformation(info: OAuthClientInformationFull): void {
    if (!this.stored) {
      this.stored = { serverUrl: this.serverUrl, storedAt: Date.now() };
    }
    this.stored.clientInfo = info;
    this.stored.storedAt = Date.now();
    saveOAuthData(this.serverName, this.stored);
  }

  tokens(): OAuthTokens | undefined {
    return this.stored?.tokens as OAuthTokens | undefined;
  }

  saveTokens(tokens: OAuthTokens): void {
    if (!this.stored) {
      this.stored = { serverUrl: this.serverUrl, storedAt: Date.now() };
    }
    this.stored.tokens = tokens;
    this.stored.storedAt = Date.now();
    saveOAuthData(this.serverName, this.stored);
  }

  redirectToAuthorization(url: URL): void {
    shell.openExternal(url.toString());
  }

  saveCodeVerifier(verifier: string): void {
    if (!this.stored) {
      this.stored = { serverUrl: this.serverUrl, storedAt: Date.now() };
    }
    this.stored.codeVerifier = verifier;
    this.stored.storedAt = Date.now();
    saveOAuthData(this.serverName, this.stored);
  }

  codeVerifier(): string {
    return this.stored?.codeVerifier ?? "";
  }
}
