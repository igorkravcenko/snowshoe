---
status: accepted
date: 2026-09-25
---

# ADR-2026-09-25: Monetization ladder

## Status

Accepted as **product policy**. Billing is **not implemented**. No Snowshoe ARR or user counts exist; unknown stays `unknown`.

## Context

Snowshoe is a personal-first, git-native catch-up map (see CURRENT). Nearby public DevTools prices (pricing pages / docs, checked 25 Sep 2026) show how the shelf takes money — they are **not** Snowshoe metrics.

Public analogs (one line each; not competitors we claim to beat):

| Product | Public model (2024–2026 sources) |
|---|---|
| IcePanel | Seat: Free → Growth $40/ed/mo annual → Scale $80; free 1–5 editors |
| Softagram | $19/active developer/mo; Desktop local free |
| Swimm | Sales / LOC; no public seat price on swimm.io/pricing |
| Sourcegraph | Platform Enterprise custom; Cody Free/Pro sunset 23 Jul 2025 |
| Amp | Hobby free; Individual $20/mo; Enterprise custom |
| CodeScene | €18 / €27 per active author/mo annual; OSS free |
| Sonar Cloud | Free ≤50k private LOC; Team from ~$34/mo per 100k LOC |
| Structurizr server | Self-host unique users/year £300/mo (1–20) … £2400/mo (1001+) |
| Structurizr Cloud | Closing 30 Sep 2026 |
| Backstage | OSS core free (self-host) |
| Spotify Portal | AWS MP ~$35,000 / 12 mo license key unit |
| DeepWiki | Public repos free (low); Medium/High via Devin ACU; no standalone private SaaS price |
| Graphite | Hobby free (personal repos); Starter $20 / Team $40 per user/mo annual |
| LinearB | Essentials $29/contributor/mo (min 50); Enterprise $59 (min 100) |
| Faros AI | Quote-only; Community Edition unknown / reportedly gone |
| Obsidian | App free; Sync $4/user/mo annual; Publish $8/site/mo |
| Continue.dev | Acqui-hire ~Jun 2026; product shut down (fork remains) |
| CodeRabbit | Essentials $24 / Team $48 / Advanced $72 per dev/mo annual (AI review contrast) |
| GitDailies | Community free (50 PR/mo, 2 repos); Pro $49/mo; Max $299/mo; unlimited users |
| What-the-Diff | Free 25k tokens; Pro 200k $19/mo |
| Yaak | MIT source free; commercial prebuilt $50/user/year |

There is **no mature public "personal comprehension map after pull" with a proven price anchor** as of that date. Closest *catch-me-up* shapes: GitDailies, What-the-Diff / Graphite PR briefing, Softagram PR impact, DeepWiki onboarding (not post-pull signal).

Patterns that work for personal-first OSS DevTools: local/OSS core free with paid convenience (Obsidian, Yaak, Softagram Desktop vs cloud); hobby free on personal repos then seats on team surfaces (Graphite); usage/volume instead of login seats (GitDailies, CodeScene active-author). Antipatterns: enterprise-only day 1 (LinearB min 50–100, Swimm sales-led, Cody self-serve sunset); seat tax on solo; AI-review price/messaging (CodeRabbit $24–72); platform absorption (Continue → Cursor).

## Decision

Locked ladder (**personal-first → team later**):

1. **Now / v1:** OSS / local-first core **free forever**. Paid layer = convenience (cloud map sync, hosted freshness after remote pull, multi-device, optional commercial binary — Obsidian/Yaak class). Not a core paywall.
2. **When a second person shares a map:** Hobby free on personal/local → **team seats only on team surfaces** (org repos, shared catch-up lists, PR-check bot, Slack digest). Seat is not a tax on solo.
3. **Early team (optional):** Usage / active-author / repo-volume rather than login seats.
4. **Later:** Support / on-prem / portal-adjacent contracts. **Not day-1 GTM.**

**Solo WTP test (hypothesis, not a market fact about Snowshoe):** $5–20/mo — at or below "two coffees a week." Nearby *solo convenience* public anchors: Obsidian Sync $4, Amp Individual $20, Yaak $50/yr, Graphite Hobby free → Starter $20. Nearby *team signal* anchors: Softagram $19/active, GitDailies Pro $49/mo flat, CodeScene €18/author. Test team overlay separately.

### Do not

- Enterprise-only or min seats 50+ (LinearB pattern)
- Copy CodeRabbit / AI-review price or messaging (wrong buyer and wrong expectation)
- Freemium where paid is "another chat" or "another wiki" without the git-freshness wedge
- Promise multiplayer knowledge graph / agent control in v1 packaging
- Depend on one host/IDE as the only distribution (Continue-class risk)
- Publish invented ARR or users

Hard paid hook still needed later so local-free does not become a never-convert wiki (Obsidian-class conversion only works with cheap sync *and* a huge base — Snowshoe has neither yet). Candidates: multi-repo hosted freshness, PR-check signal in CI, shared team overlay, or commercial binary. Pick with a future ADR; do not implement now.

## Consequences

- CURRENT points here; no billing code in this scaffold
- Positioning must not sound like AI code review
- Identity stays local-first git-native UX + human-chosen catch-up (defense against platform absorption)

## Sources (primary / near-primary)

IcePanel, Softagram, Swimm, Sourcegraph, Amp, CodeScene, Sonar, Structurizr server, Spotify Portal AWS MP, DeepWiki docs, Graphite, LinearB, Obsidian, CodeRabbit, GitDailies, What-the-Diff, Yaak pricing pages; Continue outcome via The New Stack (Jun 2026). Faros / exact Sourcegraph floor / Swimm $/LOC remain **unknown** without a sales quote.
