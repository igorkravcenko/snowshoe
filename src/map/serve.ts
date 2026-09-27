import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CliError, EXIT_INTERNAL, EXIT_USAGE } from "../errors.ts";
import { gitHead } from "../git.ts";
import { envelope } from "../json.ts";
import { findRepoRoot, requireInitialized } from "../paths.ts";
import { handleMapHttp } from "./http.ts";

export function snowshoePackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

export function mapUiDistDir(packageRoot = snowshoePackageRoot()): string {
  return join(packageRoot, "ui", "dist");
}

export function mapUiConfigPath(packageRoot = snowshoePackageRoot()): string {
  return join(packageRoot, "ui", "vite.config.ts");
}

export async function ensureMapUiBuilt(packageRoot = snowshoePackageRoot()): Promise<void> {
  const distHtml = join(mapUiDistDir(packageRoot), "index.html");
  if (existsSync(distHtml)) return;
  const config = mapUiConfigPath(packageRoot);
  if (!existsSync(config)) {
    throw new CliError(`Map UI config missing at ${config}`, EXIT_INTERNAL);
  }
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
  stop: () => void;
};

export async function startMapServer(opts: {
  cwd?: string;
  port?: number;
  hostname?: string;
  open?: boolean;
  buildUi?: boolean;
  packageRoot?: string;
}): Promise<MapServer> {
  const cwd = opts.cwd ?? process.cwd();
  const repoRoot = findRepoRoot(cwd);
  requireInitialized(repoRoot);
  const packageRoot = opts.packageRoot ?? snowshoePackageRoot();
  if (opts.buildUi !== false) {
    await ensureMapUiBuilt(packageRoot);
  }
  const uiDist = mapUiDistDir(packageRoot);
  const hostname = opts.hostname ?? "127.0.0.1";
  const requestedPort = opts.port ?? 8787;

  let queue: Promise<unknown> = Promise.resolve();
  const runSerialized = (fn: () => Promise<Response>): Promise<Response> => {
    const run = queue.then(fn, fn);
    queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const server = Bun.serve({
    hostname,
    port: requestedPort,
    fetch(req) {
      return runSerialized(() => handleMapHttp(req, { cwd: repoRoot, uiDist }));
    },
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
    stop: () => server.stop(true),
  };
}

export async function runMapServe(opts: {
  port?: number;
  host?: string;
  open?: boolean;
}): Promise<{ exitCode: number; body: Record<string, unknown>; server: MapServer }> {
  const portRaw = opts.port;
  if (portRaw !== undefined && (!Number.isInteger(portRaw) || portRaw < 0 || portRaw > 65535)) {
    throw new CliError("--port must be an integer 0–65535 (0 = ephemeral)", EXIT_USAGE);
  }
  const cwd = process.cwd();
  const repoRoot = findRepoRoot(cwd);
  const server = await startMapServer({
    cwd,
    port: portRaw,
    hostname: opts.host ?? "127.0.0.1",
    open: Boolean(opts.open),
  });
  const body = envelope("map.serve", repoRoot, gitHead(repoRoot), {
    ok: true,
    url: server.url,
    port: server.port,
    hostname: server.hostname,
    hint: "Dumb map UI. Mutations: POST /api/map/detail/mark|cancel. Reload in the UI after skill work.",
  });
  return { exitCode: 0, body, server };
}
