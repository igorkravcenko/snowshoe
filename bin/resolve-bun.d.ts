export const BUN_FETCH_VERSION: string;
export const BUN_FETCH_TIMEOUT_MS: number;
export const BUN_LOCK_STALE_MS: number;
export const RUNTIME_DIRNAME: ".runtime";
export const MIN_NODE_MAJOR: 18;

export function nodeMajor(version?: string): number;
export function nodeEngineOk(version?: string): boolean;
export function nodeEngineMessage(version?: string): string;
export function installerIsBun(env?: NodeJS.ProcessEnv): boolean;
export function missingBunMessage(): string;
export function permissionDeniedMessage(runtimePath: string): string;
export function defaultExecutableNames(platform?: NodeJS.Platform | string): string[];
export function detectLibc(platform?: NodeJS.Platform | string): "glibc" | "musl" | undefined;
export function ovenPackageIds(
  platform?: NodeJS.Platform | string,
  arch?: string,
  libc?: string,
): { ids: string[]; exe: string };
export function runtimeRoot(packageRoot: string): string;
export function runtimeCurrent(packageRoot: string): string;
export function registryBase(env?: NodeJS.ProcessEnv): string;
export function formatFetchReason(err: unknown, timeoutMs?: number): string;

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
  opts?: Pick<ResolveOpts, "platform" | "arch" | "libc">,
): string[];
export function resolveBun(
  opts: ResolveOpts & { packageRoot: string },
): { kind: "path" | "bundled"; bin: string } | null;

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
  },
): Promise<boolean>;
export function releaseLock(lockDir: string): void;
export function verifyIntegrity(buf: Buffer, integrity: string): void;
export function extractNpmTgz(buf: Buffer, dest: string): void;
export function fetchOvenBunTarball(opts: {
  env?: NodeJS.ProcessEnv;
  platform?: string;
  arch?: string;
  libc?: string;
  version?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
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
  },
): Promise<void>;
export function ensureBun(opts: ResolveOpts & { packageRoot: string }): Promise<string | null>;
