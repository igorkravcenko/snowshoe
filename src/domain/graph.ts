import type { Ledger } from "../db/ledger.ts";

/** `start` plus descendants via parent edges. `depth` 0 = start only; omitted = unbounded. */
export function descendantSlugs(ledger: Ledger, start: string, depth?: number): Set<string> {
  const out = new Set<string>([start]);
  if (depth === 0) return out;
  const max = depth ?? Number.POSITIVE_INFINITY;
  let frontier = [start];
  let level = 0;
  while (frontier.length && level < max) {
    const next: string[] = [];
    for (const s of frontier) {
      for (const c of ledger.childrenOf(s)) {
        if (!out.has(c)) {
          out.add(c);
          next.push(c);
        }
      }
    }
    frontier = next;
    level += 1;
  }
  return out;
}
