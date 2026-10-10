import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, constants as osConstants, hostname as osHostname, tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { gunzipSync } from "node:zlib";

/** Pinned oven-sh platform package. Match CI bun-version. */
export const BUN_FETCH_VERSION = "1.4.2";
export const BUN_FETCH_TIMEOUT_MS = 120_000;
/** Fallback only when the lock owner PID cannot be checked (other host / empty). */
export const BUN_LOCK_STALE_MS = 180_000;
export const RUNTIME_DIRNAME = ".runtime";
export const MIN_NODE_MAJOR = 18;
/** Approximate linux-x64 glibc oven-sh binary; README / first-run copy. */
export const BUN_FETCH_SIZE_HINT = "~40 MB compressed / ~80 MB unpacked";
export const DEFAULT_NPM_REGISTRY = "https://registry.npmjs.org";
export const BUN_WAIT_MESSAGE = "Snowshoe: waiting for another snowshoe to finish downloading Bun…";

const VERSION_PROBE_MS = 8_000;
const LOCK_POLL_MS = 100;
const LOCK_OWNER_FILE = "owner.json";
const WIN_CMD_META = /[&|<>^%\r\n]/;
const TMP_DIR_RE = /^tmp-(\d+)-[0-9a-f]+$/i;
const FETCH_DEADLINE = "SNOWSHOE_FETCH_DEADLINE";

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

export function missingBunMessage(opts = {}) {
  const lines = [
    "Snowshoe needs the Bun runtime, and none was found.",
    "",
    "Tried:",
    "- bun on PATH",
    `- a Bun binary in this install's .runtime/ (one-time download, ${BUN_FETCH_SIZE_HINT} on linux x64, when PATH bun is missing)`,
    "",
    "Install Bun: https://bun.sh",
    "  curl -fsSL https://bun.com/install | bash",
  ];
  const nodeVersion = opts.nodeVersion ?? process.versions.node;
  if (!nodeEngineOk(nodeVersion)) {
    lines.push(
      "",
      `Or install Node.js ${MIN_NODE_MAJOR}+ and retry (the launcher will download a matching Bun binary once).`,
    );
  }
  return lines.join("\n");
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

/** Cheap AVX2 probe so x64 can pick oven-sh `*-baseline` builds. */
export function cpuHasAvx2(platform = process.platform) {
  if (platform === "linux") {
    try {
      return /\bavx2\b/i.test(readFileSync("/proc/cpuinfo", "utf8"));
    } catch {
      return true;
    }
  }
  if (platform === "darwin") {
    try {
      const r = spawnSync("sysctl", ["-n", "hw.optional.avx2_0"], {
        encoding: "utf8",
        timeout: 1000,
      });
      return String(r.stdout || "").trim() === "1";
    } catch {
      return true;
    }
  }
  return true;
}

/** One matching oven-sh id (musl only when libc is musl; baseline when x64 lacks AVX2). */
export function ovenPackageIds(platform = process.platform, arch = process.arch, libc, opts = {}) {
  const exe = platform === "win32" ? "bun.exe" : "bun";
  const abi = libc ?? detectLibc(platform);
  const avx2 = opts.avx2 ?? (arch === "x64" ? cpuHasAvx2(platform) : true);
  const baseline = avx2 ? "" : "-baseline";
  /** @type {string[]} */
  const ids = [];
  if (platform === "linux" && arch === "x64") {
    ids.push(abi === "musl" ? `bun-linux-x64-musl${baseline}` : `bun-linux-x64${baseline}`);
  } else if (platform === "linux" && (arch === "arm64" || arch === "aarch64")) {
    ids.push(abi === "musl" ? "bun-linux-aarch64-musl" : "bun-linux-aarch64");
  } else if (platform === "darwin" && (arch === "arm64" || arch === "aarch64")) {
    ids.push("bun-darwin-aarch64");
  } else if (platform === "darwin" && arch === "x64") {
    ids.push(`bun-darwin-x64${baseline}`);
  } else if (platform === "win32" && arch === "x64") {
    ids.push(`bun-windows-x64${baseline}`);
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
  const { ids, exe } = ovenPackageIds(platform, arch, opts.libc, { avx2: opts.avx2 });
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

export function parseNpmrc(text, env = process.env) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    value = value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => {
      const v = env[name];
      return v == null ? "" : String(v);
    });
    out[key] = value;
  }
  return out;
}

function readNpmrcIfPresent(path, env) {
  try {
    if (!path || !existsSync(path)) return {};
    return parseNpmrc(readFileSync(path, "utf8"), env);
  } catch {
    return {};
  }
}

export function hostInNoProxy(host, noproxy) {
  const raw = String(noproxy || "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (raw.includes("*")) return true;
  const h = String(host || "").toLowerCase();
  for (const entry of raw) {
    const e = entry.toLowerCase();
    if (e === h) return true;
    if (e.startsWith(".") && (h.endsWith(e) || h === e.slice(1))) return true;
    if (!e.startsWith(".") && h.endsWith(`.${e}`)) return true;
  }
  return false;
}

function registryHost(registry) {
  try {
    return new URL(registry.endsWith("/") ? registry : `${registry}/`).host;
  } catch {
    return "";
  }
}

function authForRegistry(npmrc, env, registry) {
  const host = registryHost(registry);
  const keys = [`//${host}/:_authToken`, `//${host}:_authToken`, "_authToken"];
  for (const key of keys) {
    if (npmrc[key]) return { type: "bearer", token: npmrc[key] };
  }
  const token = env.NODE_AUTH_TOKEN || env.NPM_TOKEN;
  if (token) return { type: "bearer", token };
  const basic = npmrc[`//${host}/:_auth`] || npmrc._auth;
  if (basic) return { type: "basic", token: basic };
  return null;
}

function proxyForRegistry(registry, env, npmrc) {
  const host = registryHost(registry);
  const noproxy = env.NO_PROXY || env.no_proxy || npmrc.noproxy || npmrc.no_proxy || "";
  if (host && hostInNoProxy(host, noproxy)) return null;
  const https =
    env.HTTPS_PROXY ||
    env.https_proxy ||
    env.ALL_PROXY ||
    env.all_proxy ||
    npmrc["https-proxy"] ||
    npmrc.proxy;
  const http =
    env.HTTP_PROXY ||
    env.http_proxy ||
    env.ALL_PROXY ||
    env.all_proxy ||
    npmrc.proxy ||
    npmrc["https-proxy"];
  const url = String(registry || "");
  return url.startsWith("https:") ? https || http || null : http || https || null;
}

/** Merge global → user → project npmrc, then env `npm_config_registry`. */
export function resolveNpmFetchConfig(opts = {}) {
  const env = opts.env ?? process.env;
  const cwd = opts.cwd ?? process.cwd();
  const home = opts.home ?? env.HOME ?? homedir();
  /** @type {Record<string, string>} */
  const npmrc = { ...(opts.npmrc || {}) };
  if (!opts.skipFiles) {
    const prefix = env.npm_config_prefix || env.PREFIX;
    const globalPath = prefix ? join(prefix, "etc", "npmrc") : join("/etc", "npmrc");
    Object.assign(
      npmrc,
      readNpmrcIfPresent(globalPath, env),
      readNpmrcIfPresent(join(home, ".npmrc"), env),
      readNpmrcIfPresent(join(cwd, ".npmrc"), env),
    );
  }
  const envRegistry = env.npm_config_registry || env.NPM_CONFIG_REGISTRY;
  const registry = String(
    envRegistry || npmrc["@oven:registry"] || npmrc.registry || DEFAULT_NPM_REGISTRY,
  ).replace(/\/+$/, "");
  const auth = authForRegistry(npmrc, env, registry);
  const proxy = proxyForRegistry(registry, env, npmrc);
  /** @type {Record<string, string>} */
  const headers = {};
  if (auth?.type === "bearer") headers.Authorization = `Bearer ${auth.token}`;
  if (auth?.type === "basic") headers.Authorization = `Basic ${auth.token}`;
  return {
    registry,
    auth,
    proxy,
    headers,
    useNpmCli: Boolean(proxy),
  };
}

export function registryBase(env = process.env, opts = {}) {
  return resolveNpmFetchConfig({ env, ...opts }).registry;
}

function unwrapErr(err) {
  return err && typeof err === "object" && "cause" in err && err.cause ? err.cause : err;
}

export function formatFetchReason(err, timeoutMs = BUN_FETCH_TIMEOUT_MS) {
  if (!err) return "unknown error";
  const nested = unwrapErr(err);
  const name = nested && typeof nested === "object" && "name" in nested ? String(nested.name) : "";
  const code = nested && typeof nested === "object" && "code" in nested ? String(nested.code) : "";
  const msg = nested instanceof Error ? nested.message : String(nested);
  if (code === FETCH_DEADLINE) {
    return `timed out after ${Math.round(timeoutMs / 1000)}s`;
  }
  if (name === "AbortError" || code === "ABORT_ERR") {
    if (/timed out after \d+s/.test(msg)) return msg.split("\n")[0];
    return "aborted";
  }
  if (
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    code === "UND_ERR_BODY_TIMEOUT" ||
    code === "ETIMEDOUT" ||
    /connect timeout/i.test(msg)
  ) {
    return "connection timed out";
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "registry host not found";
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

export function isPidAlive(pid) {
  const n = Number(pid);
  if (!Number.isInteger(n) || n <= 0) return false;
  try {
    process.kill(n, 0);
    return true;
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? err.code : "";
    return code === "EPERM";
  }
}

export function lockOwnerPath(lockDir) {
  return join(lockDir, LOCK_OWNER_FILE);
}

export function writeLockOwner(lockDir, opts = {}) {
  const owner = {
    pid: opts.pid ?? process.pid,
    host: opts.host ?? osHostname(),
    started: opts.now ?? Date.now(),
  };
  writeFileSync(lockOwnerPath(lockDir), `${JSON.stringify(owner)}\n`);
  return owner;
}

export function readLockOwner(lockDir) {
  try {
    const parsed = JSON.parse(readFileSync(lockOwnerPath(lockDir), "utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Dead owner PID on this host (or missing owner) is stale immediately. */
export function isLockOwnerDead(lockDir, opts = {}) {
  const owner = readLockOwner(lockDir);
  if (!owner) return true;
  const host = opts.host ?? osHostname();
  if (owner.host && owner.host !== host) return false;
  return !isPidAlive(owner.pid);
}

/** Waiters must outlive staleMs so a live download is not abandoned. */
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
  let announced = false;
  while (now() - start < timeoutMs) {
    try {
      mkdir(lockDir);
      writeLockOwner(lockDir, opts);
      return true;
    } catch (err) {
      if (isPermissionError(err)) throw err;
      const code = err && typeof err === "object" && "code" in err ? err.code : "";
      if (code !== "EEXIST") throw err;
      let steal = false;
      try {
        if (isLockOwnerDead(lockDir, opts)) {
          steal = true;
        } else {
          const owner = readLockOwner(lockDir);
          const otherHost = Boolean(owner?.host && owner.host !== (opts.host ?? osHostname()));
          if (otherHost) {
            const st = stat(lockDir);
            const mtime = st.mtimeMs ?? (st.mtime ? st.mtime.getTime() : 0);
            if (mtime && now() - mtime > staleMs) steal = true;
          }
        }
      } catch {
        steal = true;
      }
      if (steal) {
        rm(lockDir);
        continue;
      }
      if (!announced) {
        announced = true;
        if (opts.onWait) opts.onWait();
        else process.stderr.write(`${BUN_WAIT_MESSAGE}\n`);
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

export function sweepStaleTempDirs(runtimeDir, opts = {}) {
  let names = [];
  try {
    names = readdirSync(runtimeDir);
  } catch {
    return [];
  }
  /** @type {string[]} */
  const removed = [];
  for (const name of names) {
    const match = TMP_DIR_RE.exec(name);
    if (!match) continue;
    const dir = join(runtimeDir, name);
    const pid = Number(match[1]);
    let stale = !isPidAlive(pid);
    if (!stale && opts.staleMs) {
      try {
        const st = statSync(dir);
        const mtime = st.mtimeMs ?? (st.mtime ? st.mtime.getTime() : 0);
        if (mtime && Date.now() - mtime > opts.staleMs) stale = true;
      } catch {
        stale = true;
      }
    }
    if (!stale) continue;
    try {
      rmSync(dir, { recursive: true, force: true });
      removed.push(dir);
    } catch {
      // ignore
    }
  }
  return removed;
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
    if (!/(^|\/)bin\/bun(\.exe)?$/.test(rel)) {
      offset += (size + 511) & ~511;
      continue;
    }
    const out = join(dest, rel);
    if (type === "5" || rel.endsWith("/")) {
      mkdirSync(out, { recursive: true });
    } else if (type === "0" || type === "\0" || type === "") {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, tar.subarray(offset, offset + size));
      try {
        chmodSync(out, 0o755);
      } catch {
        // Windows
      }
    }
    offset += (size + 511) & ~511;
  }
}

function fetchDeadlineError(timeoutMs) {
  const err = new Error(`timed out after ${Math.round(timeoutMs / 1000)}s`);
  err.name = "AbortError";
  err.code = FETCH_DEADLINE;
  return err;
}

export function assertSafeDownloadUrl(url, registry) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`invalid download URL: ${url}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`unsupported download protocol ${parsed.protocol}`);
  }
  let registryIsHttp = false;
  try {
    const reg = new URL(registry.endsWith("/") ? registry : `${registry}/`);
    registryIsHttp = reg.protocol === "http:";
  } catch {
    registryIsHttp = false;
  }
  if (!registryIsHttp && parsed.protocol !== "https:") {
    throw new Error(`refusing non-https download URL (${url})`);
  }
  return parsed;
}

export function assertNoHttpDowngrade(fromUrl, toUrl) {
  let from;
  let to;
  try {
    from = new URL(fromUrl);
    to = new URL(toUrl, fromUrl);
  } catch {
    throw new Error(`invalid redirect URL: ${toUrl}`);
  }
  if (from.protocol === "https:" && to.protocol !== "https:") {
    throw new Error(`refusing https→http redirect (${from.href} → ${to.href})`);
  }
}

async function fetchFollowSafe(fetchImpl, url, init, registry) {
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    assertSafeDownloadUrl(current, registry);
    const res = await fetchImpl(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error(`redirect ${res.status} without Location`);
      const next = new URL(loc, current).href;
      assertNoHttpDowngrade(current, next);
      current = next;
      continue;
    }
    if (res.url) assertSafeDownloadUrl(res.url, registry);
    return res;
  }
  throw new Error("too many redirects while downloading Bun");
}

async function withFetchDeadline(timeoutMs, fn) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), Math.max(1, timeoutMs));
  try {
    return await fn(ac.signal);
  } catch (err) {
    if (ac.signal.aborted) throw fetchDeadlineError(timeoutMs);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function npmCommand(env) {
  const execpath = env.npm_execpath;
  if (execpath && existsSync(execpath)) {
    return { bin: process.execPath, prefix: [execpath] };
  }
  return { bin: "npm", prefix: [] };
}

export function defaultRunNpm(args, opts = {}) {
  const env = opts.env ?? process.env;
  const { bin, prefix } = npmCommand(env);
  return spawnSync(bin, [...prefix, ...args], {
    cwd: opts.cwd ?? process.cwd(),
    env,
    encoding: "utf8",
    timeout: opts.timeoutMs ?? BUN_FETCH_TIMEOUT_MS,
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
  });
}

function npmShortFail(result, what) {
  const errText = String(result.stderr || result.stdout || "").trim();
  const first = errText.split("\n").find((l) => l.trim() && !/^npm (notice|warn)/i.test(l));
  const hint = first ? first.slice(0, 200) : `exit ${result.status ?? "null"}`;
  if (result.error && result.error.code === "ENOENT") {
    return new Error(
      `HTTP(S)_PROXY or a custom npm transport needs npm on PATH (${what}; npm not found)`,
    );
  }
  if (result.error && /timed? ?out/i.test(result.error.message || "")) {
    return new Error(`${what} timed out`);
  }
  return new Error(`${what} failed: ${hint}`);
}

export async function packOvenBunWithNpm(opts) {
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
  const spec = `@oven/${id}@${version}`;
  const dest = opts.dest ?? mkdtempSync(join(tmpdir(), "snowshoe-npm-pack-"));
  const createdDest = !opts.dest;
  mkdirSync(dest, { recursive: true });
  try {
    const runNpm = opts.runNpm ?? defaultRunNpm;
    const cwd = opts.cwd ?? process.cwd();
    const view = runNpm(["view", spec, "dist.integrity", "--json"], { env, cwd, timeoutMs });
    if (view.status !== 0) throw npmShortFail(view, `npm view ${spec}`);
    let integrity = String(view.stdout || "").trim();
    try {
      integrity = JSON.parse(integrity);
    } catch {
      // already a string
    }
    if (typeof integrity !== "string") {
      throw new Error(`npm view ${spec} did not return dist.integrity`);
    }
    const pack = runNpm(["pack", spec, "--pack-destination", dest, "--ignore-scripts", "--json"], {
      env,
      cwd,
      timeoutMs,
    });
    if (pack.status !== 0) throw npmShortFail(pack, `npm pack ${spec}`);
    const tgz = readdirSync(dest).find((name) => name.endsWith(".tgz"));
    if (!tgz) throw new Error(`npm pack ${spec} did not write a tarball`);
    const buf = readFileSync(join(dest, tgz));
    verifyIntegrity(buf, integrity);
    return { id, version, buf, integrity };
  } finally {
    if (createdDest) {
      try {
        rmSync(dest, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
}

export async function fetchOvenBunTarball(opts) {
  const env = opts.env ?? process.env;
  const platform = opts.platform ?? process.platform;
  const arch = opts.arch ?? process.arch;
  const { ids } = ovenPackageIds(platform, arch, opts.libc, { avx2: opts.avx2 });
  const id = ids[0];
  if (!id) {
    throw new Error(`unsupported platform for bundled Bun: ${platform} ${arch}`);
  }
  const version = opts.version ?? BUN_FETCH_VERSION;
  const timeoutMs = opts.timeoutMs ?? BUN_FETCH_TIMEOUT_MS;
  const cfg = resolveNpmFetchConfig({
    env,
    cwd: opts.cwd,
    home: opts.home,
    skipFiles: opts.skipFiles,
  });
  if (cfg.useNpmCli) {
    return packOvenBunWithNpm({ ...opts, env, timeoutMs });
  }
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("this Node.js build has no fetch; install Bun from https://bun.sh instead");
  }
  const base = cfg.registry;
  const metaUrl = `${base}/@oven/${id}/${version}`;
  const extra = Object.keys(cfg.headers).length ? { headers: cfg.headers } : {};
  try {
    return await withFetchDeadline(timeoutMs, async (signal) => {
      const init = { ...extra, signal };
      const metaRes = await fetchFollowSafe(fetchImpl, metaUrl, init, base);
      if (!metaRes.ok) {
        throw new Error(`registry returned ${metaRes.status} for @oven/${id}@${version}`);
      }
      const meta = await metaRes.json();
      const dist = meta?.dist ?? {};
      if (!dist.tarball || !dist.integrity) {
        throw new Error(
          `registry metadata for @oven/${id}@${version} is missing tarball/integrity`,
        );
      }
      assertSafeDownloadUrl(dist.tarball, base);
      const tarRes = await fetchFollowSafe(fetchImpl, dist.tarball, init, base);
      if (!tarRes.ok) {
        throw new Error(`download returned ${tarRes.status} for @oven/${id}@${version}`);
      }
      const buf = Buffer.from(await tarRes.arrayBuffer());
      verifyIntegrity(buf, dist.integrity);
      return { id, version, buf, integrity: dist.integrity };
    });
  } catch (err) {
    const reason = formatFetchReason(err, timeoutMs);
    const msg = err instanceof Error ? err.message : String(err);
    if (/^could not |^registry returned|^download returned|^refusing |^invalid /.test(msg)) {
      throw err instanceof Error ? err : new Error(msg);
    }
    throw new Error(`could not reach ${base} (${reason})`);
  }
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

function cleanupFetchState(state) {
  if (state.tmp) {
    try {
      rmSync(state.tmp, { recursive: true, force: true });
    } catch {
      // ignore
    }
    state.tmp = null;
  }
  if (state.lockDir) {
    releaseLock(state.lockDir);
    state.lockDir = null;
  }
  if (state.runtimeDir) {
    sweepStaleTempDirs(state.runtimeDir);
  }
}

function installFetchCleanup(state) {
  const signals = ["SIGINT", "SIGTERM", "SIGHUP"];
  const onExit = () => {
    cleanupFetchState(state);
  };
  /** @param {NodeJS.Signals} signal */
  const onSignal = (signal) => {
    cleanupFetchState(state);
    detach();
    const n = osConstants.signals[signal];
    process.exit(typeof n === "number" ? 128 + n : 1);
  };
  function detach() {
    process.removeListener("exit", onExit);
    for (const signal of signals) {
      process.removeListener(signal, onSignal);
    }
  }
  process.on("exit", onExit);
  for (const signal of signals) {
    process.on(signal, onSignal);
  }
  return detach;
}

export async function installOvenBun(packageRoot, opts = {}) {
  const root = ensureRuntimeParent(packageRoot);
  sweepStaleTempDirs(root);
  const current = runtimeCurrent(packageRoot);
  const tmp = join(root, `tmp-${process.pid}-${randomBytes(4).toString("hex")}`);
  if (opts.state) opts.state.tmp = tmp;
  try {
    mkdirSync(tmp, { recursive: true });
    const fetched = await fetchOvenBunTarball({
      ...opts,
      env: opts.env,
      dest: tmp,
    });
    extractNpmTgz(fetched.buf, tmp);
    try {
      rmSync(current, { recursive: true, force: true });
    } catch {
      // first install
    }
    renameSync(tmp, current);
    if (opts.state) opts.state.tmp = null;
  } catch (err) {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore
    }
    if (opts.state) opts.state.tmp = null;
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
  /** @type {{ lockDir: string | null, tmp: string | null, runtimeDir: string }} */
  const state = { lockDir: null, tmp: null, runtimeDir: root };
  const detachCleanup = installFetchCleanup(state);
  try {
    ensureRuntimeParent(opts.packageRoot);
    sweepStaleTempDirs(root);
    await acquireLock(lockDir, {
      timeoutMs: lockWaitMs(timeoutMs, staleMs),
      staleMs,
      sleep: opts.sleep,
      onWait: opts.onWait,
    });
    state.lockDir = lockDir;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    detachCleanup();
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
        cwd: opts.cwd,
        state,
      });
    }
    return resolveBun(opts)?.bin ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Failed to fetch Bun: ${message}\n`);
    return null;
  } finally {
    state.lockDir = null;
    releaseLock(lockDir);
    detachCleanup();
  }
}
