import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { config } from "./config";

/** A secret sealed with AES-256-GCM, with the fingerprint of the key that sealed it, so a rotation can find what the old key sealed. */
export type Sealed = {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  tag: Uint8Array;
  keyId: string;
};

const keyOf = (base64: string) => {
  const key = Buffer.from(base64, "base64");
  if (key.length !== 32) throw new Error("A secrets key is 32 bytes, base64");
  return key;
};
const idOf = (key: Buffer) =>
  createHash("sha256").update(key).digest("hex").slice(0, 8);

/** The keys this process may open with: the current one first, then the one being retired. */
export function keys(
  current = config.secrets.key,
  previous = config.secrets.previous,
) {
  return [current, previous].filter(Boolean).map((k) => keyOf(k!));
}

export function seal(plaintext: string, [key] = keys()): Sealed {
  if (!key) throw new Error("SECRETS_KEY is not set, so nothing can be sealed");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return { ciphertext, iv, tag: cipher.getAuthTag(), keyId: idOf(key) };
}

/** Opens a sealed secret with whichever key sealed it; a secret changed at rest fails its tag. */
export function open(sealed: Sealed, available = keys()): string {
  const key = available.find((k) => idOf(k) === sealed.keyId);
  if (!key) throw new Error(`No key ${sealed.keyId} to open this secret with`);
  const decipher = createDecipheriv("aes-256-gcm", key, sealed.iv);
  decipher.setAuthTag(sealed.tag);
  return Buffer.concat([
    decipher.update(sealed.ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/** The fingerprint of the key that seals now. */
export const currentKeyId = ([key] = keys()) => (key ? idOf(key) : undefined);
