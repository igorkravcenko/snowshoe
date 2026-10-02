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
/** Visit previous: left of focus on the ring. */
const ANGLE_PREV = Math.PI;
/** Visit next: right of focus on the ring. */
const ANGLE_NEXT = 0;
/** Non-neighbor prev/next park on the bottom corners (not top). */
const ORPHAN_PREV: Point = { x: 0.14, y: 0.88 };
const ORPHAN_NEXT: Point = { x: 0.86, y: 0.88 };

function polar(angle: number): Point {
  return { x: CX + RING_R * Math.cos(angle), y: CY + RING_R * Math.sin(angle) };
}

/** Interior points on the directed arc from `from` to `to` (endpoints exclusive). */
function interiorOnArc(from: number, to: number, count: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    out.push(from + (to - from) * t);
  }
  return out;
}

/**
 * Angles for non-pinned ring neighbors.
 * With left/right visit pins, free nodes fill the upper and lower semicircles
 * evenly (not “place on full circle then yank pins”).
 */
export function freeRingAngles(count: number, pinPrev: boolean, pinNext: boolean): number[] {
  if (count <= 0) return [];
  if (!pinPrev && !pinNext) {
    return Array.from({ length: count }, (_, i) => -Math.PI / 2 + (2 * Math.PI * i) / count);
  }
  if (pinPrev && pinNext) {
    const upperN = Math.ceil(count / 2);
    const lowerN = count - upperN;
    // Upper: right → left via top (0 → −π). Lower: right → left via bottom (0 → π).
    return [...interiorOnArc(0, -Math.PI, upperN), ...interiorOnArc(0, Math.PI, lowerN)];
  }
  // One pin: equal spacing around the full circle, skipping the pin slot.
  const pinAngle = pinPrev ? ANGLE_PREV : ANGLE_NEXT;
  const total = count + 1;
  const out: number[] = [];
  for (let i = 1; i < total; i++) {
    out.push(pinAngle + (2 * Math.PI * i) / total);
  }
  return out;
}

/**
 * Radial layout in unit square [0,1]². Focus at center; neighbors on a ring.
 * Visit previous is always left of focus; next always right (on-ring when a
 * neighbor, otherwise bottom corners — no fabricated history edge).
 * Free neighbors reflow evenly around those pins (arc fill), not a post-hoc yank.
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
  const ringSet = new Set(ring);

  const pinPrev = Boolean(prevSlug && prevSlug !== focus && ringSet.has(prevSlug));
  const pinNext = Boolean(
    nextSlug && nextSlug !== focus && nextSlug !== prevSlug && ringSet.has(nextSlug),
  );

  if (pinPrev && prevSlug) positions.set(prevSlug, polar(ANGLE_PREV));
  if (pinNext && nextSlug) positions.set(nextSlug, polar(ANGLE_NEXT));

  const free = ring.filter((s) => {
    if (pinPrev && s === prevSlug) return false;
    if (pinNext && s === nextSlug) return false;
    return true;
  });
  const angles = freeRingAngles(free.length, pinPrev, pinNext);
  for (let i = 0; i < free.length; i++) {
    positions.set(free[i]!, polar(angles[i]!));
  }

  const orphans: string[] = [];
  if (prevSlug && prevSlug !== focus && !positions.has(prevSlug)) {
    positions.set(prevSlug, ORPHAN_PREV);
    orphans.push(prevSlug);
  }
  if (nextSlug && nextSlug !== focus && !positions.has(nextSlug)) {
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
