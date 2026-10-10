import { describe, expect, test } from "bun:test";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { makeGitRepo } from "./helpers.ts";

const ROOT = join(import.meta.dir, "..");
const LAUNCHER = join(ROOT, "bin/snowshoe.js");

describe("launcher signals", () => {
  test("SIGINT through the Node launcher exits 128+SIGINT (130), not 0", async () => {
    const repo = makeGitRepo();
    const proc = Bun.spawn(["node", LAUNCHER, "map", "serve", "--port", "0"], {
      cwd: repo,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env },
    });
    const decoder = new TextDecoder();
    let buf = "";
    const reader = proc.stdout.getReader();
    const deadline = Date.now() + 35_000;
    while (Date.now() < deadline && !buf.includes('"url"')) {
      const next = await reader.read();
      if (next.value) buf += decoder.decode(next.value, { stream: true });
      if (next.done) break;
    }
    expect(buf).toContain('"url"');
    proc.kill("SIGINT");
    const code = await Promise.race([
      proc.exited,
      new Promise<number>((resolve) => {
        setTimeout(() => {
          proc.kill("SIGKILL");
          resolve(-1);
        }, 10_000);
      }),
    ]);
    expect(code).toBe(130);
  }, 50_000);

  test("SIGINT during first download releases lock and tmp-* (exit 130)", async () => {
    const server = createServer((_req, _res) => {
      /* hang */
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    const registry = `http://127.0.0.1:${addr.port}`;
    const pkg = mkdtempSync(join(tmpdir(), "snowshoe-int-"));
    mkdirSync(join(pkg, "bin"));
    copyFileSync(join(ROOT, "bin/snowshoe.js"), join(pkg, "bin/snowshoe.js"));
    copyFileSync(join(ROOT, "bin/resolve-bun.js"), join(pkg, "bin/resolve-bun.js"));
    const nodeBin = Bun.which("node");
    if (!nodeBin) throw new Error("node is required for this test");
    const proc = Bun.spawn([nodeBin, join(pkg, "bin/snowshoe.js"), "--version"], {
      cwd: pkg,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        HOME: pkg,
        PATH: `${dirname(nodeBin)}:/usr/bin:/bin`,
        npm_config_registry: registry,
      },
    });
    await Bun.sleep(400);
    proc.kill("SIGINT");
    const code = await Promise.race([
      proc.exited,
      new Promise<number>((resolve) => {
        setTimeout(() => {
          proc.kill("SIGKILL");
          resolve(-1);
        }, 8_000);
      }),
    ]);
    server.close();
    const runtime = join(pkg, ".runtime");
    expect(existsSync(join(runtime, "lock"))).toBe(false);
    const leftovers = existsSync(runtime)
      ? readdirSync(runtime).filter((n) => n.startsWith("tmp-"))
      : [];
    expect(leftovers).toEqual([]);
    expect(code).toBe(130);
  }, 20_000);
});
