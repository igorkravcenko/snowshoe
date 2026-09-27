import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { handleMapHttp } from "../src/map/http.ts";
import { completeEnvelope, makeGitRepo, snowshoe } from "./helpers.ts";

describe("locale at init (idempotent amend)", () => {
  test("persists --locale on init and exposes it on map status, session, work next", async () => {
    const repo = makeGitRepo();
    const init = await snowshoe(repo, ["init", "--json", "--locale", "ru"]);
    expect(init.exitCode).toBe(0);
    expect(init.json.locale).toBe("ru");

    const map = await snowshoe(repo, ["map", "status", "--json"]);
    expect(map.json.locale).toBe("ru");

    const next = await snowshoe(repo, ["work", "next", "--json"]);
    expect(next.json.locale).toBe("ru");

    const sess = await handleMapHttp(new Request("http://127.0.0.1/api/session"), {
      cwd: repo,
      uiDist: join(repo, "no-ui"),
    });
    expect(sess.ok).toBe(true);
    const sessJson = (await sess.json()) as { locale: string | null; repoRoot: string };
    expect(sessJson.locale).toBe("ru");
    expect(sessJson.repoRoot).toBe(repo);

    const alias = await snowshoe(repo, ["init", "--json", "--ui-language", "en"]);
    expect(alias.exitCode).toBe(0);
    expect(alias.json.locale).toBe("en");
    expect(alias.json.seededDetail).toBe(false);

    const keep = await snowshoe(repo, ["init", "--json"]);
    expect(keep.json.locale).toBe("en");
  });

  test("old ledger without locale stays null until amend", async () => {
    const repo = makeGitRepo();
    const init = await snowshoe(repo, ["init", "--json"]);
    expect(init.json.locale).toBeNull();
    const map = await snowshoe(repo, ["map", "status", "--json"]);
    expect(map.json.locale).toBeNull();
    const amend = await snowshoe(repo, ["init", "--json", "--locale", "en-US"]);
    expect(amend.exitCode).toBe(0);
    expect(amend.json.locale).toBe("en-US");
  });

  test("rejects invalid locale tags", async () => {
    const repo = makeGitRepo();
    const bad = await snowshoe(repo, ["init", "--json", "--locale", "not a tag"]);
    expect(bad.exitCode).toBe(2);
  });
});

describe("entity body on detail complete", () => {
  test("rejects empty body when unchanged=false; accepts body and resolves bodyMd", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json", "--locale", "ru"]);
    const next = await snowshoe(repo, ["work", "next", "--json"]);
    const item = (next.json.items as Array<Record<string, unknown>>)[0]!;

    const empty = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item.stepId),
          leaseToken: String(item.leaseToken),
          kind: "detail",
          payload: {
            parentSlug: "root",
            unchanged: false,
            nodes: [{ slug: "cli", title: "CLI", type: "module", op: "upsert", body: "   " }],
            children: ["cli"],
            refs: [],
          },
        },
      ]),
    });
    expect(empty.exitCode).toBe(1);
    const emptyResults = empty.json.results as Array<Record<string, unknown>>;
    expect(emptyResults[0]?.status).toBe("rejected");
    expect(emptyResults[0]?.reasons).toEqual(expect.arrayContaining(["missing_body:cli"]));

    const missing = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item.stepId),
          leaseToken: String(item.leaseToken),
          kind: "detail",
          payload: {
            parentSlug: "root",
            unchanged: false,
            nodes: [{ slug: "cli", title: "CLI", type: "module", op: "upsert" }],
            children: ["cli"],
            refs: [],
          },
        },
      ]),
    });
    expect(missing.exitCode).toBe(1);
    const missingResults = missing.json.results as Array<Record<string, unknown>>;
    expect(missingResults[0]?.reasons).toEqual(expect.arrayContaining(["missing_body:cli"]));

    const ok = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item.stepId),
          leaseToken: String(item.leaseToken),
          kind: "detail",
          payload: {
            parentSlug: "root",
            unchanged: false,
            nodes: [
              {
                slug: "cli",
                title: "CLI",
                type: "module",
                op: "upsert",
                body: "## CLI\n\nТочка входа `snowshoe`.",
              },
            ],
            children: ["cli"],
            refs: [],
          },
        },
      ]),
    });
    expect(ok.exitCode).toBe(0);
    const prosePath = join(repo, ".snowshoe", "map", "nodes", "cli.md");
    expect(existsSync(prosePath)).toBe(true);
    expect(readFileSync(prosePath, "utf8")).toContain("Точка входа");

    const map = await snowshoe(repo, ["map", "status", "--json"]);
    const cli = (map.json.nodes as Array<Record<string, unknown>>).find((n) => n.slug === "cli")!;
    expect(cli.proseRef).toBe(".snowshoe/map/nodes/cli.md");
    expect(cli.bodyMd).toContain("Точка входа");
  });

  test("accepts proseRef when the markdown file already has body", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json", "--locale", "en"]);
    const next = await snowshoe(repo, ["work", "next", "--json"]);
    const item = (next.json.items as Array<Record<string, unknown>>)[0]!;
    const ref = ".snowshoe/map/nodes/auth.md";
    mkdirSync(join(repo, ".snowshoe", "map", "nodes"), { recursive: true });
    writeFileSync(join(repo, ref), "Auth module body.\n");

    const ok = await snowshoe(repo, ["work", "complete", "--json"], {
      stdin: completeEnvelope([
        {
          id: String(item.stepId),
          leaseToken: String(item.leaseToken),
          kind: "detail",
          payload: {
            parentSlug: "root",
            unchanged: false,
            nodes: [
              {
                slug: "auth",
                title: "Auth",
                type: "module",
                op: "upsert",
                proseRef: ref,
              },
            ],
            children: ["auth"],
            refs: [],
          },
        },
      ]),
    });
    expect(ok.exitCode).toBe(0);
    const map = await snowshoe(repo, ["map", "status", "--json"]);
    const auth = (map.json.nodes as Array<Record<string, unknown>>).find((n) => n.slug === "auth")!;
    expect(auth.bodyMd).toContain("Auth module body");
  });
});
