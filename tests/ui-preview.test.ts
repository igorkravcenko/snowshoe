import { describe, expect, test } from "bun:test";
import { incomingRefs, sameAnchor } from "../ui/src/api.ts";
import { mapFingerprint } from "../ui/src/map-fingerprint.ts";
import { prismLanguage } from "../ui/src/preview-lang.ts";

describe("map UI code preview", () => {
  test("Prism only for code extensions; markdown/yaml stay plain", () => {
    expect(prismLanguage("src/cli.ts")).toBe("typescript");
    expect(prismLanguage("ui/src/App.tsx")).toBe("tsx");
    expect(prismLanguage("src/foo.js")).toBe("javascript");
    expect(prismLanguage("package.json")).toBe("json");
    expect(prismLanguage("docs/brain/CURRENT.md")).toBeNull();
    expect(prismLanguage("README.md")).toBeNull();
    expect(prismLanguage(".github/workflows/ci.yml")).toBeNull();
    expect(prismLanguage("Makefile")).toBeNull();
  });

  test("sameAnchor distinguishes path and line range", () => {
    const a = { path: "src/cli.ts", startLine: 1 };
    expect(sameAnchor(a, { path: "src/cli.ts", startLine: 1 })).toBe(true);
    expect(sameAnchor(a, { path: "src/cli.ts", startLine: 10 })).toBe(false);
    expect(sameAnchor(a, { path: "src/index.ts", startLine: 1 })).toBe(false);
  });

  test("incomingRefs is the reverse of outgoing to", () => {
    const nodes = [
      {
        slug: "cli",
        type: "module",
        leaf: false,
        children: [] as string[],
        refs: [{ to: "ledger", kind: "uses" }],
      },
      { slug: "ledger", type: "module", leaf: false, children: [] as string[] },
    ];
    expect(incomingRefs(nodes, "ledger")).toEqual([{ from: "cli", kind: "uses" }]);
    expect(incomingRefs(nodes, "cli")).toEqual([]);
  });

  test("mapFingerprint ignores generatedAt and sees detailStatus", () => {
    const nodes = [{ slug: "root", type: "system", leaf: false, children: [] as string[] }];
    const a = { generatedAt: "2026-01-01T00:00:00.000Z", rootSlug: "root", nodes };
    const b = { generatedAt: "2026-01-02T00:00:00.000Z", rootSlug: "root", nodes };
    expect(mapFingerprint(a, "abc")).toBe(mapFingerprint(b, "abc"));
    const pending = {
      ...a,
      nodes: [{ ...nodes[0]!, detailStatus: "pending" as const }],
    };
    expect(mapFingerprint(a, "abc")).not.toBe(mapFingerprint(pending, "abc"));
    expect(mapFingerprint(a, "abc")).not.toBe(mapFingerprint(a, "def"));
  });
});
