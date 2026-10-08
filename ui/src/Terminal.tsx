import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { type ReactElement, useEffect, useRef, useState } from "react";
import { mapAccessToken } from "./session-token.ts";
import "@xterm/xterm/css/xterm.css";

function ptyWsUrl(viewId: string, reset: boolean): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const q = new URLSearchParams({ v: viewId });
  if (reset) q.set("reset", "1");
  const token = mapAccessToken();
  if (token) q.set("t", token);
  return `${proto}//${window.location.host}/api/pty?${q.toString()}`;
}

function TerminalSession(props: {
  viewId: string;
  active: boolean;
  /** Kill any server-side session and spawn fresh (Restart). */
  reset: boolean;
  onSocketOpen: (open: boolean) => void;
  onError: (message: string | null) => void;
}): ReactElement {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const onSocketOpenRef = useRef(props.onSocketOpen);
  const onErrorRef = useRef(props.onError);
  onSocketOpenRef.current = props.onSocketOpen;
  onErrorRef.current = props.onError;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let disposed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let usedReset = false;
    onErrorRef.current(null);
    onSocketOpenRef.current(false);

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      theme: { background: "#0b1016", foreground: "#e7ecf1" },
    });
    const fit = new FitAddon();
    fitRef.current = fit;
    term.loadAddon(fit);
    term.open(el);
    fit.fit();

    const sendResize = () => {
      fit.fit();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    };

    const connect = () => {
      if (disposed) return;
      const reset = props.reset && !usedReset;
      if (reset) usedReset = true;
      const socket = new WebSocket(ptyWsUrl(props.viewId, reset));
      socket.binaryType = "arraybuffer";
      ws = socket;

      socket.onopen = () => {
        if (disposed || ws !== socket) return;
        attempt = 0;
        onSocketOpenRef.current(true);
        onErrorRef.current(null);
        // Server replays buffered output on attach.
        term.reset();
        sendResize();
      };
      socket.onmessage = (ev) => {
        if (disposed || ws !== socket) return;
        if (typeof ev.data === "string") term.write(ev.data);
        else term.write(new Uint8Array(ev.data as ArrayBuffer));
      };
      socket.onerror = () => {
        if (!disposed && ws === socket) {
          onErrorRef.current("PTY socket error (loopback peers only)");
        }
      };
      socket.onclose = () => {
        if (disposed || ws !== socket) return;
        onSocketOpenRef.current(false);
        const delay = Math.min(1000 * 2 ** attempt, 15_000);
        attempt += 1;
        term.writeln(`\r\n[pty disconnected — reconnecting in ${Math.round(delay / 1000)}s…]`);
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    term.onData((data) => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(data);
    });

    // xterm maps Enter and Shift+Enter both to CR; cursor-agent expects
    // the kitty CSI-u form for Shift+Enter (same as VS Code /setup-terminal).
    term.attachCustomKeyEventHandler((ev) => {
      if (ev.type !== "keydown") return true;
      if (ev.key !== "Enter" || !ev.shiftKey || ev.altKey || ev.ctrlKey || ev.metaKey) {
        return true;
      }
      ev.preventDefault();
      if (ws && ws.readyState === WebSocket.OPEN) ws.send("\x1b[13;2u");
      return false;
    });

    const onWake = () => {
      if (disposed) return;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      connect();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onWake();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onWake);

    const ro = new ResizeObserver(() => sendResize());
    ro.observe(el);
    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onWake);
      ro.disconnect();
      const socket = ws;
      ws = null;
      socket?.close();
      term.dispose();
      fitRef.current = null;
    };
  }, [props.viewId, props.reset]);

  useEffect(() => {
    if (props.active) fitRef.current?.fit();
  }, [props.active]);

  return <div ref={hostRef} className="xterm-host" />;
}

export function TerminalPane(props: { viewId: string | null; active: boolean }): ReactElement {
  const [session, setSession] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [socketOpen, setSocketOpen] = useState(false);

  if (!props.viewId) {
    return <p className="hint">Waiting for view id…</p>;
  }

  return (
    <div className="sidebar-term">
      <div className="term-toolbar">
        {!socketOpen ? (
          <button
            type="button"
            className="term-restart"
            onClick={() => setSession((n) => n + 1)}
            title="Kill any persisted shell and spawn a new one"
          >
            Restart
          </button>
        ) : null}
        {!socketOpen ? <span className="hint">disconnected</span> : null}
      </div>
      {error ? <p className="error">{error}</p> : null}
      <TerminalSession
        key={session}
        viewId={props.viewId}
        active={props.active}
        reset={session > 0}
        onSocketOpen={setSocketOpen}
        onError={setError}
      />
    </div>
  );
}
