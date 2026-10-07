# Snowshoe

[![License: Apache-2.0](https://img.shields.io/github/license/igorkravcenko/snowshoe)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/igorkravcenko/snowshoe/ci.yml?branch=main)](https://github.com/igorkravcenko/snowshoe/actions/workflows/ci.yml)

**Don't let your agents outrun your understanding. Keep your footing.**

Catch up after pull.

Do not `npm i -g snowshoe`. That package is an unrelated stamp client. This
project is `@igorkravcenko/snowshoe`.

After a pull or a big merge, Snowshoe shows what in your personal map went stale.
You choose what to catch up on. Agents can help. They don't get to outrun you.

Your map lives in `.snowshoe/` and stays gitignored. Local, git-native,
Apache-2.0. Not a team wiki. Not an agent control panel.

<!-- TODO(OWNER): replace with docs/assets/map-after-pull.png -->
_Screenshot placeholder: map after pull (stale nodes + catch-up). See [docs/assets/](docs/assets/)._

## Install

You need Bun 1.1+. The PATH binary is **`snowshoe`** (alias **`snoe`** is the same entrypoint).

### 1. Put `snowshoe` on PATH

**From the registry** (scoped package only):

```bash
bun add -g @igorkravcenko/snowshoe
# or: npm install -g @igorkravcenko/snowshoe
command -v snowshoe
```

**From a clone of this project** (contributors / local link):

```bash
bun install --frozen-lockfile
bun link
# ensure ~/.bun/bin is on PATH
command -v snowshoe
```

`snowshoe init` does **not** install git hooks. Hooks and the PR check are later intent.

### 2. Clone the repo you want to understand

Snowshoe maps **your** working tree. Clone (or open) that repository — it does not have to be this one.

```bash
git clone <your-repo> && cd <your-repo>
```

### 3. Install the skill into the agent harness

Opt-in; not part of `init`. Example for Cursor:

```bash
snowshoe skill install --json --skills-path .cursor/skills
```

Other harnesses: pass their skills directory as `--skills-path`. Check with `snowshoe skill list --json`.

## Learning (first pass)

Goal: open the map UI first, then run one agent in the UI terminal in **combined** mode — background drain (`work next --wait`) while you talk in the foreground about what to mark and detail.

1. **Open the UI** (soft-init: works before ledger init; empty map + CTA until init runs):

   ```bash
   snowshoe map serve --open
   ```

   Default port is **3232** (override with `--port`; `0` = ephemeral).

2. **Start an agent in the map UI terminal** and invoke the Snowshoe skill in **combined** mode (map UI open + keep draining while studying). The skill reads both `drain.md` and `learn.md`.

3. **Background:** one `snowshoe work next --json --wait` (optional `--wait-timeout 0` for no timeout). That waiter runs init / refresh / advance / claimed work as the queue needs. Do **not** start a second waiter.

4. **Foreground:** while wait is idle, talk — explore nodes, ask what they mean, ask to mark for detail / expand / enrich. Mark from the UI or ask the agent (`snowshoe map mark --json --slug <slug> --kind detail`). Marks stay disabled in the UI until the map is initialized.

5. When the agent finishes a batch of work, **reload the map** and mark the next nodes. Repeat.

6. Stay in one UI-terminal session: do not kill the background waiter just to study the map.

Longer path: [docs/brain/notes/how-to-try-e2e.md](docs/brain/notes/how-to-try-e2e.md).

## After a pull

When upstream moves:

```bash
git pull
```

Then drain again — either a one-shot catch-up (`snowshoe work next` via the skill on the drain branch) or the same **combined** session in the map UI (one `--wait` + foreground conversation). Reload the map when work lands.

## What it is / is not

| v1 intent | Not (v1) |
|---|---|
| After a pull: what went stale. You pick what to catch up. | A chat that “knows the repo” |
| PR-check (intent; not shipped) | AI code review |
| Personal comprehension map | Multiplayer knowledge graph |
| Human-chosen catch-up | Agent HITL / control plane |

Positioning: [docs/product/positioning.md](docs/product/positioning.md).

## Docs

Agents and contributors: start at [AGENTS.md](AGENTS.md).
License: [Apache 2.0](LICENSE) ([NOTICE](NOTICE)).
Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). Security: [SECURITY.md](SECURITY.md).
