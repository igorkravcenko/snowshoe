import { describe, expect, test } from "bun:test";
import { makeGitRepo, snowshoe } from "./helpers.ts";

describe("snowshoe help", () => {
  test("JSON index includes work next and user-asked mark", async () => {
    const repo = makeGitRepo();
    const r = await snowshoe(repo, ["help", "--json"]);
    expect(r.exitCode).toBe(0);
    expect(r.json.command).toBe("help");
    expect(r.json.audience).toBe("agent");
    const runs = (r.json.commands as Array<{ run: string; when: string }>).map((c) => c.run);
    expect(runs).toContain("snowshoe help --json");
    expect(runs).toContain("snowshoe work next --json");
    expect(runs.some((x) => x.includes("map detail mark"))).toBe(true);
    expect(String(r.json.mark)).toContain("this turn");
  });
});
