import { createHmac } from "node:crypto";
import { expect, test } from "vitest";
import { config } from "@/lib/config";
import { githubConnect } from "@/lib/github";
import { withMcp } from "@/lib/mcp";
import { repository } from "@/lib/tickets";
import { findTickets } from "@/lib/unified";
import { POST } from "./route";

// A delivery built from a real issue, read through GitHub's server and
// signed with the secret: the shape GitHub sends, without a public address.
test("a signed delivery of a real issue replaces its row in the one shape", async () => {
  const { owner, repo, slug } = repository();
  const issue = JSON.parse(
    await withMcp(githubConnect, (mcp) =>
      mcp.call("issue_read", { method: "get", owner, repo, issue_number: 164 }),
    ),
  );
  const body = JSON.stringify({
    action: "edited",
    issue,
    repository: { full_name: slug },
  });
  const response = await POST(
    new Request("http://workbot/api/webhooks/github", {
      method: "POST",
      headers: {
        "x-github-event": "issues",
        "x-hub-signature-256": `sha256=${createHmac("sha256", config.github.webhookSecret!).update(body).digest("hex")}`,
      },
      body,
    }),
  );
  expect(response.status).toBe(204);
  expect(await findTickets("loading dock")).toMatchObject([
    { id: "github#164", state: "closed", team: "operations" },
  ]);
});
