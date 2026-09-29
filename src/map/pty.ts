import type { Server, ServerWebSocket } from "bun";
import { isLoopbackPeer } from "./loopback.ts";

export type PtyWsData = {
  viewId: string;
  mapUrl: string;
  cwd: string;
  terminal?: Bun.Terminal;
  proc?: ReturnType<typeof Bun.spawn>;
};

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

/** Upgrade `/api/pty` only for loopback peers. Returns a Response when not upgraded. */
export function tryUpgradeMapPty(
  req: Request,
  server: Server<PtyWsData>,
  cwd: string,
): Response | undefined {
  const url = new URL(req.url);
  if (url.pathname !== "/api/pty") return undefined;
  const ip = server.requestIP(req)?.address ?? null;
  if (!isLoopbackPeer(ip)) {
    return jsonError("PTY is allowed only for loopback peers", 403);
  }
  const viewId = url.searchParams.get("v") ?? "";
  const upgraded = server.upgrade(req, {
    data: { viewId, mapUrl: mapOriginFromRequest(req), cwd },
  });
  if (!upgraded) return jsonError("PTY upgrade failed", 400);
  return undefined;
}

function killPty(data: PtyWsData): void {
  try {
    data.proc?.kill();
  } catch {
    /* already gone */
  }
  try {
    data.terminal?.close();
  } catch {
    /* already gone */
  }
  data.proc = undefined;
  data.terminal = undefined;
}

function applyResize(terminal: Bun.Terminal | undefined, cols: unknown, rows: unknown): void {
  const c = Number(cols);
  const r = Number(rows);
  if (!terminal || !Number.isInteger(c) || !Number.isInteger(r) || c < 1 || r < 1) return;
  terminal.resize(c, r);
}

/** PTY shell: new session so bash can TIOCSCTTY (job control). */
export function spawnMapPtyShell(opts: {
  cwd: string;
  viewId: string;
  mapUrl: string;
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
  const proc = Bun.spawn([shell], {
    cwd: opts.cwd,
    env: {
      ...process.env,
      TERM: "xterm-256color",
      SNOWSHOE_VIEW: opts.viewId,
      SNOWSHOE_MAP_URL: opts.mapUrl,
    },
    terminal,
    detached: true,
  });
  return { terminal, proc };
}

export const mapPtyWebsocket = {
  open(ws: ServerWebSocket<PtyWsData>) {
    const { cwd, viewId, mapUrl } = ws.data;
    try {
      const { terminal, proc } = spawnMapPtyShell({
        cwd,
        viewId,
        mapUrl,
        onData(chunk) {
          try {
            ws.send(chunk);
          } catch {
            /* closed */
          }
        },
      });
      ws.data.terminal = terminal;
      ws.data.proc = proc;
      void proc.exited.then(() => {
        try {
          ws.close();
        } catch {
          /* closed */
        }
      });
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
    const terminal = ws.data.terminal;
    if (!terminal) return;
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
    killPty(ws.data);
  },
};
