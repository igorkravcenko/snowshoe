---
status: accepted
date: 2026-10-12
---

# ADR-2026-10-12: Satellite skill snowshoe-scratch and global `--cwd`

## Status

Accepted. Does **not** change the product skill at `skills/snowshoe/` (no third
gate branch). Does **not** ship learning/quiz/verify. Does **not** add scratch
to `snowshoe skill install`, `.claude-plugin/`, or npm `files`.

## Context

The product skill is the git-map wedge: drain via `work next`, or talk about an
initialized map (`learn.md`). Studying a path that is not that mapped repo
(scratch tree, worktree, other checkout) still needed a durable viewport that
is **not** the personal ledger.

Citty does not inherit root flags onto subcommands. Agents need a git `-C`
equivalent so `map status` can read another checkout’s ledger without splitting
ledger vs file viewport.

## Decision

### Satellite skill

1. Add **`snowshoe-scratch`** at `skills/snowshoe-scratch/SKILL.md` (one file).
   Cursor discovery: committed symlink `.cursor/skills/snowshoe-scratch` →
   `../../skills/snowshoe-scratch`. Cross-links only: `skills/README.md`,
   `AGENTS.md`, one line in `skills/snowshoe/learn.md` for “path without the
   map.” Do not add a drain/learn/scratch branch in `skills/snowshoe/SKILL.md`.
2. Scratch is **not** the git-map wedge. It does not drain, `init`, or write
   `ledger.sqlite`. Product skill stays `skills/snowshoe/`.
3. Store: `~/.snowshoe/learn/<id>/` with
   `id = sha256(utf8(realpath(target)))` (no trailing slash except `/`).
   Sidecar `origin.md`: realpath, id, optional `mainRoot` if a map was offered.
4. Layout (subset of learn.md local state, no ledger): `origin.md`, `CURRENT.md`
    (ephemeral mental map of the target — amendment below), `STATE.md` (Now /
   voice / journal), `PLAN.md`, `discrepancies.md`, `sessions.md` (host chat
   ids; amendment 2026-10-19). Create on agreed bootstrap.
   Resume only if the hashed dir exists **and** `CURRENT.md` is present; a
   hashed dir without `CURRENT.md` (partial bootstrap) is bootstrap, not resume.
   Hash recipe lives in the skill so another chat can reconstruct the dir from
   a path. Scratch `STATE.md` journal voice is inlined in the skill (tutor
   prose after compaction); do not import product learn.md retention cards /
   check-ins.
5. Opt-in read-only atlas: `git -C` the target if it is a directory, else
   `dirname` of its realpath (file-shaped TARGET still offers the atlas).
   `git rev-parse --path-format=absolute --git-common-dir` (or `realpath` the
   common-dir against that `git -C` dir) → main checkout; if
   `<main>/.snowshoe/ledger.sqlite` exists, **ask once**, then **only**
   `snowshoe map status --json --cwd <main> …` (optional `snowshoe help --json`).
   No other snowshoe commands on that root. Map a filesystem path to `--slug` by
   matching `map status --fields slug,anchors` `anchors[].path` to the path
   relative to `git -C "$GIT_C" rev-parse --show-toplevel` (posix, no leading
   `./`; still query `--cwd <main>`). Directory TARGET: prefix. If TARGET is
   that checkout root (`rel` empty or `.`), skip slug lookup (or `--slug root`
   only if they already opted in); do not pick a nested file and do not
   `--all-fields` from `root`. If none match, skip the atlas for that file.
   Viewport files win over map prose.
   Drain-shaped prompt on the mapped checkout: one line to `skills/snowshoe`;
   do not hard-block scratch and do not run drain from this skill.
6. Until install ships, using scratch **outside this clone** means copying
   `skills/snowshoe-scratch/` into that harness skills dir (documented in
   `skills/README.md`, not a CLI).

### Global `--cwd`

7. Parse `--cwd` / `--cwd=` once from argv (same scan shape as
   `batchSizeFromArgv`). Resolve to an existing directory; missing or non-dir
   is a usage JSON error. Pass that directory into every `process.cwd()` at the
   `src/cli.ts` boundary (handlers already take `cwd`).
8. Semantics: git `-C` — discovery start for `findRepoRoot`. Not `--repo`.
   Does **not** split ledger vs file viewport. No `map serve` split-root.

## Alternatives considered

- Third intent branch in `skills/snowshoe/SKILL.md` — rejected; product skill
  stays drain/learn/combined.
- `snowshoe skill install` / plugin / npm `files` for scratch this slice —
  rejected; product install stays `skills/snowshoe` only.
- `--repo` as a ledger path distinct from file cwd — rejected; git `-C` is one
  viewport.
- Overlay write-back into the main ledger — rejected (out of scope).
- `~/.snowshoe` index beyond `origin.md` — rejected (out of scope).

## Amendment 2026-10-12: Scratch CURRENT.md is a mental map

`CURRENT.md` in the hashed dir is the same job as the product map tree: a
personal **mental model of the target** (file or directory). It is not `ls`,
not a heading table of contents, and not coded labels that require jumping
into the file (`Options A–F`). Node titles must be **readable without jumping**.
Shallow (about two listing levels; group rather than dump). Posture is
`skills/snowshoe/drain.md` (“the map is a mental model, not 1:1 with code”;
avoid telegram bodies). Markdown-only; no ledger, slugs, or quiz.

The earlier phrase “ephemeral shallow outline tree” was too easy to read as a
file listing or a copied TOC. The skill section `CURRENT.md (mental map)` is
the contract.

## Amendment 2026-10-19: Host chats (`sessions.md`)

Learn and scratch dirs are reused across chats. Record the host
conversation/session id (opaque string the host already uses; look in the
environment) in `sessions.md` in that dir — append-only UTC date + id. Do not
put ids in STATE / CURRENT / origin. Do not invent product URLs. Do not name a
vendor in the skill. Missing id: skip. Do not read `sessions.md` in the teaching
loop. Same rule in product `learn.md` (`.snowshoe/learn/sessions.md`).

## Amendment 2026-10-16: Scratch re-entry

Same `re-entry` protocol as product `learn.md` (trigger `re-entry`, optional
leading `/`; Landed / Current / Next / Do not reopen; short steering is not
the trigger). Scratch `STATE.md` layout is Now / Re-entry / voice / journal.
Skill labels stay English; local STATE / CURRENT may use any language. Still
not `skill install` / plugin / npm `files`.

## Consequences

- CURRENT: satellite `snowshoe-scratch` is not the wedge; home learn dir +
   `CURRENT.md` as a mental map of the target (concepts, not ls/TOC; titles
  readable without jumping); optional atlas allowlist (`map status --json --cwd`
  only; optional `help --json`); global `--cwd` is git `-C`. Learn/scratch
  `re-entry` reprints the landed floor (`STATE.md` Re-entry block). Host chat
  ids live in `sessions.md` (append-only; not teaching context).
- Plugin manifests, `skill.ts` packaged files, and npm `files` stay
  `skills/snowshoe` only. Tests that lock that exclusivity stay as they are.
- No learning/quiz/verify product. Scratch `STATE.md` is a journal plus a
  Re-entry block, not a quiz.

## Evidence

None required (skill boundary + CLI flag).
