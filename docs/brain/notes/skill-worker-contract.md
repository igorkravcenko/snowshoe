---
status: note
date: 2026-09-26
---

# Skill worker contract (v1)

Status: **draft note for plant** (not ADR).  
Snowshoe does **not** spawn agents. An external agent loads this skill and drives the CLI.  
Util has **no daemon/watch**: epoch/commit detection runs only when the skill hits CLI.

## Principles

- All ledger mutations go through `snowshoe` CLI (or the same util layer behind local HTTP). Skill never writes `ledger.sqlite` directly.
- One work bus: `snowshoe work next` / `work complete`.
- **Routine-first:** if required epoch steps are pending, drain them before `detail`.
- `detail` **never blocks** `routine advance` / moving `base`.
- Per-kind fail: `detail` has **no** `work fail` in v1; `structure_sync` / `blast_radius` / `metric_decay` keep fail per proposed ADR-B.
- `.snowshoe/**` ledger/map/epochs stay **local / personal** — not committed to the project repo in this slice.
- `init` does **not** install git hooks and does **not** spawn agents. After init, the **skill** performs the first work (root detail seed).

## Session loop (default)

1. `snowshoe routine status --json` — see whether refresh/advance needed and what is queued.
2. If status says target/HEAD moved → `snowshoe routine refresh` (util opens/updates epoch: structure → blast → metric_decay as required).
3. `snowshoe work next --batch-size N` → lease steps (**routine kinds before detail** when both exist).
4. For each step: produce artifacts under allowed `.snowshoe/…` paths; `work complete` with schema payload + refs.
5. Loop until empty or budget done.
6. If status allows → `snowshoe routine advance`.

## Init → seed map

1. Skill runs `snowshoe init` (local state only).
2. **Locked for this slice:** on empty ledger after init, util **auto-enqueues** one root `detail` (parent = util-owned `system` root). Actor is still the skill via `work next` — util does not spawn agents.
3. Skill takes first `work next` → **`kind=detail` on root** — not a separate `seed` command.
4. Agent expands one hop under root (`type` ≠ `system`; root stays util-owned); `complete`; user reload sees rough map.
5. Provisional root slug: `root` until util decides otherwise (see Still open in happy-paths).

## Detail

Follow `detail-queue-and-map.md`: slug/`type` catalog (`system|module|surface|flow|symbol|external`); create@0.0 metrics (util sets; agent metrics ignored); soft `anchorsUnresolved`; upsert children; no fail state.

## Non-goals

Learning/quiz/verify; spawning agents; util filesystem watch; committing map data to the project remote.
