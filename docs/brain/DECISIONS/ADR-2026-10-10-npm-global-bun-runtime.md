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

Empirically, `bun add` of a package that lists `bun` (regular or optional) still downloads the oven-sh platform packages (~80MB unpacked each; a Linux x64 VM pulled both glibc and musl plus a copy under `node_modules/bun`, ~146MB extra). Bun users already have a runtime; they must not pay that download/disk cost.

There is no package.json switch that makes bun skip *our* optionalDependencies while npm still installs them.

### Node launcher; Node >=18 is required on every install path

- `bin` is `bin/snowshoe.js` (`#!/usr/bin/env node`, no npm deps). **Node.js 18+ must be on PATH for every install path**, including `bun add -g`. There is no second Bun-native entrypoint.
- The launcher runs `src/index.ts` with: **PATH bun if usable** (always probed with `bun --version`), else a **bundled** binary already in this install’s `.runtime/current`, forwarding argv, stdio, and SIGINT/SIGTERM/SIGHUP. On signal, the launcher removes its own listeners and exits `128 + signal` (not 0).
- `engines`: `node >= 18` (launcher; cheap runtime check) and `bun >= 1.1.0` (CLI). `files` includes `bin/`.
- Linux and macOS are the supported platforms. Windows is best-effort: `.cmd` shims spawn with `shell: true` and quoted paths (Node >=18.20.2 / CVE-2024-27980 refuses `.cmd` without a shell). Prefer `bun.exe` on PATH.

### Fetch only the matching `@oven/bun-<platform>` into `.runtime/`

When PATH bun is missing, **do not** `npm install bun` in the Snowshoe package directory (that reifies Snowshoe’s own `package.json`, including `devDependencies` and lifecycle scripts, and npm 9 also pulls unused musl+glibc extra packages).

Instead:

1. Take an **atomic lock** at `<packageRoot>/.runtime/lock`: write `owner.json` (`pid` + `host`) in a staging directory, then `rename` onto the lock path so waiters never see an owner-less lock. A dead PID on this host is stale immediately; waiters print `waiting for another snowshoe to finish downloading Bun…` and reuse `.runtime/current`. mtime (180s) is only a fallback for another host. Ctrl-C / SIGTERM / SIGHUP are hooked **before** `ensureBun` and also inside it: kill any in-flight `npm` child, release the lock, delete the in-flight tmp dir, exit `128+n` (SIGTERM → 143). Orphan `tmp-<pid>-*` dirs and `snowshoe-npm-pack-<pid>-*` temps whose PID is dead are swept at install start.
2. Download **only** the matching `@oven/bun-<platform>@1.4.2` tarball. Registry comes from env `npm_config_registry`, then `@oven:registry` / `registry` in global → user (`npm_config_userconfig` or `~/.npmrc`) → project `.npmrc` (default `https://registry.npmjs.org`). `@oven/bun-*` is a **public** package: the Node fetch path **never** sends `Authorization` (not on metadata, redirects, or the tarball; `NPM_TOKEN` / `NODE_AUTH_TOKEN` / `_authToken` are ignored). Authenticated private mirrors are not supported on that path — put bun on PATH, or use HTTP(S)_PROXY so isolated `npm pack` applies the user’s npm auth. When the configured registry’s origin differs from `dist.tarball`, rewrite the tarball URL to `<registry>/@oven/<id>/-/<id>-<version>.tgz`. Verify `dist.integrity` (sha512); integrity failures are not labeled “could not reach”. Extract **only** `package/bin/bun` or `package/bin/bun.exe` (`^bin/bun(\.exe)?$` after stripping `package/`), **rename atomically** onto `.runtime/current`.
3. Bound the whole fetch (headers **and** body: `json()` / `arrayBuffer()`) at **120s** with one AbortController. On timeout or failure, print a **short** actual cause (undici connect-timeout is not labeled as a 120s bound). Tarball URLs must be **https** unless the configured registry is `http:`; **https→http redirects are refused**.
4. Pin matches app CI `bun-version`. Bump `BUN_FETCH_VERSION` in `bin/resolve-bun.js` when CI’s Bun pin moves.
5. libc: glibc vs musl on Linux (`process.report` / `/etc/alpine-release`). x64 without AVX2 (`/proc/cpuinfo`, macOS `sysctl`) uses oven-sh `*-baseline` ids. Android uses `bun-linux-*-android`.
6. Default transport is Node `fetch` (npm not required). **HTTP(S)_PROXY / npmrc `proxy` / `https-proxy`**: Node fetch does not honor proxies; when a proxy applies and the registry host is not in `NO_PROXY`, fall back to isolated `npm pack @oven/<id>@<version>` spawned **async** with `cwd` = a mkdtemp dir (dummy `package.json`; not the user’s cwd), `--fetch-retries=0`, a short `--fetch-timeout`, and a one-line failure (no npm stderr). npm must be on PATH; still checks `dist.integrity`. Does **not** run oven-sh `bun` `install.js`.

`postinstall` (`node ./bin/ensure-bun.js`) warms `.runtime/` on npm installs when PATH bun is missing. **`bun add -g`** blocks this package’s postinstall (untrusted lifecycle) and uses PATH bun. **`bun install` in a clone** no-ops when `npm_config_user_agent` contains `bun/`. `--ignore-scripts` delays the fetch until first `snowshoe`; the lock covers concurrent first runs.

Keep `src/index.ts`’s `#!/usr/bin/env bun` for `bun src/index.ts` / tests.

`bun build --compile` remains a possible later distribution path, not this npm tarball.

### Version

`snowshoe --version`, `snowshoe -V`, and `snowshoe version` print the version from this install’s `package.json` (not a hardcoded string) and exit 0. `snowshoe help` / `help --json` / `--help` are unchanged (help still wins when `-h` / `--help` is present).

### sudo / ownership

A root-owned global prefix (`sudo npm install -g`) makes `.runtime/` unwritable for a later unprivileged `snowshoe`. Fail with a short permission message (do not hang). Prefer an unprivileged prefix, or put bun on PATH.

Empty `@igorkravcenko/` after `npm uninstall -g` is npm’s scoped-package behaviour; we do not clean it.

## Alternatives considered

- **`bun` as a regular/optional dependency** — npm users get a binary automatically; bun add -g pays ~146MB extra. Rejected.
- **Nested `npm install bun@1.4.2` in the Snowshoe package cwd** — reifies Snowshoe’s package.json (devDeps + scripts as root under `sudo npm i -g`); npm 9 also installs unused musl. Rejected after critic/QA.
- **Port the CLI to Node** — rejected; Bun-only APIs stay.
- **`bun build --compile` now** — larger change, extra artifact matrix.
- **Error-only Node shim (“install Bun”)** — not “npm i -g works without Bun.”
- **A second Bun-native `bin` entry** — rejected; Node 18+ is required on every path.

## Notes (not product claims)

- Relative `PATH` entries resolve against **cwd**, like a shell (not against `packageRoot`).
- `engines.node` is also checked cheaply at launcher start.
- oven-sh `install.js` hardcodes a registry.npmjs.org fallback; we never run it.

## Consequences

- CURRENT: Node 18+ required; `npm i -g` works without a prior Bun (one-time matching platform download into `.runtime/`); `bun add -g` uses PATH bun and does not download a second runtime; `--version` / `version` print `package.json` version.
- README / `skills/snowshoe/install.md` / first-run stderr: Node 18+; npm works without Bun (one-time download, ~40 MB compressed / ~80 MB unpacked on linux x64); bun recommended if already in use; Linux/macOS, Windows best-effort; avoid sudo global if the user will run as non-root; custom registry / `.npmrc` / `npm_config_userconfig` honored; Node fetch never sends Authorization; authenticated private mirrors use `npm pack` (proxy) or a PATH bun; HTTP(S)_PROXY uses isolated `npm pack`.
- Do not publish from this change. Do not add learning, hooks, or a Node port.

## Evidence

Issues [#6](https://github.com/igorkravcenko/snowshoe/issues/6), [#7](https://github.com/igorkravcenko/snowshoe/issues/7). oven-sh platform packages `@oven/bun-*`. Bun lifecycle: root postinstall runs; `bun add -g` blocks the added package’s postinstall unless trusted.
