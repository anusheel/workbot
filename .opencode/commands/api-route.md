---
description: Scaffold a Next.js route handler with Zod validation, typed request and response, and HTTP error codes
---

Create the route handler `/api/$0` with the methods named after it (default: GET and POST):

1. `src/app/api/$0/types.ts`: Zod schemas for the request body (and query parameters where relevant) and for the response, with the inferred TypeScript types exported. Add Zod with `pnpm add zod` if it is not a dependency yet.
2. `src/app/api/$0/route.ts`: one exported function per method. Parse input with the schema's `safeParse`; on failure answer 400 with the validation issues. Answer 404 when the resource does not exist and 409 on conflicts. Let unexpected errors throw; Next.js answers 500.
3. `src/app/api/$0/route.test.ts`: a Vitest test per method that calls the handler with a `Request` and checks status and body, including one invalid input.

Read an existing route first (`src/app/api/health/route.ts`) and match its style. Run `pnpm test` when done.
