import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    alias: { "@/": new URL("./src/", import.meta.url).pathname },
    // Each test file gets its own embedded database.
    env: { DATABASE_URL: "memory://" },
  },
});
