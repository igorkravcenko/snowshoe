# Snowshoe

[![License: Apache-2.0](https://img.shields.io/github/license/igorkravcenko/snowshoe)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/igorkravcenko/snowshoe/ci.yml?branch=main)](https://github.com/igorkravcenko/snowshoe/actions/workflows/ci.yml)

**Don't let your agents outrun your understanding. Keep your footing.**

Catch up after pull. Personal comprehension map that shows where your understanding went stale after changes.
You choose what to catch up on. Agents can help.

Your map lives in `.snowshoe/` and stays gitignored by default. Local, git-native,
Apache-2.0. Not a team wiki. Not an agent control panel.

![ui_screenshot](docs/assets/map-after-pull.png)

## Install

The PATH binary is **`snowshoe`**. **Node.js 18+** is required (including after `bun add -g`). You'll also need an agent harness that can run in a CLI.

`npm install -g` works without a prior Bun install: the first install or run downloads a matching Bun binary once (~40 MB compressed / ~80 MB unpacked on linux x64). Bun on PATH is still used when present, and is recommended if you already use it. Linux and macOS are supported; Windows is best-effort. Prefer an unprivileged npm prefix (`sudo npm i -g` leaves a root-owned install that a later non-root `snowshoe` cannot update).

The download uses your npm registry (`npm_config_registry`, user/project/global `.npmrc`, and `@oven:registry`) and sends `_authToken` as a Bearer header. Node's fetch does not honor `HTTP(S)_PROXY`; when a proxy applies (and the host is not in `NO_PROXY`), the launcher runs isolated `npm pack @oven/bun-<platform>@…` instead — npm must be on PATH for that path — and still checks the tarball integrity.

> [!IMPORTANT]
> This project is `@igorkravcenko/snowshoe` on npm. Bare `snowshoe` without the scope is an unrelated package.

### 1. Put `snowshoe` on PATH

**From the registry** (preferred):

```bash
npm install -g @igorkravcenko/snowshoe
# or, if you already use Bun:
bun add -g @igorkravcenko/snowshoe
command -v snowshoe
```

**From a clone of this project** (contributors / local link):

```bash
bun install --frozen-lockfile
bun link
# ensure ~/.bun/bin is on PATH
command -v snowshoe
```

### 2. Clone the repo you want to understand

Snowshoe maps **your** working tree. Clone (or open) that repository.
Keep it separate from your day-to-day checkout so learning stays apart from other work.

```bash
git clone <your-repo> && cd <your-repo>
```

### 3. Install the skill into the agent harness

Example for Cursor:

```bash
snowshoe skill install --json --skills-path .cursor/skills
```

Other harnesses: pass their skills directory as `--skills-path`.

## Learning

1. **Open the UI**:

   ```bash
   snowshoe map serve --open
   ```

   Default port is **3232** (override with `--port`; `0` = ephemeral).

2. **Start an agent in the map UI terminal** and invoke the Snowshoe skill in **combined** mode:

   ```
   /snowshoe combined en
   ```

   Use your language instead of `en` if you prefer (for example `ru` or `de`).
   Combined mode lets the agent be both a worker (building and expanding the mental map)
   and a tutor (talking with you and teaching).
   Do **not** start more than one worker at a time.

3. **Traverse** the mental map with the tree or the graph views. **Mark** the nodes of interest for expansion and enrichment.
   The worker agent should pick up the work you asked for and update the map accordingly.
   For now, reload the map manually with the `Reload` button.
   If you want something specific, just ask the agent.

4. **Learn** by asking your agent to explain things and teach you. **Track** your understanding with the matching metrics.

5. **Pull** changes for the repo. Trigger the Snowshoe skill to react to the changes.

## What runs locally

`snowshoe map serve` binds **loopback only** (`127.0.0.1` / `localhost` / `::1`).
The map UI includes a terminal that runs **your shell and inherits your
environment**. `GET /api/file` serves repo file contents to the map UI (sandboxed
to the repo root). The printed URL (and `--open`) contains a **per-launch token**
in the fragment — treat it like a password; it can end up in agent transcripts
and browser history. Origin + that token protect the PTY and `/api`. Stop the
server when you are done.

## What it is / is not

| v1 intent | Not (v1) |
|---|---|
| After a pull: what went stale. You pick what to catch up. | A chat that “knows the repo” |
| Personal comprehension map | Multiplayer knowledge graph |
| Human-chosen catch-up | Agent HITL / control plane |

Positioning: [docs/product/positioning.md](docs/product/positioning.md).

If you're interested in a collaborative version of this for teams - [let me know](https://github.com/igorkravcenko/snowshoe/discussions).

## Docs

Agents and contributors: start at [AGENTS.md](AGENTS.md).
License: [Apache 2.0](LICENSE) ([NOTICE](NOTICE)).
Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). Security: [SECURITY.md](SECURITY.md).
