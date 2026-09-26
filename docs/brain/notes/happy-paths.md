---
status: note
date: 2026-09-26
---

# Happy paths (vertical slice, no learning)

Status: **draft note for plant**. Multiple paths; shared skill contract + util.

## HP1 — Cold init → root detail seed

1. Clone repo; agent loads snowshoe skill.
2. `snowshoe init` (local `.snowshoe/`, not pushed). No hooks, no spawn.
3. Util auto-enqueues root `detail` on empty ledger; skill `work next` → first **`detail` on root** → one-hop rough map (no `type: system` from agent).
4. User opens map UI → reload read-model → navigates.

## HP2 — User mark → detail one hop

1. User mark-detail on expandable node → util enqueues `kind=detail`; pending badge.
2. Skill `work next` (only after any required routine steps).
3. Agent upserts children + proseRef + anchors; `complete` (soft warn if anchors unresolved).
4. User reload; walk to leaves; UI opens code via anchors + highlight (editor/UI owns navigation).

## HP3 — Post-pull → epoch catch-up → then detail

1. User pulls (HEAD moved).
2. Skill hits util → refresh/status detects update → epoch steps: structure → blast → metrics (empty blast ⇒ zero metric steps).
3. Agent completes required steps; `routine advance` when allowed.
4. Only then remaining detail todos (if any).
5. User reload map — updated structure/metric colors.

## HP4 — Mixed queue (optional explicit)

Routine + detail pending → **routine first**; detail never gates `base`.

## Out of scope

Learning, quiz, verify, daemon watch, publishing `.snowshoe` to git.

## Still open (non-blocking)

- Exact CLI verb: `map export` vs `map status` (shape locked; see ui-ledger-split).
- Root slug: provisional `root` vs repo-derived.
- Wire `GET /api/map` path names when HTTP lands.
