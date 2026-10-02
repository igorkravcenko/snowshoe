import { describe, expect, test } from "bun:test";
import type { MapNode } from "../ui/src/api.ts";
import { humanTodoRows, isHumanTodoKind } from "../ui/src/marks.ts";

function node(partial: Partial<MapNode> & Pick<MapNode, "slug">): MapNode {
  return {
    type: "module",
    leaf: true,
    children: [],
    ...partial,
  };
}

describe("human todo marks", () => {
  test("learn and quiz are human todo kinds; work marks are not", () => {
    expect(isHumanTodoKind("learn")).toBe(true);
    expect(isHumanTodoKind("quiz")).toBe(true);
    expect(isHumanTodoKind("expand")).toBe(false);
    expect(isHumanTodoKind("enrich")).toBe(false);
    expect(isHumanTodoKind("fix")).toBe(false);
    expect(isHumanTodoKind("detail")).toBe(false);
  });

  test("humanTodoRows lists only nodes with learn/quiz, sorted by slug", () => {
    const rows = humanTodoRows([
      node({ slug: "z", marks: ["expand"] }),
      node({ slug: "b", title: "Beta", marks: ["quiz", "learn"] }),
      node({ slug: "a", marks: ["learn"] }),
      node({ slug: "c", marks: [] }),
      node({ slug: "d" }),
    ]);
    expect(rows).toEqual([
      { slug: "a", title: "a", kinds: ["learn"] },
      { slug: "b", title: "Beta", kinds: ["learn", "quiz"] },
    ]);
  });
});
