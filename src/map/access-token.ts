import { randomBytes, timingSafeEqual } from "node:crypto";

/** 32-byte token → 43-char unpadded base64url. */
export const MAP_ACCESS_TOKEN_BYTES = 32;

export function generateMapAccessToken(): string {
  return randomBytes(MAP_ACCESS_TOKEN_BYTES).toString("base64url");
}

/** Constant-time compare. Empty or length-mismatched values never match. */
export function mapAccessTokensEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length === 0 || a.length !== b.length) {
    const dummy = Buffer.alloc(MAP_ACCESS_TOKEN_BYTES);
    timingSafeEqual(dummy, dummy);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function bearerTokenFromAuthorization(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

/** HTTP APIs: Authorization Bearer only (query tokens are CSRF-able). */
export function mapAccessTokenFromHttpRequest(req: Request): string | null {
  return bearerTokenFromAuthorization(req.headers.get("authorization"));
}

/**
 * WebSocket upgrade cannot set Authorization from a browser `WebSocket()`.
 * Accept Bearer header (non-browser) or `?t=` (map UI).
 */
export function mapAccessTokenFromPtyUpgrade(req: Request): string | null {
  const header = mapAccessTokenFromHttpRequest(req);
  if (header) return header;
  const t = new URL(req.url).searchParams.get("t");
  return t && t.length > 0 ? t : null;
}

export function mapUiUrl(origin: string, token: string): string {
  const base = origin.endsWith("/") ? origin : `${origin}/`;
  return `${base}#t=${token}`;
}

export function isJsonContentType(req: Request): boolean {
  const raw = req.headers.get("content-type");
  if (!raw) return false;
  const media = raw.split(";")[0]?.trim().toLowerCase();
  return media === "application/json";
}

export function requestHasBody(req: Request): boolean {
  const len = req.headers.get("content-length");
  if (len !== null && len !== "" && len !== "0") return true;
  const te = req.headers.get("transfer-encoding");
  return Boolean(te?.toLowerCase().includes("chunked"));
}

/** POST/PUT/PATCH always; DELETE only when a body is present. */
export function mutationRequiresJsonContentType(method: string, req: Request): boolean {
  const m = method.toUpperCase();
  if (m === "POST" || m === "PUT" || m === "PATCH") return true;
  if (m === "DELETE") return requestHasBody(req);
  return false;
}
