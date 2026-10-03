---
status: accepted
date: 2026-09-25
---

# ADR-2026-09-25: Implementation stack

## Status

Accepted. Locked in chat, Tech Lead ↔ product owner (2026-09-25). Still **pre-code**: this ADR chooses tools; it does not authorize application scaffolding.

## Context

CURRENT and accepted form/surfaces/state ADRs lock *what* Snowshoe is, not *how* a tiny local util is built. Proposed routine ADRs ([routine-epoch-and-metrics](./ADR-2026-09-25-routine-epoch-and-metrics.md), [routine-cli-and-fsm](./ADR-2026-09-25-routine-cli-and-fsm.md)) stay **proposed**. Product owner asked to record the stack and a few product facts that were **not obvious** from that prior canon.

Constraints in force: tiny budget; AI-agent-built; local-first; personal ledger gitignored; boring and shippable.

## Decision

### Runtime / language

**TypeScript on Bun.** Ship the CLI with `bun build --compile` (macOS and Linux first; Windows is nice-to-have later).

### CLI framework

Thin framework. **Default recommendation: citty.** **commander** is an acceptable alternative if citty fights the compile/ship path. Do not adopt a heavy CLI framework.

### Validation

**Zod** for envelopes and work payloads. When schemas land, export or mirror them to JSON Schema files. The schemas themselves remain open / live in the proposed routine ADRs until those are accepted.

### Local durable machine state

**`bun:sqlite`**: one ledger DB under `.snowshoe/` (example filename: `ledger.sqlite`). SQLite is the **source of truth** for FSM / queue / leases (claim tokens) / epoch meta / metrics. Exact sqlite *file* subpath vs the personal-state layout TBD (`.snowshoe/local/` vs repo-root `.snowshoe/`) is **not** re-litigated here and **does not move** epoch artifact paths from the proposed routine ADRs. The personal ledger stays gitignored ([personal-state ADR](./ADR-2026-09-25-personal-state-gitignore.md)).

### Tests

**Vitest**, plus golden fixtures for FSM / lease / accept-reject / supersede / advance gates (those gates are specified in the proposed routine ADRs; this only picks the test runner).

### Map UI path (later, not day-1 code)

`snowshoe map` (provisional binary spelling) opens a tiny local HTTP server and the system browser. UI: **React + Vite**; **tree-first**. Understanding **bands are display-only** over float metrics (see proposed epoch ADR for the float domain; do not store bands as the source of truth). Amendment 2026-10-04: `map serve` binds **loopback only**; PTY and `/api/file` require a loopback `Host` header ([map-ui ADR](./ADR-2026-09-27-map-ui-and-skill.md)).

### Binary name

CLI spelling is **`snowshoe …`**. PATH bins: canonical **`snowshoe`**, short **`snoe`** (same entrypoint). Informal discussion shorthand *snow* is **not** a PATH command (Snowflake owns global `snow`). Skills/agents keep calling **`snowshoe`** ([provisional-name ADR](./ADR-2026-09-25-provisional-name-snowshoe.md)).

### Explicitly out of day-1

- NestJS
- Next.js
- Electron
- Obsidian-plugin-as-home
- Rust / Python / Go for the util (Go was considered; product owner chose TypeScript)

## Clarifications vs prior canon

These were decided with the product owner in the same 1:1 and were **not obvious** from CURRENT or the surfaces ADR as written.

### 1. Hooks are opt-in, not part of default `init`

Checklist (locked):

- **`init` does not install hooks.** `snowshoe init` only creates `.snowshoe/` + config (and whatever [personal-state](./ADR-2026-09-25-personal-state-gitignore.md) already requires, e.g. ignore rules for personal paths).
- **Default signal = skill → CLI:** a human, or an agent with a skill, calls `snowshoe routine refresh` / `snowshoe routine status` / `snowshoe work …` (families as in the *proposed* CLI ADR; not promoted here).
- **Opt-in only:** `snowshoe hooks install` / `snowshoe hooks uninstall` (spelling **provisional**), with the user choosing which hooks (post-merge / post-checkout / etc.).

Hooks remain a *valid primary signal surface* **when enabled**. They are convenience, not the default path.

This **refines** [ADR-2026-09-25-v1-surfaces](./ADR-2026-09-25-v1-surfaces.md). That ADR carries the amendment so readers do not assume `init` installs hooks.

### 2. State layering (storage split)

| Layer | Format | Holds | Source of truth? |
|---|---|---|---|
| Machine / FSM | SQLite (`bun:sqlite`) | epoch meta, steps/queue, **claim/lease** tokens, metrics floats **`0.0–1.0`** on `(nodeId × level)`, `canAdvance`-related truth | **Yes** — SoT for FSM / queue / leases / epoch meta / metrics |
| Heavy agent payloads | Files under `.snowshoe/epochs/<epochId>/…` (JSON etc.) | blast, structure ops blobs; DB stores refs/paths | Payload bytes live on disk; accept/status remain in SQLite |
| Human-readable map / notes | Markdown (optional frontmatter) | explain/notes for the learning UI | **No** — not SoT for metrics or step statuses |

Do **not** store metrics or step statuses only in markdown (an agent could paint green past the FSM). Markdown is a projection / teaching surface, not the ledger.

This layers *how* state is stored. It does not replace the project vs personal split, and it does not commit personal competence into git.

### Alignment with proposed routine ADRs (do not contradict)

This accepted stack ADR must **not** rewrite or promote:

- [ADR-2026-09-25-routine-epoch-and-metrics](./ADR-2026-09-25-routine-epoch-and-metrics.md) (proposed A)
- [ADR-2026-09-25-routine-cli-and-fsm](./ADR-2026-09-25-routine-cli-and-fsm.md) (proposed B)

Bun / TS / SQLite / files **align** with those drafts as follows (still proposed for protocol, not CURRENT):

- Epoch artifact paths stay `.snowshoe/epochs/<epochId>/…` (envelope blobs / `artifactRef`).
- Metric storage domain stays float **`0.0–1.0`** inclusive in SQLite; UI bands remain display-only (not a schema type).
- `work next` **claim** + `leaseToken` truth lives in SQLite; complete/fail without a matching current lease still reject (as in proposed B).

### 3. Learning vs routine store

**Learning** remains out of the routine ADRs. It may use the **same store later**. It **does not block** `base` advance. Pointer only — do not rewrite: [ADR-2026-09-25-routine-epoch-and-metrics](./ADR-2026-09-25-routine-epoch-and-metrics.md) (still **proposed**). No learning CLI is locked here.

## Deliberately not locked

- Final brand / npm scope / domain
- Exact hook subcommand spelling and which hook names ship
- SQLite schema, JSON Schema files, Zod module layout
- citty vs commander as a forever-ban (commander stays an acceptable alt)
- Windows compile as a day-1 ship gate
- Map UI information architecture beyond tree-first + bands-as-display
- Promoting proposed routine ADRs

## Alternatives considered

- **Go (or Rust / Python) util** — considered; product owner chose TypeScript on Bun for agent-built speed and one-language CLI+map later.
- **NestJS / Next.js as the product shell** — rejected for v1; the util is a local CLI, not a server framework product.
- **Electron as map home** — rejected for day-1; local HTTP + system browser is enough.
- **Obsidian plugin as home** — rejected (surfaces ADR already: not v1 center).
- **commander as default** — acceptable alt; citty preferred as the thinner default unless compile/ship forces otherwise.
- **Markdown-only ledger** — rejected; agents could forge green / step status outside the FSM.
- **Auto-install hooks on `init`** — rejected; opt-in. Default path is skill/human → CLI.

## Consequences

- CURRENT cites this ADR for stack + hook opt-in + state layering.
- Surfaces ADR is amended so “primary signal = hook” ≠ “init installs hooks.”
- Personal-state gitignore default is unchanged; ledger engine is now SQLite.
- No application code, package.json, or fake `src/` in the same change as this lock.
- Proposed routine ADRs stay proposed; this ADR must not be read as promoting them.

## Evidence

Working 1:1 Tech Lead ↔ product owner, 2026-09-25. Distilled (not truth): [../notes/implementation-stack-2026-09-25.md](../notes/implementation-stack-2026-09-25.md).
