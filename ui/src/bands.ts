/**
 * Display-only bands over metric floats (ADR-A thresholds).
 * Never persist these labels — SQLite stores 0.0–1.0 only.
 */
export const BANDS = [
  { name: "stale", min: 0, maxExclusive: 0.25, color: "#b45353" },
  { name: "shaky", min: 0.25, maxExclusive: 0.5, color: "#c4a35a" },
  { name: "partial", min: 0.5, maxExclusive: 0.75, color: "#6b8f71" },
  { name: "solid", min: 0.75, maxExclusive: 1.0001, color: "#3d8b6e" },
] as const;

export type BandName = (typeof BANDS)[number]["name"];

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

/** Tree swatch: weakest (min) stored metric, else unknown/gray. */
export function nodeFloat(metrics?: {
  overview?: number;
  contracts?: number;
  internals?: number;
}): number | null {
  if (!metrics) return null;
  const vals = [metrics.overview, metrics.contracts, metrics.internals].filter(
    (n): n is number => typeof n === "number",
  );
  if (vals.length === 0) return null;
  return Math.min(...vals);
}
