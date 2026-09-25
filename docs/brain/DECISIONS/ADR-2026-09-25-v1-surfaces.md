---
status: accepted
date: 2026-09-25
---

# ADR-2026-09-25: v1 surfaces (signal vs map vs CLI)

## Status

Accepted (intent-level). UX copy and exact CLI flags remain open — grill before code.

## Context

Without a familiar place where “red” arrives by itself, the platform-agnostic overlay metaphor fails. A navigable map is required for agency, but making a standalone dashboard the *home* recreates “another app to open.” TUI-only likely cannot carry Obsidian-like navigation. PR surfaces must not become AI code review.

## Decision

**Primary signal (where red arrives on delta):**

1. Local git-native hook after `pull` / `merge` (and long `checkout` when relevant).
2. PR check / comment on GitHub/GitLab — social delta moment; **not** AI review.

**Secondary screen (where humans learn / rank):**

- Local navigable map (form open: graph / tree / vault-like) opened on demand (e.g. `snowshoe map` — provisional binary-shaped example; binary name TBD).

**Always-on entry:**

- CLI as the automation and agent entrypoint.
- Optional TUI for status / queue / quiz in terminal.
- Thin IDE / MCP wrappers later; not v1 home.

**Explicitly not v1 center:** SaaS dashboard as sole surface; chat-only product; single-IDE plugin as sole home; TUI-only for the full map experience.

## Alternatives considered

- Dashboard-first product — rejected for habit and “orca” failure mode.
- TUI-only — rejected for map agency needs.
- Skill-store-first discovery without delta signal — rejected as primary acquisition (see notes/discoverability).

## Consequences

- CURRENT and ROADMAP point here for surface intent.
- Informal chat shorthand *snow* is **not** a naming decision (not CLI, not locked short form).
- Open: exact post-pull UX (5-second view), PR-check wording, grey≠red, degradation heuristics — stay in notes until grilled into ADRs.

## Evidence

Vision discussion (`cognitive-model-erosion/06-vision-discussion.md`); form note; Marketing Lead discoverability sketch (notes, not truth).
