---
status: note
date: 2026-09-26
---

# UI ↔ ledger split (v1)

Status: **draft note for plant**. Source: Tech Lead 2026-09-26.  
CLI command names for map surfaces are **provisional**; shape is locked.

## Rule

**Util owns all ledger mutations.** UI never opens or writes SQLite. UI never invents git/epoch logic.  
`snowshoe map` local HTTP + React is **another face of the same util**, not a second writer. CLI and HTTP share one read-model / mutation layer.

Reload after agent `work complete` (no fs watch in v1).

## UI responsibilities

1. Render tree from util read-model.
2. Float→color/bands **in UI** (display-only; float is SoT; thresholds as ADR-A display bands).
3. Pending badge from read-model (`detailStatus`), not by bypassing util.
4. User actions → util only: mark-detail, cancel (pending only), reload.
5. Leaf → code: **UI/editor owns** open+highlight from `anchors[]`. Util does not open the editor in v1.
6. Optional: surface soft `anchorsUnresolved` if util attaches them on the node.

## Surfaces (minimal)

| Surface | Role |
|---|---|
| `snowshoe map export --json` (alias OK: `map status`) / `GET` map API | Reload read-model |
| `snowshoe map detail mark --slug <slug>` / POST | Enqueue `kind=detail` |
| `snowshoe map detail cancel --slug <slug>` | Cancel if `pending` |
| `routine status` / `work next\|complete` | Agent/skill only — UI does not drive work bus in this slice |

## UI must not

- Open `ledger.sqlite` directly.
- Write markdown/graph/metrics to “look done.”
- Call `work complete` / forge leases.
- Start epochs / parse git (skill → `routine refresh`).
- Commit `.snowshoe/**` into the project repo.

## One-liner

UI = dumb client of util JSON; mutations only via mark/cancel/reload; anchors out, editor in UI; never touch SQLite from UI.
