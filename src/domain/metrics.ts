import type { BlastSeverity, MetricLevel } from "./types.ts";

/** ADR-B: blast severity → required metric levels. */
export const SEVERITY_LEVELS: Record<BlastSeverity, MetricLevel[]> = {
  nit: ["internals"],
  behavior: ["internals", "contracts"],
  contract: ["overview", "contracts", "internals"],
  boundary: ["overview", "contracts", "internals"],
};

/** ADR-B: accept upper bound per (severity × level). null = level not required / no cap. */
export const SEVERITY_CAPS: Record<
  BlastSeverity,
  Record<MetricLevel, number | null>
> = {
  nit: { internals: 0.85, contracts: null, overview: null },
  behavior: { internals: 0.6, contracts: 0.75, overview: null },
  contract: { internals: 0.45, contracts: 0.45, overview: 0.45 },
  boundary: { internals: 0.3, contracts: 0.3, overview: 0.3 },
};

export function requiredLevels(severity: BlastSeverity): MetricLevel[] {
  return [...SEVERITY_LEVELS[severity]];
}

export function severityCap(
  severity: BlastSeverity,
  level: MetricLevel,
): number | null {
  return SEVERITY_CAPS[severity][level];
}
