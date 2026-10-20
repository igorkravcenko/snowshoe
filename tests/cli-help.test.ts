import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT_USAGE } from "../src/cli-help.ts";
import { makeGitRepo, snowshoe } from "./helpers.ts";

describe("CLI --help / -h never executes", () => {
  test("root --help / -h / no-args are a human postcard, not the agent index", async () => {
    const repo = makeGitRepo();
    const viaFlag = await snowshoe(repo, ["--help"]);
    expect(viaFlag.exitCode).toBe(0);
    expect(viaFlag.stdout).toBe(ROOT_USAGE);
    expect(viaFlag.json.audience).toBeUndefined();

    const viaShort = await snowshoe(repo, ["-h"]);
    expect(viaShort.exitCode).toBe(0);
    expect(viaShort.stdout).toBe(ROOT_USAGE);

    const viaEmpty = await snowshoe(repo, []);
    expect(viaEmpty.exitCode).toBe(0);
    expect(viaEmpty.stdout).toBe(ROOT_USAGE);
  });

  test("snowshoe help and root --json stay the agent index", async () => {
    const repo = makeGitRepo();
    const viaHelp = await snowshoe(repo, ["help"]);
    expect(viaHelp.exitCode).toBe(0);
    expect(viaHelp.json.command).toBe("help");
    expect(viaHelp.json.audience).toBe("agent");
    expect(Array.isArray(viaHelp.json.commands)).toBe(true);

    const viaJson = await snowshoe(repo, ["help", "--json"]);
    expect(viaJson.json.commands).toEqual(viaHelp.json.commands);

    const rootJson = await snowshoe(repo, ["--json"]);
    expect(rootJson.exitCode).toBe(0);
    expect(rootJson.json.command).toBe("help");
    expect(rootJson.json.audience).toBe("agent");

    const helpFlagJson = await snowshoe(repo, ["--help", "--json"]);
    expect(helpFlagJson.json.command).toBe("help");
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
    expect(text).toContain("existing node");
    expect(text).toContain("stored as false");
    expect(text).toContain("blast_radius");
    expect(text).toContain("metric_decay");
    expect(text).toContain("empty_blast_illegal_intersecting_anchors");
    expect(text).toContain("value_exceeds_cap");
    expect(text).toContain("Wrap the payload in completions[]");
    for (const code of [
      "unknown_step",
      "kind_mismatch",
      "already_closed",
      "bad_lease",
      "lease_expired",
      "epoch_not_open",
      "refresh_required",
      "unknown_kind",
      "lease_reclaimed",
      "only an illustrative value",
      "node_not_in_blast",
      "evidence_sha_missing",
    ]) {
      expect(text).toContain(code);
    }
    expect(text).toContain("updates[].reason is required");
    expect(text).toContain("null = that level is not required");
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
    expect(sync.upsert_node.leaf).toContain("existing node");
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
    expect(sync.exampleNotes.join(" ")).toMatch(/new slug/i);
    expect(r.json.wrap).toContain("completions[]");
    const blast = r.json.blast_radius as {
      example: { nodes: unknown; completions?: unknown };
      requiredLevels: Record<string, string[]>;
      severityCaps: Record<string, Record<string, number | null>>;
      rejectReasons: string[];
    };
    expect(blast.example.completions).toBeUndefined();
    expect(Array.isArray(blast.example.nodes)).toBe(true);
    expect(blast.requiredLevels.nit).toEqual(["internals"]);
    expect(blast.severityCaps.nit.internals).toBe(0.85);
    expect(blast.rejectReasons).toContain("empty_blast_illegal_intersecting_anchors");
    const metric = r.json.metric_decay as {
      example: { updates: unknown; completions?: unknown };
      rejectReasons: string[];
      requiredLevels: Record<string, string[]>;
      severityCaps: Record<string, Record<string, number | null>>;
    };
    expect(metric.example.completions).toBeUndefined();
    expect(Array.isArray(metric.example.updates)).toBe(true);
    expect(metric.rejectReasons.some((s) => s.startsWith("value_exceeds_cap"))).toBe(true);
    expect(metric.rejectReasons).toContain("metric_step_expects_one_update");
    expect(metric.requiredLevels.behavior).toEqual(["internals", "contracts"]);
    expect(metric.severityCaps.boundary.overview).toBe(0.3);
    expect(r.json.commonRejectReasons).toEqual([
      "unknown_step",
      "kind_mismatch",
      "already_closed",
      "bad_lease",
      "lease_reclaimed",
      "epoch_not_open",
      "refresh_required",
      "lease_expired",
      "unknown_kind",
    ]);
    expect(String((r.json.metric_decay as { reason: string }).reason)).toContain("required");
    expect(
      String((r.json.blast_radius as { severityCapsNote: string }).severityCapsNote),
    ).toContain("null");
  });

  test("work complete --json --help is the same JSON contract", async () => {
    const repo = makeGitRepo();
    const r = await snowshoe(repo, ["work", "complete", "--json", "--help"]);
    expect(r.exitCode).toBe(0);
    expect(r.json.command).toBe("work.complete.help");
    expect(r.json.ok).toBe(true);
  });
});
