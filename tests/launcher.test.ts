import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  acquireLock,
  BUN_FETCH_SIZE_HINT,
  BUN_FETCH_VERSION,
  bundledBunCandidates,
  ensureBun,
  formatFetchReason,
  installerIsBun,
  isUsableBunBinary,
  lockWaitMs,
  missingBunMessage,
  nodeEngineOk,
  ovenPackageIds,
  pathBunCandidates,
  permissionDeniedMessage,
  releaseLock,
  resolveBun,
  runtimeCurrent,
  verifyIntegrity,
} from "../bin/resolve-bun.js";

const ROOT = join(import.meta.dir, "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  bin: Record<string, string>;
  files: string[];
  engines: Record<string, string>;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  scripts: Record<string, string>;
};

describe("npm-global launcher package shape", () => {
  test("bin is the Node launcher; bun is not a package dependency", () => {
    expect(pkg.bin.snowshoe).toBe("./bin/snowshoe.js");
    expect(pkg.bin.snoe).toBe("./bin/snowshoe.js");
    expect(pkg.files).toContain("bin");
    expect(pkg.engines.node).toBe(">=18");
    expect(pkg.engines.bun).toBe(">=1.1.0");
    expect(pkg.dependencies?.bun).toBeUndefined();
    expect(pkg.optionalDependencies?.bun).toBeUndefined();
    expect(pkg.scripts.postinstall).toBe("node ./bin/ensure-bun.js");
    expect(BUN_FETCH_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    const launcher = readFileSync(join(ROOT, "bin/snowshoe.js"), "utf8");
    expect(launcher.startsWith("#!/usr/bin/env node\n")).toBe(true);
    expect(nodeEngineOk("18.0.0")).toBe(true);
    expect(nodeEngineOk("16.20.2")).toBe(false);
  });
});

describe("resolveBun", () => {
  test("PATH bun wins over a bundled copy", () => {
    const usable = new Set(["/home/me/.bun/bin/bun"]);
    const bundled = join("/opt/snowshoe", ".runtime", "current", "bin", "bun.exe");
    const resolved = resolveBun({
      packageRoot: "/opt/snowshoe",
      pathEnv: "/home/me/.bun/bin:/usr/bin",
      pathSep: ":",
      platform: "linux",
      arch: "x64",
      executableNames: ["bun"],
      exists: (p: string) => p === "/home/me/.bun/bin/bun" || p === bundled,
      isUsableBun: (p: string) => usable.has(p) || p.endsWith("bun.exe"),
    });
    expect(resolved).toEqual({ kind: "path", bin: "/home/me/.bun/bin/bun" });
  });

  test("bundled bun is only resolved from .runtime/current", () => {
    const bundled = join("/opt/snowshoe", ".runtime", "current", "bin", "bun");
    const resolved = resolveBun({
      packageRoot: "/opt/snowshoe",
      pathEnv: "",
      pathSep: ":",
      platform: "linux",
      arch: "x64",
      exists: (p: string) => p === bundled || p === "/opt/snowshoe/node_modules/bun/bin/bun.exe",
      isUsableBun: (p: string) => p === bundled,
    });
    expect(resolved).toEqual({ kind: "bundled", bin: bundled });
    const candidates = bundledBunCandidates("/pkg", {
      platform: "linux",
      arch: "x64",
      libc: "glibc",
    });
    expect(candidates.every((p) => p.startsWith(join("/pkg", ".runtime")))).toBe(true);
    expect(candidates).not.toContain("/pkg/node_modules/bun/bin/bun.exe");
  });

  test("returns null when nothing is usable", () => {
    const resolved = resolveBun({
      packageRoot: "/opt/snowshoe",
      pathEnv: "/usr/bin",
      pathSep: ":",
      platform: "linux",
      arch: "x64",
      exists: () => false,
      isUsableBun: () => false,
    });
    expect(resolved).toBeNull();
  });

  test("oven ids are one matching platform (no musl+glibc, no baseline)", () => {
    expect(
      pathBunCandidates({
        pathEnv: "bin:/a",
        pathSep: ":",
        cwd: "/cwd",
        executableNames: ["bun"],
      }),
    ).toEqual(["/cwd/bin/bun", "/a/bun"]);
    const linuxGlibc = ovenPackageIds("linux", "x64", "glibc");
    expect(linuxGlibc.ids).toEqual(["bun-linux-x64"]);
    expect(linuxGlibc.ids.join()).not.toContain("musl");
    expect(linuxGlibc.ids.join()).not.toContain("baseline");
    expect(ovenPackageIds("linux", "x64", "musl").ids).toEqual(["bun-linux-x64-musl"]);
    expect(ovenPackageIds("darwin", "arm64").ids).toEqual(["bun-darwin-aarch64"]);
    expect(ovenPackageIds("android", "x64").ids).toEqual(["bun-linux-x64-android"]);
    expect(ovenPackageIds("android", "arm64").ids).toEqual(["bun-linux-aarch64-android"]);
  });
});

describe("isUsableBunBinary", () => {
  test("always execs --version, even for files larger than 1MiB", () => {
    const dir = mkdtempSync(join(tmpdir(), "snowshoe-usable-"));
    const big = join(dir, "bun");
    writeFileSync(big, Buffer.alloc(2 * 1024 * 1024));
    const calls: string[][] = [];
    const ok = isUsableBunBinary(big, (_file, args) => {
      calls.push(args);
      return { status: 0, stdout: "1.4.2\n" };
    });
    expect(calls).toEqual([["--version"]]);
    expect(ok).toBe(true);
  });
});

describe("ensureBun", () => {
  test("does not fetch when installer is bun", async () => {
    let fetched = false;
    const bin = await ensureBun({
      packageRoot: "/opt/snowshoe",
      pathEnv: "",
      exists: () => false,
      isUsableBun: () => false,
      installIfMissing: true,
      env: { npm_config_user_agent: "bun/1.4.2 npm/? node/v22 linux x64" },
      installBun: async () => {
        fetched = true;
      },
    });
    expect(installerIsBun({ npm_config_user_agent: "bun/1.4.2 npm/? node/v22 linux x64" })).toBe(
      true,
    );
    expect(installerIsBun({ npm_config_user_agent: "npm/10.9.7 node/v22.22.2 linux x64" })).toBe(
      false,
    );
    expect(fetched).toBe(false);
    expect(bin).toBeNull();
  });

  test("fetches into .runtime/current when PATH and bundled are missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "snowshoe-fetch-"));
    const bundled = join(runtimeCurrent(dir), "bin", "bun");
    const present = new Set<string>();
    let fetched = false;
    const bin = await ensureBun({
      packageRoot: dir,
      pathEnv: "",
      exists: (p: string) => present.has(p),
      isUsableBun: (p: string) => present.has(p),
      installIfMissing: true,
      env: { npm_config_user_agent: "npm/10.9.7 node/v22.22.2 linux x64" },
      installBun: async () => {
        fetched = true;
        mkdirSync(dirname(bundled), { recursive: true });
        writeFileSync(bundled, "fake");
        present.add(bundled);
      },
    });
    expect(fetched).toBe(true);
    expect(bin).toBe(bundled);
    expect(existsSync(join(dir, "node_modules", "@biomejs"))).toBe(false);
    expect(existsSync(join(dir, "node_modules", "@vitejs"))).toBe(false);
  });

  test("concurrent first-run fetch takes the lock; waiters reuse the result", async () => {
    const dir = mkdtempSync(join(tmpdir(), "snowshoe-lock-"));
    const bundled = join(runtimeCurrent(dir), "bin", "bun");
    let installs = 0;
    const run = () =>
      ensureBun({
        packageRoot: dir,
        pathEnv: "",
        exists: (p: string) => existsSync(p),
        isUsableBun: (p: string) => p === bundled && existsSync(p),
        installIfMissing: true,
        env: { npm_config_user_agent: "npm/9.2.0 node/v18 linux x64" },
        installBun: async () => {
          installs += 1;
          await new Promise((r) => setTimeout(r, 200));
          mkdirSync(dirname(bundled), { recursive: true });
          writeFileSync(bundled, "fake");
        },
      });
    const results = await Promise.all([run(), run(), run(), run()]);
    expect(installs).toBe(1);
    expect(results.every((b) => b === bundled)).toBe(true);
  });

  test("stale lock is stolen; fresh lock waits then times out", async () => {
    expect(lockWaitMs(120_000, 180_000)).toBe(185_000);
    const staleDir = mkdtempSync(join(tmpdir(), "snowshoe-stale-"));
    const staleLock = join(staleDir, "lock");
    mkdirSync(staleLock);
    const old = Date.now() / 1000 - 10;
    utimesSync(staleLock, old, old);
    expect(await acquireLock(staleLock, { timeoutMs: 1000, staleMs: 100, pollMs: 20 })).toBe(true);
    releaseLock(staleLock);

    const freshDir = mkdtempSync(join(tmpdir(), "snowshoe-freshlock-"));
    const freshLock = join(freshDir, "lock");
    mkdirSync(freshLock);
    const started = Date.now();
    await expect(
      acquireLock(freshLock, { timeoutMs: 250, staleMs: 60_000, pollMs: 40 }),
    ).rejects.toThrow(/timed out/);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  test("missing-bun copy has install instructions, size hint, and no stack dump", () => {
    const text = missingBunMessage();
    expect(text).toContain("https://bun.sh");
    expect(text).toContain(BUN_FETCH_SIZE_HINT);
    expect(text.toLowerCase()).not.toContain("error:");
    expect(text).not.toMatch(/at \S+ \(/);
    const perm = permissionDeniedMessage("/usr/lib/node_modules/@igorkravcenko/snowshoe/.runtime");
    expect(perm).toContain("sudo npm install -g");
    expect(perm).toContain("permission denied");
  });
});

describe("install docs", () => {
  test("README and skill install.md mention Node 18+ and one-time Bun download size", () => {
    const readme = readFileSync(join(ROOT, "README.md"), "utf8");
    const install = readFileSync(join(ROOT, "skills/snowshoe/install.md"), "utf8");
    for (const text of [readme, install]) {
      expect(text).toContain("Node.js 18+");
      expect(text).toMatch(/downloads a matching Bun binary once/);
      expect(text).toContain("~40 MB compressed");
      expect(text).toContain("~80 MB unpacked");
    }
  });
});

describe("integrity and fetch errors", () => {
  test("verifyIntegrity accepts a matching sha512 and rejects a mismatch", () => {
    const buf = Buffer.from("snowshoe-runtime");
    const integrity = `sha512-${createHash("sha512").update(buf).digest("base64")}`;
    expect(() => verifyIntegrity(buf, integrity)).not.toThrow();
    expect(() =>
      verifyIntegrity(
        buf,
        "sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
      ),
    ).toThrow(/integrity/);
  });

  test("formatFetchReason is a short line without a stack", () => {
    const aborted = formatFetchReason(
      Object.assign(new Error("This operation was aborted"), { name: "AbortError" }),
    );
    expect(aborted).toContain("timed out");
    expect(aborted).not.toMatch(/at \S+ \(/);
    const refused = formatFetchReason(
      Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    );
    expect(refused).toBe("connection refused");
    const wrapped = formatFetchReason(
      Object.assign(new Error("fetch failed"), {
        cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
      }),
    );
    expect(wrapped).toBe("connection refused");
    const stacked = formatFetchReason(new Error("boom\n    at foo (bar.js:1:1)\n    at baz"));
    expect(stacked).toBe("boom");
    expect(stacked).not.toContain("at foo");
  });
});
