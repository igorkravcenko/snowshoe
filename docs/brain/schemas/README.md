---
status: note
date: 2026-09-26
---

# Schema sketches (draft)

JSON Schema sketches for the vertical slice. Not wired to Zod yet (implementation-stack: Zod later; export/mirror when schemas land).

| File | Role |
|---|---|
| [detail-complete.schema.json](./detail-complete.schema.json) | Inner `completions[].payload` for `kind=detail` |
| [map-read-model.schema.json](./map-read-model.schema.json) | Map UI/CLI read-model (CLI names provisional) |

See notes: skill-worker-contract, happy-paths, detail-queue-and-map, ui-ledger-split.
