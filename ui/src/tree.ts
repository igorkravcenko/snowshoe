import type { MapNode } from "./api.ts";

/** Root is depth 0. Expand nodes whose depth is `< expandDepth` so that many child levels are visible. */
export function initialExpandedSlugs(
  rootSlug: string,
  nodes: Map<string, MapNode>,
  expandDepth: number,
): Set<string> {
  const out = new Set<string>();
  if (expandDepth < 1) return out;
  const queue: Array<{ slug: string; depth: number }> = [{ slug: rootSlug, depth: 0 }];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (seen.has(cur.slug)) continue;
    seen.add(cur.slug);
    if (cur.depth < expandDepth) out.add(cur.slug);
    const node = nodes.get(cur.slug);
    if (!node) continue;
    for (const child of node.children) {
      queue.push({ slug: child, depth: cur.depth + 1 });
    }
  }
  return out;
}

export function parentBySlug(rootSlug: string, nodes: Map<string, MapNode>): Map<string, string> {
  const parent = new Map<string, string>();
  const seen = new Set<string>();
  const queue = [rootSlug];
  while (queue.length > 0) {
    const slug = queue.shift()!;
    if (seen.has(slug)) continue;
    seen.add(slug);
    const node = nodes.get(slug);
    if (!node) continue;
    for (const child of node.children) {
      if (!parent.has(child)) parent.set(child, slug);
      queue.push(child);
    }
  }
  return parent;
}

/** Ancestors from root down to (not including) slug — expand these so `slug` is visible. */
export function ancestorSlugs(slug: string, parent: Map<string, string>): string[] {
  const chain: string[] = [];
  let cur: string | undefined = parent.get(slug);
  const guard = new Set<string>();
  while (cur && !guard.has(cur)) {
    guard.add(cur);
    chain.push(cur);
    cur = parent.get(cur);
  }
  return chain.reverse();
}

/** Preorder of nodes that are currently shown (expanded parents). */
export function visibleSlugs(
  rootSlug: string,
  nodes: Map<string, MapNode>,
  expanded: Set<string>,
): string[] {
  const out: string[] = [];
  const walk = (slug: string, seen: Set<string>) => {
    if (seen.has(slug)) return;
    seen.add(slug);
    out.push(slug);
    const node = nodes.get(slug);
    if (!node || !expanded.has(slug)) return;
    for (const child of node.children) walk(child, seen);
  };
  walk(rootSlug, new Set());
  return out;
}

export type TreeKeyResult =
  | { kind: "noop" }
  | { kind: "select"; slug: string }
  | { kind: "expand"; slug: string }
  | { kind: "collapse"; slug: string };

/** WAI-ARIA tree: ↑/↓ among visible rows; → expand or first child; ← collapse or parent. */
export function applyTreeKey(
  key: string,
  current: string,
  visible: string[],
  nodes: Map<string, MapNode>,
  expanded: Set<string>,
  parent: Map<string, string>,
): TreeKeyResult {
  const idx = visible.indexOf(current);
  if (key === "ArrowDown") {
    if (idx < 0 || idx >= visible.length - 1) return { kind: "noop" };
    return { kind: "select", slug: visible[idx + 1]! };
  }
  if (key === "ArrowUp") {
    if (idx <= 0) return { kind: "noop" };
    return { kind: "select", slug: visible[idx - 1]! };
  }
  if (key === "Home") {
    const first = visible[0];
    if (!first || first === current) return { kind: "noop" };
    return { kind: "select", slug: first };
  }
  if (key === "End") {
    const last = visible[visible.length - 1];
    if (!last || last === current) return { kind: "noop" };
    return { kind: "select", slug: last };
  }
  const node = nodes.get(current);
  const hasKids = Boolean(node && node.children.length > 0);
  if (key === "ArrowRight") {
    if (!hasKids) return { kind: "noop" };
    if (!expanded.has(current)) return { kind: "expand", slug: current };
    const child = node!.children[0];
    if (!child) return { kind: "noop" };
    return { kind: "select", slug: child };
  }
  if (key === "ArrowLeft") {
    if (hasKids && expanded.has(current)) return { kind: "collapse", slug: current };
    const up = parent.get(current);
    if (!up) return { kind: "noop" };
    return { kind: "select", slug: up };
  }
  return { kind: "noop" };
}
