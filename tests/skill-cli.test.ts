import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  PACKAGED_SKILLS,
  SCRATCH_PACKAGE_FILES,
  SKILL_PACKAGE_FILES,
} from "../src/commands/skill.ts";
import { makeGitRepo, snowshoe } from "./helpers.ts";

const PACKAGED = join(import.meta.dir, "../skills/snowshoe");
const PACKAGED_SCRATCH = join(import.meta.dir, "../skills/snowshoe-scratch");

describe("skill CLI", () => {
  test("list and cat return packaged packages", async () => {
    const repo = makeGitRepo();
    const list = await snowshoe(repo, ["skill", "list", "--json"]);
    expect(list.exitCode).toBe(0);
    expect(list.json.command).toBe("skill.list");
    const packages = list.json.packages as Array<{
      name: string;
      files: Array<{ name: string; bytes: number }>;
    }>;
    expect(packages.map((p) => p.name)).toEqual(PACKAGED_SKILLS.map((p) => p.name));
    expect(packages[0]!.files.map((f) => f.name)).toEqual([...SKILL_PACKAGE_FILES]);
    expect(packages[1]!.files.map((f) => f.name)).toEqual([...SCRATCH_PACKAGE_FILES]);
    expect(packages.every((p) => p.files.every((f) => f.bytes > 0))).toBe(true);
    // Back-compat product fields
    expect(list.json.packageName).toBe("snowshoe");
    expect((list.json.files as Array<{ name: string }>).map((f) => f.name)).toEqual([
      ...SKILL_PACKAGE_FILES,
    ]);

    const cat = await snowshoe(repo, ["skill", "cat", "--json", "SKILL.md"]);
    expect(cat.exitCode).toBe(0);
    expect(cat.json.command).toBe("skill.cat");
    expect(cat.json.packageName).toBe("snowshoe");
    expect(cat.json.file).toBe("SKILL.md");
    expect(String(cat.json.text)).toContain("name: snowshoe");

    const scratchCat = await snowshoe(repo, [
      "skill",
      "cat",
      "--json",
      "--package",
      "snowshoe-scratch",
      "SKILL.md",
    ]);
    expect(scratchCat.exitCode).toBe(0);
    expect(scratchCat.json.packageName).toBe("snowshoe-scratch");
    expect(String(scratchCat.json.text)).toContain("name: snowshoe-scratch");

    const bad = await snowshoe(repo, ["skill", "cat", "--json", "../etc/passwd"]);
    expect(bad.exitCode).not.toBe(0);
  });

  test("install requires --skills-path; copies snowshoe + snowshoe-scratch", async () => {
    const repo = makeGitRepo();
    const missing = await snowshoe(repo, ["skill", "install", "--json"]);
    expect(missing.exitCode).not.toBe(0);
    expect(String(missing.json.error)).toMatch(/skills-path/i);

    const installed = await snowshoe(repo, [
      "skill",
      "install",
      "--json",
      "--skills-path",
      ".cursor/skills",
    ]);
    expect(installed.exitCode).toBe(0);
    expect(installed.json.command).toBe("skill.install");
    expect(installed.json.changed).toBe(true);
    expect(String(installed.json.targetDir)).toBe(join(repo, ".cursor", "skills", "snowshoe"));
    const pkgs = installed.json.packages as Array<{
      name: string;
      targetDir: string;
      written: string[];
      changed: boolean;
    }>;
    expect(pkgs.map((p) => p.name)).toEqual(["snowshoe", "snowshoe-scratch"]);
    expect(pkgs.every((p) => p.changed)).toBe(true);

    for (const name of SKILL_PACKAGE_FILES) {
      const got = readFileSync(join(repo, ".cursor", "skills", "snowshoe", name), "utf8");
      const want = readFileSync(join(PACKAGED, name), "utf8");
      expect(got).toBe(want);
    }
    for (const name of SCRATCH_PACKAGE_FILES) {
      const got = readFileSync(join(repo, ".cursor", "skills", "snowshoe-scratch", name), "utf8");
      const want = readFileSync(join(PACKAGED_SCRATCH, name), "utf8");
      expect(got).toBe(want);
    }

    const again = await snowshoe(repo, [
      "skill",
      "install",
      "--json",
      "--skills-path",
      ".cursor/skills",
    ]);
    expect(again.exitCode).toBe(0);
    expect(again.json.changed).toBe(false);
    expect(again.json.unchanged).toEqual([...SKILL_PACKAGE_FILES]);
    const againPkgs = again.json.packages as Array<{ name: string; unchanged: string[] }>;
    expect(againPkgs.find((p) => p.name === "snowshoe")!.unchanged).toEqual([
      ...SKILL_PACKAGE_FILES,
    ]);
    expect(againPkgs.find((p) => p.name === "snowshoe-scratch")!.unchanged).toEqual([
      ...SCRATCH_PACKAGE_FILES,
    ]);
  });

  test("install refuses divergent files unless --update or --force", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["skill", "install", "--json", "--skills-path", "skills"]);
    const dest = join(repo, "skills", "snowshoe", "SKILL.md");
    expect(existsSync(dest)).toBe(true);
    writeFileSync(dest, "# mutated locally\n");

    const blocked = await snowshoe(repo, ["skill", "install", "--json", "--skills-path", "skills"]);
    expect(blocked.exitCode).not.toBe(0);
    expect(String(blocked.json.error)).toMatch(/update/i);

    const updated = await snowshoe(repo, [
      "skill",
      "install",
      "--json",
      "--skills-path",
      "skills",
      "--update",
    ]);
    expect(updated.exitCode).toBe(0);
    expect(updated.json.changed).toBe(true);
    expect(updated.json.update).toBe(true);
    expect(readFileSync(dest, "utf8")).toBe(readFileSync(join(PACKAGED, "SKILL.md"), "utf8"));

    writeFileSync(dest, "# mutated again\n");
    const forced = await snowshoe(repo, [
      "skill",
      "install",
      "--json",
      "--skills-path",
      "skills",
      "--force",
    ]);
    expect(forced.exitCode).toBe(0);
    expect(forced.json.changed).toBe(true);
    expect(forced.json.force).toBe(true);
    expect(readFileSync(dest, "utf8")).toBe(readFileSync(join(PACKAGED, "SKILL.md"), "utf8"));
  });

  test("help indexes skill install", async () => {
    const repo = makeGitRepo();
    const help = await snowshoe(repo, ["help", "--json"]);
    expect(help.exitCode).toBe(0);
    const blob = JSON.stringify(help.json);
    expect(blob).toContain("skill install");
    expect(blob).toContain("--skills-path");
    expect(blob).toContain("snowshoe-scratch");
    expect(blob).toContain("--update");
  });

  test("mkdir parent skills-path when missing", async () => {
    const repo = makeGitRepo();
    mkdirSync(join(repo, "custom"), { recursive: true });
    const r = await snowshoe(repo, [
      "skill",
      "install",
      "--json",
      "--skills-path",
      "custom/agent-skills",
    ]);
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(repo, "custom", "agent-skills", "snowshoe", "drain.md"))).toBe(true);
    expect(existsSync(join(repo, "custom", "agent-skills", "snowshoe-scratch", "SKILL.md"))).toBe(
      true,
    );
  });
});
