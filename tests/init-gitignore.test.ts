import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureGitignore } from "../src/commands/init.ts";
import { makeGitRepo, readGitignore } from "./helpers.ts";

function expectAnchored(gi: string): void {
  expect(gi).toMatch(/(^|\n)\/\.snowshoe(\n|$)/);
  expect(gi).toMatch(/(^|\n)\/\.snowshoe\/(\n|$)/);
}

describe("ensureGitignore", () => {
  test("writes root-anchored /.snowshoe and /.snowshoe/", () => {
    const repo = makeGitRepo();
    expect(ensureGitignore(repo)).toBe(true);
    expectAnchored(readGitignore(repo));
    expect(ensureGitignore(repo)).toBe(false);
  });

  test("appends /.snowshoe when only /.snowshoe/ is present", () => {
    const repo = makeGitRepo();
    writeFileSync(join(repo, ".gitignore"), "node_modules/\n/.snowshoe/\n", "utf8");
    expect(ensureGitignore(repo)).toBe(true);
    expectAnchored(readGitignore(repo));
    expect(ensureGitignore(repo)).toBe(false);
  });

  test("appends /.snowshoe/ when only /.snowshoe is present", () => {
    const repo = makeGitRepo();
    writeFileSync(join(repo, ".gitignore"), "/.snowshoe\n", "utf8");
    expect(ensureGitignore(repo)).toBe(true);
    expectAnchored(readGitignore(repo));
  });

  test("does not gitignore skills/snowshoe or .cursor/skills/snowshoe", () => {
    const repo = makeGitRepo();
    ensureGitignore(repo);
    mkdirSync(join(repo, "skills", "snowshoe"), { recursive: true });
    mkdirSync(join(repo, ".cursor", "skills", "snowshoe"), { recursive: true });
    writeFileSync(join(repo, "skills", "snowshoe", "SKILL.md"), "# skill\n");
    writeFileSync(join(repo, ".cursor", "skills", "snowshoe", "SKILL.md"), "# skill\n");
    mkdirSync(join(repo, ".snowshoe"), { recursive: true });
    writeFileSync(join(repo, ".snowshoe", "ledger.sqlite"), "");

    const env = { ...process.env };
    delete env.GIT_DIR;
    delete env.GIT_WORK_TREE;
    const check = (path: string) =>
      Bun.spawnSync(["git", "check-ignore", "-q", "--", path], {
        cwd: repo,
        stdout: "pipe",
        stderr: "pipe",
        env,
      }).exitCode;

    expect(check(".snowshoe")).toBe(0);
    expect(check("skills/snowshoe")).toBe(1);
    expect(check(".cursor/skills/snowshoe")).toBe(1);
  });
});
