import { parseMapTokenFromHash } from "../../src/map/token-hash.ts";

export { MAP_TOKEN_HASH_PREFIX, parseMapTokenFromHash } from "../../src/map/token-hash.ts";

/** sessionStorage key for the per-launch map access token (same tab / refresh). */
export const MAP_TOKEN_STORAGE_KEY = "snowshoe.mapAccessToken";

let token: string | null = null;

function isTokenShape(value: string): boolean {
  return /^[A-Za-z0-9_-]{32,128}$/.test(value);
}

/**
 * Read `#t=<token>` from the URL fragment, stash it (memory + sessionStorage),
 * then strip the fragment so `#slug` history still works.
 *
 * The fragment is never sent to the server. A cross-site page cannot read
 * another origin's URL or sessionStorage.
 */
export function installMapAccessTokenFromUrl(): string | null {
  const win = globalThis as unknown as {
    location?: { hash: string; href: string; pathname: string; search: string };
    history?: { state: unknown; replaceState: (s: unknown, t: string, u: string) => void };
    sessionStorage?: {
      getItem: (k: string) => string | null;
      setItem: (k: string, v: string) => void;
    };
  };
  if (!win.location) return token;
  const parsed = parseMapTokenFromHash(win.location.hash);
  if (parsed) {
    token = parsed;
    try {
      win.sessionStorage?.setItem(MAP_TOKEN_STORAGE_KEY, parsed);
    } catch {
      /* private mode */
    }
    const url = new URL(win.location.href);
    url.hash = "";
    win.history?.replaceState(win.history.state, "", `${url.pathname}${url.search}`);
  }
  if (!token) {
    try {
      const stored = win.sessionStorage?.getItem(MAP_TOKEN_STORAGE_KEY) ?? null;
      if (stored && isTokenShape(stored)) token = stored;
    } catch {
      /* private mode */
    }
  }
  return token;
}

export function mapAccessToken(): string | null {
  return token;
}

/** Test helper. */
export function setMapAccessTokenForTests(value: string | null): void {
  token = value;
}

export function mapAuthHeaders(init?: RequestInit["headers"]): Headers {
  const headers = new Headers(init);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}
