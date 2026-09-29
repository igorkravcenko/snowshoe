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
