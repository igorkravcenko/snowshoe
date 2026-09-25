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

1. Local git-native hook after `pull` / `merge` (and long `checkout` when relevant) — **valid when enabled**; not installed by default `init` (see amendment below).
2. PR check / comment on GitHub/GitLab — social delta moment; **not** AI review.

**Secondary screen (where humans learn / rank):**

- Local navigable map opened on demand (e.g. `snowshoe map` — provisional binary-shaped example). **Later, not day-1 code:** tiny local HTTP + system browser; React + Vite; **tree-first**; bands display-only over float metrics — [implementation-stack ADR](./ADR-2026-09-25-implementation-stack.md). Graph / vault-like are not the first map (not forbidden forever).

**Always-on entry:**

- CLI as the automation and agent entrypoint. **Default signal path:** a human, or an agent with a skill, calls `snowshoe …` (e.g. `routine refresh`, `status`, `work …` — command families still proposed elsewhere).
- Optional TUI for status / queue / quiz in terminal.
- Thin IDE / MCP wrappers later; not v1 home.

**Explicitly not v1 center:** SaaS dashboard as sole surface; chat-only product; single-IDE plugin as sole home; TUI-only for the full map experience.

### Amendment (2026-09-25): hooks are opt-in

Locked with Igor (Tech Lead 1:1). Full stack/clarifications ADR: [ADR-2026-09-25-implementation-stack.md](./ADR-2026-09-25-implementation-stack.md).

- `snowshoe init` creates `.snowshoe/` + config (and personal-state ignore rules) — **does not** install git hooks.
- Separate commands (spelling **provisional**): e.g. `snowshoe hooks install` / `uninstall`, with the user choosing which hooks (post-merge / post-checkout / etc.).
- Hooks remain a *valid primary signal surface* when the user enables them. They are **not** auto-installed and are **not** required for the default skill → CLI path.

Do not read the original “primary signal = hook” list as “init installs hooks.”

## Alternatives considered

- Dashboard-first product — rejected for habit and “orca” failure mode.
- TUI-only — rejected for map agency needs.
- Skill-store-first discovery without delta signal — rejected as primary acquisition (see notes/discoverability).

## Consequences

- CURRENT and ROADMAP point here for surface intent.
- Informal chat shorthand *snow* is **not** a naming decision (not CLI, not locked short form).
- Open: exact post-pull UX (5-second view), PR-check wording, grey≠red, degradation heuristics — stay in notes until grilled into ADRs.
- Hook *copy* and which hook names ship remain open; hook *install-by-default* is closed (no).

## Evidence

Vision discussion (`cognitive-model-erosion/06-vision-discussion.md`); form note; Marketing Lead discoverability sketch (notes, not truth).
