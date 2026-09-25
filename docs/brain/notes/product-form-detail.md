---
status: note
updated: 2026-09-25
---

# Note: Product form detail (working)

Working memory. Not truth. Decisions live in ADRs; this holds layout/CLI sketches.

## Topic

Default workflow and delivery shape agreed in discussion (2026-09-25), distilled from Igor × Brainstormer and written earlier as `07-product-form.md` on the shared box.

## Agreed direction (see ADRs)

- Repo-bound tool; data near repo (e.g. `.snowshoe/`).
- Project vs personal split; personal gitignored by default.
- CLI-first; optional TUI; on-demand local map GUI.
- Orchestrator + pluggable agent workers; dual entry (skill-in / snow-out).

## Draft CLI sketch (not a contract)

`init` · `refresh` / sync after delta · `status` · `map` · `learn` · `verify` · optional orchestrated catch-up that calls a worker.

Install story: do **not** promise bare `npx snowshoe` — public exact name / domain slots conflict; plan scoped or suffixed package names.

## Draft default loop

1. `snow init` → dirs + gitignore personal + optional hook  
2. `git pull` → hook / `refresh` → update project anchor + mark personal stale  
3. Human or agent: `status` → optional `map` → `learn`  
4. Green / verified only via explicit protocol (quiz / teach-back / self+flag) — agent must not unilaterally paint green

## Open questions

- Exact on-disk layout and file formats  
- JSON/CLI contract between snow and agent backends  
- Tree vs graph vs vault for map UI  
- Final CLI / npm scope / domain (brand ADR later)  
- Team share modes  

## Next

Promote contract pieces to ADRs when grilled. Kill this note when CURRENT + ADRs absorb it.
