# Task brief template, lint, and shared prohibitions

Read by the orchestrator when writing briefs. (Procedure lives in `../SKILL.md`.)

A subagent starts with **zero conversation history**. Anything it needs that is not in the
repo must be in its brief or the batch `context`.

## Template

```markdown
## Goal
<one sentence: the exact intended change>

## Context
<1-2 lines: why this task exists>

## Requirements
- <concrete item, naming the real file/symbol>

## Implementation Hints
- Follow the pattern in `<path:line>`
- Reuse `<function/module>`

## Constraints
- Do not change `<frozen contract / public API / on-disk format>`
- Do not refactor unrelated code
- Stay within the declared file scope; report a blocker instead of widening it

## Acceptance Criteria
- [ ] <observable outcome>
- [ ] <observable outcome>

## Verification Steps
- <exact command, scoped to this task>
```

Also set `fileScope` (a `;`-separated glob list) in task metadata, and name the owner of any
file two tasks would otherwise share.

## Blocker lint — every brief must pass

1. All seven sections present.
2. `fileScope` set, and narrower than `**/*` unless the task is a solo bootstrap.
3. At least one runnable command under Verification Steps.
4. At least two checkbox acceptance items.
5. Any dependency on another task's output is declared as a real blocker, not implied in prose.
6. Every frozen contract the task touches is quoted in the brief or the batch `context` —
   never referenced as "as discussed".

Warnings worth fixing: "follow existing patterns" with no file anchor; Constraints with no
explicit `Do not`; a brief long enough that the requirements are buried.

## Prohibitions to repeat in every brief

These do not survive as batch-level context alone — agents act on their own brief:

- **No project-wide commands.** No repo-wide lint, no `npm test --workspaces`, no full
  `npx playwright test`. Only the task's own Verification Steps. Validation runs once, at the
  end, by the orchestrator — mid-flight full runs block siblings on each other's half-done
  edits.
- **No environment repair.** No `npm i`, no shared-package rebuild, no sandbox re-bundle. The
  orchestrator did this in preflight; report a gap over `hub` instead of fixing it.
- **Stay inside `fileScope`.** Message the owning agent over `hub` rather than editing a file
  another task owns.
- **Clean cutover.** No shims, aliases, deprecated paths, or `TODO: implement`. Delete code
  the change obsoletes.
- **Product bugs are not test bugs.** A test-writing agent that hits a real defect reports it
  with evidence; it does not edit product code to make the test pass.
- **Report honestly.** Files changed, commands run with real output, and anything unfinished
  with the reason. A command that could not run is a finding, not something to omit.
