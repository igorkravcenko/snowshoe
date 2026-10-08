import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_MAP_EXPAND_DEPTH } from "../domain/types.ts";
import { CliError, EXIT_INTERNAL, EXIT_USAGE } from "../errors.ts";
import { gitHead } from "../git.ts";
import { envelope } from "../json.ts";
import { findRepoRoot, snowshoePackageRoot } from "../paths.ts";
import { handleMapHttp } from "./http.ts";
import { isLoopbackHost } from "./loopback.ts";
import { mapPtyWebsocket, type PtyWsData, tryUpgradeMapPty } from "./pty.ts";
import { createMapViewStore } from "./views.ts";

export { snowshoePackageRoot };

/** Default `map serve` port (avoids Wrangler's common 8787). */
export const DEFAULT_MAP_PORT = 3232;

export function mapUiDistDir(packageRoot = snowshoePackageRoot()): string {
  return join(packageRoot, "ui", "dist");
}

export function mapUiConfigPath(packageRoot = snowshoePackageRoot()): string {
  return join(packageRoot, "ui", "vite.config.ts");
}

function mapUiDistHtml(packageRoot: string): string {
  return join(mapUiDistDir(packageRoot), "index.html");
}

function maxMtime(path: string): number {
  const st = statSync(path);
  if (!st.isDirectory()) return st.mtimeMs;
  let max = 0;
  for (const name of readdirSync(path)) {
    if (name === "dist" || name === "node_modules") continue;
    max = Math.max(max, maxMtime(join(path, name)));
  }
  return max;
}

/**
 * Production `ui/dist` is present (not a Vite-dev index that points at /src/main.tsx).
 * npm pack pins tarball mtimes to 1985-10-26; bun/npm install then rewrite mtimes in
 * extract order, so sources can look newer than dist. Do not use mtimes here.
 */
export function isMapUiDistReady(packageRoot = snowshoePackageRoot()): boolean {
  const distHtml = mapUiDistHtml(packageRoot);
  if (!existsSync(distHtml)) return false;
  return !readFileSync(distHtml, "utf8").includes("/src/main.tsx");
}

/**
 * Contributor checkout after `bun install` (or `bun link` of that checkout).
 * Installed packages never have Vite: it is a devDependency. Resolution must not
 * walk parent `node_modules` (a global Vite would look "resolvable").
 */
export function canRebuildMapUi(packageRoot = snowshoePackageRoot()): boolean {
  return (
    existsSync(mapUiConfigPath(packageRoot)) &&
    existsSync(join(packageRoot, "node_modules", "vite"))
  );
}

/** True when index.html is missing or older than UI sources / Vite config / package.json. */
export function isMapUiDistStale(packageRoot = snowshoePackageRoot()): boolean {
  const distHtml = mapUiDistHtml(packageRoot);
  if (!existsSync(distHtml)) return true;
  if (readFileSync(distHtml, "utf8").includes("/src/main.tsx")) return true;
  const distTime = statSync(distHtml).mtimeMs;
  const inputs = [
    join(packageRoot, "ui", "src"),
    join(packageRoot, "ui", "index.html"),
    join(packageRoot, "ui", "vite.config.ts"),
    join(packageRoot, "package.json"),
  ];
  return inputs.some((p) => existsSync(p) && maxMtime(p) > distTime);
}

export async function ensureMapUiBuilt(packageRoot = snowshoePackageRoot()): Promise<void> {
  if (!canRebuildMapUi(packageRoot)) {
    if (isMapUiDistReady(packageRoot)) return;
    throw new CliError(
      "Map UI dist is missing from this install. Reinstall @igorkravcenko/snowshoe, " +
        "or from a clone run `bun install` then `bun run build:ui`.",
      EXIT_INTERNAL,
    );
  }
  if (!isMapUiDistStale(packageRoot)) return;
  const proc = Bun.spawnSync(["bun", "run", "build:ui"], {
    cwd: packageRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    const err = proc.stderr.toString() || proc.stdout.toString();
    throw new CliError(`Failed to build map UI:\n${err}`, EXIT_INTERNAL);
  }
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    Bun.spawn([cmd, ...args], {
      stdout: "ignore",
      stderr: "ignore",
      stdin: "ignore",
    });
  } catch {
    // Opening the system browser is best-effort; the server still runs.
  }
}

export type MapServer = {
  url: string;
  port: number;
  hostname: string;
  packageRoot: string;
  uiDist: string;
  stop: () => void;
};

export function parseMapExpandDepth(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") return DEFAULT_MAP_EXPAND_DEPTH;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new CliError("--expand-depth must be an integer >= 0", EXIT_USAGE);
  }
  return n;
}

export async function startMapServer(opts: {
  cwd?: string;
  port?: number;
  hostname?: string;
  open?: boolean;
  buildUi?: boolean;
  packageRoot?: string;
  expandDepth?: number;
}): Promise<MapServer> {
  const cwd = opts.cwd ?? process.cwd();
  const repoRoot = findRepoRoot(cwd);
  const packageRoot = opts.packageRoot ?? snowshoePackageRoot();
  if (opts.buildUi !== false) {
    await ensureMapUiBuilt(packageRoot);
  }
  const uiDist = mapUiDistDir(packageRoot);
  const hostname = opts.hostname ?? "127.0.0.1";
  if (!isLoopbackHost(hostname)) {
    throw new CliError(
      `--host must be loopback (127.0.0.1, localhost, ::1); got ${hostname}`,
      EXIT_USAGE,
    );
  }
  const requestedPort = opts.port ?? DEFAULT_MAP_PORT;
  const expandDepth = opts.expandDepth ?? DEFAULT_MAP_EXPAND_DEPTH;
  const views = createMapViewStore();

  let queue: Promise<unknown> = Promise.resolve();
  const runSerialized = (fn: () => Promise<Response>): Promise<Response> => {
    const run = queue.then(fn, fn);
    queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const server = Bun.serve<PtyWsData>({
    hostname,
    port: requestedPort,
    fetch(req, srv) {
      const pty = tryUpgradeMapPty(req, srv, repoRoot);
      if (pty) return pty;
      if (new URL(req.url).pathname === "/api/pty") return;
      return runSerialized(() =>
        handleMapHttp(req, { cwd: repoRoot, uiDist, expandDepth, packageRoot, views }),
      );
    },
    websocket: mapPtyWebsocket,
  });

  const boundPort = server.port;
  if (typeof boundPort !== "number") {
    server.stop(true);
    throw new CliError("map serve failed to bind a port", EXIT_INTERNAL);
  }

  const url = `http://${hostname}:${boundPort}/`;
  if (opts.open) openBrowser(url);

  return {
    url,
    port: boundPort,
    hostname,
    packageRoot,
    uiDist,
    stop: () => server.stop(true),
  };
}

export async function runMapServe(opts: {
  port?: number;
  host?: string;
  open?: boolean;
  expandDepth?: number;
}): Promise<{ exitCode: number; body: Record<string, unknown>; server: MapServer }> {
  const portRaw = opts.port;
  if (portRaw !== undefined && (!Number.isInteger(portRaw) || portRaw < 0 || portRaw > 65535)) {
    throw new CliError("--port must be an integer 0–65535 (0 = ephemeral)", EXIT_USAGE);
  }
  const expandDepth = opts.expandDepth ?? DEFAULT_MAP_EXPAND_DEPTH;
  const cwd = process.cwd();
  const repoRoot = findRepoRoot(cwd);
  const server = await startMapServer({
    cwd,
    port: portRaw,
    hostname: opts.host ?? "127.0.0.1",
    open: Boolean(opts.open),
    expandDepth,
  });
  const body = envelope("map.serve", repoRoot, gitHead(repoRoot), {
    ok: true,
    url: server.url,
    port: server.port,
    hostname: server.hostname,
    expandDepth,
    packageRoot: server.packageRoot,
    uiDist: server.uiDist,
    hint: "Mapped repo is cwd. UI is uiDist. GET /api/view/:id is RAM focus. Loopback-peer PTY at /api/pty.",
  });
  return { exitCode: 0, body, server };
}
