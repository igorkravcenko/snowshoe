---
name: snowshoe
description: >-
  Snowshoe personal repo map. After pull or catch-up: drain via work next
  (init / routine refresh / routine advance, then complete claimed steps).
  In the map PTY or when studying the map (SNOWSHOE_MODE=learn): talk about
  the tree using map view / map status. PATH binary snowshoe; install.md
  only if the binary is missing.
---

# Snowshoe skill

Assume **`snowshoe` is on PATH**. Always pass `--json` and parse the result.

The install binary is **`snowshoe`** (call this). Short PATH alias **`snoe`** is the same entrypoint — do not prefer it in agent steps.

If this working repo is missing the skill files under the harness skills dir, run
`snowshoe skill install --json --skills-path <harness-skills-dir>` (e.g. `.cursor/skills`
for Cursor). Opt-in; not part of `init`. Prefer `snowshoe help --json` over guessing flags.

Drive the CLI. Do not write the ledger yourself. Do not start `map serve` unless the human asked.

If **this turn** they asked to mark, expand, enrich, fix, detail, or cancel named node(s) (or “this node”): `snowshoe map mark --json --slug <slug> --kind detail` (or `expand` / `enrich` / `fix`; `map detail mark` queues `detail`). Do not mark a tour of the tree. Then continue the drain/learn branch.

Read **one** sibling in this folder after the checks below. Never read both `drain.md` and `learn.md` in the same invocation. Do not open `install.md` unless `snowshoe` is missing.

## 1. Binary

If `command -v snowshoe` fails, read **`install.md`** in this same folder — only then.

After following it, run `command -v snowshoe` again:

- Still missing → **STOP**. The binary often needs a **new shell** after `bun link`. Tell the human how to re-check; do not start drain or learn.
- Now present **and** this turn already classified drain or learn → go to **Intent** and open that file.
- Now present **but** they only asked to install, or intent is still unclear → ask once: drain, learn, or stop.

## 2. Intent

Classify in this order:

1. The **user prompt that invoked this skill**.
2. Nearby user text **this turn only** (not the rest of the thread).
3. If text is still empty: `SNOWSHOE_MODE=learn` → learn. Other/empty mode does not override an explicit drain prompt.
4. Else **drain**.

| Drain-adjacent | Learn |
|---|---|
| after pull, catch up, drain, `work next`, marked nodes, complete queue | study / explain the map, “what is this node”, look at the map, map PTY agent |
| | `SNOWSHOE_MODE=learn` when (1)–(2) are empty |

Explicit drain in the prompt beats env.

If **both** drain and learn appear in one turn → ask one line which branch, or take the first/stronger signal. Then read only that file.

## 3. Branch

- Learn → read **`learn.md`**
- Drain (default) → read **`drain.md`**

## 4. Optional feedback

`snowshoe feedback add --json` (stdin `{ "text": "…", "command": "optional" }`) appends a local note about Snowshoe. Use only if the tool is unclear, frustrating, or you have a concrete idea. Not required. Do not log secrets or lease tokens. Then continue drain or learn.
