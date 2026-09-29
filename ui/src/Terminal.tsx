import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { type ReactElement, useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";

function ptyWsUrl(viewId: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const q = new URLSearchParams({ v: viewId });
  return `${proto}//${window.location.host}/api/pty?${q.toString()}`;
}

export function TerminalPane(props: { viewId: string | null; active: boolean }): ReactElement {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.viewId) return;
    const el = hostRef.current;
    if (!el) return;
    let closed = false;
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

    const ws = new WebSocket(ptyWsUrl(props.viewId));
    ws.binaryType = "arraybuffer";

    const sendResize = () => {
      fit.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    };

    ws.onopen = () => {
      if (!closed) sendResize();
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") term.write(ev.data);
      else term.write(new Uint8Array(ev.data as ArrayBuffer));
    };
    ws.onerror = () => {
      if (!closed) setError("PTY socket error (loopback peers only)");
    };
    ws.onclose = () => {
      if (!closed) term.writeln("\r\n[pty closed]");
    };
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });

    const ro = new ResizeObserver(() => sendResize());
    ro.observe(el);

    return () => {
      closed = true;
      ro.disconnect();
      ws.close();
      term.dispose();
      fitRef.current = null;
    };
  }, [props.viewId]);

  useEffect(() => {
    if (props.active) fitRef.current?.fit();
  }, [props.active]);

  if (!props.viewId) {
    return <p className="hint">Waiting for view id…</p>;
  }

  return (
    <div className="sidebar-term">
      {error ? <p className="error">{error}</p> : null}
      <div ref={hostRef} className="xterm-host" />
    </div>
  );
}
