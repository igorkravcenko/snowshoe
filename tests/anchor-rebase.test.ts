import { describe, expect, test } from "bun:test";
import { rebaseAnchor } from "../src/map/anchor-rebase.ts";

describe("rebaseAnchor", () => {
  const file = "alpha\nfoo\nbar\nfoo\nbaz\n";

  test("picks the trimmed match closest to stored start", () => {
    const r = rebaseAnchor({ fileText: file, storedStart: 4, lineText: "foo", span: 2 });
    expect(r.startLine).toBe(4);
    expect(r.endLine).toBe(5);
  });

  test("keeps stored start when no trim match", () => {
    const r = rebaseAnchor({ fileText: file, storedStart: 3, lineText: "missing", span: 1 });
    expect(r.startLine).toBe(3);
    expect(r.endLine).toBe(3);
  });
});
