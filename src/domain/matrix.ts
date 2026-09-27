import type { EntityType } from "./types.ts";

/**
 * Starter parent/child matrix (data, not a forever-hardcoded product lock).
 * From docs/brain/notes/detail-queue-and-map.md.
 */
export const CHILD_TYPE_MATRIX: Record<EntityType, EntityType[]> = {
  system: ["module", "external"],
  module: ["module", "surface", "flow"],
  surface: ["flow", "symbol"],
  flow: ["symbol", "module"],
  symbol: [],
  external: ["surface", "flow"],
};

export function allowedChildTypes(parentType: EntityType, leaf: boolean): EntityType[] {
  if (leaf || parentType === "symbol") return [];
  return [...CHILD_TYPE_MATRIX[parentType]];
}

export function childAllowed(parentType: EntityType, childType: EntityType): boolean {
  return CHILD_TYPE_MATRIX[parentType].includes(childType);
}
