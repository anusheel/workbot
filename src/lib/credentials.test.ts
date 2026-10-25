import { randomBytes } from "node:crypto";
import { expect, test, vi } from "vitest";
import { createUser } from "./auth";
import {
  connections,
  credentialFor,
  revokeCredential,
  saveCredential,
} from "./credentials";
import { query } from "./db";
import { githubToken } from "./github";
import { withTrace } from "./tracing";

const env = vi.hoisted(() => {
  process.env.SECRETS_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.GITHUB_TOKEN = "app-token";
  return process.env;
});

test("a token is sealed at rest, opened for its user, and gone once revoked", async () => {
  const { user } = await createUser("Dana", "agent");
  await saveCredential(user.id, "github", "dana-token");
  const [row] = await query<{ ciphertext: Uint8Array }>(
    `select ciphertext from credentials where user_id = $1`,
    [user.id],
  );
  expect(Buffer.from(row.ciphertext).toString("utf8")).not.toContain(
    "dana-token",
  );
  expect(await credentialFor(user.id, "github")).toBe("dana-token");
  expect((await connections(user.id)).map((c) => c.provider)).toEqual([
    "github",
  ]);
  await revokeCredential(user.id, "github");
  expect(await credentialFor(user.id, "github")).toBeUndefined();
});

test("a GitHub call runs with the signed-in user's token when they connected one, and the app's otherwise", async () => {
  const { user } = await createUser("Sam", "agent");
  await saveCredential(user.id, "github", "sam-token");
  const { user: other } = await createUser("Lee", "agent");
  const as = (id?: string) =>
    withTrace(
      { caller: id ?? "web", name: "chat", role: "agent", user: id },
      githubToken,
    );
  expect(await as(user.id)).toBe("sam-token");
  expect(await as(other.id)).toBe("app-token");
  expect(await as()).toBe("app-token");
});

test("reseal moves every token onto the current key, after which the previous key can go", async () => {
  const { user } = await createUser("Ari", "agent");
  await saveCredential(user.id, "github", "ari-token");
  const previous = env.SECRETS_KEY!;
  env.SECRETS_KEY = randomBytes(32).toString("base64");
  env.SECRETS_KEY_PREVIOUS = previous;
  vi.resetModules();
  const fresh = await import("./credentials");
  expect(await fresh.credentialFor(user.id, "github")).toBe("ari-token");
  expect(await fresh.reseal()).toBeGreaterThanOrEqual(1);
  delete env.SECRETS_KEY_PREVIOUS;
  vi.resetModules();
  const after = await import("./credentials");
  expect(await after.credentialFor(user.id, "github")).toBe("ari-token");
});
