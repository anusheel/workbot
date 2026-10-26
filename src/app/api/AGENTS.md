# API routes

Each route is a folder with `route.ts`, `types.ts` and `route.test.ts`.
Schemas in `types.ts` are the contract: the body schema parses input with
`safeParse`, the response schema is what tests parse answers through. Status
codes: 201 on create, 400 with `z.flattenError(error)` on invalid input, 404
when the resource does not exist; unexpected errors throw. Handlers call the
functions in `src/lib`; they hold no logic of their own.
`api/inngest` and `api/webhooks/slack` are the exceptions, served by their SDKs: the
workflow engine's handler, with the functions listed in `src/inngest/`, and the Chat
SDK's, with the bot in `src/lib/bot.ts`. A webhook checks its provider's signature
before it parses anything.
