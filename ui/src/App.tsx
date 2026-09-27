import { type ReactElement, useCallback, useEffect, useMemo, useState } from "react";
import {
  cancelDetail,
  editorHref,
  fetchMapStatus,
  fetchSession,
  type MapNode,
  type MapReadModel,
  markDetail,
  type SessionInfo,
} from "./api.ts";
import { bandFor, colorFor, nodeFloat } from "./bands.ts";
import { isExpandable } from "./matrix.ts";

function bySlug(model: MapReadModel | null): Map<string, MapNode> {
  const map = new Map<string, MapNode>();
  if (!model) return map;
  for (const n of model.nodes) map.set(n.slug, n);
  return map;
}

function TreeNode(props: {
  slug: string;
  nodes: Map<string, MapNode>;
  selected: string | null;
  onSelect: (slug: string) => void;
  seen: Set<string>;
}): ReactElement | null {
  const node = props.nodes.get(props.slug);
  if (!node) return null;
  if (props.seen.has(props.slug)) {
    return <div className="hint">cycle:{props.slug}</div>;
  }
  const seen = new Set(props.seen);
  seen.add(props.slug);
  const float = nodeFloat(node.metrics);
  const pending = node.detailStatus;
  return (
    <div>
      <div
        className={`node${props.selected === node.slug ? " selected" : ""}`}
        onClick={() => props.onSelect(node.slug)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            props.onSelect(node.slug);
          }
        }}
        role="treeitem"
        tabIndex={0}
        aria-selected={props.selected === node.slug}
      >
        <span className="swatch" style={{ background: colorFor(float) }} title={bandFor(float)} />
        <span>{node.title ?? node.slug}</span>
        <span className="hint">{node.type}</span>
        {pending ? (
          <span className={`badge${pending === "leased" ? " leased" : ""}`}>{pending}</span>
        ) : null}
        {isExpandable(node.type, node.leaf) && node.children.length === 0 && !pending ? (
          <span className="hint">unexpanded</span>
        ) : null}
      </div>
      {node.children.length > 0 ? (
        <div className="children">
          {node.children.map((child) => (
            <TreeNode
              key={child}
              slug={child}
              nodes={props.nodes}
              selected={props.selected}
              onSelect={props.onSelect}
              seen={seen}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Inspector(props: {
  node: MapNode | null;
  session: SessionInfo | null;
  busy: boolean;
  onMark: (slug: string) => void;
  onCancel: (slug: string) => void;
}): ReactElement {
  const { node, session } = props;
  if (!node) {
    return (
      <p className="hint">
        Select a node in the tree. This UI never opens SQLite or completes work.
      </p>
    );
  }
  const expandable = isExpandable(node.type, node.leaf);
  const canMark = expandable && !node.detailStatus;
  const canCancel = node.detailStatus === "pending";
  const metrics = node.metrics ?? {};
  const levels = [
    ["overview", metrics.overview],
    ["contracts", metrics.contracts],
    ["internals", metrics.internals],
  ] as const;
  const anchors = node.anchors ?? [];

  return (
    <div>
      <h2>{node.title ?? node.slug}</h2>
      <p className="mono">
        {node.slug} · {node.type}
        {node.leaf ? " · leaf" : ""}
        {node.detailStatus ? ` · ${node.detailStatus}` : ""}
      </p>
      <div className="metrics">
        {levels.map(([name, value]) => (
          <div key={name} className="pill" style={{ borderColor: colorFor(value ?? null) }}>
            <div className="hint">{name}</div>
            <div>
              {value === undefined ? "—" : value.toFixed(2)}{" "}
              <span className="hint">{bandFor(value)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="row">
        <button
          type="button"
          className="primary"
          disabled={!canMark || props.busy}
          onClick={() => props.onMark(node.slug)}
        >
          Mark detail
        </button>
        <button
          type="button"
          className="danger"
          disabled={!canCancel || props.busy}
          onClick={() => props.onCancel(node.slug)}
        >
          Cancel pending
        </button>
      </div>
      {!expandable ? <p className="hint">Leaves cannot be marked for detail.</p> : null}
      {node.detailStatus === "leased" ? (
        <p className="hint">
          Leased — cancel waits for TTL/reclaim. Do not complete work from this UI.
        </p>
      ) : null}
      {node.anchorsUnresolved && node.anchorsUnresolved.length > 0 ? (
        <p className="warn">Unresolved anchors: {node.anchorsUnresolved.join(", ")}</p>
      ) : null}
      <h3>Anchors</h3>
      {anchors.length === 0 ? (
        <p className="hint">No anchors on this node.</p>
      ) : (
        <ul className="anchors">
          {anchors.map((a) => {
            const href = session ? editorHref(session.repoRoot, a) : undefined;
            const loc = [a.startLine && `L${a.startLine}`, a.endLine && `L${a.endLine}`, a.symbol]
              .filter(Boolean)
              .join(" · ");
            const key = `${a.path}:${a.symbol ?? ""}:${a.startLine ?? ""}:${a.endLine ?? ""}`;
            return (
              <li key={key}>
                {href ? (
                  <a href={href} title="Open in editor (UI owns this; util does not)">
                    {a.path}
                  </a>
                ) : (
                  <span className="mono">{a.path}</span>
                )}
                {loc ? <span className="hint"> {loc}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
      {node.proseRef ? <p className="hint">prose: {node.proseRef}</p> : null}
    </div>
  );
}

export function App(): ReactElement {
  const [model, setModel] = useState<MapReadModel | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [map, sess] = await Promise.all([fetchMapStatus(), fetchSession()]);
      setModel(map);
      setSession(sess);
      setSelected((cur) => {
        if (cur && map.nodes.some((n) => n.slug === cur)) return cur;
        return map.rootSlug ?? map.nodes[0]?.slug ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const nodes = useMemo(() => bySlug(model), [model]);
  const selectedNode = selected ? (nodes.get(selected) ?? null) : null;

  async function onMark(slug: string) {
    setBusy(true);
    setError(null);
    try {
      await markDetail(slug);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function onCancel(slug: string) {
    setBusy(true);
    setError(null);
    try {
      await cancelDetail(slug);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Snowshoe map</h1>
        <span className="meta">{session?.gitHead ? session.gitHead.slice(0, 12) : "no HEAD"}</span>
        <button type="button" onClick={() => void reload()} disabled={busy}>
          {busy ? "Loading…" : "Reload"}
        </button>
        {error ? <span className="error">{error}</span> : null}
      </header>
      <div className="layout">
        <div className="tree" role="tree" aria-label="Map tree">
          {model ? (
            <TreeNode
              slug={model.rootSlug}
              nodes={nodes}
              selected={selected}
              onSelect={setSelected}
              seen={new Set()}
            />
          ) : (
            <p className="hint">Loading read-model…</p>
          )}
        </div>
        <section className="detail">
          <Inspector
            node={selectedNode}
            session={session}
            busy={busy}
            onMark={onMark}
            onCancel={onCancel}
          />
        </section>
      </div>
      <footer>
        Dumb client of <code>GET /api/map/status</code> (same JSON as{" "}
        <code>snowshoe map status --json</code>). Mark/cancel via HTTP twins. Reload after the skill
        completes work. No ledger writes from this page.
      </footer>
    </div>
  );
}
