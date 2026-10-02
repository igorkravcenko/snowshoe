export const SCHEMA_VERSION = 1;
export const ROOT_SLUG = "root";
export const LEASE_TTL_MS = 30 * 60 * 1000;
/** Default `--batch-size` for `work next` (must stay ≥ 3). */
export const DEFAULT_WORK_BATCH_SIZE = 5;
/** `map serve --expand-depth`: expand root only (first child level visible). */
export const DEFAULT_MAP_EXPAND_DEPTH = 1;
/** Fallback tick while `work next --wait` if fs.watch is quiet (WAL/NFS). */
export const WORK_NEXT_WAIT_FALLBACK_MS = 2000;

export const METRIC_LEVELS = ["overview", "contracts", "internals"] as const;
export type MetricLevel = (typeof METRIC_LEVELS)[number];

export const ENTITY_TYPES = ["system", "module", "surface", "flow", "symbol", "external"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const AGENT_ENTITY_TYPES = ["module", "surface", "flow", "symbol", "external"] as const;
export type AgentEntityType = (typeof AGENT_ENTITY_TYPES)[number];

export const MAP_HOP_KINDS = ["expand", "enrich", "fix"] as const;
export type MapHopKind = (typeof MAP_HOP_KINDS)[number];

export const STEP_KINDS = [
  "structure_sync",
  "blast_radius",
  "metric_decay",
  "expand",
  "enrich",
  "fix",
  "detail",
] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export const ROUTINE_KINDS = ["structure_sync", "blast_radius", "metric_decay"] as const;
export type RoutineKind = (typeof ROUTINE_KINDS)[number];

export const BLAST_SEVERITIES = ["nit", "behavior", "contract", "boundary"] as const;
export type BlastSeverity = (typeof BLAST_SEVERITIES)[number];

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

export function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}

export function isMetricLevel(value: string): value is MetricLevel {
  return (METRIC_LEVELS as readonly string[]).includes(value);
}

export function isMapHopKind(value: string): boolean {
  return value === "detail" || (MAP_HOP_KINDS as readonly string[]).includes(value);
}

export function canonicalMapHop(kind: string): MapHopKind | null {
  if (kind === "detail" || kind === "expand") return "expand";
  if (kind === "enrich" || kind === "fix") return kind;
  return null;
}
