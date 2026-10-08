import { existsSync, statSync } from "node:fs";
import { extname, join, normalize, relative, resolve, sep } from "node:path";
import { runFeedbackAdd, runFeedbackList, runFeedbackRemove } from "../commands/feedback.ts";
import {
  metricUpdatesFromBody,
  parseLeafFlag,
  parseMapStatusOpts,
  runMapDetailCancel,
  runMapDetailMark,
  runMapInboxRead,
  runMapInboxReadAll,
  runMapMark,
  runMapMetric,
  runMapSetLeaf,
  runMapStatus,
  runMapUnmark,
} from "../commands/map.ts";
import { mapEpochAnchor, refreshRequired, withSession } from "../commands/session.ts";
import { DEFAULT_MAP_EXPAND_DEPTH } from "../domain/types.ts";
import { CliError, EXIT_ATTENTION, EXIT_INTERNAL, EXIT_OK, EXIT_USAGE } from "../errors.ts";
import { gitHead } from "../git.ts";
import {
  findRepoRoot,
  isInitialized,
  requireInitialized,
  UNINITIALIZED_CTA,
  UNINITIALIZED_HINT,
} from "../paths.ts";
import {
  isJsonContentType,
  mapAccessTokenFromHttpRequest,
  mapAccessTokensEqual,
  mutationRequiresJsonContentType,
} from "./access-token.ts";
import { FileReadError, readRepoFile } from "./file-read.ts";
import { isAllowedMapOrigin, loopbackHostHeaderOrError } from "./loopback.ts";
import { withMapSecurityHeaders } from "./security-headers.ts";
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
  /** Per-launch secret; required on every `/api/*` route. */
  accessToken: string;
  /** Actually bound port — Origin allowlist is exact for this port. */
  port: number;
};

function httpStatusForExit(code: number): number {
  if (code === EXIT_OK) return 200;
  if (code === EXIT_ATTENTION) return 409;
  if (code === EXIT_USAGE) return 400;
  if (code === EXIT_INTERNAL) return 500;
  return 500;
}

function jsonHttp(body: unknown, status: number, port: number): Response {
  return new Response(`${JSON.stringify(body, null, 2)}\n`, {
    status,
    headers: withMapSecurityHeaders(
      {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
      { port, html: false },
    ),
  });
}

function jsonResponse(body: unknown, exitCode: number, port: number): Response {
  return jsonHttp(body, httpStatusForExit(exitCode), port);
}

function uninitializedHintBody(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    ok: true,
    initialized: false,
    hint: UNINITIALIZED_HINT,
    cta: UNINITIALIZED_CTA,
    ...extra,
  };
}

function errorResponse(err: unknown, port: number): Response {
  if (err instanceof FileReadError) {
    return jsonHttp({ schemaVersion: 1, ok: false, error: err.message }, err.status, port);
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
      port,
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  return jsonResponse({ schemaVersion: 1, ok: false, error: message }, EXIT_INTERNAL, port);
}

function asHead(req: Request, res: Response): Response {
  if (req.method !== "HEAD") return res;
  return new Response(null, { status: res.status, headers: res.headers });
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

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new CliError("Invalid JSON body (expected object)", EXIT_USAGE);
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    if (err instanceof CliError) throw err;
    throw new CliError("Invalid JSON body", EXIT_USAGE);
  }
}

async function readSlug(req: Request, url: URL): Promise<string> {
  const fromQuery = url.searchParams.get("slug");
  if (fromQuery) return fromQuery;
  const parsed = await readJsonBody(req);
  return typeof parsed.slug === "string" ? parsed.slug : "";
}

/**
 * HTTP twins of `snowshoe map status|mark|unmark|leaf|metric` and `map detail mark|cancel`.
 * GET /api/map/status returns the same JSON as `snowshoe map status --json`
 * (`fields`, `slug`, `depth`, `neighborhood`, `allFields` / `all-fields`).
 * GET /api/session is UI-only (repoRoot / gitHead / mapAnchor / locale); not part of the map read-model.
 * GET /api/file is a read-only repo-root sandbox (no ledger writes).
 * GET /api/feedback is a twin of `snowshoe feedback list --json` (dev inbox; not the map).
 * POST /api/feedback twins `feedback add`; DELETE /api/feedback?id= twins `feedback remove`.
 */
export async function handleMapHttp(req: Request, opts: MapHttpOptions): Promise<Response> {
  return asHead(req, await handleMapHttpBody(req, opts));
}

async function handleMapHttpBody(req: Request, opts: MapHttpOptions): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method === "HEAD" ? "GET" : req.method;
  const port = opts.port;

  try {
    if (path.startsWith("/api/")) {
      if (!loopbackHostHeaderOrError(req)) {
        return jsonHttp(
          { schemaVersion: 1, ok: false, error: "Map API requires a loopback Host header" },
          403,
          port,
        );
      }
      const origin = req.headers.get("origin");
      if (origin !== null && origin !== "" && !isAllowedMapOrigin(origin, opts.port)) {
        return jsonHttp(
          {
            schemaVersion: 1,
            ok: false,
            error: "Map API requires Origin matching this map server",
          },
          403,
          port,
        );
      }
      const site = req.headers.get("sec-fetch-site");
      if (site?.toLowerCase() === "cross-site") {
        return jsonHttp(
          { schemaVersion: 1, ok: false, error: "Map API rejects cross-site fetch" },
          403,
          port,
        );
      }
      const offered = mapAccessTokenFromHttpRequest(req);
      if (!offered || !mapAccessTokensEqual(offered, opts.accessToken)) {
        return jsonHttp(
          { schemaVersion: 1, ok: false, error: "Map API requires a valid access token" },
          401,
          port,
        );
      }
      if (mutationRequiresJsonContentType(req.method, req) && !isJsonContentType(req)) {
        return jsonHttp(
          {
            schemaVersion: 1,
            ok: false,
            error: "Map API mutations require Content-Type: application/json",
          },
          415,
          port,
        );
      }
    }

    if (path === "/api/file" && method === "GET") {
      const repoRoot = findRepoRoot(opts.cwd);
      requireInitialized(repoRoot);
      const result = readRepoFile(repoRoot, url.searchParams.get("path") ?? "", {
        start: queryInt(url, "start"),
        end: queryInt(url, "end"),
        span: queryInt(url, "span"),
        locatorOffset: queryInt(url, "locatorOffset"),
        lineText: url.searchParams.get("lineText") ?? undefined,
      });
      return jsonHttp({ schemaVersion: 1, ...result }, 200, port);
    }

    if (path === "/api/map/status" && method === "GET") {
      const repoRoot = findRepoRoot(opts.cwd);
      if (!isInitialized(repoRoot)) {
        return jsonHttp(
          uninitializedHintBody({
            rootSlug: "root",
            nodes: [],
            repoRoot,
            gitHead: gitHead(repoRoot),
          }),
          200,
          port,
        );
      }
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
        return jsonResponse({ ...result.body, initialized: true }, result.exitCode, port);
      }, opts.cwd);
    }

    if (path === "/api/feedback" && method === "GET") {
      const result = runFeedbackList(opts.cwd);
      return jsonResponse(result.body, result.exitCode, port);
    }

    if (path === "/api/feedback" && req.method === "POST") {
      const body = await readJsonBody(req);
      const result = runFeedbackAdd(opts.cwd, body);
      return jsonResponse(result.body, result.exitCode, port);
    }

    if (path === "/api/feedback" && req.method === "DELETE") {
      const id = url.searchParams.get("id") ?? "";
      const result = runFeedbackRemove(opts.cwd, id);
      return jsonResponse(result.body, result.exitCode, port);
    }

    if (path === "/api/session" && method === "GET") {
      const repoRoot = findRepoRoot(opts.cwd);
      if (!isInitialized(repoRoot)) {
        return jsonHttp(
          uninitializedHintBody({
            repoRoot,
            gitHead: gitHead(repoRoot),
            mapAnchor: null,
            refreshRequired: false,
            locale: null,
            expandDepth: opts.expandDepth ?? DEFAULT_MAP_EXPAND_DEPTH,
            packageRoot: opts.packageRoot ?? null,
          }),
          200,
          port,
        );
      }
      return withSession(
        (s) =>
          jsonResponse(
            {
              initialized: true,
              repoRoot: s.repoRoot,
              gitHead: s.gitHead,
              mapAnchor: mapEpochAnchor(s),
              refreshRequired: refreshRequired(s),
              locale: s.ledger.getMeta("locale"),
              expandDepth: opts.expandDepth ?? DEFAULT_MAP_EXPAND_DEPTH,
              packageRoot: opts.packageRoot ?? null,
            },
            EXIT_OK,
            port,
          ),
        opts.cwd,
      );
    }

    if (path === "/api/map/mark" && req.method === "POST") {
      const body = await readJsonBody(req);
      const slug = url.searchParams.get("slug") || (typeof body.slug === "string" ? body.slug : "");
      const kind = url.searchParams.get("kind") ?? body.kind ?? "detail";
      return withSession((s) => {
        const result = runMapMark(s, slug, kind);
        return jsonResponse(result.body, result.exitCode, port);
      }, opts.cwd);
    }

    if (path === "/api/map/unmark" && req.method === "POST") {
      const body = await readJsonBody(req);
      const slug = url.searchParams.get("slug") || (typeof body.slug === "string" ? body.slug : "");
      const kind = url.searchParams.get("kind") ?? body.kind;
      return withSession((s) => {
        const result = runMapUnmark(s, slug, kind);
        return jsonResponse(result.body, result.exitCode, port);
      }, opts.cwd);
    }

    if (path === "/api/map/inbox/read" && req.method === "POST") {
      const body = await readJsonBody(req);
      const slug = url.searchParams.get("slug") || (typeof body.slug === "string" ? body.slug : "");
      return withSession((s) => {
        const result = runMapInboxRead(s, slug);
        return jsonResponse(result.body, result.exitCode, port);
      }, opts.cwd);
    }

    if (path === "/api/map/inbox/read-all" && req.method === "POST") {
      return withSession((s) => {
        const result = runMapInboxReadAll(s);
        return jsonResponse(result.body, result.exitCode, port);
      }, opts.cwd);
    }

    if (path === "/api/map/leaf" && req.method === "POST") {
      const body = await readJsonBody(req);
      const slug = url.searchParams.get("slug") || (typeof body.slug === "string" ? body.slug : "");
      const leafRaw = url.searchParams.get("leaf") ?? body.leaf;
      return withSession((s) => {
        const result = runMapSetLeaf(s, slug, parseLeafFlag(leafRaw));
        return jsonResponse(result.body, result.exitCode, port);
      }, opts.cwd);
    }

    if (path === "/api/map/metric" && req.method === "POST") {
      const body = await readJsonBody(req);
      const slug = url.searchParams.get("slug") || (typeof body.slug === "string" ? body.slug : "");
      return withSession((s) => {
        const result = runMapMetric(s, slug, metricUpdatesFromBody(body));
        return jsonResponse(result.body, result.exitCode, port);
      }, opts.cwd);
    }

    if (path === "/api/map/detail/mark" && req.method === "POST") {
      const slug = await readSlug(req, url);
      return withSession((s) => {
        const result = runMapDetailMark(s, slug);
        return jsonResponse(result.body, result.exitCode, port);
      }, opts.cwd);
    }

    if (path === "/api/map/detail/cancel" && req.method === "POST") {
      const slug = await readSlug(req, url);
      return withSession((s) => {
        const result = runMapDetailCancel(s, slug);
        return jsonResponse(result.body, result.exitCode, port);
      }, opts.cwd);
    }

    if (path === "/api/view" && req.method === "POST") {
      if (!opts.views) {
        return jsonResponse(
          { schemaVersion: 1, ok: false, error: "Map views are not available" },
          EXIT_INTERNAL,
          port,
        );
      }
      const id = opts.views.create();
      const repoRoot = findRepoRoot(opts.cwd);
      return jsonHttp({ schemaVersion: 1, ok: true, id, slug: null, repoRoot }, 200, port);
    }

    const viewId = path.startsWith("/api/view/") ? path.slice("/api/view/".length) : "";
    if (viewId && !viewId.includes("/")) {
      if (!opts.views) {
        return jsonResponse(
          { schemaVersion: 1, ok: false, error: "Map views are not available" },
          EXIT_INTERNAL,
          port,
        );
      }
      if (method === "GET") {
        const rec = opts.views.get(viewId);
        if (!rec) {
          return jsonHttp({ schemaVersion: 1, ok: false, error: "Unknown view id" }, 404, port);
        }
        const repoRoot = findRepoRoot(opts.cwd);
        return jsonHttp(
          { schemaVersion: 1, ok: true, id: viewId, slug: rec.slug, repoRoot },
          200,
          port,
        );
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
          return jsonHttp({ schemaVersion: 1, ok: false, error: "Unknown view id" }, 404, port);
        }
        return jsonHttp({ schemaVersion: 1, ok: true, id: viewId, slug: rec.slug }, 200, port);
      }
    }

    if (path.startsWith("/api/")) {
      return jsonResponse(
        { schemaVersion: 1, ok: false, error: `Unknown API route ${req.method} ${path}` },
        EXIT_USAGE,
        port,
      );
    }
  } catch (err) {
    return errorResponse(err, port);
  }

  return serveUiAsset(path, opts.uiDist, port);
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

function serveUiAsset(urlPath: string, uiDist: string, port: number): Response {
  if (!existsSync(uiDist)) {
    return jsonResponse(
      {
        schemaVersion: 1,
        ok: false,
        error: "Map UI is not built. Run `bun run build:ui` or restart `snowshoe map serve`.",
      },
      EXIT_INTERNAL,
      port,
    );
  }

  let file = safeDistFile(uiDist, urlPath);
  const htmlFallbackHeaders = (status: number, body: string) =>
    new Response(body, {
      status,
      headers: withMapSecurityHeaders(
        { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        { port, html: false },
      ),
    });
  if (!file) {
    return htmlFallbackHeaders(403, "Forbidden");
  }

  if (!existsSync(file) || statSync(file).isDirectory()) {
    const index = join(uiDist, "index.html");
    if (existsSync(index) && isSpaIndexFallback(urlPath)) {
      file = index;
    } else {
      return htmlFallbackHeaders(404, "Not found");
    }
  }

  const bytes = Bun.file(file);
  const type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
  const html = type.startsWith("text/html");
  return new Response(bytes, {
    headers: withMapSecurityHeaders(
      {
        "content-type": type,
        "cache-control": "no-store",
      },
      { port, html },
    ),
  });
}
