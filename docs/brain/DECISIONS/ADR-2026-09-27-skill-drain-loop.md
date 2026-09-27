---
status: accepted
date: 2026-09-27
---

# ADR-2026-09-27: Skill drain loop, work-next gates, PATH bin `snowshoe`

## Status

Accepted. Amends the skill package in [ADR-2026-09-27-map-ui-and-skill](./ADR-2026-09-27-map-ui-and-skill.md). Does **not** promote proposed routine ADRs A/B. Does **not** add learning.

## Context

The first skill at `.cursor/skills/snowshoe/` was written against this repository (HP names, `bun src/index.ts`, schema paths, “no learning” framing, `--batch-size 1`). The drain loop asked the agent to poll `routine status` itself. `work next` failed opaquely before `init`. Informal *snow* was easy to confuse with a PATH command (Snowflake owns global `snow`).

Igor-locked: the skill must be repo-agnostic and self-contained; entry is `work next`; missing `snowshoe` loads a sibling `install.md` only then.

## Decision

### Skill

- Package remains `.cursor/skills/snowshoe/` (`SKILL.md` + sibling `install.md`).
- Skill protocol is the drain loop only. Learning absence is product WIP, not skill text.
- Assume **`snowshoe` on PATH**. If missing, open `install.md` in the same folder only then — not a separate skill, not loaded into a normal drain.
- Payload examples live in the skill (or `snowshoe … --help`). Do not point agents at `docs/brain/schemas/…`.
- Human uses the map UI to mark, cancel, and reload. Agent completes via CLI; human reloads.

### `work next` gating

`snowshoe work next --json` is the **entry** command. Until an unlock is done, it surfaces **only** that unlock. Field shape:

| Field | Values |
|---|---|
| `action` | `init` · `refresh` · `advance` · `work` · `idle` |
| `todo` | Exact command when gated: `snowshoe init --json`, `snowshoe routine refresh --json`, or `snowshoe routine advance --json`. `null` otherwise. |
| `items` | Claimed steps. Empty unless claiming work. |

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

## Consequences

- CURRENT: skill is PATH-`snowshoe`, `work next` gated, default batch 5. Optional `--wait`: [ADR-2026-09-27-work-next-wait](./ADR-2026-09-27-work-next-wait.md).
- Proposed ADR-B CLI families stay proposed; this ADR specifies the working `work next` envelope for the slice.

## Evidence

- [../notes/how-to-try-e2e.md](../notes/how-to-try-e2e.md)
- [../notes/skill-worker-contract.md](../notes/skill-worker-contract.md) (historical loop; this ADR is truth for the skill)

