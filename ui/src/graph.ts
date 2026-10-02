import { incomingRefs, type MapNode } from "./api.ts";

export type GraphEdge = {
  from: string;
  to: string;
  kind: string;
};

export type EgoGraph = {
  focus: string;
  neighbors: string[];
  edges: GraphEdge[];
};

export type Point = { x: number; y: number };

export type GraphLayout = {
  positions: Map<string, Point>;
  /** Slugs placed on the neighbor ring (structural neighbors). */
  ring: string[];
  /** Prev/next parked off-ring when not a neighbor. */
  orphans: string[];
};

export type EdgeStrokeFamily = "parent" | "ref";

/** `parent` is hierarchy; every other kind is a relevance ref. */
export function edgeStrokeFamily(kind: string): EdgeStrokeFamily {
  return kind === "parent" ? "parent" : "ref";
}

export function edgeStrokeClass(kind: string): string {
  return edgeStrokeFamily(kind) === "parent" ? "graph-edge-parent" : "graph-edge-ref";
}

/**
 * 1-hop ego cut from the shared MapNode index (same SoT as the tree).
 * Edges: parent→focus, focus→child, outgoing refs, incoming refs.
 */
export function buildEgoGraph(focus: string, nodes: Map<string, MapNode>): EgoGraph {
  const focusNode = nodes.get(focus);
  if (!focusNode) {
    return { focus, neighbors: [], edges: [] };
  }

  const neighborSet = new Set<string>();
  const edges: GraphEdge[] = [];
  const edgeKey = (from: string, to: string, kind: string) => `${from}\0${to}\0${kind}`;
  const seen = new Set<string>();

  const addEdge = (from: string, to: string, kind: string) => {
    if (from === to) return;
    const key = edgeKey(from, to, kind);
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from, to, kind });
    if (from !== focus) neighborSet.add(from);
    if (to !== focus) neighborSet.add(to);
  };

  for (const [slug, node] of nodes) {
    if (node.children.includes(focus)) {
      addEdge(slug, focus, "parent");
    }
  }

  for (const child of focusNode.children) {
    if (nodes.has(child)) addEdge(focus, child, "parent");
  }

  for (const r of focusNode.refs ?? []) {
    if (nodes.has(r.to)) addEdge(focus, r.to, r.kind || "related");
  }

  for (const r of incomingRefs(nodes.values(), focus)) {
    if (nodes.has(r.from)) addEdge(r.from, focus, r.kind || "related");
  }

  const neighbors = [...neighborSet].sort();
  edges.sort((a, b) => {
    const c = a.from.localeCompare(b.from);
    if (c !== 0) return c;
    const d = a.to.localeCompare(b.to);
    if (d !== 0) return d;
    return a.kind.localeCompare(b.kind);
  });

  return { focus, neighbors, edges };
}

const CX = 0.5;
const CY = 0.5;
const RING_R = 0.36;
const ORPHAN_PREV: Point = { x: 0.12, y: 0.12 };
const ORPHAN_NEXT: Point = { x: 0.88, y: 0.12 };

/**
 * Radial layout in unit square [0,1]². Focus at center; neighbors on a ring;
 * prev/next that are not neighbors sit in corners (no structural edge implied).
 */
export function radialLayout(
  focus: string,
  neighborSlugs: string[],
  prevSlug?: string | null,
  nextSlug?: string | null,
): GraphLayout {
  const positions = new Map<string, Point>();
  positions.set(focus, { x: CX, y: CY });

  const ring = [...neighborSlugs].sort();
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    positions.set(ring[i]!, {
      x: CX + RING_R * Math.cos(angle),
      y: CY + RING_R * Math.sin(angle),
    });
  }

  const orphans: string[] = [];
  const ringSet = new Set(ring);
  if (prevSlug && prevSlug !== focus && !ringSet.has(prevSlug) && !positions.has(prevSlug)) {
    positions.set(prevSlug, ORPHAN_PREV);
    orphans.push(prevSlug);
  }
  if (nextSlug && nextSlug !== focus && !ringSet.has(nextSlug) && !positions.has(nextSlug)) {
    positions.set(nextSlug, ORPHAN_NEXT);
    orphans.push(nextSlug);
  }

  return { positions, ring, orphans };
}

/** Visit stack mirror synced to browser History push/back/forward. */
export type VisitMirror = {
  stack: string[];
  index: number;
};

export function emptyVisitMirror(): VisitMirror {
  return { stack: [], index: -1 };
}

/** After a push navigation to `slug` (truncates forward stack). */
export function visitPush(mirror: VisitMirror, slug: string): VisitMirror {
  if (mirror.index >= 0 && mirror.stack[mirror.index] === slug) return mirror;
  const stack = mirror.stack.slice(0, mirror.index + 1);
  stack.push(slug);
  return { stack, index: stack.length - 1 };
}

/** Align mirror index after popstate landed on `slug` (prefer existing entry). */
export function visitPopTo(mirror: VisitMirror, slug: string): VisitMirror {
  if (mirror.stack.length === 0) {
    return { stack: [slug], index: 0 };
  }
  // Prefer stepping back one if that matches (undo without A-B-A pollution).
  if (mirror.index > 0 && mirror.stack[mirror.index - 1] === slug) {
    return { stack: mirror.stack, index: mirror.index - 1 };
  }
  // Prefer stepping forward one.
  if (mirror.index < mirror.stack.length - 1 && mirror.stack[mirror.index + 1] === slug) {
    return { stack: mirror.stack, index: mirror.index + 1 };
  }
  // Same slug (no-op / replace).
  if (mirror.stack[mirror.index] === slug) return mirror;
  // Seed or recover: replace current or push when empty index.
  if (mirror.index < 0) {
    return { stack: [slug], index: 0 };
  }
  // Divergent pop (manual hash edit): truncate forward and set current.
  const stack = mirror.stack.slice(0, mirror.index);
  stack.push(slug);
  return { stack, index: stack.length - 1 };
}

export function visitPrevSlug(mirror: VisitMirror): string | null {
  if (mirror.index <= 0) return null;
  return mirror.stack[mirror.index - 1] ?? null;
}

export function visitNextSlug(mirror: VisitMirror): string | null {
  if (mirror.index < 0 || mirror.index >= mirror.stack.length - 1) return null;
  return mirror.stack[mirror.index + 1] ?? null;
}
