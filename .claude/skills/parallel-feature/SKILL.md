---
name: parallel-feature
description: Ship a multi-task Bruno feature as parallel subagent waves — discovery, frozen
  cross-agent contracts, wave dispatch, task lint, verification. Use when work splits across
  several files or packages.
---

# Shipping a Bruno feature in parallel waves

For work that spans several files or packages and would otherwise be done one edit at a
time. You stay the orchestrator: you own decomposition and the cross-agent contracts, and
subagents own disjoint file scopes.

Do **not** use this for a single-file change, an investigation, or anything where the
affected files are still unknown — scout first, then decide.

## 1. Preflight (once per session, before any subagent)

Read `preflight.md` and satisfy every gate. Skipping this is the single most expensive
mistake here: a fresh checkout cannot run e2e at all, and four agents will each rediscover
that in parallel.

## 2. Discovery

Fan out read-only `scout` subagents (never generic agents) over the unknown areas — one per
question, in a single message. Ask each for `path:line` evidence, exported signatures, and
the existing pattern to copy. Findings feed the contracts below; do not let subagents infer
architecture independently.

## 3. Freeze the contracts — the critical step

Anything two agents must agree on is decided **by you, now**, and written verbatim into the
batch `context`:

- IPC channel names, payload shapes, return shapes (see `.claude/rules/electron-ipc.md`)
- Redux reducer key, slice `name`, state shape, exact thunk/reducer names (`redux-store.md`)
- Component export shape and `data-testid` prefix
- On-disk format changes (`dsl-changes.md`)

Never leave a contract for agents to negotiate mid-flight. State supersets are allowed
(an implementer may return extra fields) but renames and reshapes are not.

## 4. Plan waves by real dependency

A task blocks another **only** if it strictly needs its output. Two tasks that merely touch
the same file are not a dependency — they are a scope conflict, and the fix is to give one
of them the file and let the other coordinate over `hub`.

Compute waves rather than eyeballing them: a task sits in the earliest wave where all its
blockers are in earlier waves. Verify no cycles, no orphan-by-accident, and **no overlapping
`fileScope` between tasks in the same wave**.

## 5. Write the task briefs

Each task is self-contained — subagents start with zero conversation history. Use the
template and pass the blocker lint in `task-brief.md`. Materialize briefs under
`.team/<feature>/task-<n>.md` so the plan survives the session and a human can read it.

## 6. Dispatch

One `tasks[]` array per wave. Every brief must carry the shared prohibitions from
`task-brief.md` — no project-wide lint/test runs, no `npm i`, stay inside `fileScope`.

While a wave runs: relay environment discoveries to the whole batch over `hub` immediately.
Serialize the two resources that cannot be shared (Playwright, and any dependency install)
by handing out an explicit lock. Agents that hit a shared-file need should message the owner
rather than edit.

## 7. Verify yourself

Subagent "completed" means it yielded, not that its claims are true. Before reporting:

- Re-run the consolidated suites yourself; don't trust reported numbers.
- `grep` the acceptance invariants (e.g. a removed symbol has zero hits repo-wide).
- Confirm the registration points really landed — read the files.
- `git status --porcelain` for scratch files agents left behind, then delete them.

## Support files

| File | Contents |
|---|---|
| `preflight.md` | Environment gates that must pass before any subagent runs. |
| `task-brief.md` | Task brief template, the blocker lint, and the prohibitions every brief repeats. |
