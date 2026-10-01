import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileReadError, readRepoFile, resolveRepoFile } from "../src/map/file-read.ts";
import { handleMapHttp } from "../src/map/http.ts";
import { startMapServer } from "../src/map/serve.ts";
import { makeGitRepo, snowshoe } from "./helpers.ts";

let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  stop = undefined;
});

function expectEscape(requested: string, repo: string): void {
  try {
    resolveRepoFile(repo, requested);
    throw new Error(`expected escape reject for ${requested}`);
  } catch (err) {
    expect(err).toBeInstanceOf(FileReadError);
    expect((err as FileReadError).status).toBe(403);
  }
}

async function fileApi(repo: string, query: string): Promise<Response> {
  return handleMapHttp(new Request(`http://127.0.0.1/api/file?${query}`), {
    cwd: repo,
    uiDist: join(repo, "no-ui"),
  });
}

describe("repo file sandbox (GET /api/file)", () => {
  test("rejects .., absolute, and outside-repo paths", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);

    const escapes = [
      "../secret",
      "..",
      "/etc/passwd",
      "foo/../../etc/passwd",
      "..\\..\\secret",
      "C:\\Windows\\win.ini",
      "/tmp/outside.txt",
    ];
    for (const p of escapes) {
      expectEscape(p, repo);
      const res = await fileApi(repo, `path=${encodeURIComponent(p)}`);
      expect([400, 403]).toContain(res.status);
      const body = (await res.json()) as { ok: boolean };
      expect(body.ok).toBe(false);
    }
  });

  test("rejects symlink that points outside repoRoot", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    const outside = join(tmpdir(), `snowshoe-secret-${Date.now()}.txt`);
    writeFileSync(outside, "SECRET\n");
    symlinkSync(outside, join(repo, "leak"));
    try {
      readRepoFile(repo, "leak");
      throw new Error("expected symlink escape reject");
    } catch (err) {
      expect(err).toBeInstanceOf(FileReadError);
      expect((err as FileReadError).status).toBe(403);
    }
    const res = await fileApi(repo, "path=leak");
    expect(res.status).toBe(403);
  });

  test("happy-path reads text and optional line range; no ledger write", async () => {
    const repo = makeGitRepo();
    await snowshoe(repo, ["init", "--json"]);
    mkdirSync(join(repo, "src"), { recursive: true });
    writeFileSync(join(repo, "src", "hello.ts"), "const a = 1;\nconst b = 2;\n");

    const direct = readRepoFile(repo, "src/hello.ts", { start: 2, end: 2 });
    expect(direct.ok).toBe(true);
    expect(direct.path).toBe("src/hello.ts");
    expect(direct.text).toContain("const b = 2");
    expect(direct.startLine).toBe(2);
    expect(direct.endLine).toBe(2);
    expect(direct.lineCount).toBe(2);

    const ledger = join(repo, ".snowshoe", "ledger.sqlite");
    const before = statSync(ledger).mtimeMs;

    const res = await fileApi(repo, "path=src/hello.ts&start=2&end=2");
    expect(res.ok).toBe(true);
    const body = (await res.json()) as {
      ok: boolean;
      path: string;
      text: string;
      startLine: number;
      endLine: number;
    };
    expect(body.ok).toBe(true);
    expect(body.path).toBe("src/hello.ts");
    expect(body.text).toContain("const a = 1");
    expect(body.startLine).toBe(2);
    expect(body.endLine).toBe(2);
    expect(statSync(ledger).mtimeMs).toBe(before);

    writeFileSync(join(repo, "src", "hello.ts"), "hdr\nconst a = 1;\nconst b = 2;\n");
    const rebased = readRepoFile(repo, "src/hello.ts", {
      start: 2,
      lineText: "const b = 2;",
      span: 1,
    });
    expect(rebased.startLine).toBe(3);
    expect(rebased.endLine).toBe(3);

    const missingPath = await fileApi(repo, "");
    expect(missingPath.status).toBe(400);

    const badStart = await fileApi(repo, "path=README.md&start=nope");
    expect(badStart.status).toBe(400);

    const server = await startMapServer({
      cwd: repo,
      port: 0,
      hostname: "127.0.0.1",
      open: false,
      buildUi: false,
    });
    stop = server.stop;
    const live = await fetch(`${server.url}api/file?path=README.md&start=1&end=1`);
    expect(live.ok).toBe(true);
    const liveJson = (await live.json()) as { text: string; startLine: number };
    expect(liveJson.text).toContain("fixture");
    expect(liveJson.startLine).toBe(1);
  });
});
