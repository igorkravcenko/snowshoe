import { describe, expect, test } from "bun:test";
import type { MapNode } from "../ui/src/api.ts";
import {
  applyGraphDisplay,
  buildEgoGraph,
  edgeStrokeClass,
  edgeStrokeFamily,
  emptyVisitMirror,
  radialLayout,
  visitNextSlug,
  visitPopTo,
  visitPrevSlug,
  visitPush,
} from "../ui/src/graph.ts";

function node(partial: Partial<MapNode> & Pick<MapNode, "slug">): MapNode {
  return {
    type: "module",
    leaf: true,
    children: [],
    ...partial,
  };
}

function asMap(nodes: MapNode[]): Map<string, MapNode> {
  return new Map(nodes.map((n) => [n.slug, n]));
}

describe("buildEgoGraph", () => {
  test("includes parent, children, and bidirectional refs", () => {
    const nodes = asMap([
      node({ slug: "root", children: ["a", "b"], leaf: false }),
      node({
        slug: "a",
        children: ["a1"],
        leaf: false,
        refs: [{ to: "b", kind: "uses" }],
      }),
      node({ slug: "b", refs: [{ to: "a", kind: "related" }] }),
      node({ slug: "a1" }),
      node({ slug: "orphan" }),
    ]);
    const ego = buildEgoGraph("a", nodes);
    expect(ego.focus).toBe("a");
    expect(ego.neighbors).toEqual(["a1", "b", "root"]);
    expect(ego.edges).toContainEqual({ from: "root", to: "a", kind: "parent" });
    expect(ego.edges).toContainEqual({ from: "a", to: "a1", kind: "parent" });
    expect(ego.edges).toContainEqual({ from: "a", to: "b", kind: "uses" });
    expect(ego.edges).toContainEqual({ from: "b", to: "a", kind: "related" });
    expect(ego.neighbors).not.toContain("orphan");
  });

  test("unknown focus yields empty ego", () => {
    expect(buildEgoGraph("missing", asMap([node({ slug: "a" })]))).toEqual({
      focus: "missing",
      neighbors: [],
      edges: [],
    });
  });
});

describe("applyGraphDisplay", () => {
  test("hiding refs drops ref edges and ref-only neighbors", () => {
    const nodes = asMap([
      node({ slug: "root", children: ["a", "b"], leaf: false }),
      node({
        slug: "a",
        children: ["a1"],
        leaf: false,
        refs: [{ to: "b", kind: "uses" }],
      }),
      node({ slug: "b" }),
      node({ slug: "a1" }),
    ]);
    const ego = buildEgoGraph("a", nodes);
    const filtered = applyGraphDisplay(ego, { showRefs: false });
    expect(filtered.neighbors).toEqual(["a1", "root"]);
    expect(filtered.edges.every((e) => e.kind === "parent")).toBe(true);
    expect(filtered.edges).not.toContainEqual({ from: "a", to: "b", kind: "uses" });
    expect(applyGraphDisplay(ego, { showRefs: true })).toEqual(ego);
  });
});

describe("edge stroke families", () => {
  test("parent vs ref", () => {
    expect(edgeStrokeFamily("parent")).toBe("parent");
    expect(edgeStrokeFamily("related")).toBe("ref");
    expect(edgeStrokeFamily("uses")).toBe("ref");
    expect(edgeStrokeClass("parent")).toBe("graph-edge-parent");
    expect(edgeStrokeClass("uses")).toBe("graph-edge-ref");
  });
});

describe("radialLayout", () => {
  test("focus at center; orphan prev/next on bottom left/right", () => {
    const layout = radialLayout("focus", ["n1", "n2"], "prev", "next");
    expect(layout.positions.get("focus")).toEqual({ x: 0.5, y: 0.5 });
    expect(layout.ring).toEqual(["n1", "n2"]);
    expect(layout.orphans).toEqual(["prev", "next"]);
    const prev = layout.positions.get("prev")!;
    const next = layout.positions.get("next")!;
    expect(prev.x).toBeLessThan(0.5);
    expect(next.x).toBeGreaterThan(0.5);
    expect(prev.y).toBeGreaterThan(0.7);
    expect(next.y).toBeGreaterThan(0.7);
  });

  test("neighbor prev pins left; next pins right", () => {
    const layout = radialLayout("focus", ["prev", "other", "next"], "prev", "next");
    expect(layout.orphans).toEqual([]);
    const prev = layout.positions.get("prev")!;
    const next = layout.positions.get("next")!;
    expect(prev.x).toBeLessThan(0.5);
    expect(Math.abs(prev.y - 0.5)).toBeLessThan(0.02);
    expect(next.x).toBeGreaterThan(0.5);
    expect(Math.abs(next.y - 0.5)).toBeLessThan(0.02);
    // Sole free neighbor sits on top arc midpoint (even reflow, not a yanked hole).
    const other = layout.positions.get("other")!;
    expect(Math.abs(other.x - 0.5)).toBeLessThan(0.02);
    expect(other.y).toBeLessThan(0.5);
  });

  test("two free neighbors split to top and bottom when both pins set", () => {
    const layout = radialLayout("focus", ["prev", "a", "b", "next"], "prev", "next");
    const a = layout.positions.get("a")!;
    const b = layout.positions.get("b")!;
    const ys = [a.y, b.y].sort((x, y) => x - y);
    expect(ys[0]!).toBeLessThan(0.5);
    expect(ys[1]!).toBeGreaterThan(0.5);
  });

  test("neighbor prev stays on ring, not orphaned", () => {
    const layout = radialLayout("focus", ["prev", "other"], "prev", null);
    expect(layout.orphans).toEqual([]);
    expect(layout.positions.has("prev")).toBe(true);
    expect(layout.positions.get("prev")!.x).toBeLessThan(0.5);
  });
});

describe("visit mirror", () => {
  test("push truncates forward; back/forward do not re-push A-B-A", () => {
    let m = emptyVisitMirror();
    m = visitPush(m, "a");
    m = visitPush(m, "b");
    m = visitPush(m, "c");
    expect(visitPrevSlug(m)).toBe("b");
    expect(visitNextSlug(m)).toBe(null);

    m = visitPopTo(m, "b");
    expect(m.index).toBe(1);
    expect(visitPrevSlug(m)).toBe("a");
    expect(visitNextSlug(m)).toBe("c");

    m = visitPopTo(m, "a");
    expect(m.stack).toEqual(["a", "b", "c"]);
    expect(m.index).toBe(0);

    m = visitPush(m, "d");
    expect(m.stack).toEqual(["a", "d"]);
    expect(m.index).toBe(1);
  });

  test("push same slug is a no-op", () => {
    let m = visitPush(emptyVisitMirror(), "a");
    m = visitPush(m, "a");
    expect(m).toEqual({ stack: ["a"], index: 0 });
  });
});
