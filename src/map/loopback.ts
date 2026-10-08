/** True for IPv4/IPv6 loopback, including IPv4-mapped v6. Independent of HTTP bind address. */
export function isLoopbackPeer(address: string | null | undefined): boolean {
  if (!address) return false;
  let a = address.trim();
  if (a.startsWith("[") && a.endsWith("]")) a = a.slice(1, -1);
  const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) a = mapped[1]!;
  if (a === "::1" || a === "localhost") return true;
  const m = a.match(/^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  return [m[1], m[2], m[3]].every((p) => {
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
}

/**
 * True for bind hosts / HTTP Host names that are loopback.
 * Strips a trailing `:port` (and `[::1]:port` brackets). Rejects wildcards.
 */
export function isLoopbackHost(host: string | null | undefined): boolean {
  if (!host) return false;
  let h = host.trim().toLowerCase();
  if (!h) return false;
  if (h === "0.0.0.0" || h === "::" || h === "[::]" || h === "*") return false;

  if (h.startsWith("[")) {
    const end = h.indexOf("]");
    if (end === -1) return false;
    const inner = h.slice(1, end);
    const rest = h.slice(end + 1);
    if (rest && !/^:\d+$/.test(rest)) return false;
    return isLoopbackPeer(inner);
  }

  // host:port — but do not split IPv6 without brackets
  const colon = h.lastIndexOf(":");
  if (colon > -1 && h.includes(".") && /^\d+$/.test(h.slice(colon + 1))) {
    h = h.slice(0, colon);
  } else if (colon > -1 && !h.includes(".") && h !== "::1") {
    // bare hostname:port (e.g. localhost:3232)
    if (/^\d+$/.test(h.slice(colon + 1))) h = h.slice(0, colon);
  }

  return isLoopbackPeer(h);
}

/** Reject DNS-rebinding Host headers on sensitive map HTTP routes. */
export function loopbackHostHeaderOrError(req: Request): string | null {
  const raw = req.headers.get("host");
  if (!isLoopbackHost(raw)) return null;
  return raw!.trim();
}

function originForLoopbackName(name: string, port: number): string {
  const host = name.includes(":") ? `[${name}]` : name;
  if (port === 80) return `http://${host}`;
  return `http://${host}:${port}`;
}

/**
 * Exact Origin strings this `map serve` instance considers itself.
 * Port is the actually bound port (not the attacker-controlled Host port).
 */
export function loopbackOriginsForPort(port: number): ReadonlySet<string> {
  return new Set([
    originForLoopbackName("127.0.0.1", port),
    originForLoopbackName("localhost", port),
    originForLoopbackName("::1", port),
  ]);
}

export function httpOriginForBind(hostname: string, port: number): string {
  const host = hostname.includes(":") && !hostname.startsWith("[") ? `[${hostname}]` : hostname;
  if (port === 80) return `http://${host}`;
  return `http://${host}:${port}`;
}

/** Exact match only. Missing Origin is not allowed. */
export function isAllowedMapOrigin(origin: string | null | undefined, port: number): boolean {
  if (!origin) return false;
  return loopbackOriginsForPort(port).has(origin.trim());
}
