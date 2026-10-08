/** URL fragment `#t=<token>` on the printed / `--open` URL. Not a node slug. */
export const MAP_TOKEN_HASH_PREFIX = "t=";

function isTokenShape(value: string): boolean {
  return /^[A-Za-z0-9_-]{32,128}$/.test(value);
}

/** Parse `#t=<token>` (optional extra `&…`). Null if the hash is a node slug. */
export function parseMapTokenFromHash(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.startsWith(MAP_TOKEN_HASH_PREFIX)) return null;
  const value = raw.slice(MAP_TOKEN_HASH_PREFIX.length).split("&")[0] ?? "";
  return isTokenShape(value) ? value : null;
}
