---
status: note
date: 2026-09-26
---

# Gaps vs proposed ADR-B (work bus / detail slice)

Status: **draft note for plant**. Call-outs only — do not rewrite ADR bodies in the same PR.

Call-outs for later amend when promoting:

1. ADR-B appendix missing `kind=detail` on the work bus.
2. Structure sketches still use `id` / node `kind` — plant notes use **`slug`** / **`type`**; treat as aliases until B amend.
3. ADR-B lists `work fail` globally — **per-kind carve-out**: `detail` has no fail in v1; routine kinds keep fail.
4. Map HTTP/`snowshoe map *` surfaces are product UI (stack) — not in ADR-B; documented in `ui-ledger-split.md`.
5. Epoch detect: only on skill→CLI hit (`routine refresh` and/or `work next`), never util daemon/watch.

This package documents the carve-outs; it does not silently edit ADR-B.
