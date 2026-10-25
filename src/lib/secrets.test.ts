import { randomBytes } from "node:crypto";
import { expect, test } from "vitest";
import { keys, open, seal } from "./secrets";

const key = () => randomBytes(32).toString("base64");

test("a sealed secret opens with its key and hides its text", () => {
  const ring = keys(key());
  const sealed = seal("ghp_example_token", ring);
  expect(Buffer.from(sealed.ciphertext).toString("utf8")).not.toContain("ghp_");
  expect(open(sealed, ring)).toBe("ghp_example_token");
});

test("a secret changed at rest fails, and so does one without its key", () => {
  const ring = keys(key());
  const sealed = seal("token", ring);
  const tampered = {
    ...sealed,
    ciphertext: Buffer.from(sealed.ciphertext).map((b, i) =>
      i === 0 ? b ^ 1 : b,
    ),
  };
  expect(() => open(tampered, ring)).toThrow();
  expect(() => open(sealed, keys(key()))).toThrow(/No key/);
});

test("during a rotation the previous key still opens what it sealed, and new seals use the current one", () => {
  const old = key();
  const sealedBefore = seal("token", keys(old));
  const ring = keys(key(), old);
  expect(open(sealedBefore, ring)).toBe("token");
  expect(seal("token", ring).keyId).not.toBe(sealedBefore.keyId);
});

test("a key that is not 32 bytes is refused, and sealing without one says why", () => {
  expect(() => keys(Buffer.from("short").toString("base64"))).toThrow(
    /32 bytes/,
  );
  expect(() => seal("token", [])).toThrow(/SECRETS_KEY/);
});
