/** Display-only starter matrix (same as util). Not a second writer. */
export const CHILD_TYPES: Record<string, string[]> = {
  system: ["module", "external"],
  module: ["module", "surface", "flow"],
  surface: ["flow", "symbol"],
  flow: ["symbol", "module"],
  symbol: ["symbol"],
  external: ["surface", "flow"],
};

export function isExpandable(type: string, leaf: boolean): boolean {
  if (leaf) return false;
  return (CHILD_TYPES[type] ?? []).length > 0;
}
