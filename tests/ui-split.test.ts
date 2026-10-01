import { describe, expect, test } from "bun:test";
import {
  applySplitDrag,
  DEFAULT_SPLIT,
  MIN_DETAIL_PX,
  MIN_SIDEBAR_PX,
  MIN_TREE_PX,
  parseSplitWeights,
  weightsToPx,
} from "../ui/src/split.ts";

describe("map column split", () => {
  test("parseSplitWeights rejects junk", () => {
    expect(parseSplitWeights(null)).toBeNull();
    expect(parseSplitWeights("{")).toBeNull();
    expect(parseSplitWeights(JSON.stringify(DEFAULT_SPLIT))).toEqual(DEFAULT_SPLIT);
    expect(DEFAULT_SPLIT).toEqual({ tree: 32, detail: 40, sidebar: 28 });
  });

  test("tree-detail drag grows tree and shrinks inspector", () => {
    const next = applySplitDrag(DEFAULT_SPLIT, "tree-detail", 80, 1200, true);
    const before = weightsToPx(DEFAULT_SPLIT, 1200 - 12, true);
    const after = weightsToPx(next, 1200 - 12, true);
    expect(after.tree).toBeGreaterThan(before.tree);
    expect(after.detail).toBeLessThan(before.detail);
    expect(after.tree).toBeGreaterThanOrEqual(MIN_TREE_PX);
    expect(after.detail).toBeGreaterThanOrEqual(MIN_DETAIL_PX);
    expect(after.sidebar).toBeGreaterThanOrEqual(MIN_SIDEBAR_PX);
  });

  test("mins hold on a small layout", () => {
    const next = applySplitDrag(DEFAULT_SPLIT, "tree-detail", 2000, 700, true);
    const px = weightsToPx(next, 700 - 12, true);
    expect(px.tree).toBeGreaterThanOrEqual(MIN_TREE_PX);
    expect(px.detail).toBeGreaterThanOrEqual(MIN_DETAIL_PX);
    expect(px.sidebar).toBeGreaterThanOrEqual(MIN_SIDEBAR_PX);
  });

  test("detail-sidebar drag is a no-op when sidebar is closed", () => {
    expect(applySplitDrag(DEFAULT_SPLIT, "detail-sidebar", 40, 1000, false)).toEqual(DEFAULT_SPLIT);
  });
});
