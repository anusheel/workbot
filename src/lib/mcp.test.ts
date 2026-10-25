import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { expect, test } from "vitest";
import { z } from "zod";
import { connectMcp, withMcp } from "./mcp";

async function connect() {
  const server = new McpServer({ name: "fake", version: "1.0.0" });
  server.registerTool(
    "echo",
    { inputSchema: { text: z.string() } },
    async ({ text }) => ({ content: [{ type: "text", text }] }),
  );
  server.registerTool("fail", {}, async () => ({
    content: [{ type: "text", text: "no such thing" }],
    isError: true,
  }));
  const [client, transport] = InMemoryTransport.createLinkedPair();
  await server.connect(transport);
  return connectMcp(client);
}

test("lists the server's tools, returns a tool's text and throws its error", async () => {
  const mcp = await connect();
  expect((await mcp.tools()).map((t) => t.name)).toEqual(["echo", "fail"]);
  expect(await mcp.call("echo", { text: "hi" })).toBe("hi");
  await expect(mcp.call("fail", {})).rejects.toThrow("no such thing");
  await mcp.close();
});

test("withMcp closes the connection whether the work succeeds or throws", async () => {
  let open = 0;
  const counted = async () => {
    const mcp = await connect();
    open++;
    return { ...mcp, close: () => (open--, mcp.close()) };
  };
  expect(await withMcp(counted, (mcp) => mcp.call("echo", { text: "x" }))).toBe(
    "x",
  );
  await expect(
    withMcp(counted, () => Promise.reject(new Error("boom"))),
  ).rejects.toThrow("boom");
  expect(open).toBe(0);
});
