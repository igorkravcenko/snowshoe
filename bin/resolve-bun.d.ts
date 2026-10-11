export const BUN_FETCH_VERSION: string;
export const BUN_FETCH_TIMEOUT_MS: number;
export const BUN_LOCK_STALE_MS: number;
export const RUNTIME_DIRNAME: ".runtime";
export const MIN_NODE_MAJOR: 18;
export const BUN_FETCH_SIZE_HINT: string;
export const DEFAULT_NPM_REGISTRY: string;
export const BUN_WAIT_MESSAGE: string;

export function nodeMajor(version?: string): number;
export function nodeEngineOk(version?: string): boolean;
export function nodeEngineMessage(version?: string): string;
export function installerIsBun(env?: NodeJS.ProcessEnv): boolean;
export function missingBunMessage(opts?: { nodeVersion?: string }): string;
export function permissionDeniedMessage(runtimePath: string): string;
export function defaultExecutableNames(platform?: NodeJS.Platform | string): string[];
export function detectLibc(platform?: NodeJS.Platform | string): "glibc" | "musl" | undefined;
export function cpuHasAvx2(platform?: NodeJS.Platform | string): boolean;
export function ovenPackageIds(
  platform?: NodeJS.Platform | string,
  arch?: string,
  libc?: string,
  opts?: { avx2?: boolean },
): { ids: string[]; exe: string };
export function runtimeRoot(packageRoot: string): string;
export function runtimeCurrent(packageRoot: string): string;
export function parseNpmrc(text: string, env?: NodeJS.ProcessEnv): Record<string, string>;
export function hostInNoProxy(host: string, noproxy: string): boolean;
export function resolveNpmFetchConfig(opts?: {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  home?: string;
  npmrc?: Record<string, string>;
  skipFiles?: boolean;
}): {
  registry: string;
  proxy: string | null;
  useNpmCli: boolean;
};
export function registryBase(env?: NodeJS.ProcessEnv, opts?: object): string;
export function formatFetchReason(err: unknown, timeoutMs?: number): string;
export function assertSafeDownloadUrl(url: string, registry: string): URL;
export function assertNoHttpDowngrade(fromUrl: string, toUrl: string): void;
export function ovenTarballUrl(
  registry: string,
  id: string,
  version: string,
  distTarball: string,
): string;

export function spawnBun(
  bin: string,
  args: string[],
  options?: object,
): ReturnType<typeof import("node:child_process").spawn>;
export function spawnBunSync(
  bin: string,
  args: string[],
  options?: object,
): ReturnType<typeof import("node:child_process").spawnSync>;

export function isUsableBunBinary(
  bin: string,
  run?: (
    file: string,
    args: string[],
    opts: object,
  ) => { status: number | null; stdout?: string | Buffer },
): boolean;

export type ResolveOpts = {
  packageRoot?: string;
  pathEnv?: string;
  pathSep?: string;
  cwd?: string;
  platform?: NodeJS.Platform | string;
  arch?: string;
  libc?: string;
  executableNames?: string[];
  exists?: (p: string) => boolean;
  isUsableBun?: (p: string) => boolean;
  env?: NodeJS.ProcessEnv;
  installIfMissing?: boolean;
  timeoutMs?: number;
  staleMs?: number;
  sleep?: (ms: number) => Promise<void>;
  fetch?: typeof fetch;
  onWait?: () => void;
  skipFiles?: boolean;
  avx2?: boolean;
  installBun?: (opts: {
    packageRoot: string;
    env: NodeJS.ProcessEnv;
    version: string;
    timeoutMs: number;
  }) => void | Promise<void>;
};

export function pathBunCandidates(
  opts: Pick<ResolveOpts, "pathEnv" | "pathSep" | "platform" | "executableNames" | "cwd">,
): string[];
export function bundledBunCandidates(
  packageRoot: string,
  opts?: Pick<ResolveOpts, "platform" | "arch" | "libc" | "avx2">,
): string[];
export function resolveBun(
  opts: ResolveOpts & { packageRoot: string },
): { kind: "path" | "bundled"; bin: string } | null;

export function isPidAlive(pid: number): boolean;
export function lockOwnerPath(lockDir: string): string;
export function writeLockOwner(
  lockDir: string,
  opts?: { pid?: number; host?: string; now?: number },
): { pid: number; host: string; started: number };
export function readLockOwner(lockDir: string): { pid?: number; host?: string } | null;
export function isLockOwnerDead(lockDir: string, opts?: { host?: string }): boolean;
export function lockWaitMs(timeoutMs?: number, staleMs?: number): number;
export function acquireLock(
  lockDir: string,
  opts?: {
    timeoutMs?: number;
    staleMs?: number;
    pollMs?: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    mkdir?: (p: string) => void;
    rm?: (p: string) => void;
    stat?: (p: string) => { mtimeMs?: number; mtime?: Date };
    onWait?: () => void;
    pid?: number;
    host?: string;
  },
): Promise<boolean>;
export function releaseLock(lockDir: string): void;
export function sweepStaleTempDirs(runtimeDir: string, opts?: { staleMs?: number }): string[];
export function sweepNpmPackTemps(base?: string): string[];
export function verifyIntegrity(buf: Buffer, integrity: string): void;
export function extractNpmTgz(buf: Buffer, dest: string): void;
export function runNpmAsync(
  args: string[],
  opts?: {
    env?: NodeJS.ProcessEnv;
    cwd?: string;
    timeoutMs?: number;
    onChild?: (child: import("node:child_process").ChildProcess) => void;
  },
): Promise<{
  status: number | null;
  stdout: string;
  stderr: string;
  error?: NodeJS.ErrnoException;
}>;
export function packOvenBunWithNpm(opts: {
  env?: NodeJS.ProcessEnv;
  platform?: string;
  arch?: string;
  libc?: string;
  version?: string;
  timeoutMs?: number;
  dest?: string;
  pid?: number;
  runNpm?: (
    args: string[],
    opts: {
      env?: NodeJS.ProcessEnv;
      cwd?: string;
      timeoutMs?: number;
      onChild?: (child: import("node:child_process").ChildProcess) => void;
    },
  ) => unknown;
  state?: { npmChild?: import("node:child_process").ChildProcess | null };
}): Promise<{ id: string; version: string; buf: Buffer; integrity: string }>;
export function fetchOvenBunTarball(opts: {
  env?: NodeJS.ProcessEnv;
  platform?: string;
  arch?: string;
  libc?: string;
  version?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  cwd?: string;
  home?: string;
  skipFiles?: boolean;
  dest?: string;
  avx2?: boolean;
  state?: { npmChild?: import("node:child_process").ChildProcess | null };
}): Promise<{ id: string; version: string; buf: Buffer; integrity: string }>;
export function installOvenBun(
  packageRoot: string,
  opts?: {
    env?: NodeJS.ProcessEnv;
    platform?: string;
    arch?: string;
    libc?: string;
    timeoutMs?: number;
    fetch?: typeof fetch;
    cwd?: string;
    state?: { tmp: string | null; npmChild?: import("node:child_process").ChildProcess | null };
  },
): Promise<void>;
export function ensureBun(opts: ResolveOpts & { packageRoot: string }): Promise<string | null>;
