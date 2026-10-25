import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

/** A connected MCP server: its tools, a call that returns the text a tool produced, and a close. */
export type Mcp = {
  tools(): Promise<{ name: string; description?: string }[]>;
  call(name: string, args: Record<string, unknown>): Promise<string>;
  close(): Promise<void>;
};

/**
 * The transport to a remote server over Streamable HTTP with a bearer token.
 * A per-user OAuth flow hands the SDK an OAuthClientProvider here instead of
 * a token; the server then sends the person to authorize and the transport
 * refreshes what it is given.
 */
export const remote = (
  url: string,
  token: string,
  headers: Record<string, string> = {},
) =>
  new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${token}`, ...headers } },
  });

/** Connects to an MCP server. A tool's failure comes back as an error carrying the server's message. */
export async function connectMcp(transport: Transport): Promise<Mcp> {
  const client = new Client({ name: "workbot", version: "1.0.0" });
  await client.connect(transport);
  return {
    tools: async () => (await client.listTools()).tools,
    call: async (name, args) => {
      const result = await client.callTool({ name, arguments: args });
      const text = (result.content as { type: string; text?: string }[])
        .filter((part) => part.type === "text")
        .map((part) => part.text ?? "")
        .join("\n");
      if (result.isError) throw new Error(text || `${name} failed`);
      return text;
    },
    close: () => client.close(),
  };
}

/** Runs `fn` on a fresh connection and closes it, whatever happens. */
export async function withMcp<T>(
  connect: () => Promise<Mcp>,
  fn: (mcp: Mcp) => Promise<T>,
): Promise<T> {
  const mcp = await connect();
  try {
    return await fn(mcp);
  } finally {
    await mcp.close();
  }
}
