import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "@/lib/config";
import { posthogServer } from "@/mcp/posthog";

const { host, projectId, personalKey } = config.posthog.api;
if (!projectId || !personalKey) {
  console.error(
    "Set POSTHOG_PROJECT_ID and POSTHOG_PERSONAL_KEY to use the PostHog MCP server.",
  );
  process.exit(1);
}

await posthogServer({ host, projectId, personalKey }).connect(
  new StdioServerTransport(),
);
