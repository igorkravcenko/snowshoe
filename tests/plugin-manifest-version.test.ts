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

  test("manifests expose snowshoe and snowshoe-scratch", () => {
    const want = ["./skills/snowshoe", "./skills/snowshoe-scratch"];
    expect(read(".claude-plugin/plugin.json").skills).toEqual(want);
    for (const p of read(".claude-plugin/marketplace.json").plugins) {
      expect(p.skills).toEqual(want);
    }
  });

  test("plugin description is bun add -g, not npm i -g", () => {
    const desc = String(read(".claude-plugin/plugin.json").description);
    expect(desc).toContain("bun add -g @igorkravcenko/snowshoe");
    expect(desc).not.toMatch(/npm install -g/);
  });
});
