export const BUN_FETCH_VERSION: string;

export function installerIsBun(env?: NodeJS.ProcessEnv): boolean;
export function missingBunMessage(): string;
export function defaultExecutableNames(platform?: NodeJS.Platform): string[];
export function ovenPackageIds(
  platform?: NodeJS.Platform | string,
  arch?: string,
): { ids: string[]; exe: string };

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
  platform?: NodeJS.Platform | string;
  arch?: string;
  executableNames?: string[];
  exists?: (p: string) => boolean;
  isUsableBun?: (p: string) => boolean;
  env?: NodeJS.ProcessEnv;
  installIfMissing?: boolean;
  installBun?: (opts: {
    packageRoot: string;
    env: NodeJS.ProcessEnv;
    version: string;
  }) => void | Promise<void>;
};

export function pathBunCandidates(
  opts: Pick<ResolveOpts, "pathEnv" | "pathSep" | "platform" | "executableNames">,
): string[];
export function bundledBunCandidates(
  packageRoot: string,
  opts?: Pick<ResolveOpts, "platform" | "arch">,
): string[];
export function resolveBun(
  opts: ResolveOpts & { packageRoot: string },
): { kind: "path" | "bundled"; bin: string } | null;
export function installBunPackage(
  packageRoot: string,
  env?: NodeJS.ProcessEnv,
  version?: string,
): void;
export function ensureBun(opts: ResolveOpts & { packageRoot: string }): Promise<string | null>;
