import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "@/lib/config";
import { connect } from "@/lib/db";
import { databaseServer } from "@/mcp/database";

// An embedded database can be open in one process only, so this server
// needs a database server to talk to.
if (!config.database.startsWith("postgres")) {
  console.error(
    "Set DATABASE_URL to a postgres:// URL to use the database MCP server.",
  );
  process.exit(1);
}

const { query } = connect(config.database, { readOnly: true });
await databaseServer(query).connect(new StdioServerTransport());
