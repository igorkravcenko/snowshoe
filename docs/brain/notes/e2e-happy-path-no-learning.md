---
status: note
date: 2026-09-27
---

# E2E happy path (no learning)

Status: **draft for plant** — single chained scenario for UI + skill implementation.  
Pointers: [happy-paths.md](./happy-paths.md) (HP scraps), [skill-worker-contract.md](./skill-worker-contract.md), [ui-ledger-split.md](./ui-ledger-split.md), [detail-queue-and-map.md](./detail-queue-and-map.md), schemas under `docs/brain/schemas/`.

ADR-A/B stay **proposed**; this note does not promote them.

## Locked assumptions

| Item | Value |
|------|--------|
| Root slug | `root` (`type: system`, util-owned) |
| Map read CLI | `snowshoe map status --json` (HTTP twin shares same JSON) |
| Init | no hooks, no spawn; util **auto-enqueues** root `detail` on empty ledger; skill is actor |
| Ledger/map | local `.snowshoe/**`, not committed to project git |
| Epoch detect | only on skill→CLI hit (`routine status` / `refresh` / `work next`) — no util daemon |
| Queue | routine-first; `detail` never gates `base` / `routine advance` |
| Metrics | new detail nodes @ `0.0` (util); agent metrics ignored; UI maps floats→color |
| Fail | no `work fail` for `detail`; routine kinds keep fail per proposed ADR-B |

## Actors

| Actor | Does |
|-------|------|
| **User** | walk UI, mark/cancel detail, reload, open leaf code, pull commits |
| **Skill** | default drain loop against CLI; never writes SQLite |
| **Util** | ledger SoT, FSM, accept gates, map status/mark/cancel, routine refresh/advance |
| **UI** | dumb client of map JSON; editor owns open+highlight from anchors |

## Chained scenario (HP1 → HP2 → HP3)

### A. Cold seed (HP1)

1. Clone repo; agent loads snowshoe skill.
2. Skill: `snowshoe init` → local `.snowshoe/`; root `root` exists; root `detail` auto-queued.
3. Skill drain: `work next` → `kind=detail`, `parentSlug=root` → agent one-hop upsert (no `type: system` in payload) → `work complete` per `detail-complete` schema.
4. **Checkpoint:** `snowshoe map status --json` has `rootSlug: "root"`, ≥1 child under `root`, children `detailStatus` null/absent, new-node metrics `0.0` (or equivalent fields present).

### B. Walk + user detail (HP2)

5. User starts map UI → loads read-model (`map status` / GET).
6. User walks tree; gray/expandable nodes visible; pending badge absent unless queued.
7. User **mark-detail** on expandable non-root node → util enqueues; **Checkpoint:** that node `detailStatus: "pending"`.
8. Skill drain (routine queue empty): `work next` → detail → complete with children + `anchors` + optional `proseRef`.
9. Soft path: missing file on anchor → accept + `anchorsUnresolved` (warn), node still written.
10. User **reload** → new children; walk to a `symbol` (or `leaf: true`) node.
11. User opens leaf → UI reads `anchors[]` → editor opens `path` at `startLine`/`endLine` or symbol (UI/editor owns highlight; util does **not** open editor).
12. **Checkpoint:** at least one leaf with nonempty `anchors[]`; click path documented for UI acceptance.

### C. Pull → epoch → reload (HP3)

13. User pulls (or otherwise moves HEAD).
14. Skill: `snowshoe routine status --json` → needs refresh → `snowshoe routine refresh`.
15. Util queues epoch: `structure_sync` → `blast_radius` → `metric_decay`×N (empty blast ⇒ **zero** metric steps).
16. Skill drain **routine-first** until required steps done; `work fail` only if a routine kind fails (not detail).
17. When allowed: `snowshoe routine advance`.
18. User reload map → structure/metrics colors updated.
19. **Checkpoint:** status shows base advanced (or epoch clear); map metrics floats changed where decay applied; any leftover detail still non-blocking for advance.

### D. Mixed queue (HP4, if both pending)

20. If detail todos exist during epoch: skill finishes required routine steps before detail; advance not waiting on detail.

## Skill default drain loop

```
loop:
  status ← routine status --json
  if needs_refresh: routine refresh
  batch ← work next --batch-size N   # util orders routine before detail
  if batch empty:
    if can_advance: routine advance
    stop  # or idle until next skill invocation
  for step in batch:
    do work; write artifacts under .snowshoe/…
    work complete (schema payload + refs)
  if hard reject / budget exhausted: stop with report
```

**Stop rules:** queue empty; batch budget done; unrecoverable hard reject (bad lease, matrix forbid, proseRef outside root); operator interrupt.  
**Do not:** write ledger directly; spawn agents; install hooks; run a util watcher; call `work fail` on `detail`.

## UI acceptance (minimal)

- [ ] Load tree from `map status --json` (or HTTP twin) — no direct SQLite.
- [ ] Show pending via `detailStatus`.
- [ ] Mark-detail / cancel-pending via util only.
- [ ] Reload re-fetches read-model after skill completes.
- [ ] Float→color/bands computed in UI (display-only).
- [ ] Leaf → open editor from `anchors[]` (`path` + optional `startLine`/`endLine`/`symbol`); util does not launch editor.
- [ ] Optional: show `anchorsUnresolved` warnings if present on node.

## JSON checkpoints (fields, not dumps)

| When | Must see |
|------|----------|
| After seed complete | `rootSlug`, children of `root`, schemas-valid nodes |
| After mark | `detailStatus: "pending"` on marked slug |
| After detail complete | new child slugs; `detailStatus` cleared; metrics 0 on new nodes |
| After refresh | routine status lists structure/blast/(metrics) as required |
| After advance | base/target reflect catch-up; detail still irrelevant to gate |

Schemas: `docs/brain/schemas/detail-complete.schema.json`, `map-read-model.schema.json`.

## Definition of done

| Layer | Green means |
|-------|-------------|
| **Util tests** (PR #7 style) | CLI/FSM/schemas unit+integration pass — **not** full E2E |
| **E2E (this note)** | Skill + UI can run A→C checklist above on a real or temp git repo without learning features |

Util green ≠ E2E green.

## Out of scope

Learning, quiz, verify; ADR promote; hooks/spawn; fs watch; committing `.snowshoe` to project remote; fixture/demo submodule (use temp git / repo tree until needed); Critic/GAN.

## Non-blocking leftovers

- Exact HTTP path names for map API.
- Whether map UI is served by `snowshoe map` or separate static host — both must use same read-model.
