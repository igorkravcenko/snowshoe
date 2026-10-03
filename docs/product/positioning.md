---
status: canonical
updated: 2026-10-04
---

# Positioning

One page. Matches CURRENT. Brand is provisional.

## Name and subtitle

- **Working title:** Snowshoe. **Backup:** Catchmark (canon/agent only — not README / CLI / UI / skills). Informal *snow* in discussion is not a locked short form. npm package: `@igorkravcenko/snowshoe`.
- **Subtitle:** Don't let your agents outrun your understanding. Keep your footing.

## Wedge

Git-native **personal comprehension map of a repository** (any clone; the map/ledger is personal/local — not limited to “personal GitHub repos”). After commits or `git pull`, understanding goes stale in visible ways; the **human chooses** what to catch up on.

Form: CLI-first **orchestrator** — owns freshness + verify; agents are pluggable workers. Personal ledger local/gitignored by default.

## Surfaces (v1 intent)

- **Signal:** CLI by default (human or skill → `snowshoe …`); **opt-in** post-pull/merge hook + PR-check (not AI review). `init` does not install hooks.  
- **Learn:** on-demand local map (later: tree-first in the system browser); optional TUI for status/queue/quiz; CLI always.  
- **Not the home:** SaaS dashboard; chat-only; single-IDE-only.

## Not (v1)

- Chat hell / “ask the repo” as the product  
- AI code review  
- Multiplayer knowledge graph as the first wedge  
- Agent HITL / control plane  
- Nested full agent harness  
- Generic agent-memory / “mental model KG” shelf  

## Monetization (summary)

Not implementing billing. OSS / local core **free forever**. Policy: [ADR-2026-09-25-monetization-ladder](../brain/DECISIONS/ADR-2026-09-25-monetization-ladder.md). No public price bands; later paid/team sketches stay in private maintainers docs after overlay.

## Differentiate vs platform “catch me up”

Personal ledger + freshness after **git delta** + verify — not a one-shot chat that explains the repo.
