---
status: note
updated: 2026-09-25
---

# Note: Vision open questions

Carried from vision discussion (2026-09-24). Not truth. Grey = not modeled ≠ red = human doesn’t understand — must stay distinct in any UI.

## Still open

1. Minimal transparent structure for first prototype: **first map path is tree-first** (stack ADR, later-not-day-1). Graph vs vault remain open as later alternatives, not a day-1 fork.  
2. Metrics model: coverage / verified / stale / agent-confidence — how to separate in UI and data. Inclination: coverage ≠ verified (teach-back); self-rated marked unverified; children ≠ parent without self.  
3. Degradation after diff: v0 rules that are honest (conservative red on contracts/boundaries; leaf nits barely touch parents).  
4. Day-one persona and “aha” in one session (wedge inclination already: one human + one repo + “I fell behind”).  
5. Progressive detail: cheap high-level model first; deepen on demand; HITL when teaching a low-confidence or boundary-shifted node.  
6. Grounding: prefer repo docs/ADR + provenance; dispute flags; full ontology editor later, not v1 requirement.

## Constraints / metaphors worth keeping

- **Agency:** human ranks what to learn; avoid agent “100500 red” queues.  
- **Orca / platform-agnostic:** portable overlay over git + external systems; OSS as trust/distribution channel; moat more in stale logic + habit than in “we are OSS.”  
- **Platform threat:** Cursor/Claude “catch me up” chat — differentiate *personal ledger + freshness after git*, not chat “explain the repo.”

## Next

Grill into ADRs or kill. Do not invent answers in CURRENT.
