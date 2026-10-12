import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

describe(".claude-plugin manifests stay in lockstep with package.json", () => {
  const version = read("package.json").version as string;

  test("plugin.json version matches package.json", () => {
    expect(read(".claude-plugin/plugin.json").version).toBe(version);
  });

  test("marketplace.json versions match package.json", () => {
    const m = read(".claude-plugin/marketplace.json");
    expect(m.metadata.version).toBe(version);
    for (const p of m.plugins) expect(p.version).toBe(version);
  });

  test("manifests expose only skills/snowshoe", () => {
    expect(read(".claude-plugin/plugin.json").skills).toEqual(["./skills/snowshoe"]);
    for (const p of read(".claude-plugin/marketplace.json").plugins) {
      expect(p.skills).toEqual(["./skills/snowshoe"]);
    }
  });
});
