import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { completeEnvelope, makeGitRepo, snowshoe } from "./helpers.ts";

const SKILL = join(import.meta.dir, "../.cursor/skills/snowshoe/SKILL.md");

describe("snowshoe skill contract (dry-run of instructions)", () => {
  const text = readFileSync(SKILL, "utf8");

  test("is agent-loadable and names the drain commands", () => {
    expect(text).toContain("name: snowshoe");
    for (const cmd of [
      "init --json",
      "routine status --json",
      "routine refresh --json",
      "work next --json",
      "work complete --json",
      "routine advance --json",
      "map status --json",
    ]) {
      expect(text).toContain(cmd);
    }
  });

  test("encodes stop rules and forbidden actions", () => {
    expect(text).toMatch(/Stop rules/i);
    expect(text).toMatch(/Never open or write/);
    expect(text).toContain("ledger.sqlite");
    expect(text).toMatch(/Never install git hooks/);
    expect(text).toMatch(/Never call `work fail` on `kind=detail`/);
    expect(text).toContain('type: "system"');
    expect(text).toMatch(/parentSlug=root|parentSlug": "root/);
    expect(text).toMatch(/Routine-first/);
    expect(text).toMatch(/queue empty/);
  });

  test("does not tell the util to spawn or watch", () => {
    expect(text).toMatch(/does \*\*not\*\* spawn/i);
    expect(text.toLowerCase()).not.toContain("fs.watch");
    expect(text).toMatch(/Out of scope[\s\S]*hooks install/);
    expect(text).not.toMatch(/snowshoe hooks install/);
  });

  test("dry-run: documented init → work next → complete → map status", async () => {
    const repo = makeGitRepo();
    const init = await snowshoe(repo, ["init", "--json"]);
    expect(init.exitCode).toBe(0);
    const status = await snowshoe(repo, ["routine", "status", "--json"]);
    expect(status.json.ok).toBeDefined();
    const next = await snowshoe(repo, ["work", "next", "--json", "--batch-size", "1"]);
    const item = (next.json.items as Array<Record<string, unknown>>)[0]!;
    expect(item.kind).toBe("detail");
    expect(item.parentSlug).toBe("root");
    const complete = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item.stepId),
          leaseToken: String(item.leaseToken),
          kind: "detail",
          payload: {
            parentSlug: "root",
            unchanged: false,
            nodes: [{ slug: "cli", title: "CLI", type: "module", op: "upsert" }],
            edges: [{ from: "root", to: "cli", kind: "parent" }],
          },
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
