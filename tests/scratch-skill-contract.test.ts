import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SKILL = join(import.meta.dir, "../skills/snowshoe-scratch/SKILL.md");

describe("snowshoe-scratch skill contract", () => {
  const text = readFileSync(SKILL, "utf8");

  test("CURRENT.md is a mental map, not a file tree or TOC dump", () => {
    expect(text).toContain("mental model, not");
    expect(text).toContain("1:1 with code");
    expect(text).toContain("Readable without jumping");
    expect(text).toContain("CURRENT.md (mental map)");
    expect(text).not.toContain("notable files only");
    expect(text).not.toContain("shallow outline tree");
    expect(text).not.toContain("Shallow outline tree of the target");
  });
});
