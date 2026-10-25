---
description: Scaffold an app component with a render test, composed from shadcn/ui primitives and following the project's conventions
---

Create the component `$ARGUMENTS`, following AGENTS.md:

1. `src/components/<kebab-name>.tsx`: a Server Component unless it needs state, effects or browser APIs. Props are typed; the component is exported by name; it composes primitives from `src/components/ui/` and Tailwind classes rather than restyling from scratch. Add a missing primitive with `pnpm dlx shadcn@latest add <name>`.
2. `src/components/<kebab-name>.test.tsx`: a Vitest test that renders it with `renderToStaticMarkup` from `react-dom/server` and asserts on the markup.

Read `src/components/site-header.tsx` and its test first and match them. Run `pnpm test` when done.
