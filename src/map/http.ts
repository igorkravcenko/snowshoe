import { existsSync, statSync } from "node:fs";
import { extname, join, normalize, relative, resolve, sep } from "node:path";
import { runMapDetailCancel, runMapDetailMark, runMapStatus } from "../commands/map.ts";
import { withSession } from "../commands/session.ts";
import { CliError, EXIT_ATTENTION, EXIT_INTERNAL, EXIT_OK, EXIT_USAGE } from "../errors.ts";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

export type MapHttpOptions = {
  cwd: string;
  uiDist: string;
};

function httpStatusForExit(code: number): number {
  if (code === EXIT_OK) return 200;
  if (code === EXIT_ATTENTION) return 409;
  if (code === EXIT_USAGE) return 400;
  if (code === EXIT_INTERNAL) return 500;
  return 500;
}

function jsonResponse(body: unknown, exitCode: number): Response {
  return new Response(`${JSON.stringify(body, null, 2)}\n`, {
    status: httpStatusForExit(exitCode),
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function errorResponse(err: unknown): Response {
  if (err instanceof CliError) {
    return jsonResponse(
      {
        schemaVersion: 1,
        ok: false,
        error: err.message,
        ...err.body,
      },
      err.exitCode,
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  return jsonResponse({ schemaVersion: 1, ok: false, error: message }, EXIT_INTERNAL);
}

async function readSlug(req: Request, url: URL): Promise<string> {
  const fromQuery = url.searchParams.get("slug");
  if (fromQuery) return fromQuery;
  const text = await req.text();
  if (!text.trim()) return "";
  try {
    const parsed = JSON.parse(text) as { slug?: unknown };
    return typeof parsed.slug === "string" ? parsed.slug : "";
  } catch {
    throw new CliError("Invalid JSON body (expected { slug })", EXIT_USAGE);
  }
}

/**
 * HTTP twins of `snowshoe map status|detail mark|cancel`.
 * GET /api/map/status returns the same JSON as `snowshoe map status --json`.
 * GET /api/session is UI-only (repoRoot for editor links); not part of the map read-model.
 */
export async function handleMapHttp(req: Request, opts: MapHttpOptions): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  try {
    if (path === "/api/map/status" && req.method === "GET") {
      return withSession((s) => {
        const result = runMapStatus(s);
        return jsonResponse(result.body, result.exitCode);
      }, opts.cwd);
    }

    if (path === "/api/session" && req.method === "GET") {
      return withSession(
        (s) =>
          jsonResponse(
            {
              repoRoot: s.repoRoot,
              gitHead: s.gitHead,
            },
            EXIT_OK,
          ),
        opts.cwd,
      );
    }

    if (path === "/api/map/detail/mark" && req.method === "POST") {
      const slug = await readSlug(req, url);
      return withSession((s) => {
        const result = runMapDetailMark(s, slug);
        return jsonResponse(result.body, result.exitCode);
      }, opts.cwd);
    }

    if (path === "/api/map/detail/cancel" && req.method === "POST") {
      const slug = await readSlug(req, url);
      return withSession((s) => {
        const result = runMapDetailCancel(s, slug);
        return jsonResponse(result.body, result.exitCode);
      }, opts.cwd);
    }

    if (path.startsWith("/api/")) {
      return jsonResponse(
        { schemaVersion: 1, ok: false, error: `Unknown API route ${req.method} ${path}` },
        EXIT_USAGE,
      );
    }
  } catch (err) {
    return errorResponse(err);
  }

  return serveUiAsset(path, opts.uiDist);
}

function safeDistFile(uiDist: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split("?")[0] ?? "");
  const rel = decoded === "/" || decoded === "" ? "index.html" : decoded.replace(/^\//, "");
  if (rel.includes("\0") || rel.startsWith("/") || rel.includes("..")) {
    const abs = resolve(uiDist, rel);
    const root = resolve(uiDist);
    const fromRoot = relative(root, abs);
    if (
      fromRoot.startsWith("..") ||
      fromRoot.startsWith(`..${sep}`) ||
      normalize(fromRoot) === ".."
    ) {
      return null;
    }
    return abs;
  }
  const abs = resolve(uiDist, rel);
  const root = resolve(uiDist);
  if (relative(root, abs).startsWith("..")) return null;
  return abs;
}

function serveUiAsset(urlPath: string, uiDist: string): Response {
  if (!existsSync(uiDist)) {
    return jsonResponse(
      {
        schemaVersion: 1,
        ok: false,
        error: "Map UI is not built. Run `bun run build:ui` or restart `snowshoe map serve`.",
      },
      EXIT_INTERNAL,
    );
  }

  let file = safeDistFile(uiDist, urlPath);
  if (!file) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!existsSync(file) || statSync(file).isDirectory()) {
    const index = join(uiDist, "index.html");
    if (existsSync(index) && !urlPath.startsWith("/assets/")) {
      file = index;
    } else {
      return new Response("Not found", { status: 404 });
    }
  }

  const bytes = Bun.file(file);
  const type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
  return new Response(bytes, {
    headers: {
      "content-type": type,
      "cache-control":
        urlPath === "/" || file.endsWith("index.html") ? "no-store" : "public, max-age=60",
    },
  });
}
