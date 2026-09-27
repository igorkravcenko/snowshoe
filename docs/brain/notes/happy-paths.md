---
status: note
date: 2026-09-26
updated: 2026-09-27
---

# Happy paths (vertical slice, no learning)

Status: **note**. Short scraps; **canonical chained E2E** → [e2e-happy-path-no-learning.md](./e2e-happy-path-no-learning.md).  
Shared: [skill-worker-contract.md](./skill-worker-contract.md), [ui-ledger-split.md](./ui-ledger-split.md).

## Locked (was Still open)

| Item | Lock |
|------|------|
| Map CLI | `snowshoe map status --json` |
| Root slug | `root` |
| Empty ledger after init | util **auto-enqueues** root `detail`; skill remains actor |

## HP1 — Cold init → root detail seed

1. Clone repo; agent loads snowshoe skill.
2. `snowshoe init` (local `.snowshoe/`, not pushed). No hooks, no spawn.
3. Util auto-enqueues root `detail`; skill `work next` → first **`detail` on root** → one-hop rough map (agent must not emit `type: system`).
4. User opens map UI → `map status` reload → navigates.

## HP2 — User mark → detail one hop

1. User mark-detail → util enqueues `kind=detail`; pending badge.
2. Skill `work next` only after required routine steps.
3. Agent upserts children + proseRef + anchors; `complete` (soft warn if anchors unresolved).
4. User reload; leaves; UI opens code via anchors (editor owns highlight).

## HP3 — Post-pull → epoch catch-up → then detail

1. User pulls (HEAD moved).
2. Skill → util refresh/status → structure → blast → metrics (empty blast ⇒ zero metric steps).
3. Agent completes; `routine advance` when allowed.
4. Then remaining detail todos (if any).
5. User reload — updated structure/metric colors.

## HP4 — Mixed queue

Routine + detail pending → **routine first**; detail never gates `base`.

## Out of scope

Learning, quiz, verify, daemon watch, publishing `.snowshoe` to git.
