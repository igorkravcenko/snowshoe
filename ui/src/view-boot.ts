/**
 * Latch for one-shot map view bootstrap.
 * Claim while a create/fetch is in flight; release on cancel-before-success or failure
 * so a later effect can retry. Once a view id is committed, keep the claim.
 */

export type ViewBootLatch = {
  claimed: boolean;
};

export function beginViewBoot(
  latch: ViewBootLatch,
  modelReady: boolean,
  viewId: string | null,
): boolean {
  if (!modelReady || viewId || latch.claimed) return false;
  latch.claimed = true;
  return true;
}

/** Effect cleanup: release only if no view id was committed yet. */
export function cancelViewBoot(latch: ViewBootLatch, viewId: string | null): void {
  if (!viewId) latch.claimed = false;
}

/** createMapView / resolve failure: always release so Reload can retry. */
export function failViewBoot(latch: ViewBootLatch): void {
  latch.claimed = false;
}
