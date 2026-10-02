---
status: accepted
date: 2026-09-27
---

# ADR-2026-09-27: Skill drain loop, work-next gates, PATH bin `snowshoe`

## Status

Accepted. Amends the skill package in [ADR-2026-09-27-map-ui-and-skill](./ADR-2026-09-27-map-ui-and-skill.md). Does **not** promote proposed routine ADRs A/B. Does **not** ship learning/quiz/verify. 2026-09-29: package is a thin `SKILL.md` gate plus `drain.md` / `learn.md` (learn file is channel instructions, not a quiz product).

## Context

The first skill at `.cursor/skills/snowshoe/` was written against this repository (HP names, `bun src/index.ts`, schema paths, “no learning” framing, `--batch-size 1`). The drain loop asked the agent to poll `routine status` itself. `work next` failed opaquely before `init`. Informal *snow* was easy to confuse with a PATH command (Snowflake owns global `snow`).

Igor-locked: the skill must be repo-agnostic and self-contained; entry is `work next`; missing `snowshoe` loads a sibling `install.md` only then.

## Decision

### Skill

- Package remains **one** Cursor skill at `.cursor/skills/snowshoe/` (`SKILL.md` gate + `drain.md` + `learn.md` + sibling `install.md`). Not three skills.
- `SKILL.md` is the **only** copy of shared operator rules: PATH/`--json`, bin name / `snoe`, do not write the ledger, do not start `map serve` unless asked, one branch, `install.md` only if missing. It may mention optional `snowshoe feedback add --json` (dev inbox; not a drain step) ([ADR-2026-09-30-agent-feedback-inbox](./ADR-2026-09-30-agent-feedback-inbox.md)). YAML `description` covers after-pull drain **and** map-PTY / study-the-map (`SNOWSHOE_MODE=learn`). `drain.md` / `learn.md` / `install.md` do not restate those lines.
- **No binary** (`command -v snowshoe` fails) → read `install.md` only (not loaded on a normal drain or learn). Recheck PATH. Still missing → STOP (new shell). Present and this turn already classified → that branch. Present but they only asked to install / intent unclear → one question: drain, learn, or stop.
- **Intent** (this invocation): (a) the user prompt that invoked the skill; (b) nearby user text **this turn only**; (c) `SNOWSHOE_MODE=learn` if text is still empty; (d) **drain**. Explicit drain in the prompt beats env. Greys: “look at the map” / “what is this node” → learn; “after pull / catch up / marked nodes / work next” → drain.
- **One branch per invocation.** Never read both `drain.md` and `learn.md`. If both intents appear, one-line ask or first/stronger signal.
- Drain protocol lives in `drain.md` (`work next` loop). Detail hop: grow vs `unchanged` (no child-count cap; prefer refs to existing slugs; `leaf` is a stop-flag; `symbol` may have children; group or stage important children when the cut is large). One `--wait` loop per session. Read models: `work next` `children[]`, or `map status --slug` / `--depth` / `--neighborhood --slug` (default columns `slug,children`; `--all-fields` for the rest). Detail complete may enrich `parentSlug`, `retire` descendants, `clearEdges` in-subtree. `learn.md` is conversation about the mapped repo; no quiz/verify; do not complete claimed steps (re-invoke for drain). `install.md` is how to get the binary on PATH, not when to load it.
- Payload examples live in `drain.md` (or `snowshoe … --help`). Agent command index: `snowshoe help --json`. Do not point agents at `docs/brain/schemas/…`.
- Human uses the map UI to mark, unmark, and reload, **or** this turn asks the agent to run `map mark` / `map detail mark` / `cancel` for named nodes (not an autonomous crawl) ([ADR-2026-09-30-user-asked-mark-and-help](./ADR-2026-09-30-user-asked-mark-and-help.md), [ADR-2026-10-01-map-polish](./ADR-2026-10-01-map-polish.md)). Agent completes via CLI on the drain branch; human reloads. `snowshoe help --json` is the agent command index.

### `work next` gating

`snowshoe work next --json` is the **entry** command. Until an unlock is done, it surfaces **only** that unlock. Field shape:

| Field | Values |
|---|---|
| `action` | `init` · `refresh` · `advance` · `work` · `idle` |
| `todo` | Exact command when gated: `snowshoe init --json`, `snowshoe routine refresh --json`, or `snowshoe routine advance --json`. `null` otherwise. |
| `items` | Claimed steps. Empty unless claiming work. Map hops (`expand` / `enrich` / `fix`; legacy `detail` = expand) include `parentSlug`, `allowedChildTypes`, `children`, `intent`, `marks`. |

Order: uninitialized → `init`; HEAD/target moved needs refresh → `refresh`; claimable work → `work`; queue idle and FSM allows advance → `advance`; else `idle`. Keep `--json`. Exit 0 on followable gates (not an opaque usage fail).

Agent loop: outer cycle re-runs `work next`; if `todo` is set, run only that command; if `items` empty and no `todo`, stop **unless** the human asked for an interactive map drain, in which case the next poll is `work next --json --wait` (see [ADR-2026-09-27-work-next-wait](./ADR-2026-09-27-work-next-wait.md)). Inner loop completes the current batch; do not assume the queue is empty after finishing those tickets.

### Default batch size

`--batch-size` default is **5** (≥ 3). `--budget` remains a deprecated alias. The skill must not recommend a batch of one.

### PATH vs chat

Install / PATH binary is **`snowshoe`**. Informal *snow* is not PATH. Optional user-local alias `snoe` is convenience only. See the provisional-name ADR amendment.

## Alternatives considered

- Keep `routine status` as skill entry — rejected; one gate (`work next`) is enough.
- Opaque fail before `init` — rejected; structured `todo` is followable.
- Default `--batch-size 1` — rejected; too chatty for a drain loop.
- Separate install skill — rejected; sibling file, loaded only when missing.
- Three Cursor skills (drain / learn / install) — rejected; one package, progressive disclosure.

## Consequences

- CURRENT: skill package is a gate; drain still PATH-`snowshoe`, `work next` gated, default batch 5. Optional `--wait`: [ADR-2026-09-27-work-next-wait](./ADR-2026-09-27-work-next-wait.md). `learn.md` is not quiz.
- Proposed ADR-B CLI families stay proposed; this ADR specifies the working `work next` envelope for the slice.

## Evidence

- [../notes/how-to-try-e2e.md](../notes/how-to-try-e2e.md)
- [../notes/skill-worker-contract.md](../notes/skill-worker-contract.md) (historical loop; this ADR is truth for the skill)

