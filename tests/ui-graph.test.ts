import { describe, expect, test } from "bun:test";
import type { MapNode } from "../ui/src/api.ts";
import {
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
  test("focus at center; orphans for non-neighbor prev/next", () => {
    const layout = radialLayout("focus", ["n1", "n2"], "prev", "next");
    expect(layout.positions.get("focus")).toEqual({ x: 0.5, y: 0.5 });
    expect(layout.ring).toEqual(["n1", "n2"]);
    expect(layout.orphans).toEqual(["prev", "next"]);
    expect(layout.positions.get("prev")?.y).toBeLessThan(0.3);
    expect(layout.positions.get("next")?.x).toBeGreaterThan(0.7);
  });

  test("neighbor prev stays on ring, not orphaned", () => {
    const layout = radialLayout("focus", ["prev", "other"], "prev", null);
    expect(layout.orphans).toEqual([]);
    expect(layout.positions.has("prev")).toBe(true);
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
