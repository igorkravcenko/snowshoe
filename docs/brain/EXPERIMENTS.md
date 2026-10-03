---
status: registry
updated: 2026-10-04
---

# EXPERIMENTS

Registry of named bets. **Not truth.** An experiment does not change CURRENT until it is promoted with an ADR.

GTM sketch, skills-overlap, solutions ranking, and pre-repo provenance live in
private maintainers docs (`docs/private` after `./scripts/link-private-overlay.sh`).
Public rows below do not markdown-link into `docs/private`.

| ID | Hypothesis | Status | Evidence | Promotion bar |
|---|---|---|---|---|
| E-signal-pull | A post-pull / post-merge hook is the strongest first “red arrived” surface for solo IC | promoted | Private maintainers: pre-repo provenance (after overlay) | Promoted via [ADR-2026-09-25-v1-surfaces](./DECISIONS/ADR-2026-09-25-v1-surfaces.md) (intent already accepted; 2026-09-25 amendment: hooks **opt-in**, not default `init`). Remaining work is UX/copy grill in ROADMAP (5-second signal, grey≠red) — not reopening auto-install. |
| E-pr-check | A PR check/comment that is *not* AI review can still surface comprehension risk socially | promoted | Private maintainers: pre-repo provenance (after overlay) | Promoted via [ADR-2026-09-25-v1-surfaces](./DECISIONS/ADR-2026-09-25-v1-surfaces.md) (intent already accepted). Remaining work is UX/copy grill in ROADMAP (not-review wording; no false “approved understanding”). |
| E-skills-entry | Skills in Cursor/Claude/Codex stores are secondary acquisition, not primary | proposed | Private maintainers: skills-overlap brief (after overlay) | Measure install/entry path later — do not invent metrics. Skill-store-as-primary already rejected in v1-surfaces alternatives. |
| E-compose-teachback | Existing teach-back skills (mentor / learn-codebase class) can be workers under Snowshoe verify protocol | proposed | Private maintainers: skills-overlap brief (after overlay) | Protocol contract exists; no unilateral green |

Status values: `proposed` · `running` · `concluded` · `promoted` · `killed`.

Process experiments (grilling a wedge, WTP interviews) may be listed when they exist. Do not invent product metrics.
