import { mapAuthHeaders } from "./session-token.ts";

export type DetailStatus = "pending" | "leased" | null;

export type Anchor = {
  path: string;
  symbol?: string;
  startLine?: number;
  endLine?: number;
  lineText?: string;
  span?: number;
  locatorOffset?: number;
};

export function sameAnchor(a: Anchor, b: Anchor): boolean {
  return (
    a.path === b.path &&
    a.startLine === b.startLine &&
    a.endLine === b.endLine &&
    a.symbol === b.symbol &&
    (a.locatorOffset ?? 0) === (b.locatorOffset ?? 0)
  );
}

/** Keep the current preview if it still belongs to the node; else the first anchor. */
export function previewForNode(anchors: Anchor[], current: Anchor | null): Anchor | null {
  if (current && anchors.some((a) => sameAnchor(a, current))) return current;
  return anchors[0] ?? null;
}

export type MapNode = {
  slug: string;
  title?: string;
  type: string;
  leaf: boolean;
  detailStatus?: DetailStatus;
  marks?: string[];
  metrics?: {
    overview?: number;
    contracts?: number;
    internals?: number;
  };
  anchors?: Anchor[];
  anchorsUnresolved?: string[];
  proseRef?: string;
  bodyMd?: string | null;
  children: string[];
  refs?: Array<{ to: string; kind: string }>;
};

export function incomingRefs(
  nodes: Iterable<MapNode>,
  slug: string,
): Array<{ from: string; kind: string }> {
  const out: Array<{ from: string; kind: string }> = [];
  for (const n of nodes) {
    for (const r of n.refs ?? []) {
      if (r.to === slug) out.push({ from: n.slug, kind: r.kind });
    }
  }
  return out;
}

export type MapReadModel = {
  generatedAt?: string;
  rootSlug: string;
  locale?: string | null;
  nodes: MapNode[];
  initialized?: boolean;
  hint?: string;
  cta?: string;
};

export type SessionInfo = {
  repoRoot: string;
  gitHead: string | null;
  mapAnchor?: string | null;
  refreshRequired?: boolean;
  locale?: string | null;
  expandDepth?: number;
  packageRoot?: string | null;
  initialized?: boolean;
  hint?: string;
  cta?: string;
};

/** Header / tab title: `<repo basename> map` (not product brand). */
export function mapChromeTitle(repoRoot: string | null | undefined): string {
  if (!repoRoot) return "map";
  const trimmed = repoRoot.replace(/[/\\]+$/, "");
  const parts = trimmed.split(/[/\\]/).filter(Boolean);
  const name = parts.at(-1);
  return name ? `${name} map` : "map";
}

export type FeedbackEntry = {
  id: string;
  createdAt: string;
  text: string;
  command?: string;
};

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }
}

function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = mapAuthHeaders(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  if (
    (method === "POST" || method === "PUT" || method === "PATCH") &&
    !headers.has("content-type")
  ) {
    headers.set("content-type", "application/json");
  }
  return fetch(input, { ...init, headers });
}

export async function fetchMapStatus(): Promise<MapReadModel> {
  const res = await apiFetch("/api/map/status?allFields=1");
  const body = await readJson<MapReadModel & { error?: string }>(res);
  if (!res.ok) throw new Error(body.error ?? `map status HTTP ${res.status}`);
  return body;
}

export async function fetchFeedback(): Promise<FeedbackEntry[]> {
  const res = await apiFetch("/api/feedback");
  const body = await readJson<{ entries?: FeedbackEntry[]; error?: string }>(res);
  if (!res.ok) throw new Error(body.error ?? `feedback HTTP ${res.status}`);
  return body.entries ?? [];
}

export async function addFeedback(text: string, command?: string): Promise<FeedbackEntry> {
  const payload: { text: string; command?: string } = { text };
  if (command?.trim()) payload.command = command.trim();
  const res = await apiFetch("/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await readJson<{ entry?: FeedbackEntry; error?: string }>(res);
  if (!res.ok || !body.entry) throw new Error(body.error ?? `feedback add HTTP ${res.status}`);
  return body.entry;
}

export async function removeFeedback(id: string): Promise<void> {
  const res = await apiFetch(`/api/feedback?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  const body = await readJson<{ ok?: boolean; error?: string; removedId?: string }>(res);
  if (!res.ok) throw new Error(body.error ?? `feedback remove HTTP ${res.status}`);
}

export async function fetchSession(): Promise<SessionInfo> {
  const res = await apiFetch("/api/session");
  const body = await readJson<SessionInfo & { error?: string }>(res);
  if (!res.ok) throw new Error(body.error ?? `session HTTP ${res.status}`);
  return body;
}

export async function fetchMapView(id: string): Promise<boolean> {
  const res = await apiFetch(`/api/view/${encodeURIComponent(id)}`);
  return res.ok;
}

export async function createMapView(): Promise<string> {
  const res = await apiFetch("/api/view", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const body = await readJson<{ id?: string; error?: string }>(res);
  if (!res.ok || !body.id) throw new Error(body.error ?? `view HTTP ${res.status}`);
  return body.id;
}

export async function putMapView(id: string, slug: string | null): Promise<void> {
  const res = await apiFetch(`/api/view/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug }),
  });
  const body = await readJson<{ ok?: boolean; error?: string }>(res);
  if (!res.ok || body.ok === false) {
    throw new Error(body.error ?? `view PUT HTTP ${res.status}`);
  }
}

export async function markNode(slug: string, kind: string): Promise<void> {
  const res = await apiFetch("/api/map/mark", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug, kind }),
  });
  const body = await readJson<{ ok?: boolean; error?: string; reasons?: string[] }>(res);
  if (!res.ok || body.ok === false) {
    throw new Error(body.error ?? body.reasons?.join(", ") ?? `mark HTTP ${res.status}`);
  }
}

export async function unmarkNode(slug: string, kind: string): Promise<void> {
  const res = await apiFetch("/api/map/unmark", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug, kind }),
  });
  const body = await readJson<{ ok?: boolean; error?: string; reasons?: string[] }>(res);
  if (!res.ok || body.ok === false) {
    throw new Error(body.error ?? body.reasons?.join(", ") ?? `unmark HTTP ${res.status}`);
  }
}

export async function readInboxNode(slug: string): Promise<void> {
  const res = await apiFetch("/api/map/inbox/read", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug }),
  });
  const body = await readJson<{ ok?: boolean; error?: string }>(res);
  if (!res.ok || body.ok === false) {
    throw new Error(body.error ?? `inbox read HTTP ${res.status}`);
  }
}

export async function readAllInbox(): Promise<void> {
  const res = await apiFetch("/api/map/inbox/read-all", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const body = await readJson<{ ok?: boolean; error?: string }>(res);
  if (!res.ok || body.ok === false) {
    throw new Error(body.error ?? `inbox read-all HTTP ${res.status}`);
  }
}

export async function setLeaf(slug: string, leaf: boolean): Promise<void> {
  const res = await apiFetch("/api/map/leaf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug, leaf }),
  });
  const body = await readJson<{ ok?: boolean; error?: string; reasons?: string[] }>(res);
  if (!res.ok || body.ok === false) {
    throw new Error(body.error ?? body.reasons?.join(", ") ?? `leaf HTTP ${res.status}`);
  }
}

export type FilePreview = {
  path: string;
  text: string;
  startLine?: number;
  endLine?: number;
  lineCount: number;
};

export async function fetchFile(
  path: string,
  opts: {
    start?: number;
    end?: number;
    lineText?: string;
    span?: number;
    locatorOffset?: number;
  } = {},
): Promise<FilePreview> {
  const q = new URLSearchParams({ path });
  if (opts.start !== undefined) q.set("start", String(opts.start));
  if (opts.end !== undefined) q.set("end", String(opts.end));
  if (opts.span !== undefined) q.set("span", String(opts.span));
  if (opts.locatorOffset !== undefined) q.set("locatorOffset", String(opts.locatorOffset));
  if (opts.lineText) q.set("lineText", opts.lineText);
  const res = await apiFetch(`/api/file?${q.toString()}`);
  const body = await readJson<FilePreview & { error?: string; ok?: boolean }>(res);
  if (!res.ok || body.ok === false) {
    throw new Error(body.error ?? `file HTTP ${res.status}`);
  }
  return body;
}

/** Editor/OS open from the UI. The util never launches an editor. */
export function editorHref(repoRoot: string, anchor: Anchor): string {
  const root = repoRoot.replace(/[/\\]+$/, "");
  const rel = anchor.path.replace(/\\/g, "/").replace(/^\//, "");
  const abs = `${root}/${rel}`;
  if (anchor.startLine && anchor.startLine > 0) {
    return `vscode://file${abs}:${anchor.startLine}:1`;
  }
  return `vscode://file${abs}`;
}
