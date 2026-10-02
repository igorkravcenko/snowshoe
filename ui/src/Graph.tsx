import { type ReactElement, useMemo } from "react";
import type { MapNode } from "./api.ts";
import { targetLayerColors, targetTitle } from "./bands.ts";
import { buildEgoGraph, edgeStrokeClass, edgeStrokeFamily, radialLayout } from "./graph.ts";

const FOCUS_R = 5.2;
const NODE_R = 3.8;
/** Clearance past the outer stroke so arrowheads are not covered. */
const EDGE_GAP = 0.55;

function diskRadius(slug: string, focus: string): number {
  return slug === focus ? FOCUS_R : NODE_R;
}

/** Outer edge of the painted disk (radius + half stroke), plus a small gap. */
function edgeStop(
  slug: string,
  focus: string,
  prevSlug: string | null,
  nextSlug: string | null,
): number {
  const r = diskRadius(slug, focus);
  let stroke = 0.7;
  if (slug === focus) stroke = Math.max(stroke, 0.85);
  if (slug === prevSlug || slug === nextSlug) {
    stroke = Math.max(stroke, slug === focus ? 1 : 0.9);
  }
  return r + stroke / 2 + EDGE_GAP;
}

export function GraphPanel(props: {
  focus: string | null;
  nodes: Map<string, MapNode>;
  prevSlug: string | null;
  nextSlug: string | null;
  onNavigate: (slug: string) => void;
}): ReactElement {
  const { focus, nodes, prevSlug, nextSlug, onNavigate } = props;

  const ego = useMemo(() => {
    if (!focus || !nodes.has(focus)) return null;
    return buildEgoGraph(focus, nodes);
  }, [focus, nodes]);

  const layout = useMemo(() => {
    if (!ego) return null;
    return radialLayout(ego.focus, ego.neighbors, prevSlug, nextSlug);
  }, [ego, prevSlug, nextSlug]);

  if (!focus || !ego || !layout) {
    return <p className="hint">Select a node to see its local graph.</p>;
  }

  const slugs = [...layout.positions.keys()];
  const W = 100;
  const H = 100;
  const toSvg = (p: { x: number; y: number }) => ({ x: p.x * W, y: p.y * H });

  return (
    <div className="graph-panel">
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
          const startPad = edgeStop(e.from, focus, prevSlug, nextSlug);
          const endPad = edgeStop(e.to, focus, prevSlug, nextSlug);
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
            >
              <title>{e.kind}</title>
            </line>
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
          const r = diskRadius(slug, focus);
          const className = [
            "graph-node",
            isFocus ? "focus" : "",
            isPrev ? "prev" : "",
            isNext ? "next" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const label = [
            title,
            isPrev ? "(previous)" : null,
            isNext ? "(next)" : null,
            slug,
            targetTitle(node?.metrics),
          ]
            .filter(Boolean)
            .join("\n");
          return (
            <a
              key={slug}
              className={className}
              transform={`translate(${p.x} ${p.y})`}
              href={`#${encodeURIComponent(slug)}`}
              aria-label={label}
              onClick={(ev) => {
                ev.preventDefault();
                onNavigate(slug);
              }}
            >
              <title>{label}</title>
              <circle r={r} fill={colors.overview} className="graph-node-disk" />
              <circle r={r * 0.62} fill={colors.contracts} />
              <circle r={r * 0.28} fill={colors.internals} />
              <text className="graph-node-label" y={r + 3.2} textAnchor="middle">
                {title.length > 14 ? `${title.slice(0, 12)}…` : title}
              </text>
            </a>
          );
        })}
      </svg>
      <div className="graph-legend" aria-hidden>
        <span>
          <i className="graph-legend-line parent" /> parent
        </span>
        <span>
          <i className="graph-legend-line ref" /> ref
        </span>
        <span>
          <i className="graph-legend-swatch prev" /> previous
        </span>
        <span>
          <i className="graph-legend-swatch next" /> next
        </span>
      </div>
    </div>
  );
}
