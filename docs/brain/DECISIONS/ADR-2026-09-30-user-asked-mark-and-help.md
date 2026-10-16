---
status: accepted
date: 2026-09-30
---

# ADR-2026-09-30: User-asked detail mark + `snowshoe help`

## Status

Accepted. Amends [ADR-2026-09-27-skill-drain-loop](./ADR-2026-09-27-skill-drain-loop.md). Does not promote routine A/B. Not HITL: the human still chooses *whether* to expand; the agent may run the same CLI as the UI when that choice is in **this turn**.

## Context

`snowshoe map detail mark` already exists. Canon said only the human (UI) marks so the map is not an agent-driven crawl. Operators still want to say “mark auth and drain.” Agents also guess flags; citty `--help` is per-command and easy to skip.

## Decision

- **Mark / cancel:** The agent may run `snowshoe map detail mark --json --slug <slug>` (and cancel) **only if this turn’s user text asked** to mark, expand, or cancel those nodes (named slug, “this node”, current map view). Do not walk the tree marking gray nodes. UI mark/cancel unchanged.
- **Help:** `snowshoe help --json` is the agent-oriented command index (when to run what). Gate/`drain.md` point at it; payloads stay in `drain.md` and `snowshoe <cmd> --help`. Not a second skill file.

## Alternatives considered

- Agent-autonomous mark of every expandable node — rejected; agency.
- Help only as markdown in the skill — rejected; CLI is the util contract.

## Amendment 2026-10-15: Context “only the human (UI) marks” is historical

That sentence in Context describes a *prior* default that this ADR already
replaced. **Do not quote it as current truth.** Current rule is the Decision:
the agent may mark/cancel **if this turn’s user text asked**. Autonomous
tree-crawling marks stay rejected.

**Mark is not color.** Mark kinds (`detail` / `expand` / `enrich` / `fix`)
enqueue work. Node green/red is display over metric floats
(`snowshoe map metric` — [ADR-2026-10-02-map-metric-cli](./ADR-2026-10-02-map-metric-cli.md)).
Do not mash “only the human marks” into “only the human paints green.”

## Consequences

CURRENT: human may ask the agent to mark this turn; `snowshoe help --json`. Skill-drain-loop: mark rule + help as index. The Context line “only the human (UI) marks” is historical, not a living claim. Root `--help` / no-args is a human postcard, not this index — [ADR-2026-10-16-root-help-human](./ADR-2026-10-16-root-help-human.md).
