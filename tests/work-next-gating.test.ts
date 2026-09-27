import { describe, expect, test } from "bun:test";
import { DEFAULT_WORK_BATCH_SIZE } from "../src/domain/types.ts";
import {
  commitFile,
  completeEnvelope,
  detailPayload,
  git,
  makeGitRepo,
  snowshoe,
} from "./helpers.ts";

describe("work next gating (init / refresh / advance)", () => {
  test("uninitialized repo returns todo init instead of opaque fail", async () => {
    const repo = makeGitRepo();
    const next = await snowshoe(repo, ["work", "next", "--json"]);
    expect(next.exitCode).toBe(0);
    expect(next.json.action).toBe("init");
    expect(next.json.todo).toBe("snowshoe init --json");
    expect(next.json.items).toEqual([]);
    expect(next.json.batchSize).toBe(DEFAULT_WORK_BATCH_SIZE);
  });

  test("HEAD moved without refresh returns only routine refresh", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    commitFile(repo, "docs/note.md", "n\n", "docs: note");
    const next = await snowshoe(repo, ["work", "next", "--json"]);
    expect(next.exitCode).toBe(0);
    expect(next.json.action).toBe("refresh");
    expect(next.json.todo).toBe("snowshoe routine refresh --json");
    expect(next.json.items).toEqual([]);
  });

  test("queue idle and canAdvance returns only routine advance", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const d0 = await snowshoe(repo, ["work", "next", "--json"]);
    const item = (d0.json.items as Array<Record<string, unknown>>)[0]!;
    await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item.stepId),
          leaseToken: String(item.leaseToken),
          kind: "detail",
          payload: detailPayload({ parentSlug: "root", unchanged: true }),
        },
      ]),
    });

    const base = git(repo, ["rev-parse", "HEAD"]);
    commitFile(repo, "CHANGELOG.md", "v0\n", "docs: changelog");
    const target = git(repo, ["rev-parse", "HEAD"]);
    await snowshoe(repo, ["routine", "refresh", "--json"]);

    const sNext = await snowshoe(repo, ["work", "next", "--json"]);
    const sItem = (sNext.json.items as Array<Record<string, unknown>>)[0]!;
    expect(sItem.kind).toBe("structure_sync");
    await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(sItem.stepId),
          leaseToken: String(sItem.leaseToken),
          kind: "structure_sync",
          payload: {
            schemaVersion: 1,
            base,
            target,
            ops: [],
            coverage: { touchedPathsConsidered: true, unmappedPaths: ["CHANGELOG.md"] },
          },
        },
      ]),
    });

    const bNext = await snowshoe(repo, ["work", "next", "--json"]);
    const bItem = (bNext.json.items as Array<Record<string, unknown>>)[0]!;
    await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(bItem.stepId),
          leaseToken: String(bItem.leaseToken),
          kind: "blast_radius",
          payload: { schemaVersion: 1, base, target, nodes: [] },
        },
      ]),
    });

    const gated = await snowshoe(repo, ["work", "next", "--json"]);
    expect(gated.json.action).toBe("advance");
    expect(gated.json.todo).toBe("snowshoe routine advance --json");
    expect(gated.json.items).toEqual([]);
  });

  test("pending detail with canAdvance still claims work (queue not idle)", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const base = git(repo, ["rev-parse", "HEAD"]);
    commitFile(repo, "docs/note.md", "n\n", "docs: note");
    const target = git(repo, ["rev-parse", "HEAD"]);
    await snowshoe(repo, ["routine", "refresh", "--json"]);

    const sNext = await snowshoe(repo, ["work", "next", "--json"]);
    const sItem = (sNext.json.items as Array<Record<string, unknown>>)[0]!;
    await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(sItem.stepId),
          leaseToken: String(sItem.leaseToken),
          kind: "structure_sync",
          payload: {
            schemaVersion: 1,
            base,
            target,
            ops: [],
            coverage: { touchedPathsConsidered: true, unmappedPaths: ["docs/note.md"] },
          },
        },
      ]),
    });
    const bNext = await snowshoe(repo, ["work", "next", "--json"]);
    const bItem = (bNext.json.items as Array<Record<string, unknown>>)[0]!;
    await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(bItem.stepId),
          leaseToken: String(bItem.leaseToken),
          kind: "blast_radius",
          payload: { schemaVersion: 1, base, target, nodes: [] },
        },
      ]),
    });

    const status = await snowshoe(repo, ["routine", "status", "--json"]);
    expect(status.json.canAdvance).toBe(true);
    expect(status.json.detailPending).toBe(1);

    const next = await snowshoe(repo, ["work", "next", "--json"]);
    expect(next.json.action).toBe("work");
    expect(next.json.todo).toBeNull();
    const items = next.json.items as Array<Record<string, unknown>>;
    expect(items[0]?.kind).toBe("detail");
  });
});
