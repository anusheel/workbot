---
description: Pre-deploy checks. Type-check, tests, stray console.log calls and required environment variables, with a pass/fail summary
---

Report each check below as pass or fail in one short table, then an overall verdict. Do not fix anything; say what fails and where.

## Type check

!`pnpm typecheck 2>&1 | tail -5`

## Tests

!`pnpm test 2>&1 | tail -8`

## console.log in src/

!`grep -rn "console\.log" src --include='*.ts' --include='*.tsx' || echo none`

## Required environment variables

Every variable named in `.env.example` must be set in `.env.local` or the environment.

!`node --env-file-if-exists=.env.local -e 'const fs=require("fs");const names=fs.existsSync(".env.example")?(fs.readFileSync(".env.example","utf8").match(/^[A-Z_]+/gm)??[]):[];const missing=names.filter(n=>!process.env[n]);console.log(!names.length?"none required":missing.length?"missing: "+missing.join(", "):"all set: "+names.join(", "))'`
