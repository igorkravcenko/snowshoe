import { CliError, EXIT_OK, EXIT_USAGE } from "../errors.ts";
import { envelope } from "../json.ts";

export async function runMapView(opts: {
  url?: string;
  id?: string;
}): Promise<{ exitCode: number; body: Record<string, unknown> }> {
  const urlRaw = (opts.url ?? process.env.SNOWSHOE_MAP_URL ?? "").trim();
  const id = (opts.id ?? process.env.SNOWSHOE_VIEW ?? "").trim();
  if (!urlRaw || !id) {
    throw new CliError(
      "map view needs SNOWSHOE_MAP_URL and SNOWSHOE_VIEW (or --url and --id)",
      EXIT_USAGE,
    );
  }
  const base = urlRaw.replace(/\/$/, "");
  const res = await fetch(`${base}/api/view/${encodeURIComponent(id)}`);
  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new CliError(text || `map view HTTP ${res.status}`, EXIT_USAGE);
  }
  if (!res.ok) {
    throw new CliError(
      typeof parsed.error === "string" ? parsed.error : `map view HTTP ${res.status}`,
      EXIT_USAGE,
    );
  }
  const repoRoot = typeof parsed.repoRoot === "string" ? parsed.repoRoot : "";
  const slug = parsed.slug === null || typeof parsed.slug === "string" ? parsed.slug : null;
  return {
    exitCode: EXIT_OK,
    body: envelope("map.view", repoRoot, null, {
      ok: true,
      id,
      slug,
      url: base,
    }),
  };
}
