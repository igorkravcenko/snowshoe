import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureGitignore } from "../src/commands/init.ts";
import { makeGitRepo, readGitignore } from "./helpers.ts";

describe("ensureGitignore", () => {
  test("writes both .snowshoe and .snowshoe/", () => {
    const repo = makeGitRepo();
    expect(ensureGitignore(repo)).toBe(true);
    const gi = readGitignore(repo);
    expect(gi).toMatch(/(^|\n)\.snowshoe(\n|$)/);
    expect(gi).toMatch(/(^|\n)\.snowshoe\/(\n|$)/);
    expect(ensureGitignore(repo)).toBe(false);
  });

  test("appends bare .snowshoe when only .snowshoe/ is present", () => {
    const repo = makeGitRepo();
    writeFileSync(join(repo, ".gitignore"), "node_modules/\n.snowshoe/\n", "utf8");
    expect(ensureGitignore(repo)).toBe(true);
    const gi = readGitignore(repo);
    expect(gi).toMatch(/(^|\n)\.snowshoe(\n|$)/);
    expect(gi).toMatch(/(^|\n)\.snowshoe\/(\n|$)/);
    expect(ensureGitignore(repo)).toBe(false);
  });

  test("appends .snowshoe/ when only bare .snowshoe is present", () => {
    const repo = makeGitRepo();
    writeFileSync(join(repo, ".gitignore"), ".snowshoe\n", "utf8");
    expect(ensureGitignore(repo)).toBe(true);
    const gi = readGitignore(repo);
    expect(gi).toMatch(/(^|\n)\.snowshoe(\n|$)/);
    expect(gi).toMatch(/(^|\n)\.snowshoe\/(\n|$)/);
  });
});
