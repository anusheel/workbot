import { type Role, createUser } from "@/lib/auth";
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
