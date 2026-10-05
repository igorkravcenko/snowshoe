import { describe, expect, test } from "bun:test";
import type { MapNode } from "../ui/src/api.ts";
import {
  formatNodeTip,
  humanTodoRows,
  inboxTodoRows,
  isHumanTodoKind,
  isInboxMarkKind,
} from "../ui/src/marks.ts";

function node(partial: Partial<MapNode> & Pick<MapNode, "slug">): MapNode {
  return {
    type: "module",
    leaf: true,
    children: [],
    ...partial,
  };
}

describe("formatNodeTip", () => {
  test("marks go on a second line", () => {
    expect(formatNodeTip("Auth", "auth", [])).toBe("Auth · auth");
    expect(formatNodeTip("auth", "auth", [])).toBe("auth");
    expect(formatNodeTip("Auth", "auth", ["detail", "learn"])).toBe("Auth · auth\nDetail, Learn");
  });
});

describe("mark kind buckets", () => {
  test("inbox vs later vs work", () => {
    expect(isInboxMarkKind("new")).toBe(true);
    expect(isInboxMarkKind("decayed")).toBe(true);
    expect(isInboxMarkKind("learn")).toBe(false);
    expect(isHumanTodoKind("learn")).toBe(true);
    expect(isHumanTodoKind("quiz")).toBe(true);
    expect(isHumanTodoKind("new")).toBe(false);
    expect(isHumanTodoKind("expand")).toBe(false);
  });

  test("inbox and later rows split", () => {
    const nodes = [
      node({ slug: "a", title: "Alpha", marks: ["new", "learn"] }),
      node({ slug: "b", title: "Beta", marks: ["decayed"] }),
      node({ slug: "c", title: "Gamma", marks: ["expand"] }),
      node({ slug: "d", title: "Delta", marks: ["quiz"] }),
    ];
    expect(inboxTodoRows(nodes)).toEqual([
      { slug: "a", title: "Alpha", kinds: ["new"] },
      { slug: "b", title: "Beta", kinds: ["decayed"] },
    ]);
    expect(humanTodoRows(nodes)).toEqual([
      { slug: "a", title: "Alpha", kinds: ["learn"] },
      { slug: "d", title: "Delta", kinds: ["quiz"] },
    ]);
  });
});
