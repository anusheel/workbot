import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests that call the real APIs run through vitest.live.config.ts.
    exclude: [...configDefaults.exclude, "**/*.live.test.ts"],
    alias: { "@/": new URL("./src/", import.meta.url).pathname },
    // Each test file gets its own embedded database.
    env: { DATABASE_URL: "memory://" },
    // A file's first query opens that database, with its extensions, while
    // the other files open theirs; under load that outlives the 5 s default.
    testTimeout: 20_000,
  },
});
