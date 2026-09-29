import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { completeEnvelope, detailPayload, makeGitRepo, snowshoe } from "./helpers.ts";

const SKILL_DIR = join(import.meta.dir, "../.cursor/skills/snowshoe");
const SKILL = join(SKILL_DIR, "SKILL.md");
const DRAIN = join(SKILL_DIR, "drain.md");
const LEARN = join(SKILL_DIR, "learn.md");
const INSTALL = join(SKILL_DIR, "install.md");

describe("snowshoe skill contract (dry-run of instructions)", () => {
  const gate = readFileSync(SKILL, "utf8");
  const drain = readFileSync(DRAIN, "utf8");
  const learn = readFileSync(LEARN, "utf8");

  test("SKILL.md is a router (not the drain body)", () => {
    expect(gate).toContain("name: snowshoe");
    expect(gate).toMatch(/SNOWSHOE_MODE=learn/);
    expect(existsSync(INSTALL)).toBe(true);
    expect(existsSync(DRAIN)).toBe(true);
    expect(existsSync(LEARN)).toBe(true);
    expect(gate).toMatch(/install\.md/);
    expect(gate).toMatch(/drain\.md/);
    expect(gate).toMatch(/learn\.md/);
    expect(gate).not.toContain("bun src/index.ts");
    expect(gate).not.toContain("waitTimedOut");
    expect(gate).not.toContain("missing_body");
    expect(gate).not.toContain("work next --json --wait");
  });

  test("drain.md is repo-agnostic PATH snowshoe (no snowshoe-repo internals)", () => {
    expect(drain.toLowerCase()).not.toContain("no learning");
    expect(drain).not.toMatch(/docs\/brain\/schemas\//);
    expect(drain).not.toContain("--batch-size 1");
    expect(drain).not.toContain("anchorsUnresolved");
    expect(drain).not.toContain("HP1");
    expect(drain).not.toContain("Out of scope");
    expect(drain).not.toContain("work fail");
    expect(drain.toLowerCase()).not.toContain("workfail");
    expect(drain).not.toContain("bun src/index.ts");
    for (const cmd of [
      "work next --json",
      "work next --json --wait",
      "init --json",
      "init --json --locale ru",
      "routine refresh --json",
      "routine status --json",
      "work complete --json",
      "routine advance --json",
      "map status --json",
    ]) {
      expect(drain).toContain(cmd);
    }
    expect(drain).toContain("--wait");
    expect(drain).toContain("waitTimedOut");
    expect(drain).toContain("children");
    expect(drain).toContain("refs");
    expect(drain).toContain("--locale");
    expect(drain).toContain("body");
    expect(drain).toContain("missing_body");
    expect(drain).toContain("startLine");
    expect(drain).toContain("endLine");
  });

  test("learn.md is a map-conversation stub (no quiz, no complete)", () => {
    expect(learn).toContain("map view --json");
    expect(learn).toContain("SNOWSHOE_MAP_URL");
    expect(learn).toContain("SNOWSHOE_VIEW");
    expect(learn).not.toContain("work complete");
    expect(learn).not.toContain("work next --json");
  });

  test("dry-run: documented work next → complete → map status", async () => {
    const repo = makeGitRepo();
    const init = await snowshoe(repo, ["init", "--json"]);
    expect(init.exitCode).toBe(0);
    const next = await snowshoe(repo, ["work", "next", "--json"]);
    expect(next.json.action).toBe("work");
    const item = (next.json.items as Array<Record<string, unknown>>)[0]!;
    expect(item.kind).toBe("detail");
    expect(item.parentSlug).toBe("root");
    const complete = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item.stepId),
          leaseToken: String(item.leaseToken),
          kind: "detail",
          payload: detailPayload({
            parentSlug: "root",
            nodes: [{ slug: "cli", title: "CLI", type: "module", op: "upsert" }],
          }),
        },
      ]),
    });
    expect(complete.exitCode).toBe(0);
    const map = await snowshoe(repo, ["map", "status", "--json"]);
    expect(map.json.rootSlug).toBe("root");
    const slugs = (map.json.nodes as Array<Record<string, unknown>>).map((n) => n.slug);
    expect(slugs).toContain("cli");
  });
});
