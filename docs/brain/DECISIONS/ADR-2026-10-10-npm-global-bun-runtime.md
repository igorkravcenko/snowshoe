---
status: accepted
date: 2026-10-10
---

# ADR-2026-10-10: npm global install without a prior Bun + `snowshoe --version`

## Status

Accepted.

## Context

The CLI is TypeScript run by Bun (`bun:sqlite`, `Bun.serve`, `Bun.spawn` with a PTY). Porting to Node is out of scope. Through 0.0.4 the published `bin` was `./src/index.ts` with `#!/usr/bin/env bun`, so `npm i -g @igorkravcenko/snowshoe` on a machine without Bun installed silently and then failed with `env: 'bun': No such file or directory` (exit 127) — issue #7. `snowshoe --version` / `snowshoe version` also failed (issue #6); the version was a hardcoded citty `meta.version` and only showed up via `help --json`.

The stack ADR mentioned `bun build --compile` as the ship path. The published tarball has been source + shebang, not a compiled binary.

Preferred starting point: add the official `bun` npm package (oven-sh; platform binaries via its `optionalDependencies`) as a Snowshoe dependency so npm installs bring a Bun binary.

## Decision

### Do not put `bun` in Snowshoe `dependencies` or `optionalDependencies`

Empirically, `bun add` of a package that lists `bun` (regular or optional) still downloads the oven-sh platform packages (~80MB unpacked each; this VM pulled both glibc and musl plus a copy under `node_modules/bun`, ~146MB extra). Bun users already have a runtime; they must not pay that download/disk cost.

There is no package.json switch that makes bun skip *our* optionalDependencies while npm still installs them. `bun add -g --omit optional` is not a default we can impose.

### Node launcher + fetch only when PATH bun is missing

- `bin` is `bin/snowshoe.js` (`#!/usr/bin/env node`, no npm deps). It runs `src/index.ts` with: **PATH bun if usable**, else a **bundled** binary already in this install’s `node_modules` (`bun` package postinstall output or `@oven/bun-*`), forwarding argv, stdio, exit code, and SIGINT/SIGTERM/SIGHUP.
- If neither exists, **fetch** the official `bun@1.4.2` npm package into this install prefix (`npm install bun@1.4.2 --no-save`, global/omit flags stripped so a nested install stays local), then retry. Pin matches app CI `bun-version`. Bump the pin in `bin/resolve-bun.js` when CI’s Bun pin moves.
- If fetch is impossible, print a short Bun-install message (no stack trace) and exit non-zero.
- `postinstall`: `node ./bin/ensure-bun.js`. **npm** runs it (fetches when PATH bun is missing). **bun add -g** does not run it (`Blocked N postinstall` — untrusted lifecycle). **bun install in a clone** does run the root postinstall; the script no-ops when `npm_config_user_agent` contains `bun/` so CI/contributors do not download a second binary. PATH bun is still used at runtime.
- Keep `src/index.ts`’s `#!/usr/bin/env bun` for `bun src/index.ts` / tests.
- `engines`: `node >= 18` (launcher) and `bun >= 1.1.0` (runtime). `files` includes `bin/`.
- Windows is best-effort (same launcher; oven-sh ships win32 binaries).

`bun build --compile` remains a possible later distribution path, not this npm tarball. Amendment on the stack ADR.

### Version

`snowshoe --version`, `snowshoe -V`, and `snowshoe version` print the version from this install’s `package.json` (not a hardcoded string) and exit 0. `snowshoe help` / `help --json` / `--help` are unchanged (help still wins when `-h` / `--help` is present).

## Alternatives considered

- **`bun` as a regular/optional dependency** — npm users get a binary automatically; bun add -g pays ~146MB extra. Rejected (maintainer: bun users must not pay that cost).
- **Port the CLI to Node** — rejected; Bun-only APIs (`bun:sqlite`, `Bun.serve`, PTY spawn) stay.
- **`bun build --compile` now** — larger change, extra artifact matrix; not required to fix npm global.
- **Error-only Node shim (“install Bun”)** — meets the original issue text but not “npm i -g works without Bun.”
- **Lazy download with no postinstall** — bun users still fine; npm users wait on first `snowshoe`. Kept as fallback (`--ignore-scripts`); postinstall still warms npm installs.

## Consequences

- CURRENT: `npm i -g` works without a prior Bun; `bun add -g` uses PATH bun and does not download a second runtime; `--version` / `version` print `package.json` version.
- README / `skills/snowshoe/install.md`: npm works without Bun (fetched when missing); bun recommended if already in use.
- Do not publish from this change. Do not add learning, hooks, or a Node port.

## Evidence

Issues [#6](https://github.com/igorkravcenko/snowshoe/issues/6), [#7](https://github.com/igorkravcenko/snowshoe/issues/7). oven-sh `bun` npm package (`optionalDependencies` `@oven/bun-*`, `postinstall` copies `bin/bun.exe`). Bun lifecycle: root postinstall runs; dependency postinstalls are trusted-list only; `bun add -g` blocks the added package’s postinstall unless trusted.
