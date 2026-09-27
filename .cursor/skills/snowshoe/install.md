---
name: snowshoe-install
description: >-
  How to put the `snowshoe` binary on PATH. Open this file only when
  `command -v snowshoe` fails. Not part of the normal drain loop.
---

# Install `snowshoe` on PATH

The drain skill assumes the **`snowshoe`** binary is on PATH. Confirm:

```bash
command -v snowshoe
snowshoe --help
```

## From this package

In the Snowshoe package root (the directory that has `package.json` with `"bin": { "snowshoe": ... }`):

```bash
bun link
```

Ensure Bun’s global bin directory is on PATH (often `~/.bun/bin`). Then re-check `command -v snowshoe`.

After `bun link`, `command -v snowshoe` is a **single global** symlink. It does not follow git worktrees. If you `bun link` from clone A, then `cd` to clone B and run `snowshoe map serve`, the **ledger** is B but the **map UI** is still A’s `ui/dist`. To serve B’s UI: `bun link` from B, or from B run `bun src/index.ts map serve`.

Equivalent with npm, from the same package root:

```bash
npm link
```

## Global install

When a registry package exists:

```bash
npm install -g snowshoe
# or
bun add -g snowshoe
```

## Names

- **PATH / install name:** `snowshoe`
- **Not PATH:** informal *snow* (global `snow` is owned by Snowflake)
- **Optional:** a user-local shell alias such as `alias snoe=snowshoe` — convenience only, not the install bin

After `snowshoe` is on PATH, return to `SKILL.md` and start with `snowshoe work next --json`.
