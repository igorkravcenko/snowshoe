import { loopbackOriginsForPort } from "./loopback.ts";

function wsConnectSrc(port: number): string {
  const httpOrigins = loopbackOriginsForPort(port);
  const ws = [...httpOrigins].map((origin) => origin.replace(/^http:/, "ws:"));
  return ["'self'", ...ws].join(" ");
}

/**
 * HTML document CSP. `style-src-attr 'unsafe-inline'` is required for React
 * `style={{…}}` (split gutters, graph positions, Prism token colors). Script
 * and style *elements* stay `'self'` via default-src — Vite emits external
 * `/assets/*` only.
 */
export function mapHtmlContentSecurityPolicy(port: number): string {
  return [
    "default-src 'self'",
    `connect-src ${wsConnectSrc(port)}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "style-src-attr 'unsafe-inline'",
  ].join("; ");
}

export function mapApiContentSecurityPolicy(): string {
  return "frame-ancestors 'none'";
}

export function mapResponseSecurityHeaders(opts: { port: number; html: boolean }): Headers {
  const headers = new Headers();
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "no-referrer");
  headers.set(
    "content-security-policy",
    opts.html ? mapHtmlContentSecurityPolicy(opts.port) : mapApiContentSecurityPolicy(),
  );
  return headers;
}

export function withMapSecurityHeaders(
  headers: Headers | Record<string, string> | undefined,
  opts: { port: number; html: boolean },
): Headers {
  const out = new Headers(headers);
  mapResponseSecurityHeaders(opts).forEach((value, key) => {
    out.set(key, value);
  });
  return out;
}
