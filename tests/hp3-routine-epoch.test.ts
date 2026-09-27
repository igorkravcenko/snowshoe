import { describe, expect, test } from "bun:test";
import { commitFile, completeEnvelope, git, makeGitRepo, snowshoe } from "./helpers.ts";

describe("HP3 post-pull epoch catch-up → then detail", () => {
  test("HEAD move opens structure→blast; empty blast ⇒ zero metrics; advance; detail still works", async () => {
    const repo = makeGitRepo();
    const init = await snowshoe(repo, ["init", "--json"]);
    expect(init.exitCode).toBe(0);
    const base = git(repo, ["rev-parse", "HEAD"]);

    commitFile(repo, "docs/note.md", "hello\n", "docs: note");
    const target = git(repo, ["rev-parse", "HEAD"]);
    expect(target).not.toBe(base);

    const refresh = await snowshoe(repo, ["routine", "refresh", "--json"]);
    expect(refresh.exitCode).toBe(0);
    expect(refresh.json.action).toBe("opened");
    expect(refresh.json.base).toBe(base);
    expect(refresh.json.target).toBe(target);

    const status = await snowshoe(repo, ["routine", "status", "--json"]);
    expect(status.exitCode).toBe(1);
    expect(status.json.behindHead).toBe(true);
    expect(status.json.canAdvance).toBe(false);
    expect(status.json.detailPending).toBe(1);

    const next1 = await snowshoe(repo, ["work", "next", "--json", "--batch-size", "8"]);
    const items1 = next1.json.items as Array<Record<string, unknown>>;
    expect(items1.map((i) => i.kind)).toEqual(["structure_sync"]);
    expect(items1[0]?.kind).not.toBe("detail");

    const structure = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(items1[0]?.stepId),
          leaseToken: String(items1[0]?.leaseToken),
          kind: "structure_sync",
          payload: {
            schemaVersion: 1,
            base,
            target,
            ops: [],
            coverage: {
              touchedPathsConsidered: true,
              unmappedPaths: ["docs/note.md"],
            },
          },
        },
      ]),
    });
    expect(structure.exitCode).toBe(0);

    const next2 = await snowshoe(repo, ["work", "next", "--json"]);
    const items2 = next2.json.items as Array<Record<string, unknown>>;
    expect(items2).toHaveLength(1);
    expect(items2[0]?.kind).toBe("blast_radius");

    const blast = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(items2[0]?.stepId),
          leaseToken: String(items2[0]?.leaseToken),
          kind: "blast_radius",
          payload: {
            schemaVersion: 1,
            base,
            target,
            nodes: [],
          },
        },
      ]),
    });
    expect(blast.exitCode).toBe(0);

    const next3 = await snowshoe(repo, ["work", "next", "--json", "--batch-size", "8"]);
    const items3 = next3.json.items as Array<Record<string, unknown>>;
    expect(items3.map((i) => i.kind)).not.toContain("metric_decay");
    // Required routine is accepted, so detail is claimable before advance.
    const detail = items3[0]!;
    expect(detail?.kind).toBe("detail");

    const advance = await snowshoe(repo, ["routine", "advance", "--json"]);
    expect(advance.exitCode).toBe(0);
    expect(advance.json.ok).toBe(true);

    const after = await snowshoe(repo, ["routine", "status", "--json"]);
    expect(after.exitCode).toBe(0);
    expect(after.json.behindHead).toBe(false);

    expect(detail.parentSlug).toBe("root");
    const done = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(detail.stepId),
          leaseToken: String(detail.leaseToken),
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
    expect(done.exitCode).toBe(0);
    const map = await snowshoe(repo, ["map", "status", "--json"]);
    const slugs = (map.json.nodes as Array<Record<string, unknown>>).map((n) => n.slug);
    expect(slugs).toContain("cli");
  });

  test("non-empty blast opens metric_decay under caps", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const next0 = await snowshoe(repo, ["work", "next", "--json"]);
    const d0 = (next0.json.items as Array<Record<string, unknown>>)[0]!;
    await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(d0.stepId),
          leaseToken: String(d0.leaseToken),
          kind: "detail",
          payload: { parentSlug: "root", unchanged: true, nodes: [], edges: [] },
        },
      ]),
    });

    const base = git(repo, ["rev-parse", "HEAD"]);
    commitFile(repo, "src/pay.ts", "export const x = 1;\n", "feat: pay");
    const target = git(repo, ["rev-parse", "HEAD"]);
    await snowshoe(repo, ["routine", "refresh", "--json"]);

    const sNext = await snowshoe(repo, ["work", "next", "--json"]);
    const sItem = (sNext.json.items as Array<Record<string, unknown>>)[0]!;
    const sDone = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(sItem.stepId),
          leaseToken: String(sItem.leaseToken),
          kind: "structure_sync",
          payload: {
            schemaVersion: 1,
            base,
            target,
            ops: [
              {
                op: "upsert_node",
                node: {
                  id: "pay",
                  title: "Pay",
                  kind: "module",
                  parentIds: ["root"],
                  codeAnchors: [{ path: "src/pay.ts", symbol: null }],
                },
              },
            ],
            coverage: { touchedPathsConsidered: true, unmappedPaths: [] },
          },
        },
      ]),
    });
    expect(sDone.exitCode).toBe(0);

    const bNext = await snowshoe(repo, ["work", "next", "--json"]);
    const bItem = (bNext.json.items as Array<Record<string, unknown>>)[0]!;
    const bDone = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(bItem.stepId),
          leaseToken: String(bItem.leaseToken),
          kind: "blast_radius",
          payload: {
            schemaVersion: 1,
            base,
            target,
            nodes: [
              {
                nodeId: "pay",
                severity: "nit",
                parentIds: ["root"],
                evidence: [{ type: "path", path: "src/pay.ts" }],
              },
            ],
          },
        },
      ]),
    });
    expect(bDone.exitCode).toBe(0);

    const mNext = await snowshoe(repo, ["work", "next", "--json", "--batch-size", "8"]);
    const mItems = mNext.json.items as Array<Record<string, unknown>>;
    expect(mItems.map((i) => i.kind)).toEqual(["metric_decay"]);
    expect(mItems[0]?.level).toBe("internals");

    const tooHigh = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(mItems[0]?.stepId),
          leaseToken: String(mItems[0]?.leaseToken),
          kind: "metric_decay",
          payload: {
            schemaVersion: 1,
            updates: [
              {
                nodeId: "pay",
                level: "internals",
                value: 0.99,
                previousValue: 1,
                reason: "severity:nit",
              },
            ],
          },
        },
      ]),
    });
    expect(tooHigh.exitCode).toBe(1);

    const ok = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(mItems[0]?.stepId),
          leaseToken: String(mItems[0]?.leaseToken),
          kind: "metric_decay",
          payload: {
            schemaVersion: 1,
            updates: [
              {
                nodeId: "pay",
                level: "internals",
                value: 0.5,
                reason: "severity:nit",
              },
            ],
          },
        },
      ]),
    });
    expect(ok.exitCode).toBe(0);

    const advance = await snowshoe(repo, ["routine", "advance", "--json"]);
    expect(advance.exitCode).toBe(0);

    const map = await snowshoe(repo, ["map", "status", "--json"]);
    const pay = (map.json.nodes as Array<Record<string, unknown>>).find((n) => n.slug === "pay")!;
    expect((pay.metrics as Record<string, number>).internals).toBe(0.5);
  });
});
