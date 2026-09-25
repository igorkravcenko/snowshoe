---
status: canonical
updated: 2026-09-25
---

# Positioning

One page. Matches CURRENT. Brand is provisional.

## Name and subtitle

- **Working name:** Snowshoe (not final). **Backup:** Catchmark. Informal *snow* in discussion is not a locked short form.
- **Subtitle:** Catch up after pull.

## Wedge

Git-native / ideally OSS layer for a **personal** repo comprehension map. After commits or `git pull`, understanding goes stale in visible ways; the **human chooses** what to catch up on.

Form: CLI-first **orchestrator** — owns freshness + verify; agents are pluggable workers. Personal ledger local/gitignored by default.

## Surfaces (v1 intent)

- **Signal:** CLI by default (human or skill → `snowshoe …`); **opt-in** post-pull/merge hook + PR-check (not AI review). `init` does not install hooks.  
- **Learn:** on-demand local map (later: tree-first in the system browser); optional TUI for status/queue/quiz; CLI always.  
- **Not the home:** SaaS dashboard; chat-only; single-IDE-only.

## Not (v1)

- Chat hell / “ask the repo” as the product  
- AI code review (wrong buyer, wrong price shelf, wrong expectations)  
- Multiplayer knowledge graph as the first wedge  
- Agent HITL / control plane  
- Nested full agent harness  
- Generic agent-memory / “mental model KG” shelf  

## Monetization (summary)

Not implementing billing. Full decision: [ADR-2026-09-25-monetization-ladder](../brain/DECISIONS/ADR-2026-09-25-monetization-ladder.md).

- **Core:** OSS / local map + catch-up signal — free forever  
- **Paid:** sync / hosted freshness / multi-device convenience (and maybe a commercial binary later)  
- **Team seats:** only when shared surfaces exist; not a solo seat tax  
- **Solo WTP test:** $5–20/mo (hypothesis; no public anchor for this exact wedge)  
- **Avoid:** core paywall, CodeRabbit-class AI-review pricing/messaging, enterprise-only day 1, invented ARR/users  

There is no proven public price for a personal post-pull comprehension map as of 25 Sep 2026. Do not pretend otherwise on a landing page.

## Differentiate vs platform “catch me up”

Personal ledger + freshness after **git delta** + verify — not a one-shot chat that explains the repo.
