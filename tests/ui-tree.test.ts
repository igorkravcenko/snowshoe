import { describe, expect, test } from "bun:test";
import { DEFAULT_MAP_EXPAND_DEPTH } from "../src/domain/types.ts";
import { CliError } from "../src/errors.ts";
import { parseMapExpandDepth } from "../src/map/serve.ts";
import type { MapNode } from "../ui/src/api.ts";
import {
  ancestorSlugs,
  applyTreeKey,
  breadcrumbSlugs,
  initialExpandedSlugs,
  parentBySlug,
  slugFromHash,
  visibleSlugs,
} from "../ui/src/tree.ts";

function node(slug: string, children: string[]): MapNode {
  return { slug, type: "module", leaf: children.length === 0, children };
}

function tree(): Map<string, MapNode> {
  return new Map([
    ["root", node("root", ["a", "b"])],
    ["a", node("a", ["a1"])],
    ["b", node("b", [])],
    ["a1", node("a1", [])],
  ]);
}

describe("map tree expand depth", () => {
  test("parseMapExpandDepth default 1; rejects negatives", () => {
    expect(parseMapExpandDepth(undefined)).toBe(DEFAULT_MAP_EXPAND_DEPTH);
    expect(parseMapExpandDepth("0")).toBe(0);
    expect(parseMapExpandDepth("2")).toBe(2);
    expect(() => parseMapExpandDepth("-1")).toThrow(CliError);
    expect(() => parseMapExpandDepth("1.5")).toThrow(CliError);
  });

  test("default 1 expands root only", () => {
    const nodes = tree();
    expect([...initialExpandedSlugs("root", nodes, 1)].sort()).toEqual(["root"]);
    expect([...initialExpandedSlugs("root", nodes, 2)].sort()).toEqual(["a", "b", "root"]);
    expect([...initialExpandedSlugs("root", nodes, 0)]).toEqual([]);
  });

  test("GoTo expands ancestors so the target is visible", () => {
    const parent = parentBySlug("root", tree());
    expect(ancestorSlugs("a1", parent)).toEqual(["root", "a"]);
    expect(ancestorSlugs("root", parent)).toEqual([]);
    expect(breadcrumbSlugs("a1", parent)).toEqual(["root", "a", "a1"]);
    expect(slugFromHash("#auth")).toBe("auth");
    expect(slugFromHash("")).toBe("");
  });

  test("arrows walk visible rows; left/right expand and collapse", () => {
    const nodes = tree();
    const parent = parentBySlug("root", nodes);
    const expanded = new Set(["root"]);
    const vis = visibleSlugs("root", nodes, expanded);
    expect(vis).toEqual(["root", "a", "b"]);

    expect(applyTreeKey("ArrowDown", "root", vis, nodes, expanded, parent)).toEqual({
      kind: "select",
      slug: "a",
    });
    expect(applyTreeKey("ArrowUp", "a", vis, nodes, expanded, parent)).toEqual({
      kind: "select",
      slug: "root",
    });
    expect(applyTreeKey("ArrowRight", "a", vis, nodes, expanded, parent)).toEqual({
      kind: "expand",
      slug: "a",
    });
    const openA = new Set(["root", "a"]);
    expect(
      applyTreeKey("ArrowRight", "a", visibleSlugs("root", nodes, openA), nodes, openA, parent),
    ).toEqual({
      kind: "select",
      slug: "a1",
    });
    expect(applyTreeKey("ArrowLeft", "a", vis, nodes, openA, parent)).toEqual({
      kind: "collapse",
      slug: "a",
    });
    expect(applyTreeKey("ArrowLeft", "b", vis, nodes, expanded, parent)).toEqual({
      kind: "select",
      slug: "root",
    });
    expect(applyTreeKey("Home", "b", vis, nodes, expanded, parent)).toEqual({
      kind: "select",
      slug: "root",
    });
    expect(applyTreeKey("End", "root", vis, nodes, expanded, parent)).toEqual({
      kind: "select",
      slug: "b",
    });
  });
});
