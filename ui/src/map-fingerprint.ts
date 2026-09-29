import type { MapReadModel } from "./api.ts";

/** Snapshot of the map the UI is showing. `generatedAt` is wall-clock and must not count. HEAD drift is the header SHA, not Reload. */
export function mapFingerprint(map: Pick<MapReadModel, "rootSlug" | "locale" | "nodes">): string {
  return JSON.stringify({
    rootSlug: map.rootSlug,
    locale: map.locale ?? null,
    nodes: map.nodes,
  });
}
