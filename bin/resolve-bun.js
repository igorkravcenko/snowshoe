import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { gunzipSync } from "node:zlib";

/** Pinned oven-sh platform package. Match CI bun-version. */
export const BUN_FETCH_VERSION = "1.4.2";
export const BUN_FETCH_TIMEOUT_MS = 120_000;
/** Must exceed the fetch bound so a live download is not stolen. */
export const BUN_LOCK_STALE_MS = 180_000;
export const RUNTIME_DIRNAME = ".runtime";
export const MIN_NODE_MAJOR = 18;
/** Approximate linux-x64 glibc oven-sh binary; README / first-run copy. */
export const BUN_FETCH_SIZE_HINT = "~40 MB compressed / ~80 MB unpacked";

const VERSION_PROBE_MS = 8_000;
const LOCK_POLL_MS = 100;
const WIN_CMD_META = /[&|<>^%\r\n]/;

/**
 * @typedef {object} ResolveOpts
 * @property {string} packageRoot
 * @property {string} [pathEnv]
 * @property {string} [pathSep]
 * @property {string} [cwd]
 * @property {NodeJS.Platform | string} [platform]
 * @property {string} [arch]
 * @property {string} [libc]
 * @property {string[]} [executableNames]
 * @property {(p: string) => boolean} [exists]
 * @property {(p: string) => boolean} [isUsableBun]
 * @property {NodeJS.ProcessEnv} [env]
 * @property {boolean} [installIfMissing]
 * @property {number} [timeoutMs]
 * @property {number} [staleMs]
 * @property {(ms: number) => Promise<void>} [sleep]
 * @property {typeof fetch} [fetch]
 * @property {(opts: { packageRoot: string, env: NodeJS.ProcessEnv, version: string, timeoutMs: number }) => void | Promise<void>} [installBun]
 */

export function nodeMajor(version = process.versions.node) {
  return Number.parseInt(String(version), 10);
}

export function nodeEngineOk(version = process.versions.node) {
  const major = nodeMajor(version);
  return Number.isFinite(major) && major >= MIN_NODE_MAJOR;
}

export function nodeEngineMessage(version = process.versions.node) {
  return `Snowshoe's launcher needs Node.js ${MIN_NODE_MAJOR} or newer (this is ${version}).`;
}

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
    `- a Bun binary in this install's .runtime/ (one-time download, ${BUN_FETCH_SIZE_HINT} on linux x64, when PATH bun is missing)`,
    "",
    "Install Bun: https://bun.sh",
    "  curl -fsSL https://bun.com/install | bash",
    "",
    "Or install Node.js 18+ and retry (the launcher will download a matching Bun binary once).",
  ].join("\n");
}

export function permissionDeniedMessage(runtimePath) {
  return [
    `Snowshoe cannot write a Bun runtime into ${runtimePath} (permission denied).`,
    "If you used `sudo npm install -g`, the global prefix is root-owned.",
    "Fix: put bun on PATH, or fix ownership of the global package, or reinstall without sudo",
    "(npm prefix in your home directory).",
  ].join("\n");
}

export function defaultExecutableNames(platform = process.platform) {
  return platform === "win32" ? ["bun.exe", "bun.cmd", "bun"] : ["bun"];
}

export function detectLibc(platform = process.platform) {
  if (platform !== "linux") return undefined;
  try {
    if (existsSync("/etc/alpine-release")) return "musl";
  } catch {
    // ignore
  }
  try {
    if (process.report?.getReport) {
      const excludeNetwork = process.report.excludeNetwork;
      process.report.excludeNetwork = true;
      try {
        const report = process.report.getReport();
        if (report?.header) {
          return report.header.glibcVersionRuntime ? "glibc" : "musl";
        }
      } finally {
        process.report.excludeNetwork = excludeNetwork;
      }
    }
  } catch {
    // ignore
  }
  return "glibc";
}

/** One matching oven-sh id (no baseline aliases; musl only when libc is musl). */
export function ovenPackageIds(platform = process.platform, arch = process.arch, libc) {
  const exe = platform === "win32" ? "bun.exe" : "bun";
  const abi = libc ?? detectLibc(platform);
  /** @type {string[]} */
  const ids = [];
  if (platform === "linux" && arch === "x64") {
    ids.push(abi === "musl" ? "bun-linux-x64-musl" : "bun-linux-x64");
  } else if (platform === "linux" && (arch === "arm64" || arch === "aarch64")) {
    ids.push(abi === "musl" ? "bun-linux-aarch64-musl" : "bun-linux-aarch64");
  } else if (platform === "darwin" && (arch === "arm64" || arch === "aarch64")) {
    ids.push("bun-darwin-aarch64");
  } else if (platform === "darwin" && arch === "x64") {
    ids.push("bun-darwin-x64");
  } else if (platform === "win32" && arch === "x64") {
    ids.push("bun-windows-x64");
  } else if (platform === "win32" && (arch === "arm64" || arch === "aarch64")) {
    ids.push("bun-windows-aarch64");
  } else if (platform === "android" && (arch === "arm64" || arch === "aarch64")) {
    ids.push("bun-linux-aarch64-android");
  } else if (platform === "android" && arch === "x64") {
    ids.push("bun-linux-x64-android");
  } else if (platform === "freebsd" && arch === "x64") {
    ids.push("bun-freebsd-x64");
  } else if (platform === "freebsd" && (arch === "arm64" || arch === "aarch64")) {
    ids.push("bun-freebsd-aarch64");
  }
  return { ids, exe };
}

export function runtimeRoot(packageRoot) {
  return join(packageRoot, RUNTIME_DIRNAME);
}

export function runtimeCurrent(packageRoot) {
  return join(runtimeRoot(packageRoot), "current");
}

function winQuote(value) {
  if (!/[ \t"]/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function isWindowsCmd(bin, platform = process.platform) {
  return platform === "win32" && /\.(cmd|bat)$/i.test(bin);
}

function assertSafeWinCmd(bin, args) {
  if (WIN_CMD_META.test(bin) || args.some((a) => WIN_CMD_META.test(String(a)))) {
    throw new Error("refusing to spawn a Windows .cmd path with shell metacharacters");
  }
}

/** Spawn bun. `.cmd` uses shell:true (Node >=18.20.2 / CVE-2024-27980); others never use a shell. */
export function spawnBun(bin, args, options = {}) {
  const { platform: spawnPlatform, ...rest } = options;
  if (isWindowsCmd(bin, spawnPlatform ?? process.platform)) {
    assertSafeWinCmd(bin, args);
    return spawn(
      winQuote(bin),
      args.map((a) => winQuote(String(a))),
      { ...rest, shell: true, windowsVerbatimArguments: true },
    );
  }
  return spawn(bin, args, { ...rest, shell: false });
}

export function spawnBunSync(bin, args, options = {}) {
  const { platform: spawnPlatform, ...rest } = options;
  if (isWindowsCmd(bin, spawnPlatform ?? process.platform)) {
    assertSafeWinCmd(bin, args);
    return spawnSync(
      winQuote(bin),
      args.map((a) => winQuote(String(a))),
      { ...rest, shell: true, windowsVerbatimArguments: true },
    );
  }
  return spawnSync(bin, args, { ...rest, shell: false });
}

export function isUsableBunBinary(bin, run = spawnBunSync) {
  try {
    const st = statSync(bin);
    if (!st.isFile()) return false;
    const result = run(bin, ["--version"], {
      encoding: "utf8",
      timeout: VERSION_PROBE_MS,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = String(result.stdout || "").trim();
    return result.status === 0 && /^\d+\.\d+/.test(stdout);
  } catch {
    return false;
  }
}

/** Relative PATH entries resolve vs cwd, like a shell. */
export function pathBunCandidates(opts) {
  const pathEnv = opts.pathEnv ?? process.env.PATH ?? "";
  const pathSep =
    opts.pathSep ?? (opts.platform === "win32" || process.platform === "win32" ? ";" : ":");
  const names = opts.executableNames ?? defaultExecutableNames(opts.platform);
  const cwd = opts.cwd ?? process.cwd();
  /** @type {string[]} */
  const out = [];
  for (const dir of pathEnv.split(pathSep)) {
    if (!dir) continue;
    const resolvedDir = isAbsolute(dir) ? dir : join(cwd, dir);
    for (const name of names) {
      out.push(join(resolvedDir, name));
    }
  }
  return out;
}

/** Bundled bun lives only under `<packageRoot>/.runtime/current`. */
export function bundledBunCandidates(packageRoot, opts = {}) {
  const platform = opts.platform ?? process.platform;
  const arch = opts.arch ?? process.arch;
  const { ids, exe } = ovenPackageIds(platform, arch, opts.libc);
  const current = runtimeCurrent(packageRoot);
  /** @type {string[]} */
  const out = [join(current, "bin", "bun.exe"), join(current, "bin", "bun")];
  for (const id of ids) {
    out.push(join(current, "node_modules", "@oven", id, "bin", exe));
    out.push(join(current, "bin", exe));
  }
  return [...new Set(out)];
}

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

function isPermissionError(err) {
  const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
  const msg = err instanceof Error ? err.message : String(err);
  return code === "EACCES" || code === "EPERM" || /eacces|permission denied/i.test(msg);
}

export function registryBase(env = process.env) {
  const raw = env.npm_config_registry || env.NPM_CONFIG_REGISTRY || "https://registry.npmjs.org/";
  return String(raw).replace(/\/+$/, "");
}

export function formatFetchReason(err, timeoutMs = BUN_FETCH_TIMEOUT_MS) {
  if (!err) return "unknown error";
  const nested = err && typeof err === "object" && "cause" in err && err.cause ? err.cause : err;
  const name = nested && typeof nested === "object" && "name" in nested ? String(nested.name) : "";
  const code = nested && typeof nested === "object" && "code" in nested ? String(nested.code) : "";
  const msg = nested instanceof Error ? nested.message : String(nested);
  if (name === "AbortError" || code === "ABORT_ERR" || /aborted|timed out|timeout/i.test(msg)) {
    return `timed out after ${Math.round(timeoutMs / 1000)}s`;
  }
  if (code === "ENOTFOUND") return "registry host not found";
  if (code === "ECONNREFUSED") return "connection refused";
  if (code === "ECONNRESET") return "connection reset";
  if (code === "ENETUNREACH") return "network unreachable";
  const first = msg.split("\n")[0] || msg;
  return first.slice(0, 200);
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mkdirLock(lockDir) {
  mkdirSync(lockDir);
}

/** Waiters must outlive staleMs so a crashed lock can be stolen. */
export function lockWaitMs(timeoutMs = BUN_FETCH_TIMEOUT_MS, staleMs = BUN_LOCK_STALE_MS) {
  return Math.max(timeoutMs, staleMs + 5_000);
}

export async function acquireLock(lockDir, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? lockWaitMs();
  const staleMs = opts.staleMs ?? BUN_LOCK_STALE_MS;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? sleepMs;
  const mkdir = opts.mkdir ?? mkdirLock;
  const rm = opts.rm ?? ((p) => rmSync(p, { recursive: true, force: true }));
  const stat = opts.stat ?? statSync;
  const start = now();
  while (now() - start < timeoutMs) {
    try {
      mkdir(lockDir);
      return true;
    } catch (err) {
      if (isPermissionError(err)) throw err;
      const code = err && typeof err === "object" && "code" in err ? err.code : "";
      if (code !== "EEXIST") throw err;
      try {
        const st = stat(lockDir);
        const mtime = st.mtimeMs ?? (st.mtime ? st.mtime.getTime() : 0);
        if (mtime && now() - mtime > staleMs) {
          rm(lockDir);
          continue;
        }
      } catch {
        // lock disappeared
      }
      await sleep(opts.pollMs ?? LOCK_POLL_MS);
    }
  }
  throw new Error(
    `timed out after ${Math.round(timeoutMs / 1000)}s waiting for another Snowshoe process to finish fetching Bun`,
  );
}

export function releaseLock(lockDir) {
  try {
    rmSync(lockDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

export function verifyIntegrity(buf, integrity) {
  const match = /^sha512-(.+)$/.exec(String(integrity || ""));
  if (!match) {
    throw new Error("package metadata is missing sha512 integrity");
  }
  const actual = createHash("sha512").update(buf).digest("base64");
  const a = Buffer.from(actual);
  const b = Buffer.from(match[1]);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("downloaded Bun tarball failed integrity check");
  }
}

/** Extract an npm package tarball (gzip ustar) into dest, stripping the leading `package/` prefix. */
export function extractNpmTgz(buf, dest) {
  const tar = gunzipSync(buf);
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const name = tar
      .subarray(offset, offset + 100)
      .toString("utf8")
      .replace(/\0.*$/, "");
    if (!name) break;
    const sizeStr = tar
      .subarray(offset + 124, offset + 136)
      .toString("utf8")
      .replace(/\0.*$/, "");
    const size = Number.parseInt(sizeStr.trim(), 8);
    const type = String.fromCharCode(tar[offset + 156] || 48);
    offset += 512;
    if (Number.isNaN(size) || size < 0) continue;
    const rel = name.replace(/^package\//, "").replace(/\\/g, "/");
    if (!rel || rel.startsWith("/") || rel.includes("\0") || rel.split("/").includes("..")) {
      offset += (size + 511) & ~511;
      continue;
    }
    const out = join(dest, rel);
    if (type === "5" || rel.endsWith("/")) {
      mkdirSync(out, { recursive: true });
    } else if (type === "0" || type === "\0" || type === "") {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, tar.subarray(offset, offset + size));
      if (/(^|\/)bin\/bun(\.exe)?$/.test(rel.replace(/\\/g, "/"))) {
        try {
          chmodSync(out, 0o755);
        } catch {
          // Windows
        }
      }
    }
    offset += (size + 511) & ~511;
  }
}

async function fetchWithDeadline(url, fetchImpl, deadline, extra = {}) {
  const ac = new AbortController();
  const ms = Math.max(1, deadline - Date.now());
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetchImpl(url, { ...extra, signal: ac.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchOvenBunTarball(opts) {
  const env = opts.env ?? process.env;
  const platform = opts.platform ?? process.platform;
  const arch = opts.arch ?? process.arch;
  const { ids } = ovenPackageIds(platform, arch, opts.libc);
  const id = ids[0];
  if (!id) {
    throw new Error(`unsupported platform for bundled Bun: ${platform} ${arch}`);
  }
  const version = opts.version ?? BUN_FETCH_VERSION;
  const timeoutMs = opts.timeoutMs ?? BUN_FETCH_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("this Node.js build has no fetch; install Bun from https://bun.sh instead");
  }
  const base = registryBase(env);
  const metaUrl = `${base}/@oven/${id}/${version}`;
  let metaRes;
  try {
    metaRes = await fetchWithDeadline(metaUrl, fetchImpl, deadline);
  } catch (err) {
    throw new Error(`could not reach ${base} (${formatFetchReason(err, timeoutMs)})`);
  }
  if (!metaRes.ok) {
    throw new Error(`registry returned ${metaRes.status} for @oven/${id}@${version}`);
  }
  const meta = await metaRes.json();
  const dist = meta?.dist ?? {};
  if (!dist.tarball || !dist.integrity) {
    throw new Error(`registry metadata for @oven/${id}@${version} is missing tarball/integrity`);
  }
  let tarRes;
  try {
    tarRes = await fetchWithDeadline(dist.tarball, fetchImpl, deadline);
  } catch (err) {
    throw new Error(`could not download ${dist.tarball} (${formatFetchReason(err, timeoutMs)})`);
  }
  if (!tarRes.ok) {
    throw new Error(`download returned ${tarRes.status} for @oven/${id}@${version}`);
  }
  const buf = Buffer.from(await tarRes.arrayBuffer());
  verifyIntegrity(buf, dist.integrity);
  return { id, version, buf, integrity: dist.integrity };
}

function ensureRuntimeParent(packageRoot) {
  const root = runtimeRoot(packageRoot);
  try {
    mkdirSync(root, { recursive: true });
  } catch (err) {
    if (isPermissionError(err)) {
      throw new Error(permissionDeniedMessage(root));
    }
    throw err;
  }
  return root;
}

export async function installOvenBun(packageRoot, opts = {}) {
  const root = ensureRuntimeParent(packageRoot);
  const current = runtimeCurrent(packageRoot);
  const tmp = join(root, `tmp-${process.pid}-${randomBytes(4).toString("hex")}`);
  try {
    mkdirSync(tmp, { recursive: true });
    const fetched = await fetchOvenBunTarball({ ...opts, env: opts.env });
    extractNpmTgz(fetched.buf, tmp);
    try {
      rmSync(current, { recursive: true, force: true });
    } catch {
      // first install
    }
    renameSync(tmp, current);
  } catch (err) {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore
    }
    if (isPermissionError(err)) {
      throw new Error(permissionDeniedMessage(root));
    }
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
  const timeoutMs = opts.timeoutMs ?? BUN_FETCH_TIMEOUT_MS;
  const staleMs = opts.staleMs ?? BUN_LOCK_STALE_MS;
  const root = runtimeRoot(opts.packageRoot);
  const lockDir = join(root, "lock");
  try {
    ensureRuntimeParent(opts.packageRoot);
    await acquireLock(lockDir, {
      timeoutMs: lockWaitMs(timeoutMs, staleMs),
      staleMs,
      sleep: opts.sleep,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    return null;
  }
  try {
    const again = resolveBun(opts);
    if (again) return again.bin;
    process.stderr.write(
      `Snowshoe: Bun is not on PATH; downloading @oven/${ovenPackageIds(opts.platform, opts.arch, opts.libc).ids[0] ?? "bun"}@${BUN_FETCH_VERSION} once (${BUN_FETCH_SIZE_HINT}) into .runtime/…\n`,
    );
    if (opts.installBun) {
      await opts.installBun({
        packageRoot: opts.packageRoot,
        env,
        version: BUN_FETCH_VERSION,
        timeoutMs,
      });
    } else {
      await installOvenBun(opts.packageRoot, {
        env,
        platform: opts.platform,
        arch: opts.arch,
        libc: opts.libc,
        timeoutMs,
        fetch: opts.fetch,
      });
    }
    return resolveBun(opts)?.bin ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Failed to fetch Bun: ${message}\n`);
    return null;
  } finally {
    releaseLock(lockDir);
  }
}
