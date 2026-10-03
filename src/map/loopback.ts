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
    // bare hostname:port (e.g. localhost:8787)
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
