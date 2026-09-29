---
name: snowshoe-install
description: >-
  How to put the `snowshoe` binary on PATH (`bun link` / `npm link` / global).
---

# Install `snowshoe` on PATH

From the Snowshoe package root (`package.json` with `"bin": { "snowshoe": ... }`):

```bash
bun link
```

Put Bun’s global bin on PATH (often `~/.bun/bin`). Then:

```bash
command -v snowshoe
snowshoe --help
```

`bun link` is **one global** symlink. It does not follow git worktrees. If you link clone A, then `cd` to clone B and run `snowshoe map serve`, the **ledger** is B but the **map UI** is still A’s `ui/dist`. To serve B’s UI: `bun link` from B, or from B run `bun src/index.ts map serve`.

Equivalent:

```bash
npm link
```

When a registry package exists:

```bash
npm install -g snowshoe
# or
bun add -g snowshoe
```
