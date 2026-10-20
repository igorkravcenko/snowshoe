---
status: accepted
date: 2026-10-20
---

# ADR-2026-10-20: `work next` live-lease echo (`leased[]`)

## Status

Accepted. Amends the `work next` envelope in [ADR-2026-09-27-skill-drain-loop](./ADR-2026-09-27-skill-drain-loop.md) and `--wait` in [ADR-2026-09-27-work-next-wait](./ADR-2026-09-27-work-next-wait.md). Does **not** promote proposed routine ADRs A/B.

## Context

Exclusive leases are by design: overlapping `work next` must not mint a new token for a still-valid lease (`LEASE_TTL_MS` is 30 minutes). A later poll that found nothing else claimable returned `action: "work"`, `items: []`, `remaining: 0`, `stop: true`. `drain.md` treated empty `items` as STOP. `routine status` does not expose `leaseToken`. Crash recovery and a second poll in the same chat could not complete the live batch.

A second hole: `hasOpenWork` and claim ranking listed every `pending`/`leased`/`failed` step. After `routine refresh` supersedes an epoch, old routine rows stay in sqlite. `canAdvance` already scopes to the open epoch; the queue did not. Echoing only current-epoch leases would still leave `hasOpenWork` true, both arrays empty, and `advance` unreachable until TTL, after which the old step could be reclaimed.

## Decision

### Envelope

`snowshoe work next --json` always includes `leased` (gates — including refresh — and `idle`: `[]`). Same item shape as `items` (including `leaseToken`).

- `items` = this call’s **new** claims only. Never re-token a live step. Never splice leftovers into `items`.
- `leased` = queue-visible live leftovers **not** minted this call (same tokens). Echo **all** of them; do not slice to `--batch-size`.
- Live leftover: `status === "leased"`, token present, `lease_expires_at > now`.
- Minting a new `items` batch while leftovers exist is allowed. `items ∩ leased = ∅`.
- Expired leases are reclaimable into `items` (new token) even if other leftovers remain.
- `remaining` = claimable steps not taken into `items` this call. Leftovers in `leased` are not remaining.
- `stop` is false while `leased` is nonempty; otherwise `stop: remaining === 0` as before.
- `action` is `"work"` while queue-visible leftovers or other queue-visible open work exist.
- `routine status` stays token-free.

### Queue-visible work

One helper for ranking, `hasOpenWork`, and `leased`:

- Map hops (`detail` / `expand` / `enrich` / `fix`) always.
- Routine kinds only when `epoch_id` is the current **open** epoch.

Superseded-epoch routine rows may remain in sqlite. They are not claimed, not echoed, and must not block `advance`. Do not fail/cancel them in this decision. `work complete` rejects a routine step whose epoch is not the open epoch with `epoch_not_open`, so a token held from before refresh cannot apply a stale range. While the refresh gate is showing (HEAD left the open epoch's target), routine completes reject `refresh_required`. Check order after the token check: `epoch_not_open` → `refresh_required` → `lease_expired` → payload. Both are skip-and-repoll for the skill, not a STOP.

### Lost lease vs bad token

The ledger keeps only the current token, no history. A token mismatch on a step that is still `leased` under another token, with a well-formed (UUID) token, rejects `lease_reclaimed`: the step is probably re-claimed by another worker after the caller's lease expired. Skip-and-repoll. A wrong UUID-shaped token (e.g. another step's token) also lands here; harmless, because the step shows up in `leased` on the next poll and Lease order picks it up. `bad_lease` = token mismatch otherwise: malformed, or the step is no longer leased (e.g. an old token on a step that was reset or re-marked since). STOP is the conservative choice there. A step someone else already completed rejects `already_closed` (checked first). `work fail` keeps a single `bad_lease` for any token mismatch.

### Refresh vs leftover (`todo` wins)

`refreshRequired` runs before claim. That is the only `todo` that can overlap a live batch (`advance` is gated only when queue-visible work is empty; `init` is pre-ledger).

On the refresh gate: `items: []`, `leased: []`, do not mint. Skill: run only `todo`; **do not complete across refresh**. After `routine refresh`, superseded routine leftovers stay out of `leased` because of the open-epoch filter, and completing one with an old token rejects `epoch_not_open`. Map-hop leftovers are not epoch-scoped and reappear in `leased` on the next poll.

### Skill loop

There is no lease owner in the ledger. Ownership lives only in the draining agent's context: **own** leased are `leaseToken`s it received from an earlier `work next` in its own context; every other `leased` row is **foreign**.

1. If `todo` is set: run only that. Do not complete. Continue.
2. If `waitTimedOut`: STOP.
3. Own work first: `items` plus own `leased`, in the agent's chosen order. Leave foreign `leased` and re-poll.
4. If a poll has no `items` and no own `leased` but foreign `leased` remain: take them now (crashed / compacted worker). No waiting and no re-poll loop for them, so the loop cannot busy-spin.
5. An agent that lost its context (compaction) and does not remember its tokens treats every `leased` row as foreign; step 4 then makes it finish them after its own `items`.
6. STOP only if `items` and `leased` are both empty (unless interactive `--wait`).

Two live workers may both reach step 4 for the same foreign row; the loser gets `already_closed` (skip-and-repoll, not a STOP). Duplicate effort is accepted; corruption is not possible because completion checks the token and status.

`--wait` still blocks only `action: idle`. `action: work` (including nonempty `leased`) returns immediately.

## Alternatives considered

- Mix leftovers into `items` (or append at the tail) — rejected; `items` means this claim.
- Do not mint while any live lease exists — rejected; forces finish-the-plate in CLI and blocks claiming other pending.
- Tokens on `routine status` — rejected; `work next` is the resume surface.
- Shorter TTL or `work fail` as recovery — rejected; map hops have no `work fail`.
- Fail/cancel superseded-epoch routine steps on refresh — deferred; queue-visible filter plus `epoch_not_open` on complete is the lock.
- Echo leftovers on the refresh gate (diagnostic) — rejected; nothing may act on them before refresh, and an empty array is simpler.

## Consequences

- CURRENT: `work next` always exposes `leased` (`[]` on the refresh gate); routine completes from a non-open epoch reject `epoch_not_open`; STOP when `todo` is null and both `items` and `leased` are empty; queue-visible work is map hops plus open-epoch routine steps.
- Skill `drain.md` and `snowshoe help --json` match the loop above.

## Evidence

- GitHub [#16](https://github.com/igorkravcenko/snowshoe/issues/16)
