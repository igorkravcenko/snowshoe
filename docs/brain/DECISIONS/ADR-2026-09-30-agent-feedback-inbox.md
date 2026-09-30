---
status: accepted
date: 2026-09-30
---

# ADR-2026-09-30: Dev agent feedback inbox

## Status

Accepted. Dev-only inbox for optional agent notes about Snowshoe itself. Not a v1 product surface. Does not promote routine ADRs A/B. Not HITL, chat, or a drain step.

## Context

Agents are a user sidestep: they exercise the CLI/skill while a human maps a repo. Occasional notes (unclear, frustrating, a concrete idea) are useful dogfood. They must not become a required loop, a work queue, or a conversation channel.

## Decision

- Optional `snowshoe feedback add --json` appends one JSONL row under gitignored `.snowshoe/feedback/log.jsonl` in **mapped cwd** (personal, not telemetry). `snowshoe feedback list --json` reads newest first. Write may mkdir that dir without a full ledger init.
- `GET /api/feedback` is a read-only HTTP twin of `feedback list`. The map UI does not POST. Sidebar tab **Feedback** lists entries (fetch on tab; light poll while open).
- Gate [`SKILL.md`](../../../.cursor/skills/snowshoe/SKILL.md) may mention the command in a few lines (when it might help; not required; no secrets; continue drain/learn). Not a third intent branch. `drain.md` / `learn.md` do not nag.
- Not SQLite, not FSM, no replies, no `work complete` from feedback.

## Alternatives considered

- Store next to the snowshoe packageRoot — rejected for this slice; mapped `.snowshoe/` matches other personal state.
- Ledger table / detail steps — rejected; not map work.

## Consequences

CURRENT: one line that optional `feedback add` exists (gitignored, sidebar tab, not v1). Map UI ADR: third sidebar tab. Skill-drain-loop: optional gate hint.

## Evidence

None required (dev inbox).
