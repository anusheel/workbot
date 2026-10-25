import { type Role, createUser } from "@/lib/auth";
import type { Tool } from "@/lib/tool";
import { withTrace } from "@/lib/tracing";
import { caller } from "./caller";

/** The headers of a new caller with the role, for a route handler under test. */
export async function as(role: Role) {
  const { key } = await createUser(`A ${role}`, role);
  return { authorization: `Bearer ${key}` };
}

/**
 * Signs a new caller with the role in, for a test that calls a server
 * action; the test file mocks next/headers with:
 * vi.mock("next/headers", async () => ({ headers: async () => (await import("@/test/caller")).caller.headers }))
 */
export async function signIn(role: Role) {
  caller.headers = new Headers(await as(role));
}

/** Tools that run as the role, for a test that calls them directly. */
export const actingAs = (role: Role, tools: Tool[]): Tool[] =>
  tools.map((t) => ({
    ...t,
    run: (input) =>
      withTrace({ caller: `a ${role}`, name: "test", role }, () =>
        t.run(input),
      ),
  }));
