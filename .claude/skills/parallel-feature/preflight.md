# Preflight gates

Run these **before** dispatching any subagent. Each one has silently cost a full parallel
wave: agents fail on the environment, diagnose it concurrently, and race to repair it.

Verify with the listed check; only run the fix when the check fails.

## 1. Dependencies installed

```bash
node -e "require.resolve('electron'); require.resolve('fs-extra'); require.resolve('@playwright/test')"
```

Fix: `npm i --legacy-peer-deps` from the root. A partial `node_modules` makes every
`bruno-electron` spec fail at import with a misleading "Cannot find module" — not a code bug.

## 2. Electron binary actually extracted

```bash
node -e "console.log(require('electron'))"   # must print a path to electron.exe / Electron
```

`@electron/get` can report a cache hit while leaving `node_modules/electron/dist` without
`path.txt`, so `require('electron')` throws "Electron failed to install correctly". Fix by
re-extracting the cached zip into `dist/` and writing `path.txt`.

Specs that `jest.mock('electron')` with a factory are unaffected — a green unit suite does
not prove this gate.

## 3. Shared package dists built

`npm run dev` does **not** build them (see `.claude/CLAUDE.md`). Missing dists surface as
renderer bundle errors like `Can't resolve @usebruno/converters`, which look like a broken
edit but are not.

```bash
npm run build:bruno-common && npm run build:schema-types && npm run build:bruno-query \
  && npm run build:bruno-requests && npm run build:bruno-converters \
  && npm run build:graphql-docs && npm run build:bruno-sqlite && npm run build:bruno-filestore
```

`build:bruno-filestore`'s declaration step needs `schema-types` built first — keep the order.
Rollup warnings from `@faker-js/faker` and `@opencollection/types` are pre-existing upstream
noise; only a missing `created dist/...` line is a real failure.

**One owner.** Two concurrent builds write the same `dist/` directories. Build before the
fan-out, or hand exactly one agent the job and tell the rest to wait.

## 4. JS sandbox libraries bundled

```bash
npm run sandbox:bundle-libraries --workspace=packages/bruno-js
```

Without this the Electron main process exits at `packages/bruno-electron/src/index.js:13`
with "JS Sandbox libraries have not been bundled yet", so **every** Playwright launch dies on
`waitForEvent('window')` with a timeout that names the fixture, not the cause.

## 5. Know the two command traps

- **`npm test --workspace=packages/bruno-electron` cannot run on Windows.** The script is
  `node --experimental-vm-modules $(npx which jest)`; `cmd` does not expand `$(...)`. Use
  `npm run test:ci --workspace=packages/bruno-electron -- <pattern>`. `bruno-app`'s `npm test`
  is fine.
- **Playwright needs `--workers=1`** on a typical dev machine, and the first run of a session
  fails cold. Both are covered in `.claude/rules/testing.md`.

## 6. Reserve the serial resources

Only one agent at a time may hold:

- **Playwright** — parallel runs collide on the dev-server port, and each boots its own
  server when `CI` is set.
- **Dependency install / shared-package build** — same `node_modules` and `dist/` trees.

Hand out these locks explicitly over `hub` and require a hand-back.
