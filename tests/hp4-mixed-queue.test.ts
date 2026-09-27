import { describe, expect, test } from "bun:test";
import { commitFile, completeEnvelope, git, makeGitRepo, snowshoe } from "./helpers.ts";

describe("HP4 mixed queue: routine-first; detail never gates advance", () => {
  test("work next drains structure before detail; advance succeeds with pending detail", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const base = git(repo, ["rev-parse", "HEAD"]);
    commitFile(repo, "CHANGELOG.md", "v0\n", "docs: changelog");
    const target = git(repo, ["rev-parse", "HEAD"]);
    await snowshoe(repo, ["routine", "refresh", "--json"]);

    const queued = await snowshoe(repo, ["routine", "status", "--json"]);
    expect(queued.json.detailPending).toBe(1);
    expect(queued.json.canAdvance).toBe(false);

    const batch = await snowshoe(repo, ["work", "next", "--json", "--batch-size", "10"]);
    const kinds = (batch.json.items as Array<Record<string, unknown>>).map((i) => i.kind);
    expect(kinds[0]).toBe("structure_sync");
    expect(kinds).not.toContain("detail");

    const structureItem = (batch.json.items as Array<Record<string, unknown>>)[0]!;
    const sDone = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(structureItem.stepId),
          leaseToken: String(structureItem.leaseToken),
          kind: "structure_sync",
          payload: {
            schemaVersion: 1,
            base,
            target,
            ops: [],
            coverage: {
              touchedPathsConsidered: true,
              unmappedPaths: ["CHANGELOG.md"],
            },
          },
        },
      ]),
    });
    expect(sDone.exitCode).toBe(0);

    const blastNext = await snowshoe(repo, ["work", "next", "--json", "--batch-size", "10"]);
    const blastKinds = (blastNext.json.items as Array<Record<string, unknown>>).map((i) => i.kind);
    expect(blastKinds).toEqual(["blast_radius"]);
    const blastItem = (blastNext.json.items as Array<Record<string, unknown>>)[0]!;
    const bDone = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(blastItem.stepId),
          leaseToken: String(blastItem.leaseToken),
          kind: "blast_radius",
          payload: { schemaVersion: 1, base, target, nodes: [] },
        },
      ]),
    });
    expect(bDone.exitCode).toBe(0);

    const beforeAdvance = await snowshoe(repo, ["routine", "status", "--json"]);
    expect(beforeAdvance.json.canAdvance).toBe(true);
    expect(beforeAdvance.json.detailPending).toBe(1);

    const advance = await snowshoe(repo, ["routine", "advance", "--json"]);
    expect(advance.exitCode).toBe(0);

    const failDetailLease = await snowshoe(repo, ["work", "next", "--json"]);
    const detail = (failDetailLease.json.items as Array<Record<string, unknown>>)[0]!;
    expect(detail.kind).toBe("detail");
    const fail = await snowshoe(repo, ["work", "fail", "--json"], {
      stdin: JSON.stringify({
        schemaVersion: 1,
        failures: [
          {
            id: detail.stepId,
            leaseToken: detail.leaseToken,
            reason: "should-not-apply",
          },
        ],
      }),
    });
    expect(fail.exitCode).toBe(1);
    const failResults = fail.json.results as Array<Record<string, unknown>>;
    expect(failResults[0]?.reasons).toContain("detail_has_no_work_fail");

    const still = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(detail.stepId),
          leaseToken: String(detail.leaseToken),
          kind: "detail",
          payload: {
            parentSlug: "root",
            unchanged: true,
            nodes: [],
            edges: [],
          },
        },
      ]),
    });
    expect(still.exitCode).toBe(0);
  });
});
