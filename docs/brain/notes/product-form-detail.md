---
status: note
updated: 2026-09-25
---

# Note: Product form detail (working)

Working memory. Not truth. Decisions live in ADRs; this holds layout/CLI sketches.

## Topic

Default workflow and delivery shape agreed in discussion (2026-09-25), distilled from product owner × Brainstormer and written earlier as `07-product-form.md` (author working copy, not in-repo).

## Agreed direction (see ADRs)

- Repo-bound tool; data near repo (e.g. `.snowshoe/`).
- Project vs personal split; personal gitignored by default.
- CLI-first; optional TUI; on-demand local map GUI (later tree-first HTTP/browser — stack ADR).
- Orchestrator + pluggable agent workers; dual entry (skill-in / CLI-out).
- Hooks are **opt-in** (`hooks install`); not part of `init`. Default signal is skill/human → CLI.

## Draft CLI sketch (not a contract)

`init` · `refresh` / sync after delta · `status` · `map` · `learn` · `verify` · optional orchestrated catch-up that calls a worker.

Install story: do **not** promise bare `npx snowshoe` — public exact name / domain slots conflict; plan scoped or suffixed package names.

## Draft default loop

1. `snowshoe init` → dirs + gitignore personal (**no** hooks)  
2. Optional: `snowshoe hooks install` (user picks post-merge / post-checkout / …)  
3. Default: human or skill calls CLI (`routine refresh` / `status` / `work …`) after pull; enabled hook is convenience  
4. Human or agent: `status` → optional `map` → `learn`  
5. Green / verified only via explicit protocol (quiz / teach-back / self+flag) — agent must not unilaterally paint green (metrics/status live in SQLite, not markdown)

## Open questions

- Exact on-disk layout (e.g. `.snowshoe/local/` vs `.snowshoe/ledger.sqlite`) — engine/layering is in the stack ADR  
- JSON/CLI contract between the util and agent backends (proposed routine ADRs, not CURRENT)  
- First map is tree-first; graph/vault later or never — not a day-1 fork  
- Final CLI / npm scope / domain (brand ADR later)  
- Team share modes  

## Next

Promote contract pieces to ADRs when grilled. Kill this note when CURRENT + ADRs absorb it.
