export type DetailStatus = "pending" | "leased" | null;

export type Anchor = {
  path: string;
  symbol?: string;
  startLine?: number;
  endLine?: number;
};

export function sameAnchor(a: Anchor, b: Anchor): boolean {
  return (
    a.path === b.path &&
    a.startLine === b.startLine &&
    a.endLine === b.endLine &&
    a.symbol === b.symbol
  );
}

export type MapNode = {
  slug: string;
  title?: string;
  type: string;
  leaf: boolean;
  detailStatus?: DetailStatus;
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
};

export type SessionInfo = {
  repoRoot: string;
  gitHead: string | null;
  locale?: string | null;
  expandDepth?: number;
  packageRoot?: string | null;
};

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }
}

export async function fetchMapStatus(): Promise<MapReadModel> {
  const res = await fetch("/api/map/status");
  const body = await readJson<MapReadModel & { error?: string }>(res);
  if (!res.ok) throw new Error(body.error ?? `map status HTTP ${res.status}`);
  return body;
}

export async function fetchSession(): Promise<SessionInfo> {
  const res = await fetch("/api/session");
  const body = await readJson<SessionInfo & { error?: string }>(res);
  if (!res.ok) throw new Error(body.error ?? `session HTTP ${res.status}`);
  return body;
}

export async function createMapView(): Promise<string> {
  const res = await fetch("/api/view", { method: "POST" });
  const body = await readJson<{ id?: string; error?: string }>(res);
  if (!res.ok || !body.id) throw new Error(body.error ?? `view HTTP ${res.status}`);
  return body.id;
}

export async function putMapView(id: string, slug: string | null): Promise<void> {
  const res = await fetch(`/api/view/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug }),
  });
  const body = await readJson<{ ok?: boolean; error?: string }>(res);
  if (!res.ok || body.ok === false) {
    throw new Error(body.error ?? `view PUT HTTP ${res.status}`);
  }
}

export async function markDetail(slug: string): Promise<void> {
  const res = await fetch("/api/map/detail/mark", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug }),
  });
  const body = await readJson<{ ok?: boolean; error?: string; reasons?: string[] }>(res);
  if (!res.ok || body.ok === false) {
    throw new Error(body.error ?? body.reasons?.join(", ") ?? `mark HTTP ${res.status}`);
  }
}

export type FilePreview = {
  path: string;
  text: string;
  startLine?: number;
  endLine?: number;
  lineCount: number;
};

export async function fetchFile(path: string, start?: number, end?: number): Promise<FilePreview> {
  const q = new URLSearchParams({ path });
  if (start !== undefined) q.set("start", String(start));
  if (end !== undefined) q.set("end", String(end));
  const res = await fetch(`/api/file?${q.toString()}`);
  const body = await readJson<FilePreview & { error?: string; ok?: boolean }>(res);
  if (!res.ok || body.ok === false) {
    throw new Error(body.error ?? `file HTTP ${res.status}`);
  }
  return body;
}

export async function cancelDetail(slug: string): Promise<void> {
  const res = await fetch("/api/map/detail/cancel", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug }),
  });
  const body = await readJson<{ ok?: boolean; error?: string; reasons?: string[] }>(res);
  if (!res.ok || body.ok === false) {
    throw new Error(body.error ?? body.reasons?.join(", ") ?? `cancel HTTP ${res.status}`);
  }
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
