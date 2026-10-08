import type { Server, ServerWebSocket } from "bun";
import { mapAccessTokenFromPtyUpgrade, mapAccessTokensEqual } from "./access-token.ts";
import { isAllowedMapOrigin, isLoopbackPeer, loopbackHostHeaderOrError } from "./loopback.ts";

export type PtyWsData = {
  viewId: string;
  mapUrl: string;
  cwd: string;
  /** When true, destroy any persisted session for this view before attach. */
  reset: boolean;
  /** Per-launch map access token (PTY env `SNOWSHOE_MAP_TOKEN` for `map view`). */
  token?: string;
};

type PtySession = {
  viewId: string;
  cwd: string;
  mapUrl: string;
  terminal: Bun.Terminal;
  proc: ReturnType<typeof Bun.spawn>;
  ws: ServerWebSocket<PtyWsData> | null;
  /** Ring of recent output for replay on reconnect. */
  buffer: Uint8Array[];
  bufferBytes: number;
  createdAt: number;
  /** Set when the last WS detaches; cleared on attach. */
  detachedAt: number | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
  sink: ((chunk: Uint8Array<ArrayBuffer>) => void) | null;
};

/**
 * Keep detached sessions alive across laptop sleep / brief WS drops.
 * Bounded by {@link PTY_MAX_SESSIONS} (LRU detached first) so orphans cannot grow without limit.
 */
export const PTY_IDLE_MS = 12 * 60 * 60 * 1000;
/** Hard cap on persisted shells per `map serve` process. */
export const PTY_MAX_SESSIONS = 4;
const PTY_BUFFER_MAX_BYTES = 64 * 1024;

const sessions = new Map<string, PtySession>();

function jsonError(message: string, status: number): Response {
  return new Response(`${JSON.stringify({ schemaVersion: 1, ok: false, error: message })}\n`, {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function mapOriginFromRequest(req: Request): string {
  const host = req.headers.get("host")?.trim();
  if (host) return `http://${host}`;
  return "http://127.0.0.1";
}

export type PtyUpgradeAuth = {
  token: string;
  port: number;
};

/**
 * Upgrade `/api/pty` only for loopback peers with a matching Origin and token.
 * Missing Origin is denied: the PTY is a browser map-UI channel. Non-browser
 * clients may send Origin equal to this server's loopback origin plus the token.
 */
export function tryUpgradeMapPty(
  req: Request,
  server: Server<PtyWsData>,
  cwd: string,
  auth: PtyUpgradeAuth,
): Response | undefined {
  const url = new URL(req.url);
  if (url.pathname !== "/api/pty") return undefined;
  const ip = server.requestIP(req)?.address ?? null;
  if (!isLoopbackPeer(ip)) {
    return jsonError("PTY is allowed only for loopback peers", 403);
  }
  if (!loopbackHostHeaderOrError(req)) {
    return jsonError("PTY requires a loopback Host header", 403);
  }
  const origin = req.headers.get("origin");
  if (!isAllowedMapOrigin(origin, auth.port)) {
    return jsonError("PTY requires Origin matching this map server", 403);
  }
  const offered = mapAccessTokenFromPtyUpgrade(req);
  if (!offered || !mapAccessTokensEqual(offered, auth.token)) {
    return jsonError("PTY requires a valid access token", 401);
  }
  const viewId = url.searchParams.get("v") ?? "";
  const reset = url.searchParams.get("reset") === "1";
  const upgraded = server.upgrade(req, {
    data: { viewId, mapUrl: mapOriginFromRequest(req), cwd, reset, token: auth.token },
  });
  if (!upgraded) return jsonError("PTY upgrade failed", 400);
  return undefined;
}

function pushBuffer(session: PtySession, chunk: Uint8Array): void {
  const copy = chunk.slice();
  session.buffer.push(copy);
  session.bufferBytes += copy.byteLength;
  while (session.bufferBytes > PTY_BUFFER_MAX_BYTES && session.buffer.length > 1) {
    const dropped = session.buffer.shift();
    if (dropped) session.bufferBytes -= dropped.byteLength;
  }
}

function bufferConcat(session: PtySession): Uint8Array {
  if (session.buffer.length === 0) return new Uint8Array();
  if (session.buffer.length === 1) return session.buffer[0]!;
  const out = new Uint8Array(session.bufferBytes);
  let offset = 0;
  for (const part of session.buffer) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

function clearIdle(session: PtySession): void {
  if (session.idleTimer) {
    clearTimeout(session.idleTimer);
    session.idleTimer = null;
  }
}

function destroySession(session: PtySession): void {
  clearIdle(session);
  session.sink = null;
  session.ws = null;
  sessions.delete(session.viewId);
  try {
    session.proc.kill();
  } catch {
    /* already gone */
  }
  try {
    session.terminal.close();
  } catch {
    /* already gone */
  }
}

/**
 * Evict orphans when at capacity. Prefer oldest detached; if every slot is attached,
 * evict the oldest session other than `keepViewId`.
 */
function reapForCapacity(keepViewId?: string): void {
  while (sessions.size >= PTY_MAX_SESSIONS) {
    const candidates = [...sessions.values()].filter((s) => s.viewId !== keepViewId);
    if (candidates.length === 0) break;
    const detached = candidates.filter((s) => !s.ws);
    const pool = detached.length > 0 ? detached : candidates;
    pool.sort((a, b) => {
      const aT = a.detachedAt ?? a.createdAt;
      const bT = b.detachedAt ?? b.createdAt;
      return aT - bT;
    });
    destroySession(pool[0]!);
  }
}

function scheduleIdle(session: PtySession): void {
  clearIdle(session);
  session.idleTimer = setTimeout(() => {
    if (session.ws) return;
    destroySession(session);
  }, PTY_IDLE_MS);
}

function attachWs(session: PtySession, ws: ServerWebSocket<PtyWsData>): void {
  clearIdle(session);
  session.detachedAt = null;
  if (session.ws && session.ws !== ws) {
    try {
      session.ws.close();
    } catch {
      /* closed */
    }
  }
  session.ws = ws;
  session.sink = null;
  const replay = bufferConcat(session);
  if (replay.byteLength > 0) {
    try {
      ws.send(replay);
    } catch {
      /* closed */
    }
  }
  session.sink = (chunk) => {
    try {
      ws.send(chunk);
    } catch {
      /* closed */
    }
  };
}

function detachWs(session: PtySession, ws: ServerWebSocket<PtyWsData>): void {
  if (session.ws !== ws) return;
  session.ws = null;
  session.sink = null;
  session.detachedAt = Date.now();
  scheduleIdle(session);
}

function createSession(opts: {
  cwd: string;
  viewId: string;
  mapUrl: string;
  token?: string;
}): PtySession {
  reapForCapacity(opts.viewId);
  const now = Date.now();
  const session: PtySession = {
    viewId: opts.viewId,
    cwd: opts.cwd,
    mapUrl: opts.mapUrl,
    // filled immediately below; onData only runs after spawn returns
    terminal: null as unknown as Bun.Terminal,
    proc: null as unknown as ReturnType<typeof Bun.spawn>,
    ws: null,
    buffer: [],
    bufferBytes: 0,
    createdAt: now,
    detachedAt: now,
    idleTimer: null,
    sink: null,
  };
  const spawned = spawnMapPtyShell({
    cwd: opts.cwd,
    viewId: opts.viewId,
    mapUrl: opts.mapUrl,
    token: opts.token,
    onData(chunk) {
      pushBuffer(session, chunk);
      session.sink?.(chunk);
    },
  });
  session.terminal = spawned.terminal;
  session.proc = spawned.proc;
  sessions.set(opts.viewId, session);
  void spawned.proc.exited.then(() => {
    const current = sessions.get(opts.viewId);
    if (current !== session) return;
    const attached = session.ws;
    destroySession(session);
    if (attached) {
      try {
        attached.close();
      } catch {
        /* closed */
      }
    }
  });
  return session;
}

function applyResize(terminal: Bun.Terminal | undefined, cols: unknown, rows: unknown): void {
  const c = Number(cols);
  const r = Number(rows);
  if (!terminal || !Number.isInteger(c) || !Number.isInteger(r) || c < 1 || r < 1) return;
  terminal.resize(c, r);
}

export const SNOWSHOE_MODE_LEARN = "learn";

/** Human-facing PTY motd. Not an agent prompt; Snowshoe does not type into the shell. */
export function mapPtyWelcomeLines(): string[] {
  return [
    "Start your usual agent here. Load the snowshoe skill to talk about this repo map and study it.",
    "",
  ];
}

function shellArgv(shell: string): string[] {
  const printed = mapPtyWelcomeLines()
    .map((line) => JSON.stringify(line))
    .join(" ");
  const execShell = JSON.stringify(shell);
  return ["/bin/sh", "-c", `printf '%s\\n' ${printed}; exec ${execShell} -i`];
}

/** PTY shell: new session so bash can TIOCSCTTY (job control). */
export function spawnMapPtyShell(opts: {
  cwd: string;
  viewId: string;
  mapUrl: string;
  token?: string;
  cols?: number;
  rows?: number;
  onData: (chunk: Uint8Array<ArrayBuffer>) => void;
}): { terminal: Bun.Terminal; proc: ReturnType<typeof Bun.spawn> } {
  const terminal = new Bun.Terminal({
    cols: opts.cols ?? 80,
    rows: opts.rows ?? 24,
    data(_t, chunk) {
      opts.onData(chunk);
    },
  });
  const shell = (process.env.SHELL ?? "").trim() || "/bin/bash";
  const proc = Bun.spawn(shellArgv(shell), {
    cwd: opts.cwd,
    env: {
      ...process.env,
      TERM: "xterm-256color",
      SNOWSHOE_VIEW: opts.viewId,
      SNOWSHOE_MAP_URL: opts.mapUrl,
      SNOWSHOE_MODE: SNOWSHOE_MODE_LEARN,
      ...(opts.token ? { SNOWSHOE_MAP_TOKEN: opts.token } : {}),
    },
    terminal,
    detached: true,
  });
  return { terminal, proc };
}

/** Test helper: how many persisted PTY sessions exist. */
export function ptySessionCountForTests(): number {
  return sessions.size;
}

/** Test helper: tear down every persisted session. */
export function destroyAllPtySessionsForTests(): void {
  for (const session of [...sessions.values()]) {
    destroySession(session);
  }
}

/** Test helper: is a session for viewId still alive (proc not reaped from the map). */
export function hasPtySessionForTests(viewId: string): boolean {
  return sessions.has(viewId);
}

export const mapPtyWebsocket = {
  open(ws: ServerWebSocket<PtyWsData>) {
    const { cwd, viewId, mapUrl, reset, token } = ws.data;
    const key = viewId || "__default__";
    try {
      let session = sessions.get(key);
      if (reset && session) {
        destroySession(session);
        session = undefined;
      }
      if (!session) {
        session = createSession({ cwd, viewId: key, mapUrl, token });
      }
      // Keep env snapshot fresh for map view CLI (shell already has old env).
      attachWs(session, ws);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        ws.send(new TextEncoder().encode(`snowshoe: PTY failed: ${message}\r\n`));
      } catch {
        /* closed */
      }
      ws.close();
    }
  },
  message(ws: ServerWebSocket<PtyWsData>, message: string | Buffer) {
    const key = ws.data.viewId || "__default__";
    const session = sessions.get(key);
    if (!session || session.ws !== ws) return;
    const terminal = session.terminal;
    if (typeof message === "string") {
      const trimmed = message.trim();
      if (trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed) as { type?: string; cols?: unknown; rows?: unknown };
          if (
            parsed.type === "resize" ||
            (parsed.cols !== undefined && parsed.rows !== undefined)
          ) {
            applyResize(terminal, parsed.cols, parsed.rows);
            return;
          }
        } catch {
          /* treat as keystrokes */
        }
      }
      terminal.write(message);
      return;
    }
    terminal.write(message);
  },
  close(ws: ServerWebSocket<PtyWsData>) {
    const key = ws.data.viewId || "__default__";
    const session = sessions.get(key);
    if (!session) return;
    detachWs(session, ws);
  },
};
