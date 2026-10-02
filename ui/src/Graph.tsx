import { type ReactElement, useEffect, useMemo, useRef, useState } from "react";
import type { MapNode } from "./api.ts";
import { targetLayerColors } from "./bands.ts";
import { buildEgoGraph, edgeStrokeClass, edgeStrokeFamily, radialLayout } from "./graph.ts";
import { formatNodeTip, MARK_KINDS, MARK_LABELS, type MarkKind } from "./marks.ts";

const FOCUS_R = 5.2;
const NODE_R = 3.8;
/** Clearance past the outer stroke so arrowheads are not covered. */
const EDGE_GAP = 0.55;
/** Show custom tip quickly (native SVG `<title>` feels multi-second). */
const TIP_DELAY_MS = 40;

function diskRadius(slug: string, focus: string): number {
  return slug === focus ? FOCUS_R : NODE_R;
}

function edgeStop(slug: string, focus: string): number {
  const r = diskRadius(slug, focus);
  const stroke = slug === focus ? 0.55 : 0.7;
  return r + stroke / 2 + EDGE_GAP;
}

type TipState = { text: string; x: number; y: number };
type CtxMenu = { slug: string; x: number; y: number };

export function GraphPanel(props: {
  focus: string | null;
  nodes: Map<string, MapNode>;
  prevSlug: string | null;
  nextSlug: string | null;
  busy?: boolean;
  onNavigate: (slug: string) => void;
  onMark: (slug: string, kind: MarkKind) => void;
}): ReactElement {
  const { focus, nodes, prevSlug, nextSlug, busy, onNavigate, onMark } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const [ctx, setCtx] = useState<CtxMenu | null>(null);

  const ego = useMemo(() => {
    if (!focus || !nodes.has(focus)) return null;
    return buildEgoGraph(focus, nodes);
  }, [focus, nodes]);

  const layout = useMemo(() => {
    if (!ego) return null;
    return radialLayout(ego.focus, ego.neighbors, prevSlug, nextSlug);
  }, [ego, prevSlug, nextSlug]);

  useEffect(() => {
    return () => {
      if (tipTimer.current) clearTimeout(tipTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!ctx) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCtx(null);
    };
    const onPointer = (e: MouseEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest(".graph-ctx-menu")) return;
      setCtx(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [ctx]);

  function clearTip() {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = null;
    setTip(null);
  }

  function scheduleTip(text: string, clientX: number, clientY: number) {
    if (ctx) return;
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => {
      const box = panelRef.current?.getBoundingClientRect();
      if (!box) return;
      setTip({
        text,
        x: clientX - box.left + 10,
        y: clientY - box.top + 12,
      });
    }, TIP_DELAY_MS);
  }

  function openCtx(slug: string, clientX: number, clientY: number) {
    clearTip();
    const box = panelRef.current?.getBoundingClientRect();
    if (!box) return;
    const menuW = 160;
    const menuH = 220;
    let x = clientX - box.left;
    let y = clientY - box.top;
    x = Math.max(4, Math.min(x, box.width - menuW - 4));
    y = Math.max(4, Math.min(y, box.height - menuH - 4));
    setCtx({ slug, x, y });
  }

  if (!focus || !ego || !layout) {
    return <p className="hint">Select a node to see its local graph.</p>;
  }

  const slugs = [...layout.positions.keys()];
  const W = 100;
  const H = 100;
  const toSvg = (p: { x: number; y: number }) => ({ x: p.x * W, y: p.y * H });
  const ctxNode = ctx ? nodes.get(ctx.slug) : null;
  const ctxMarked = new Set(ctxNode?.marks ?? []);

  return (
    <div className="graph-panel" ref={panelRef}>
      <svg
        className="graph-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Local graph centered on ${focus}`}
      >
        <defs>
          <marker
            id="graph-arrow-parent"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="graph-marker-parent" />
          </marker>
          <marker
            id="graph-arrow-ref"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5" className="graph-marker-ref" fill="none" />
          </marker>
        </defs>
        {ego.edges.map((e) => {
          const from = layout.positions.get(e.from);
          const to = layout.positions.get(e.to);
          if (!from || !to) return null;
          const a = toSvg(from);
          const b = toSvg(to);
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const startPad = edgeStop(e.from, focus);
          const endPad = edgeStop(e.to, focus);
          const maxPad = Math.max(0, (len - 0.5) / 2);
          const fromPad = Math.min(startPad, maxPad);
          const toPad = Math.min(endPad, maxPad);
          const ux = dx / len;
          const uy = dy / len;
          const x1 = a.x + ux * fromPad;
          const y1 = a.y + uy * fromPad;
          const x2 = b.x - ux * toPad;
          const y2 = b.y - uy * toPad;
          const family = edgeStrokeFamily(e.kind);
          const marker = family === "parent" ? "url(#graph-arrow-parent)" : "url(#graph-arrow-ref)";
          return (
            <line
              key={`${e.from}->${e.to}:${e.kind}`}
              className={edgeStrokeClass(e.kind)}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              markerEnd={marker}
            />
          );
        })}
        {slugs.map((slug) => {
          const pos = layout.positions.get(slug)!;
          const p = toSvg(pos);
          const node = nodes.get(slug);
          const title = node?.title ?? slug;
          const colors = targetLayerColors(node?.metrics);
          const isFocus = slug === focus;
          const isPrev = slug === prevSlug;
          const isNext = slug === nextSlug;
          const marks = node?.marks ?? [];
          const hasMarks = marks.length > 0;
          const markLabels = marks.map((k) => MARK_LABELS[k as MarkKind] ?? k).join(", ");
          const r = diskRadius(slug, focus);
          const className = ["graph-node", isFocus ? "focus" : ""].filter(Boolean).join(" ");
          const tipText = formatNodeTip(title, slug, marks);
          const aria = [
            title,
            isPrev ? "(previous)" : null,
            isNext ? "(next)" : null,
            hasMarks ? `(marked: ${markLabels})` : null,
            slug,
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <a
              key={slug}
              className={className}
              transform={`translate(${p.x} ${p.y})`}
              href={`#${encodeURIComponent(slug)}`}
              aria-label={aria}
              onClick={(ev) => {
                ev.preventDefault();
                clearTip();
                setCtx(null);
                onNavigate(slug);
              }}
              onContextMenu={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                openCtx(slug, ev.clientX, ev.clientY);
              }}
              onMouseEnter={(ev) => scheduleTip(tipText, ev.clientX, ev.clientY)}
              onMouseMove={(ev) => {
                if (tip && !ctx) {
                  const box = panelRef.current?.getBoundingClientRect();
                  if (!box) return;
                  setTip({
                    text: tipText,
                    x: ev.clientX - box.left + 10,
                    y: ev.clientY - box.top + 12,
                  });
                }
              }}
              onMouseLeave={clearTip}
            >
              <circle r={r} fill={colors.overview} className="graph-node-disk" />
              <circle r={r * 0.62} fill={colors.contracts} />
              <circle r={r * 0.28} fill={colors.internals} />
              {isPrev ? (
                <text
                  className="graph-visit-badge prev"
                  x={-r * 0.95}
                  y={-r * 0.75}
                  textAnchor="middle"
                  aria-hidden
                >
                  ↺
                </text>
              ) : null}
              {isNext ? (
                <text
                  className="graph-visit-badge next"
                  x={-r * 0.95}
                  y={-r * 0.75}
                  textAnchor="middle"
                  aria-hidden
                >
                  ↻
                </text>
              ) : null}
              {hasMarks ? (
                <circle
                  className="graph-mark-dot"
                  cx={r * 0.72}
                  cy={-r * 0.72}
                  r={1.15}
                  aria-hidden
                />
              ) : null}
              <text className="graph-node-label" y={r + 3.2} textAnchor="middle">
                {title.length > 14 ? `${title.slice(0, 12)}…` : title}
              </text>
            </a>
          );
        })}
      </svg>
      {tip && !ctx ? (
        <div className="graph-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
          {tip.text}
        </div>
      ) : null}
      {ctx ? (
        <div
          className="graph-ctx-menu mark-menu"
          style={{ left: ctx.x, top: ctx.y }}
          role="menu"
          aria-label={`Mark ${ctx.slug}`}
        >
          <div className="graph-ctx-heading">{ctxNode?.title ?? ctx.slug}</div>
          {MARK_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              role="menuitem"
              disabled={Boolean(busy) || ctxMarked.has(kind)}
              onClick={() => {
                setCtx(null);
                onMark(ctx.slug, kind);
              }}
            >
              {MARK_LABELS[kind]}
            </button>
          ))}
        </div>
      ) : null}
      <div className="graph-legend" aria-hidden>
        <span>
          <i className="graph-legend-line parent" /> parent
        </span>
        <span>
          <i className="graph-legend-line ref" /> ref
        </span>
        <span>
          <span className="graph-legend-badge">↺</span> previous
        </span>
        <span>
          <span className="graph-legend-badge">↻</span> next
        </span>
      </div>
    </div>
  );
}
