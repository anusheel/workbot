# How we work with the CLIs

One repository policy, 3 terminal agents, a brain of notes they read, and a way of working that keeps a change reviewable. Written from one day of shipping with all 3 (Day 21); the comparisons are what happened, not a ranking.

## The policy, in files

| What         | Claude Code                                                                                                                                                                       | Codex CLI                                                                                                                    | OpenCode                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Instructions | `CLAUDE.md` imports `AGENTS.md`, at the root and in each package                                                                                                                  | `AGENTS.md`, root and nested                                                                                                 | `AGENTS.md` at the root; the nested ones listed in `opencode.jsonc` `instructions` |
| MCP servers  | `.mcp.json`                                                                                                                                                                       | `.codex/config.toml`, `[mcp_servers.<name>]`                                                                                 | `opencode.jsonc`, `mcp`                                                            |
| Permissions  | `.claude/settings.json`: allow the checks and read-only git, deny `.env.local` and `rm -rf`; the allow list applies once the workspace has been trusted in an interactive session | `approval_policy = "on-request"`; `default_permissions` selects a profile that extends `:workspace` and denies the env files | `permission`: edit allowed, bash asks, reads of `.env` files denied                |
| Skills       | `.claude/skills/<name>/SKILL.md`                                                                                                                                                  | `[[skills.config]]` pointing at the same folders                                                                             | `.opencode/commands/<name>.md`, written from the skills by `pnpm sync:commands`    |
| Checked by   | `scripts/agent-config.test.ts`: the 3 declare the same servers, every nested `AGENTS.md` is wired, every skill is in all 3                                                        |

`AGENTS.md` is the source; the only copies are generated, and the test compares them. A new package gets an `AGENTS.md`, a `CLAUDE.md` of one line, and a line in `opencode.jsonc`; a new skill gets `pnpm sync:commands` and a `[[skills.config]]` entry; the test fails until it does.

## The brain

`brain/` is what an agent reads before a task that touches product, architecture, the customer or style: an index, 5 notes, a `Reviewed` date each, and a retention rule (90 days, then archive; decisions superseded in place). It is read by path, not loaded into every prompt: the root `AGENTS.md` says where it is and asks for the note relied on to be cited. The budget rule: every session gets `AGENTS.md`; everything else the agent fetches when the task needs it.

## From issue to merged pull request

1. The issue is the brief: the form in `.github/ISSUE_TEMPLATE/task.yml` requires a goal and acceptance criteria, and asks for constraints, related paths and a session link. An issue without checkable criteria is sent back before any agent sees it.
2. Plan mode first for anything that touches more than one package; the plan goes in the pull request.
3. One pull request per unit of work, small; the template carries the brief (`Closes #`), the plan, the session per CLI used, and the checks.
4. The session is the handoff: a cloud session's link, or the local session's id, in the pull request, so the next person or agent can continue it rather than start over.
5. Review by reading the diff, running the tests and checking the brief's criteria one by one. The agent's summary is not the review.

## The 3 CLIs on one day's tasks

| Task                                               | CLI                                      | Model           | Time                     | What happened                                                                                                                                                                                                |
| -------------------------------------------------- | ---------------------------------------- | --------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The policy across 3 CLIs and the brain (issue #24) | Claude Code                              | Sonnet-class    | the morning, interactive | the shape of the task was open (what to share, how to keep one source); an interactive session with plan mode, reading each CLI's docs on the way, was the right tool                                        |
| Issue and pull request templates (issue #22)       | Codex CLI, `codex exec --approve-for-me` | the default     | 21 s                     | a closed brief with the exact fields: the files came back as specified, reviewed as is. Two false starts on flags: `--full-auto` is gone and `--sandbox` cannot be combined with `--approve-for-me` in 0.157 |
| The configuration consistency test (issue #23)     | OpenCode, `opencode run --auto`          | DeepSeek V4 Pro | 90 s                     | ran the test and the linter itself and fixed what failed before reporting; the code reads like ours. The Anthropic provider is not configured in this OpenCode, so it ran on DeepSeek                        |

Where each was faster or clearer: Codex for a closed brief with named files, fastest and quietest; OpenCode for a task that needs a check loop (write, run, fix) without a conversation, and for a second opinion from a different model family; Claude Code for the open-ended task, where plan mode, the docs tools and the long session pay for themselves. All 3 named `AGENTS.md`, the 5 servers and the 4 skills when probed; 3 things the probe taught: Claude Code ignores a project's `permissions.allow` until the workspace is trusted once interactively; OpenCode's `bash: ask` ends a non-interactive run at the first command it refuses, so a probe denies the shell for the run; and OpenCode's glob does not match under dot-directories, so it reads `.opencode/commands` as a directory instead.

## Checking a CLI picks the policy up

Ask it, with no write access: "the instruction files that apply here, the MCP servers configured for you, the skills or commands available to you". `claude -p --allowedTools "Read,Glob,Grep"`, `codex exec --sandbox read-only`, and `opencode run` with the shell denied for the run: `OPENCODE_CONFIG_CONTENT='{"permission":{"bash":"deny"}}'`. The answers name the same files, servers and skills, or the configuration is wrong for that CLI. The env rule has its own check: `opencode run` asked to read `.env.local` answers with the rule; `codex sandbox --permission-profile workbot -- cat .env.local` fails with "Operation not permitted". Codex applies the profile to a session only when no loaded config sets the older `sandbox_mode`, the user's `~/.codex/config.toml` included.

## Terminals and editors

One pane per agent, one browser, one notes app: cmux here, with the Chrome the agents drive and the course's pages beside it; Obsidian or any editor for the brain, which is plain Markdown. Session persistence matters more than the terminal: a session that survives a closed pane is a handoff that still works.
