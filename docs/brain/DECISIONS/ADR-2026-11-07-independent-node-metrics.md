---
status: accepted
date: 2026-11-07
---

# ADR-2026-11-07: Independent node metrics

## Status

Accepted

## Context

Implicit parent decay changes values outside the requested operation. A batch of routine steps based on one snapshot can consequently reject a valid parent update after a child update.

## Decision

`metric_decay` and `map metric` update only the specified node and level. Parents require their own explicit updates. A drop stamps `decayed` only on the affected node. Existing values are not restored.

This amends the parent propagation decisions in ADR-2026-09-26-vertical-slice-cli and ADR-2026-10-02-map-metric-cli, and supersedes the parent propagation proposal in ADR-2026-09-25-routine-epoch-and-metrics.

## Alternatives considered

- Derived parent rollups: rejected because node metrics represent independent comprehension.
- Keep propagation and expose it: rejected because it creates order-dependent writes.

## Consequences

Batched updates to different nodes do not invalidate one another through parent propagation. Existing validation and severity caps remain in force.
