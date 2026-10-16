import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { makeGitRepo, snowshoe } from "./helpers.ts";

describe("CLI --help / -h never executes", () => {
  test("root --help and -h match help index, exit 0", async () => {
    const repo = makeGitRepo();
    const viaFlag = await snowshoe(repo, ["--help"]);
    expect(viaFlag.exitCode).toBe(0);
    expect(viaFlag.json.command).toBe("help");
    expect(viaFlag.json.audience).toBe("agent");
    expect(Array.isArray(viaFlag.json.commands)).toBe(true);

    const viaShort = await snowshoe(repo, ["-h"]);
    expect(viaShort.exitCode).toBe(0);
    expect(viaShort.json.command).toBe("help");

    const viaHelp = await snowshoe(repo, ["help"]);
    expect(viaHelp.exitCode).toBe(0);
    expect(viaHelp.json.commands).toEqual(viaFlag.json.commands);
  });

  test("init --help does not create .snowshoe", async () => {
    const repo = makeGitRepo();
    const r = await snowshoe(repo, ["init", "--help"]);
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(repo, ".snowshoe"))).toBe(false);
    expect(r.stdout + r.stderr).toMatch(/USAGE|init/i);
    expect(r.json.command).not.toBe("init");
  });

  test("map serve --help does not bind a port", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const r = await snowshoe(repo, ["map", "serve", "--help"]);
    expect(r.exitCode).toBe(0);
    expect(r.json.command).not.toBe("map.serve");
    expect(r.stdout + r.stderr).toMatch(/USAGE|serve/i);
    // JSON body from a real serve includes url/port; help should not.
    expect(r.json.url).toBeUndefined();
    expect(r.json.port).toBeUndefined();
  });

  test("work complete --help documents structure_sync replace-vs-omit", async () => {
    const repo = makeGitRepo();
    const r = await snowshoe(repo, ["work", "complete", "--help"]);
    expect(r.exitCode).toBe(0);
    const text = r.stdout + r.stderr;
    expect(text).toMatch(/USAGE|complete/i);
    expect(text).toContain("codeAnchors present");
    expect(text).toContain("replaces ALL anchors");
    expect(text).toContain("codeAnchors omitted");
    expect(text).toContain("leaf omitted");
    expect(text).toContain("stored as false");
    expect(text).toContain('"op": "upsert_node"');
    expect(text).toContain("src/pay.ts");
    expect(text).toContain('"id": "cli"');
    expect(text).not.toMatch(/"ops":\s*\[\]/);
  });

  test("work complete --help --json is the payload contract", async () => {
    const repo = makeGitRepo();
    const r = await snowshoe(repo, ["work", "complete", "--help", "--json"]);
    expect(r.exitCode).toBe(0);
    expect(r.json.command).toBe("work.complete.help");
    expect(r.json.ok).toBe(true);
    const sync = r.json.structure_sync as {
      upsert_node: Record<string, string>;
      example: { ops: Array<{ op: string; node: Record<string, unknown> }> };
      exampleNotes: string[];
    };
    expect(sync.upsert_node.codeAnchors).toContain("replaces ALL anchors");
    expect(sync.upsert_node.omitCodeAnchors).toContain("omitted");
    expect(sync.upsert_node.leaf).toContain("false");
    expect(sync.example.ops.length).toBeGreaterThanOrEqual(2);
    const replace = sync.example.ops[0]!;
    const omit = sync.example.ops[1]!;
    expect(replace.op).toBe("upsert_node");
    expect(Array.isArray(replace.node.codeAnchors)).toBe(true);
    expect(replace.node.codeAnchors).not.toEqual([]);
    expect(omit.op).toBe("upsert_node");
    expect(omit.node.codeAnchors).toBeUndefined();
    expect(omit.node.leaf).toBeUndefined();
    expect(sync.exampleNotes.join(" ")).toMatch(/replace ALL/i);
    expect(sync.exampleNotes.join(" ")).toMatch(/omitted/i);
  });

  test("work complete --json --help is the same JSON contract", async () => {
    const repo = makeGitRepo();
    const r = await snowshoe(repo, ["work", "complete", "--json", "--help"]);
    expect(r.exitCode).toBe(0);
    expect(r.json.command).toBe("work.complete.help");
    expect(r.json.ok).toBe(true);
  });
});
