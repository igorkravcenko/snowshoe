import {
  type KeyboardEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type Anchor,
  createMapView,
  fetchMapStatus,
  fetchSession,
  incomingRefs,
  type MapNode,
  type MapReadModel,
  markNode,
  previewForNode,
  putMapView,
  type SessionInfo,
  sameAnchor,
  setLeaf,
  unmarkNode,
} from "./api.ts";
import { bandFor, colorFor } from "./bands.ts";
import { FeedbackPane } from "./Feedback.tsx";
import { GraphPanel } from "./Graph.tsx";
import {
  emptyVisitMirror,
  type VisitMirror,
  visitNextSlug,
  visitPopTo,
  visitPrevSlug,
  visitPush,
} from "./graph.ts";
import { MetricTarget } from "./MetricTarget.tsx";
import { mapFingerprint } from "./map-fingerprint.ts";
import { MarkdownBody } from "./markdown.tsx";
import { humanTodoRows, MARK_KINDS, MARK_LABELS, type MarkKind } from "./marks.ts";
import { isExpandable } from "./matrix.ts";
import { PreviewPanel } from "./Preview.tsx";
import { applySplitDrag, DEFAULT_SPLIT, parseSplitWeights, type SplitWeights } from "./split.ts";
import { TerminalPane } from "./Terminal.tsx";
import {
  ancestorSlugs,
  applyTreeKey,
  breadcrumbSlugs,
  initialExpandedSlugs,
  parentBySlug,
  slugFromHash,
  visibleSlugs,
} from "./tree.ts";

type NavTab = "tree" | "graph" | "todos";
const NAV_TAB_KEY = "snowshoe.navTab";
const NAV_TABS: NavTab[] = ["tree", "graph", "todos"];
const NAV_TAB_LABELS: Record<NavTab, string> = {
  tree: "Tree",
  graph: "Graph",
  todos: "Todos",
};

function loadNavTab(): NavTab {
  try {
    const raw = sessionStorage.getItem(NAV_TAB_KEY);
    if (raw && (NAV_TABS as string[]).includes(raw)) return raw as NavTab;
  } catch {
    /* sessionStorage may be unavailable */
  }
  return "tree";
}

function bySlug(model: MapReadModel | null): Map<string, MapNode> {
  const map = new Map<string, MapNode>();
  if (!model) return map;
  for (const n of model.nodes) map.set(n.slug, n);
  return map;
}

function focusTreeRow(slug: string): boolean {
  const el = document.querySelector(`[data-slug="${CSS.escape(slug)}"]`);
  if (!(el instanceof HTMLElement)) return false;
  el.focus();
  el.scrollIntoView({ block: "nearest" });
  return document.activeElement === el;
}

function treeKeysBlocked(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
  return Boolean(target.closest(".preview-panel, .sidebar-term, .xterm"));
}

const TREE_NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]);
const SIDEBAR_KEY = "snowshoe.sidebar";
const SPLIT_KEY = "snowshoe.split.v2";

function loadSidebarOpen(): boolean {
  try {
    const raw = sessionStorage.getItem(SIDEBAR_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    /* sessionStorage may be unavailable */
  }
  return true;
}

function loadSplit(): SplitWeights {
  try {
    return parseSplitWeights(sessionStorage.getItem(SPLIT_KEY)) ?? DEFAULT_SPLIT;
  } catch {
    return DEFAULT_SPLIT;
  }
}

function SplitGutter(props: { label: string; onDelta: (dx: number) => void }): ReactElement {
  const lastX = useRef<number | null>(null);
  return (
    <hr
      className="split-gutter"
      aria-orientation="vertical"
      title={props.label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        lastX.current = e.clientX;
      }}
      onPointerMove={(e) => {
        if (lastX.current === null || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const dx = e.clientX - lastX.current;
        lastX.current = e.clientX;
        if (dx !== 0) props.onDelta(dx);
      }}
      onPointerUp={() => {
        lastX.current = null;
      }}
    />
  );
}

function mapViewHref(viewId: string, slug: string): string {
  const q = new URLSearchParams(window.location.search);
  q.set("v", viewId);
  return `${window.location.pathname}?${q.toString()}#${encodeURIComponent(slug)}`;
}

function TreeNode(props: {
  slug: string;
  nodes: Map<string, MapNode>;
  selected: string | null;
  expanded: Set<string>;
  onSelect: (slug: string) => void;
  onToggle: (slug: string) => void;
  onKeyDown: (e: KeyboardEvent, slug: string) => void;
  seen: Set<string>;
}): ReactElement | null {
  const node = props.nodes.get(props.slug);
  if (!node) return null;
  if (props.seen.has(props.slug)) {
    return <div className="hint">cycle:{props.slug}</div>;
  }
  const seen = new Set(props.seen);
  seen.add(props.slug);
  const pending = node.detailStatus;
  const hasKids = node.children.length > 0;
  const open = hasKids && props.expanded.has(node.slug);
  return (
    <div>
      <div
        className={`node${props.selected === node.slug ? " selected" : ""}`}
        data-slug={node.slug}
        onClick={() => props.onSelect(node.slug)}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest("button.twirl")) return;
          if (hasKids) {
            e.preventDefault();
            props.onToggle(node.slug);
          }
        }}
        onKeyDown={(e) => props.onKeyDown(e, node.slug)}
        role="treeitem"
        tabIndex={props.selected === node.slug ? 0 : -1}
        aria-selected={props.selected === node.slug}
        aria-expanded={hasKids ? open : undefined}
      >
        {hasKids ? (
          <button
            type="button"
            className="twirl"
            tabIndex={-1}
            aria-label={open ? "Collapse" : "Expand"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              props.onToggle(node.slug);
            }}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {open ? "▼" : "▶"}
          </button>
        ) : (
          <span className="twirl" aria-hidden />
        )}
        <MetricTarget metrics={node.metrics} />
        <span className="node-title">{node.title ?? node.slug}</span>
        <span className="hint">{node.type}</span>
        {pending ? (
          <span className={`badge${pending === "leased" ? " leased" : ""}`}>{pending}</span>
        ) : null}
        {isExpandable(node.type, node.leaf) && node.children.length === 0 && !pending ? (
          <span className="hint">unexpanded</span>
        ) : null}
      </div>
      {open ? (
        <div className="children">
          {node.children.map((child) => (
            <TreeNode
              key={child}
              slug={child}
              nodes={props.nodes}
              selected={props.selected}
              expanded={props.expanded}
              onSelect={props.onSelect}
              onToggle={props.onToggle}
              onKeyDown={props.onKeyDown}
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
  nodes: Map<string, MapNode>;
  preview: Anchor | null;
  busy: boolean;
  menuOpen: boolean;
  onMenuOpen: (open: boolean) => void;
  onMark: (slug: string, kind: MarkKind) => void;
  onUnmark: (slug: string, kind: string) => void;
  onLeaf: (slug: string, leaf: boolean) => void;
  onPreview: (anchor: Anchor) => void;
  onGoTo: (slug: string) => void;
}): ReactElement {
  const { node } = props;
  if (!node) {
    return (
      <p className="hint">
        Select a node in the tree. This UI never opens SQLite or completes work.
      </p>
    );
  }
  const metrics = node.metrics ?? {};
  const levels = [
    ["overview", metrics.overview],
    ["contracts", metrics.contracts],
    ["internals", metrics.internals],
  ] as const;
  const anchors = node.anchors ?? [];
  const outgoing = node.refs ?? [];
  const incoming = incomingRefs(props.nodes.values(), node.slug);
  const marks = node.marks ?? [];
  const marked = new Set(marks);

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
      <div className="row mark-row">
        <div className="mark-control">
          <button
            type="button"
            className="primary"
            disabled={props.busy}
            aria-expanded={props.menuOpen}
            onClick={() => props.onMenuOpen(!props.menuOpen)}
          >
            Mark
          </button>
          {props.menuOpen ? (
            <div className="mark-menu" role="menu">
              {MARK_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="menuitem"
                  disabled={props.busy || marked.has(kind)}
                  onClick={() => {
                    props.onMenuOpen(false);
                    props.onMark(node.slug, kind);
                  }}
                >
                  {MARK_LABELS[kind]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <label className="leaf-toggle">
          <input
            type="checkbox"
            checked={node.leaf}
            disabled={props.busy}
            onChange={(e) => props.onLeaf(node.slug, e.target.checked)}
          />
          Leaf
        </label>
      </div>
      {marks.length > 0 ? (
        <div className="mark-chips">
          {marks.map((kind) => (
            <span key={kind} className="mark-chip">
              {MARK_LABELS[kind as MarkKind] ?? kind}
              <button
                type="button"
                className="chip-x"
                disabled={props.busy}
                aria-label={`Remove ${kind} mark`}
                onClick={() => props.onUnmark(node.slug, kind)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {node.detailStatus === "leased" ? (
        <p className="hint">
          Leased — unmark waits for TTL/reclaim. Do not complete work from this UI.
        </p>
      ) : null}
      {node.anchorsUnresolved && node.anchorsUnresolved.length > 0 ? (
        <p className="warn">Unresolved anchors: {node.anchorsUnresolved.join(", ")}</p>
      ) : null}
      <h3>Body</h3>
      {node.bodyMd?.trim() ? (
        <MarkdownBody text={node.bodyMd} />
      ) : (
        <p className="hint">
          No entity body yet. Detail complete must write prose in the init locale.
        </p>
      )}
      <h3>Anchors</h3>
      {anchors.length === 0 ? (
        <p className="hint">No anchors on this node.</p>
      ) : (
        <ul className="anchors">
          {anchors.map((a) => {
            const loc = [a.startLine && `L${a.startLine}`, a.endLine && `L${a.endLine}`, a.symbol]
              .filter(Boolean)
              .join(" · ");
            const key = `${a.path}:${a.symbol ?? ""}:${a.startLine ?? ""}:${a.endLine ?? ""}`;
            const selected = props.preview ? sameAnchor(props.preview, a) : false;
            return (
              <li key={key}>
                <button
                  type="button"
                  className={selected ? "linkish active" : "linkish"}
                  onClick={() => props.onPreview(a)}
                  title="Preview in UI"
                  aria-pressed={selected}
                >
                  {a.path}
                </button>
                {loc ? <span className="hint"> {loc}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
      <h3>Refs</h3>
      {outgoing.length === 0 && incoming.length === 0 ? (
        <p className="hint">No refs on this node. Relevance links are not parent→child.</p>
      ) : (
        <ul className="anchors">
          {outgoing.map((r) => {
            const target = props.nodes.get(r.to);
            const label = target?.title ?? r.to;
            return (
              <li key={`out:${r.kind}:${r.to}`}>
                <span className="hint">{r.kind} → </span>
                {target ? (
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => props.onGoTo(r.to)}
                    title={`Go to ${r.to}`}
                  >
                    {label}
                  </button>
                ) : (
                  <span className="warn">{r.to}</span>
                )}
                {target && label !== r.to ? <span className="hint"> {r.to}</span> : null}
              </li>
            );
          })}
          {incoming.map((r) => {
            const source = props.nodes.get(r.from);
            const label = source?.title ?? r.from;
            return (
              <li key={`in:${r.kind}:${r.from}`}>
                <span className="hint">{r.kind} ← </span>
                {source ? (
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => props.onGoTo(r.from)}
                    title={`Go to ${r.from}`}
                  >
                    {label}
                  </button>
                ) : (
                  <span className="warn">{r.from}</span>
                )}
                {source && label !== r.from ? <span className="hint"> {r.from}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
      <h3>Children</h3>
      {node.children.length === 0 ? (
        <p className="hint">No children yet. Mark detail to split further.</p>
      ) : (
        <ul className="anchors">
          {node.children.map((child) => {
            const target = props.nodes.get(child);
            const label = target?.title ?? child;
            return (
              <li key={child}>
                {target ? (
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => props.onGoTo(child)}
                    title={`Go to ${child}`}
                  >
                    {label}
                  </button>
                ) : (
                  <span className="warn">{child}</span>
                )}
                {target && label !== child ? <span className="hint"> {child}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function App(): ReactElement {
  const [model, setModel] = useState<MapReadModel | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Anchor | null>(null);
  const [stale, setStale] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const expandSeeded = useRef(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(loadSidebarOpen);
  const [sidebarTab, setSidebarTab] = useState<"terminal" | "code" | "feedback">("terminal");
  const [navTab, setNavTab] = useState<NavTab>(loadNavTab);
  const [split, setSplit] = useState(loadSplit);
  const [markMenu, setMarkMenu] = useState(false);
  const [visit, setVisit] = useState<VisitMirror>(() => emptyVisitMirror());
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const viewBootstrapped = useRef(false);
  const skipHistoryPush = useRef(true);

  const reload = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [map, sess] = await Promise.all([fetchMapStatus(), fetchSession()]);
      setModel(map);
      setSession(sess);
      setStale(false);
      if (!expandSeeded.current) {
        expandSeeded.current = true;
        const nodeMap = new Map<string, MapNode>();
        for (const n of map.nodes) nodeMap.set(n.slug, n);
        setExpanded(initialExpandedSlugs(map.rootSlug, nodeMap, sess.expandDepth ?? 1));
      }
      setSelected((cur) => {
        const fromHash = slugFromHash(window.location.hash);
        if (fromHash && map.nodes.some((n) => n.slug === fromHash)) return fromHash;
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

  const shownFingerprint = model ? mapFingerprint(model) : null;

  useEffect(() => {
    if (!shownFingerprint || busy) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const [map, sess] = await Promise.all([fetchMapStatus(), fetchSession()]);
        if (cancelled) return;
        setSession((cur) =>
          cur
            ? {
                ...cur,
                gitHead: sess.gitHead,
                mapAnchor: sess.mapAnchor,
                refreshRequired: sess.refreshRequired,
              }
            : sess,
        );
        setStale(mapFingerprint(map) !== shownFingerprint);
      } catch {
        /* poll is best-effort; Reload stays manual */
      }
    };
    const id = setInterval(() => void tick(), 2000);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [shownFingerprint, busy]);

  const nodes = useMemo(() => bySlug(model), [model]);
  const parents = useMemo(
    () => (model ? parentBySlug(model.rootSlug, nodes) : new Map<string, string>()),
    [model, nodes],
  );
  const selectedNode = selected ? (nodes.get(selected) ?? null) : null;
  const crumbs = selected ? breadcrumbSlugs(selected, parents) : [];
  const prevSlug = visitPrevSlug(visit);
  const nextSlug = visitNextSlug(visit);

  useEffect(() => {
    if (viewBootstrapped.current || !model) return;
    viewBootstrapped.current = true;
    let cancelled = false;
    const boot = async () => {
      const fromQuery = new URLSearchParams(window.location.search).get("v");
      let id = fromQuery;
      if (id) {
        const res = await fetch(`/api/view/${encodeURIComponent(id)}`);
        if (!res.ok) id = null;
      }
      if (!id) id = await createMapView();
      if (cancelled || !id) return;
      setViewId(id);
      const slug = slugFromHash(window.location.hash) || selected || model.rootSlug;
      const known = slug && model.nodes.some((n) => n.slug === slug) ? slug : model.rootSlug;
      if (known) {
        skipHistoryPush.current = true;
        history.replaceState({ slug: known }, "", mapViewHref(id, known));
        skipHistoryPush.current = false;
        setVisit({ stack: [known], index: 0 });
        setSelected(known);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [model, selected]);

  useEffect(() => {
    if (!viewId) return;
    void putMapView(viewId, selected).catch(() => {
      /* view PUT is best-effort */
    });
  }, [viewId, selected]);

  useEffect(() => {
    if (!selectedNode) {
      setPreview(null);
      return;
    }
    const anchors = selectedNode.anchors ?? [];
    setPreview((cur) => previewForNode(anchors, cur));
  }, [selectedNode]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SIDEBAR_KEY, sidebarOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarOpen]);

  useEffect(() => {
    try {
      sessionStorage.setItem(NAV_TAB_KEY, navTab);
    } catch {
      /* ignore */
    }
  }, [navTab]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SPLIT_KEY, JSON.stringify(split));
    } catch {
      /* ignore */
    }
  }, [split]);

  useLayoutEffect(() => {
    if (!selected || !model) return;
    let frames = 0;
    let raf = 0;
    const attempt = () => {
      const ae = document.activeElement;
      if (ae instanceof HTMLElement && ae.closest(".preview-panel, .detail")) return;
      if (focusTreeRow(selected)) return;
      frames += 1;
      if (frames < 12) raf = requestAnimationFrame(attempt);
    };
    attempt();
    return () => cancelAnimationFrame(raf);
  }, [model, selected]);

  function selectNode(slug: string, historyMode: "push" | "replace" | "none" = "push") {
    setMarkMenu(false);
    setSelected(slug);
    setExpanded((cur) => {
      const next = new Set(cur);
      for (const a of ancestorSlugs(slug, parents)) next.add(a);
      return next;
    });
    queueMicrotask(() => focusTreeRow(slug));
    if (historyMode === "push") {
      setVisit((cur) => visitPush(cur, slug));
    } else if (historyMode === "replace") {
      setVisit((cur) => {
        if (cur.stack.length === 0 || cur.index < 0) return { stack: [slug], index: 0 };
        const stack = [...cur.stack];
        stack[cur.index] = slug;
        return { stack, index: cur.index };
      });
    }
    if (
      viewId &&
      historyMode !== "none" &&
      !skipHistoryPush.current &&
      slug !== slugFromHash(window.location.hash)
    ) {
      const href = mapViewHref(viewId, slug);
      if (historyMode === "replace") history.replaceState({ slug }, "", href);
      else history.pushState({ slug }, "", href);
    }
  }

  function onGraphNavigate(slug: string) {
    if (slug === selected) return;
    if (slug === prevSlug) {
      history.back();
      return;
    }
    if (slug === nextSlug) {
      history.forward();
      return;
    }
    selectNode(slug);
  }

  function setExpandedOpen(slug: string, open: boolean) {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (open) next.add(slug);
      else next.delete(slug);
      return next;
    });
  }

  function onTreeKeyDown(e: KeyboardEvent, slug: string) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectNode(slug);
    }
  }

  function applyTreeNavKey(key: string, slug: string, e: { preventDefault: () => void }): void {
    const visible = model ? visibleSlugs(model.rootSlug, nodes, expanded) : [];
    const result = applyTreeKey(key, slug, visible, nodes, expanded, parents);
    if (result.kind === "noop") return;
    e.preventDefault();
    if (result.kind === "select") selectNode(result.slug);
    if (result.kind === "expand") setExpandedOpen(result.slug, true);
    if (result.kind === "collapse") setExpandedOpen(result.slug, false);
  }

  useEffect(() => {
    const onPop = () => {
      const slug = slugFromHash(window.location.hash);
      if (!slug) return;
      setVisit((cur) => visitPopTo(cur, slug));
      selectNode(slug, "none");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  });

  useEffect(() => {
    if (!selected || !model || navTab !== "tree") return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (!TREE_NAV_KEYS.has(e.key)) return;
      if (treeKeysBlocked(e.target)) return;
      applyTreeNavKey(e.key, selected, e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const todoRows = useMemo(() => (model ? humanTodoRows(model.nodes) : []), [model]);

  function toggleExpand(slug: string) {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function onMark(slug: string, kind: MarkKind) {
    setBusy(true);
    setError(null);
    try {
      await markNode(slug, kind);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function onUnmark(slug: string, kind: string) {
    setBusy(true);
    setError(null);
    try {
      await unmarkNode(slug, kind);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function onLeaf(slug: string, leaf: boolean) {
    setBusy(true);
    setError(null);
    try {
      await setLeaf(slug, leaf);
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
        <span
          className={session?.refreshRequired ? "meta behind" : "meta"}
          title={
            session?.refreshRequired && session.gitHead
              ? `HEAD moved. Catch up the map to ${session.gitHead.slice(0, 12)} (routine refresh / snowshoe work next).`
              : session?.mapAnchor
                ? `Map epoch target ${session.mapAnchor}`
                : "Git HEAD (no epoch target yet)"
          }
        >
          {session?.mapAnchor
            ? session.mapAnchor.slice(0, 12)
            : session?.gitHead
              ? session.gitHead.slice(0, 12)
              : "no HEAD"}
        </span>
        <button
          type="button"
          className={stale ? "primary" : undefined}
          onClick={() => void reload()}
          disabled={Boolean(busy && model)}
          title={stale ? "Map changed since this view (skill, CLI, or another tab)" : "Reload map"}
        >
          {busy ? "Loading…" : stale ? "Reload · updated" : "Reload"}
        </button>
        {stale ? <span className="warn">Map changed</span> : null}
        {error ? <span className="error">{error}</span> : null}
        <button
          type="button"
          className="header-sidebar-toggle"
          aria-pressed={sidebarOpen}
          onClick={() => setSidebarOpen((open) => !open)}
        >
          {sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        </button>
      </header>
      <nav className="crumbs" aria-label="Location">
        {crumbs.length === 0 ? (
          <span className="hint">…</span>
        ) : (
          crumbs.map((slug, i) => {
            const node = nodes.get(slug);
            const label = node?.title ?? slug;
            const last = i === crumbs.length - 1;
            return (
              <span key={slug}>
                {i > 0 ? <span className="crumbs-sep"> / </span> : null}
                {last ? (
                  <span className="crumbs-here" title={slug}>
                    {label}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="linkish"
                    title={slug}
                    onClick={() => selectNode(slug)}
                  >
                    {label}
                  </button>
                )}
              </span>
            );
          })
        )}
      </nav>
      <div
        ref={layoutRef}
        className={sidebarOpen ? "layout has-sidebar" : "layout"}
        style={
          sidebarOpen
            ? {
                gridTemplateColumns: `${split.tree}fr 6px ${split.detail}fr 6px ${split.sidebar}fr`,
              }
            : { gridTemplateColumns: `${split.tree}fr 6px ${split.detail}fr` }
        }
      >
        <nav className="nav-pane" aria-label="Map navigation">
          <div className="nav-tabs" role="tablist" aria-label="Map navigation panels">
            {NAV_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={navTab === tab}
                onClick={() => setNavTab(tab)}
              >
                {NAV_TAB_LABELS[tab]}
                {tab === "todos" && todoRows.length > 0 ? (
                  <span className="nav-tab-count">{todoRows.length}</span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="nav-body">
            <div
              className={navTab === "tree" ? "nav-panel tree" : "nav-panel tree hidden"}
              role="tabpanel"
              aria-label="Map tree"
            >
              {model ? (
                <div role="tree" aria-label="Map tree">
                  <TreeNode
                    slug={model.rootSlug}
                    nodes={nodes}
                    selected={selected}
                    expanded={expanded}
                    onSelect={selectNode}
                    onToggle={toggleExpand}
                    onKeyDown={onTreeKeyDown}
                    seen={new Set()}
                  />
                </div>
              ) : (
                <p className="hint">Loading read-model…</p>
              )}
            </div>
            <div
              className={navTab === "graph" ? "nav-panel graph-tab" : "nav-panel graph-tab hidden"}
              role="tabpanel"
              aria-label="Local graph"
            >
              <GraphPanel
                focus={selected}
                nodes={nodes}
                prevSlug={prevSlug}
                nextSlug={nextSlug}
                onNavigate={onGraphNavigate}
              />
            </div>
            <div
              className={navTab === "todos" ? "nav-panel" : "nav-panel hidden"}
              role="tabpanel"
              aria-label="Human todos"
            >
              {todoRows.length === 0 ? (
                <p className="hint">
                  No human todos yet. Mark a node with {MARK_LABELS.learn} or {MARK_LABELS.quiz} in
                  the inspector.
                </p>
              ) : (
                <ul className="todo-list" aria-label="Nodes marked learn or quiz">
                  {todoRows.map((row) => (
                    <li key={row.slug}>
                      <button
                        type="button"
                        className={`todo-row${selected === row.slug ? " selected" : ""}`}
                        data-slug={row.slug}
                        onClick={() => selectNode(row.slug)}
                      >
                        <span className="todo-title">{row.title}</span>
                        <span className="todo-kinds">
                          {row.kinds.map((kind) => (
                            <span key={kind} className="badge">
                              {MARK_LABELS[kind]}
                            </span>
                          ))}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </nav>
        <SplitGutter
          label="Resize tree and inspector"
          onDelta={(dx) => {
            const width = layoutRef.current?.clientWidth ?? 0;
            setSplit((cur) => applySplitDrag(cur, "tree-detail", dx, width, sidebarOpen));
          }}
        />
        <section className="detail">
          <Inspector
            node={selectedNode}
            nodes={nodes}
            preview={preview}
            busy={busy}
            menuOpen={markMenu}
            onMenuOpen={setMarkMenu}
            onMark={onMark}
            onUnmark={onUnmark}
            onLeaf={onLeaf}
            onPreview={(anchor) => {
              setSidebarOpen(true);
              setSidebarTab("code");
              setPreview(anchor);
            }}
            onGoTo={selectNode}
          />
        </section>
        {sidebarOpen ? (
          <>
            <SplitGutter
              label="Resize inspector and sidebar"
              onDelta={(dx) => {
                const width = layoutRef.current?.clientWidth ?? 0;
                setSplit((cur) => applySplitDrag(cur, "detail-sidebar", dx, width, true));
              }}
            />
            <aside className="sidebar" aria-label="Sidebar">
              <div className="sidebar-tabs" role="tablist" aria-label="Sidebar panels">
                <button
                  type="button"
                  role="tab"
                  aria-selected={sidebarTab === "terminal"}
                  onClick={() => setSidebarTab("terminal")}
                >
                  Terminal
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={sidebarTab === "code"}
                  onClick={() => setSidebarTab("code")}
                >
                  Code
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={sidebarTab === "feedback"}
                  onClick={() => setSidebarTab("feedback")}
                >
                  Feedback
                </button>
              </div>
              <div className="sidebar-body">
                <div
                  className={sidebarTab === "terminal" ? "sidebar-panel" : "sidebar-panel hidden"}
                  role="tabpanel"
                >
                  <TerminalPane viewId={viewId} active={sidebarTab === "terminal"} />
                </div>
                <div
                  className={sidebarTab === "code" ? "sidebar-panel" : "sidebar-panel hidden"}
                  role="tabpanel"
                >
                  <PreviewPanel
                    anchor={preview}
                    repoRoot={session?.repoRoot ?? null}
                    active={sidebarTab === "code"}
                  />
                </div>
                <div
                  className={sidebarTab === "feedback" ? "sidebar-panel" : "sidebar-panel hidden"}
                  role="tabpanel"
                >
                  <FeedbackPane active={sidebarTab === "feedback"} />
                </div>
              </div>
            </aside>
          </>
        ) : null}
      </div>
    </div>
  );
}
