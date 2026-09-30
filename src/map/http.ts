import { existsSync, statSync } from "node:fs";
import { extname, join, normalize, relative, resolve, sep } from "node:path";
import { runFeedbackList } from "../commands/feedback.ts";
import {
  parseMapStatusOpts,
  runMapDetailCancel,
  runMapDetailMark,
  runMapStatus,
} from "../commands/map.ts";
import { mapEpochAnchor, refreshRequired, withSession } from "../commands/session.ts";
import { DEFAULT_MAP_EXPAND_DEPTH } from "../domain/types.ts";
import { CliError, EXIT_ATTENTION, EXIT_INTERNAL, EXIT_OK, EXIT_USAGE } from "../errors.ts";
import { findRepoRoot, requireInitialized } from "../paths.ts";
import { FileReadError, readRepoFile } from "./file-read.ts";
import type { MapViewStore } from "./views.ts";

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
  expandDepth?: number;
  packageRoot?: string;
  views?: MapViewStore;
};

function httpStatusForExit(code: number): number {
  if (code === EXIT_OK) return 200;
  if (code === EXIT_ATTENTION) return 409;
  if (code === EXIT_USAGE) return 400;
  if (code === EXIT_INTERNAL) return 500;
  return 500;
}

function jsonHttp(body: unknown, status: number): Response {
  return new Response(`${JSON.stringify(body, null, 2)}\n`, {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function jsonResponse(body: unknown, exitCode: number): Response {
  return jsonHttp(body, httpStatusForExit(exitCode));
}

function errorResponse(err: unknown): Response {
  if (err instanceof FileReadError) {
    return jsonHttp({ schemaVersion: 1, ok: false, error: err.message }, err.status);
  }
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

function queryInt(url: URL, name: string): number | undefined {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n)) {
    throw new FileReadError(`${name} must be a positive integer`, 400);
  }
  return n;
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
 * GET /api/map/status returns the same JSON as `snowshoe map status --json`
 * (`fields`, `slug`, `depth`, `neighborhood`, `allFields` / `all-fields`).
 * GET /api/session is UI-only (repoRoot / gitHead / mapAnchor / locale); not part of the map read-model.
 * GET /api/file is a read-only repo-root sandbox (no ledger writes).
 * GET /api/feedback is a twin of `snowshoe feedback list --json` (dev inbox; not the map).
 */
export async function handleMapHttp(req: Request, opts: MapHttpOptions): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  try {
    if (path === "/api/file" && req.method === "GET") {
      const repoRoot = findRepoRoot(opts.cwd);
      requireInitialized(repoRoot);
      const result = readRepoFile(repoRoot, url.searchParams.get("path") ?? "", {
        start: queryInt(url, "start"),
        end: queryInt(url, "end"),
      });
      return jsonHttp({ schemaVersion: 1, ...result }, 200);
    }

    if (path === "/api/map/status" && req.method === "GET") {
      return withSession((s) => {
        const result = runMapStatus(
          s,
          parseMapStatusOpts({
            fields: url.searchParams.get("fields") ?? undefined,
            slug: url.searchParams.get("slug") ?? undefined,
            depth: url.searchParams.get("depth") ?? undefined,
            neighborhood: url.searchParams.has("neighborhood")
              ? (url.searchParams.get("neighborhood") ?? "")
              : undefined,
            allFields: url.searchParams.has("allFields")
              ? (url.searchParams.get("allFields") ?? "")
              : url.searchParams.has("all-fields")
                ? (url.searchParams.get("all-fields") ?? "")
                : undefined,
          }),
        );
        return jsonResponse(result.body, result.exitCode);
      }, opts.cwd);
    }

    if (path === "/api/feedback" && req.method === "GET") {
      const result = runFeedbackList(opts.cwd);
      return jsonResponse(result.body, result.exitCode);
    }

    if (path === "/api/session" && req.method === "GET") {
      return withSession(
        (s) =>
          jsonResponse(
            {
              repoRoot: s.repoRoot,
              gitHead: s.gitHead,
              mapAnchor: mapEpochAnchor(s),
              refreshRequired: refreshRequired(s),
              locale: s.ledger.getMeta("locale"),
              expandDepth: opts.expandDepth ?? DEFAULT_MAP_EXPAND_DEPTH,
              packageRoot: opts.packageRoot ?? null,
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

    if (path === "/api/view" && req.method === "POST") {
      if (!opts.views) {
        return jsonResponse(
          { schemaVersion: 1, ok: false, error: "Map views are not available" },
          EXIT_INTERNAL,
        );
      }
      const id = opts.views.create();
      const repoRoot = findRepoRoot(opts.cwd);
      return jsonHttp({ schemaVersion: 1, ok: true, id, slug: null, repoRoot }, 200);
    }

    const viewId = path.startsWith("/api/view/") ? path.slice("/api/view/".length) : "";
    if (viewId && !viewId.includes("/")) {
      if (!opts.views) {
        return jsonResponse(
          { schemaVersion: 1, ok: false, error: "Map views are not available" },
          EXIT_INTERNAL,
        );
      }
      if (req.method === "GET") {
        const rec = opts.views.get(viewId);
        if (!rec) {
          return jsonHttp({ schemaVersion: 1, ok: false, error: "Unknown view id" }, 404);
        }
        const repoRoot = findRepoRoot(opts.cwd);
        return jsonHttp({ schemaVersion: 1, ok: true, id: viewId, slug: rec.slug, repoRoot }, 200);
      }
      if (req.method === "PUT") {
        const text = await req.text();
        let slug: string | null;
        try {
          const parsed = JSON.parse(text) as { slug?: unknown };
          if (parsed.slug === null) slug = null;
          else if (typeof parsed.slug === "string") slug = parsed.slug;
          else throw new Error("bad slug");
        } catch {
          throw new CliError("Invalid JSON body (expected { slug })", EXIT_USAGE);
        }
        const rec = opts.views.put(viewId, slug);
        if (!rec) {
          return jsonHttp({ schemaVersion: 1, ok: false, error: "Unknown view id" }, 404);
        }
        return jsonHttp({ schemaVersion: 1, ok: true, id: viewId, slug: rec.slug }, 200);
      }
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

function isSpaIndexFallback(urlPath: string): boolean {
  if (urlPath.startsWith("/assets/") || urlPath.startsWith("/src/")) return false;
  if (/\.(js|mjs|cjs|ts|tsx|css|map|json)$/i.test(urlPath)) return false;
  return true;
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
    if (existsSync(index) && isSpaIndexFallback(urlPath)) {
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
      "cache-control": "no-store",
    },
  });
}
