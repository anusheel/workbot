import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

// The live suite calls the real APIs with the keys in .env.local.
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .flatMap((line) => {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      return match ? [[match[1], match[2]]] : [];
    }),
);

export default defineConfig({
  test: {
    include: ["src/**/*.live.test.ts"],
    alias: { "@/": new URL("./src/", import.meta.url).pathname },
    // The suite runs on Anthropic's small model whatever .env.local chooses for the app.
    env: {
      ...env,
      DATABASE_URL: "memory://",
      CHAT_PROVIDER: "anthropic",
      CHAT_MODEL: "claude-haiku-5-5",
    },
    testTimeout: 180_000,
  },
});
