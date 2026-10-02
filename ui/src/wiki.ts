/** Obsidian-style wiki link: `[[slug]]` or `[[slug|label]]`. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseWikiLink(inner: string): { slug: string; label: string } | null {
  const pipe = inner.indexOf("|");
  const slugPart = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
  const labelPart = pipe >= 0 ? inner.slice(pipe + 1).trim() : "";
  if (!SLUG_RE.test(slugPart)) return null;
  return { slug: slugPart, label: labelPart || slugPart };
}

export type WikiLinkRender = {
  slug: string;
  text: string;
  missing: boolean;
};

/** Resolve display text and missing flag for a wiki target. */
export function resolveWikiLink(
  slug: string,
  label: string,
  titleForSlug?: (slug: string) => string | undefined,
): WikiLinkRender {
  const knownTitle = titleForSlug?.(slug);
  const missing = knownTitle === undefined;
  const text = label !== slug ? label : (knownTitle ?? slug);
  return { slug, text, missing };
}
