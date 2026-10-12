import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { completeEnvelope, detailPayload, makeGitRepo, snowshoe } from "./helpers.ts";

async function seedNamedChild(repo: string, slug: string): Promise<void> {
  const init = await snowshoe(repo, ["init", "--json"]);
  expect(init.exitCode).toBe(0);
  const next = await snowshoe(repo, ["work", "next", "--json"]);
  const item = (next.json.items as Array<Record<string, unknown>>)[0]!;
  const done = await snowshoe(repo, ["work", "complete", "--json"], {
    stdin: completeEnvelope([
      {
        id: String(item.stepId),
        leaseToken: String(item.leaseToken),
        kind: "detail",
        payload: detailPayload({
          parentSlug: "root",
          nodes: [{ slug, title: slug, type: "module", op: "upsert" }],
        }),
      },
    ]),
  });
  expect(done.exitCode).toBe(0);
}

function statusSlugs(r: { json: Record<string, unknown> }): string[] {
  return (r.json.nodes as Array<{ slug: string }>).map((n) => n.slug);
}

describe("global --cwd (git -C)", () => {
  test("map status --cwd <other> reads the other ledger; default cwd unchanged", async () => {
    const a = makeGitRepo("snowshoe-cwd-a-");
    const b = makeGitRepo("snowshoe-cwd-b-");
    await seedNamedChild(a, "alpha");
    await seedNamedChild(b, "beta");

    const fromA = await snowshoe(a, ["map", "status", "--json"]);
    expect(fromA.exitCode).toBe(0);
    expect(statusSlugs(fromA)).toEqual(["alpha", "root"]);

    const viaFlag = await snowshoe(a, ["map", "status", "--json", "--cwd", b]);
    expect(viaFlag.exitCode).toBe(0);
    expect(statusSlugs(viaFlag)).toEqual(["beta", "root"]);

    const viaEquals = await snowshoe(a, ["map", "status", "--json", `--cwd=${b}`]);
    expect(viaEquals.exitCode).toBe(0);
    expect(statusSlugs(viaEquals)).toEqual(["beta", "root"]);

    const viaPrefix = await snowshoe(a, ["--cwd", b, "map", "status", "--json"]);
    expect(viaPrefix.exitCode).toBe(0);
    expect(statusSlugs(viaPrefix)).toEqual(["beta", "root"]);

    const stillA = await snowshoe(a, ["map", "status", "--json"]);
    expect(stillA.exitCode).toBe(0);
    expect(statusSlugs(stillA)).toEqual(["alpha", "root"]);
  });

  test("missing or non-directory --cwd is a usage JSON error", async () => {
    const repo = makeGitRepo("snowshoe-cwd-err-");
    await snowshoe(repo, ["init", "--json"]);

    const missing = await snowshoe(repo, [
      "map",
      "status",
      "--json",
      "--cwd",
      join(repo, "no-such-snowshoe-cwd"),
    ]);
    expect(missing.exitCode).toBe(2);
    expect(missing.json.ok).toBe(false);
    expect(String(missing.json.error)).toMatch(/cwd/i);

    const filePath = join(repo, "README.md");
    const asFile = await snowshoe(repo, ["map", "status", "--json", "--cwd", filePath]);
    expect(asFile.exitCode).toBe(2);
    expect(asFile.json.ok).toBe(false);
    expect(String(asFile.json.error)).toMatch(/cwd/i);

    const empty = await snowshoe(repo, ["map", "status", "--json", "--cwd="]);
    expect(empty.exitCode).toBe(2);
    expect(empty.json.ok).toBe(false);
    expect(String(empty.json.error)).toMatch(/cwd/i);
  });
});
