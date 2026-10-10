import { describe, expect, test } from "bun:test";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { makeGitRepo } from "./helpers.ts";

const ROOT = join(import.meta.dir, "..");
const LAUNCHER = join(ROOT, "bin/snowshoe.js");

function isShebang(path: string): boolean {
  try {
    const buf = readFileSync(path);
    return buf.length >= 2 && buf[0] === 0x23 && buf[1] === 0x21;
  } catch {
    return true;
  }
}

/** ELF / Mach-O / PE bun, not a PATH wrapper script. */
function resolveRealBun(): string | null {
  const candidates = [
    Bun.which("bun"),
    process.env.BUN_INSTALL ? join(process.env.BUN_INSTALL, "bin", "bun") : "",
    join(homedir(), ".bun", "bin", "bun"),
  ].filter((p): p is string => Boolean(p));
  const seen = new Set<string>();
  for (const path of candidates) {
    if (seen.has(path)) continue;
    seen.add(path);
    if (!existsSync(path) || isShebang(path)) continue;
    return path;
  }
  return null;
}

const realBun = resolveRealBun();

describe("launcher signals", () => {
  test.skipIf(!realBun)(
    "SIGINT through the Node launcher exits 128+SIGINT (130), not 0",
    async () => {
      const repo = makeGitRepo();
      const bunDir = dirname(realBun as string);
      const proc = Bun.spawn(["node", LAUNCHER, "map", "serve", "--port", "0"], {
        cwd: repo,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, PATH: `${bunDir}:${process.env.PATH ?? ""}` },
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
    },
    50_000,
  );

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

  test("SIGTERM during first download exits 143 promptly", async () => {
    const server = createServer((_req, _res) => {
      /* hang */
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    const registry = `http://127.0.0.1:${addr.port}`;
    const pkg = mkdtempSync(join(tmpdir(), "snowshoe-term-"));
    mkdirSync(join(pkg, "bin"));
    copyFileSync(join(ROOT, "bin/snowshoe.js"), join(pkg, "bin/snowshoe.js"));
    copyFileSync(join(ROOT, "bin/resolve-bun.js"), join(pkg, "bin/resolve-bun.js"));
    const nodeBin = Bun.which("node");
    if (!nodeBin) throw new Error("node is required for this test");
    const started = Date.now();
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
    proc.kill("SIGTERM");
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
    expect(Date.now() - started).toBeLessThan(5000);
    expect(existsSync(join(pkg, ".runtime", "lock"))).toBe(false);
    expect(code).toBe(143);
  }, 20_000);
});
