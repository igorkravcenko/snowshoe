import type { MapReadModel } from "./api.ts";

/** Snapshot of the map the UI is showing. `generatedAt` is wall-clock and must not count. */
export function mapFingerprint(
  map: Pick<MapReadModel, "rootSlug" | "locale" | "nodes">,
  gitHead: string | null,
): string {
  return JSON.stringify({
    gitHead,
    rootSlug: map.rootSlug,
    locale: map.locale ?? null,
    nodes: map.nodes,
  });
}
