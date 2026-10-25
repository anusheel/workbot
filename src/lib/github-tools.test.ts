import { expect, test, vi } from "vitest";
import { toolsFor } from "./tools";

vi.hoisted(() => {
  process.env.GITHUB_REPO = "acme/helpdesk";
  delete process.env.GITHUB_TOKEN;
});

// With no app token, a user who connected their own can still file: the tools follow the repository, the token is chosen per call.
test("the ticket tools are offered wherever a repository is configured, by role", () => {
  const names = (role: "viewer" | "agent") => toolsFor(role).map((t) => t.name);
  expect(names("agent")).toEqual(
    expect.arrayContaining(["find_ticket", "file_ticket", "comment_on_ticket"]),
  );
  expect(names("viewer")).toContain("find_ticket");
  expect(names("viewer")).not.toContain("file_ticket");
});
