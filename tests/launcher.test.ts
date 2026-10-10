import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BUN_FETCH_VERSION,
  bundledBunCandidates,
  ensureBun,
  installerIsBun,
  missingBunMessage,
  ovenPackageIds,
  pathBunCandidates,
  resolveBun,
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
  });
});

describe("resolveBun", () => {
  test("PATH bun wins over a bundled copy", () => {
    const usable = new Set(["/home/me/.bun/bin/bun"]);
    const resolved = resolveBun({
      packageRoot: "/opt/snowshoe",
      pathEnv: "/home/me/.bun/bin:/usr/bin",
      pathSep: ":",
      platform: "linux",
      arch: "x64",
      executableNames: ["bun"],
      exists: (p: string) =>
        p === "/home/me/.bun/bin/bun" || p === "/opt/snowshoe/node_modules/bun/bin/bun.exe",
      isUsableBun: (p: string) => usable.has(p) || p.endsWith("bun.exe"),
    });
    expect(resolved).toEqual({ kind: "path", bin: "/home/me/.bun/bin/bun" });
  });

  test("bundled bun.exe is used when PATH is empty", () => {
    const bundled = "/opt/snowshoe/node_modules/bun/bin/bun.exe";
    const resolved = resolveBun({
      packageRoot: "/opt/snowshoe",
      pathEnv: "",
      pathSep: ":",
      platform: "linux",
      arch: "x64",
      exists: (p: string) => p === bundled,
      isUsableBun: (p: string) => p === bundled,
    });
    expect(resolved).toEqual({ kind: "bundled", bin: bundled });
  });

  test("skips a tiny placeholder and uses the oven platform package", () => {
    const placeholder = "/opt/snowshoe/node_modules/bun/bin/bun.exe";
    const oven = "/opt/snowshoe/node_modules/@oven/bun-linux-x64/bin/bun";
    const resolved = resolveBun({
      packageRoot: "/opt/snowshoe",
      pathEnv: "/usr/bin",
      pathSep: ":",
      platform: "linux",
      arch: "x64",
      executableNames: ["bun"],
      exists: (p: string) => p === placeholder || p === oven,
      isUsableBun: (p: string) => p === oven,
    });
    expect(resolved).toEqual({ kind: "bundled", bin: oven });
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

  test("path and oven candidates cover linux x64 and darwin arm64", () => {
    expect(pathBunCandidates({ pathEnv: "/a:/b", pathSep: ":", executableNames: ["bun"] })).toEqual(
      ["/a/bun", "/b/bun"],
    );
    expect(ovenPackageIds("linux", "x64").ids).toContain("bun-linux-x64");
    expect(ovenPackageIds("darwin", "arm64").ids).toContain("bun-darwin-aarch64");
    expect(bundledBunCandidates("/pkg", { platform: "linux", arch: "x64" })).toContain(
      "/pkg/node_modules/@oven/bun-linux-x64/bin/bun",
    );
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

  test("fetches the official bun package when PATH and bundled are missing", async () => {
    const bundled = "/opt/snowshoe/node_modules/bun/bin/bun.exe";
    const present = new Set<string>();
    let fetched = false;
    const bin = await ensureBun({
      packageRoot: "/opt/snowshoe",
      pathEnv: "",
      exists: (p: string) => present.has(p),
      isUsableBun: (p: string) => present.has(p),
      installIfMissing: true,
      env: { npm_config_user_agent: "npm/10.9.7 node/v22.22.2 linux x64" },
      installBun: async () => {
        fetched = true;
        present.add(bundled);
      },
    });
    expect(fetched).toBe(true);
    expect(bin).toBe(bundled);
  });

  test("missing-bun copy has install instructions and no stack dump", () => {
    const text = missingBunMessage();
    expect(text).toContain("https://bun.sh");
    expect(text).toContain("npm install -g bun");
    expect(text.toLowerCase()).not.toContain("error:");
    expect(text).not.toMatch(/at \S+ \(/);
  });
});
