# How we code, in brief

The conventions are in `AGENTS.md`, which every CLI reads; this note is why they are what they are.

- Minimal code: the smallest change that does the job, no abstraction before its second use, no option nobody asked for.
- Server Components by default; a client component only for state, effects or browser APIs, and it says so with a render test beside it.
- One module reads the environment (`src/lib/config.ts`); one knows the database driver (`src/lib/db.ts`); one holds model ids and prices (`src/lib/providers.ts`). Everything else goes through them, so a change is one place.
- Schemas are contracts: Zod at every boundary (a route body, a tool input, a model's output), parsed, never trusted.
- Tests prove behaviour, not coverage: a scripted model for the loop, the real model on the small tier for what only the model decides, the embedded database for everything that touches a table. A bug found in a live run gets a test that would have caught it.
- A side effect that must not repeat is its own step; a limit on every loop; a guard on every fetch.
- Comments say why; the code says what. Prettier formats; nothing else is a review comment.
