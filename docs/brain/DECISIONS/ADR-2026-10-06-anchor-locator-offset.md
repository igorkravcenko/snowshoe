---
status: accepted
date: 2026-10-06
---

# ADR-2026-10-06: Anchor `locatorOffset`

## Status

Accepted. Amends [ADR-2026-10-01-map-polish](./ADR-2026-10-01-map-polish.md). Does **not** add LSP / tree-sitter. Does **not** change mark kinds or preview window semantics beyond rebase identity.

## Context

Detail anchors stored `lineText` from `startLine`. Agents often set `startLine` to the first line of a fragment (e.g. a Python `@dataclass` decorator) while the durable identity is the declaration line (`class CarrySession:`). Rebase then tracked the wrong line after edits.

## Decision

1. Agent anchor shape is `{ path, symbol?, startLine?, endLine?, locatorOffset }`. **`locatorOffset` is required** (int ≥ 0) on every detail complete anchor.
2. **Window** remains `startLine`…`endLine` (end optional; omit rather than guess). Preview / highlight still use that window.
3. **Identity** for `lineText` capture and rebase is `startLine + locatorOffset` when `startLine` is set. `locatorOffset: 0` means identity is `startLine` (prior behavior).
4. After rebase finds the identity line, reconstruct `startLine' = locatorLine' - locatorOffset` (clamped to ≥ 1), then apply stored fragment `span` for `endLine'` when known.
5. Reject complete when `startLine` is set and the locator line is past `endLine` (if known) or past EOF (`anchor_locator_past_end` / `anchor_locator_past_eof`). Missing path still rejects as today.
6. Legacy ledger rows without `locator_offset` read as `0`. Map status always exposes `locatorOffset`.

## Alternatives considered

- Locator as free-text needle only — rejected for this slice; larger agent contract change.
- Optional `locatorOffset` defaulting to 0 on write — rejected; agents would omit and keep decorator-as-identity.
- Auto-snap decorator lines in util — deferred; offset is explicit.

## Consequences

CURRENT and `skills/snowshoe/drain.md` require `locatorOffset` and show a decorator+declaration example. Capture / rebase / `GET /api/file` honor the offset. Not LSP.

## Evidence

None required for this contract change.
