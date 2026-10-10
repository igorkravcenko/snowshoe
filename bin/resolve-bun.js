import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

/** Pinned fetch of the official `bun` npm package when PATH bun is missing. Match CI bun-version. */
export const BUN_FETCH_VERSION = "1.4.2";

const MIN_REAL_BUN_BYTES = 1024 * 1024;

/**
 * @typedef {object} ResolveOpts
 * @property {string} packageRoot
 * @property {string} [pathEnv]
 * @property {string} [pathSep]
 * @property {NodeJS.Platform} [platform]
 * @property {string} [arch]
 * @property {string[]} [executableNames]
 * @property {(p: string) => boolean} [exists]
 * @property {(p: string) => boolean} [isUsableBun]
 * @property {NodeJS.ProcessEnv} [env]
 * @property {boolean} [installIfMissing]
 * @property {(opts: { packageRoot: string, env: NodeJS.ProcessEnv, version: string }) => void | Promise<void>} [installBun]
 */

export function installerIsBun(env = process.env) {
  const ua = String(env.npm_config_user_agent || "").toLowerCase();
  return ua.includes("bun/");
}

export function missingBunMessage() {
  return [
    "Snowshoe needs the Bun runtime, and none was found.",
    "",
    "Tried:",
    "- bun on PATH",
    "- a Bun binary next to this install (npm postinstall / first-run fetch of the official bun package)",
    "",
    "Install Bun: https://bun.sh",
    "  curl -fsSL https://bun.com/install | bash",
    "",
    "Or: npm install -g bun",
  ].join("\n");
}

export function defaultExecutableNames(platform = process.platform) {
  return platform === "win32" ? ["bun.exe", "bun.cmd", "bun"] : ["bun"];
}

export function ovenPackageIds(platform = process.platform, arch = process.arch) {
  const exe = platform === "win32" ? "bun.exe" : "bun";
  /** @type {string[]} */
  const ids = [];
  if (platform === "linux" && arch === "x64") {
    ids.push("bun-linux-x64", "bun-linux-x64-musl", "bun-linux-x64-baseline");
  } else if (platform === "linux" && (arch === "arm64" || arch === "aarch64")) {
    ids.push("bun-linux-aarch64", "bun-linux-aarch64-musl");
  } else if (platform === "darwin" && (arch === "arm64" || arch === "aarch64")) {
    ids.push("bun-darwin-aarch64");
  } else if (platform === "darwin" && arch === "x64") {
    ids.push("bun-darwin-x64", "bun-darwin-x64-baseline");
  } else if (platform === "win32" && arch === "x64") {
    ids.push("bun-windows-x64", "bun-windows-x64-baseline");
  } else if (platform === "win32" && (arch === "arm64" || arch === "aarch64")) {
    ids.push("bun-windows-aarch64");
  } else if (platform === "android" && (arch === "arm64" || arch === "aarch64")) {
    ids.push("bun-linux-aarch64-android");
  } else if (platform === "freebsd" && arch === "x64") {
    ids.push("bun-freebsd-x64");
  } else if (platform === "freebsd" && (arch === "arm64" || arch === "aarch64")) {
    ids.push("bun-freebsd-aarch64");
  }
  return { ids, exe };
}

/**
 * @param {string} bin
 * @param {(file: string, args: string[], opts: object) => { status: number | null, stdout?: string | Buffer }} [run]
 */
export function isUsableBunBinary(bin, run = spawnSync) {
  try {
    const st = statSync(bin);
    if (!st.isFile()) return false;
    // Real bun is tens of MB; oven-sh's placeholder bun.exe is a tiny shell stub.
    if (st.size >= MIN_REAL_BUN_BYTES) return true;
    const result = run(bin, ["--version"], {
      encoding: "utf8",
      timeout: 8000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = String(result.stdout || "").trim();
    return result.status === 0 && /^\d+\.\d+/.test(stdout);
  } catch {
    return false;
  }
}

/** @param {ResolveOpts} opts */
export function pathBunCandidates(opts) {
  const pathEnv = opts.pathEnv ?? process.env.PATH ?? "";
  const pathSep =
    opts.pathSep ?? (opts.platform === "win32" || process.platform === "win32" ? ";" : ":");
  const names = opts.executableNames ?? defaultExecutableNames(opts.platform);
  /** @type {string[]} */
  const out = [];
  for (const dir of pathEnv.split(pathSep)) {
    if (!dir) continue;
    for (const name of names) {
      out.push(join(dir, name));
    }
  }
  return out;
}

/** @param {string} packageRoot @param {ResolveOpts} [opts] */
export function bundledBunCandidates(packageRoot, opts = {}) {
  const platform = opts.platform ?? process.platform;
  const arch = opts.arch ?? process.arch;
  const { ids, exe } = ovenPackageIds(platform, arch);
  const bunPkg = join(packageRoot, "node_modules", "bun");
  /** @type {string[]} */
  const out = [
    join(bunPkg, "bin", "bun.exe"),
    join(bunPkg, "bin", "bun"),
    join(bunPkg, "node_modules", ".bin", "bun"),
    join(packageRoot, "node_modules", ".bin", "bun"),
  ];
  for (const id of ids) {
    const rel = join("bin", exe);
    out.push(join(packageRoot, "node_modules", "@oven", id, rel));
    out.push(join(bunPkg, "node_modules", "@oven", id, rel));
  }
  try {
    const require = createRequire(join(packageRoot, "package.json"));
    try {
      const bunJson = require.resolve("bun/package.json");
      out.push(join(bunJson, "..", "bin", "bun.exe"), join(bunJson, "..", "bin", "bun"));
    } catch {
      // bun package not installed
    }
    for (const id of ids) {
      try {
        out.push(require.resolve(`@oven/${id}/bin/${exe}`));
      } catch {
        // platform package not installed
      }
    }
  } catch {
    // createRequire can fail if package.json is missing
  }
  return [...new Set(out)];
}

/** @param {ResolveOpts} opts */
export function resolveBun(opts) {
  const exists = opts.exists ?? existsSync;
  const isUsable = opts.isUsableBun ?? isUsableBunBinary;
  for (const candidate of pathBunCandidates(opts)) {
    if (exists(candidate) && isUsable(candidate)) {
      return { kind: "path", bin: candidate };
    }
  }
  for (const candidate of bundledBunCandidates(opts.packageRoot, opts)) {
    if (exists(candidate) && isUsable(candidate)) {
      return { kind: "bundled", bin: candidate };
    }
  }
  return null;
}

function npmInstallEnv(env) {
  const next = { ...env };
  for (const key of Object.keys(next)) {
    if (/^npm_config_(global|prefix|omit|production)$/i.test(key)) {
      delete next[key];
    }
  }
  return next;
}

/** @param {string} packageRoot @param {NodeJS.ProcessEnv} [env] @param {string} [version] */
export function installBunPackage(packageRoot, env = process.env, version = BUN_FETCH_VERSION) {
  const npmJs = env.npm_execpath;
  const npmCli = npmJs ? [process.execPath, npmJs] : ["npm"];
  const args = [
    "install",
    `bun@${version}`,
    "--no-save",
    "--omit=dev",
    "--no-package-lock",
    "--no-audit",
    "--no-fund",
    "--loglevel=error",
  ];
  const result = spawnSync(npmCli[0], [...npmCli.slice(1), ...args], {
    cwd: packageRoot,
    encoding: "utf8",
    env: npmInstallEnv(env),
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || "").trim();
    const err = new Error(
      `Failed to install bun@${version} into the Snowshoe prefix${detail ? `: ${detail}` : ""}`,
    );
    throw err;
  }
}

/** @param {ResolveOpts} opts */
export async function ensureBun(opts) {
  const found = resolveBun(opts);
  if (found) return found.bin;
  if (!opts.installIfMissing) return null;
  const env = opts.env ?? process.env;
  if (installerIsBun(env)) return null;
  try {
    if (opts.installBun) {
      await opts.installBun({
        packageRoot: opts.packageRoot,
        env,
        version: BUN_FETCH_VERSION,
      });
    } else {
      process.stderr.write(
        `Snowshoe: Bun is not on PATH; fetching bun@${BUN_FETCH_VERSION} into this install…\n`,
      );
      installBunPackage(opts.packageRoot, env, BUN_FETCH_VERSION);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    return null;
  }
  return resolveBun(opts)?.bin ?? null;
}
