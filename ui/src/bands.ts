/**
 * Display-only bands over metric floats (ADR-A thresholds).
 * Never persist these labels — SQLite stores 0.0–1.0 only.
 *
 * Palette: traffic-light progression on dark chrome —
 * stale=red → shaky=orange → partial=yellow → solid=green.
 */
export const BANDS = [
  { name: "stale", min: 0, maxExclusive: 0.25, color: "#f07178" },
  { name: "shaky", min: 0.25, maxExclusive: 0.5, color: "#ff9e64" },
  { name: "partial", min: 0.5, maxExclusive: 0.75, color: "#e6c84a" },
  { name: "solid", min: 0.75, maxExclusive: 1.0001, color: "#7fd962" },
] as const;

export type BandName = (typeof BANDS)[number]["name"];

export type MetricLevels = {
  overview?: number;
  contracts?: number;
  internals?: number;
};

/** Outer → middle → core for the bullseye / target glyph. */
export const TARGET_LAYERS = ["overview", "contracts", "internals"] as const;
export type TargetLayer = (typeof TARGET_LAYERS)[number];

export function bandFor(value: number | null | undefined): BandName | "unknown" {
  if (value === null || value === undefined || Number.isNaN(value)) return "unknown";
  if (value < 0 || value > 1) return "unknown";
  if (value >= 0.75) return "solid";
  if (value >= 0.5) return "partial";
  if (value >= 0.25) return "shaky";
  return "stale";
}

export function colorFor(value: number | null | undefined): string {
  const band = bandFor(value);
  if (band === "unknown") return "#6b7280";
  return BANDS.find((b) => b.name === band)!.color;
}

/** Colors for bullseye: overview (outer), contracts (middle), internals (core). */
export function targetLayerColors(metrics?: MetricLevels): {
  overview: string;
  contracts: string;
  internals: string;
} {
  return {
    overview: colorFor(metrics?.overview),
    contracts: colorFor(metrics?.contracts),
    internals: colorFor(metrics?.internals),
  };
}

export function targetTitle(metrics?: MetricLevels): string {
  return TARGET_LAYERS.map((layer) => {
    const v = metrics?.[layer];
    const band = bandFor(v);
    const num = typeof v === "number" ? v.toFixed(2) : "—";
    return `${layer}: ${num} (${band})`;
  }).join("\n");
}

/** Weakest stored metric (legacy aggregate); prefer the bullseye for display. */
export function nodeFloat(metrics?: MetricLevels): number | null {
  if (!metrics) return null;
  const vals = [metrics.overview, metrics.contracts, metrics.internals].filter(
    (n): n is number => typeof n === "number",
  );
  if (vals.length === 0) return null;
  return Math.min(...vals);
}
