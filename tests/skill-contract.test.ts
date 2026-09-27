import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { completeEnvelope, detailPayload, makeGitRepo, snowshoe } from "./helpers.ts";

const SKILL = join(import.meta.dir, "../.cursor/skills/snowshoe/SKILL.md");
const INSTALL = join(import.meta.dir, "../.cursor/skills/snowshoe/install.md");

describe("snowshoe skill contract (dry-run of instructions)", () => {
  const text = readFileSync(SKILL, "utf8");

  test("is agent-loadable and names the drain commands", () => {
    expect(text).toContain("name: snowshoe");
    expect(existsSync(INSTALL)).toBe(true);
    expect(text).toMatch(/install\.md/);
    for (const cmd of [
      "work next --json",
      "init --json",
      "routine refresh --json",
      "routine status --json",
      "work complete --json",
      "routine advance --json",
      "map status --json",
    ]) {
      expect(text).toContain(cmd);
    }
  });

  test("is repo-agnostic PATH snowshoe (no snowshoe-repo internals)", () => {
    expect(text).not.toContain("bun src/index.ts");
    expect(text.toLowerCase()).not.toContain("no learning");
    expect(text).not.toMatch(/docs\/brain\/schemas\//);
    expect(text).not.toContain("--batch-size 1");
    expect(text).not.toContain("anchorsUnresolved");
    expect(text).not.toContain("HP1");
    expect(text).not.toContain("Out of scope");
    expect(text).not.toContain("work fail");
    expect(text.toLowerCase()).not.toContain("workfail");
    expect(text).toContain("snowshoe work next --json");
    expect(text).toContain("children");
    expect(text).toContain("refs");
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
