export type SplitWeights = {
  tree: number;
  detail: number;
  sidebar: number;
};

export const DEFAULT_SPLIT: SplitWeights = { tree: 24, detail: 28, sidebar: 48 };
export const GUTTER_PX = 6;
export const MIN_TREE_PX = 160;
export const MIN_DETAIL_PX = 200;
export const MIN_SIDEBAR_PX = 220;

export function paneInnerWidth(layoutWidth: number, sidebarOpen: boolean): number {
  const gutters = sidebarOpen ? 2 : 1;
  return Math.max(1, layoutWidth - gutters * GUTTER_PX);
}

export function weightsToPx(
  w: SplitWeights,
  inner: number,
  sidebarOpen: boolean,
): { tree: number; detail: number; sidebar: number } {
  if (sidebarOpen) {
    const sum = Math.max(1e-6, w.tree + w.detail + w.sidebar);
    const tree = Math.max(MIN_TREE_PX, (w.tree / sum) * inner);
    const detail = Math.max(MIN_DETAIL_PX, (w.detail / sum) * inner);
    const sidebar = Math.max(MIN_SIDEBAR_PX, inner - tree - detail);
    return { tree, detail, sidebar };
  }
  const sum = Math.max(1e-6, w.tree + w.detail);
  const tree = Math.max(MIN_TREE_PX, (w.tree / sum) * inner);
  const detail = Math.max(MIN_DETAIL_PX, inner - tree);
  return { tree, detail, sidebar: w.sidebar };
}

export function pxToWeights(
  px: { tree: number; detail: number; sidebar: number },
  sidebarOpen: boolean,
): SplitWeights {
  if (sidebarOpen) {
    const sum = Math.max(1e-6, px.tree + px.detail + px.sidebar);
    return { tree: px.tree / sum, detail: px.detail / sum, sidebar: px.sidebar / sum };
  }
  const sum = Math.max(1e-6, px.tree + px.detail);
  return { tree: px.tree / sum, detail: px.detail / sum, sidebar: px.sidebar };
}

function clampMins(
  px: { tree: number; detail: number; sidebar: number },
  sidebarOpen: boolean,
): void {
  px.tree = Math.max(MIN_TREE_PX, px.tree);
  px.detail = Math.max(MIN_DETAIL_PX, px.detail);
  if (sidebarOpen) px.sidebar = Math.max(MIN_SIDEBAR_PX, px.sidebar);
}

/** Drag the tree|detail or detail|sidebar gutter. `dx` is pointer delta in CSS pixels. */
export function applySplitDrag(
  w: SplitWeights,
  kind: "tree-detail" | "detail-sidebar",
  dx: number,
  layoutWidth: number,
  sidebarOpen: boolean,
): SplitWeights {
  if (dx === 0) return w;
  if (kind === "detail-sidebar" && !sidebarOpen) return w;
  const inner = paneInnerWidth(layoutWidth, sidebarOpen);
  const px = weightsToPx(w, inner, sidebarOpen);
  if (kind === "tree-detail") {
    px.tree += dx;
    px.detail -= dx;
  } else {
    px.detail += dx;
    px.sidebar -= dx;
  }
  clampMins(px, sidebarOpen);
  let used = px.tree + px.detail + (sidebarOpen ? px.sidebar : 0);
  if (used > inner) {
    const overflow = used - inner;
    if (kind === "tree-detail") {
      if (dx > 0) px.tree = Math.max(MIN_TREE_PX, px.tree - overflow);
      else px.detail = Math.max(MIN_DETAIL_PX, px.detail - overflow);
    } else if (dx > 0) {
      px.detail = Math.max(MIN_DETAIL_PX, px.detail - overflow);
    } else {
      px.sidebar = Math.max(MIN_SIDEBAR_PX, px.sidebar - overflow);
    }
  }
  used = px.tree + px.detail + (sidebarOpen ? px.sidebar : 0);
  if (used < inner) {
    const slack = inner - used;
    if (kind === "tree-detail") {
      if (dx > 0) px.detail += slack;
      else px.tree += slack;
    } else if (dx > 0) {
      px.sidebar += slack;
    } else {
      px.detail += slack;
    }
  }
  clampMins(px, sidebarOpen);
  px.tree = Math.round(px.tree);
  px.detail = Math.round(px.detail);
  if (sidebarOpen) px.sidebar = Math.round(px.sidebar);
  return pxToWeights(px, sidebarOpen);
}

export function parseSplitWeights(raw: string | null): SplitWeights | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<SplitWeights>;
    if (
      typeof v.tree !== "number" ||
      typeof v.detail !== "number" ||
      typeof v.sidebar !== "number" ||
      !Number.isFinite(v.tree) ||
      !Number.isFinite(v.detail) ||
      !Number.isFinite(v.sidebar) ||
      v.tree <= 0 ||
      v.detail <= 0 ||
      v.sidebar <= 0
    ) {
      return null;
    }
    return { tree: v.tree, detail: v.detail, sidebar: v.sidebar };
  } catch {
    return null;
  }
}
