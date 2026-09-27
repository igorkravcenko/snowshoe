export const SCHEMA_VERSION = 1;
export const ROOT_SLUG = "root";
export const LEASE_TTL_MS = 30 * 60 * 1000;

export const METRIC_LEVELS = ["overview", "contracts", "internals"] as const;
export type MetricLevel = (typeof METRIC_LEVELS)[number];

export const ENTITY_TYPES = [
  "system",
  "module",
  "surface",
  "flow",
  "symbol",
  "external",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const AGENT_ENTITY_TYPES = [
  "module",
  "surface",
  "flow",
  "symbol",
  "external",
] as const;
export type AgentEntityType = (typeof AGENT_ENTITY_TYPES)[number];

export const STEP_KINDS = [
  "structure_sync",
  "blast_radius",
  "metric_decay",
  "detail",
] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export const ROUTINE_KINDS = [
  "structure_sync",
  "blast_radius",
  "metric_decay",
] as const;
export type RoutineKind = (typeof ROUTINE_KINDS)[number];

export const BLAST_SEVERITIES = [
  "nit",
  "behavior",
  "contract",
  "boundary",
] as const;
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
