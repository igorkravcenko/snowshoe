import { CliError, EXIT_USAGE } from "../errors.ts";

/** BCP-47 language tag, e.g. `ru`, `en`, `en-US`. */
const BCP47 = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;

export function normalizeLocale(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || !BCP47.test(trimmed)) {
    throw new CliError(
      `Invalid locale (BCP-47 language tag expected, e.g. ru or en): ${raw}`,
      EXIT_USAGE,
    );
  }
  const [language, ...rest] = trimmed.split("-");
  const canon = [
    language!.toLowerCase(),
    ...rest.map((part, i) => {
      if (part.length === 2 && i === 0) return part.toUpperCase();
      if (part.length === 4) return part[0]!.toUpperCase() + part.slice(1).toLowerCase();
      return part.toLowerCase();
    }),
  ];
  return canon.join("-");
}

/** `--locale` and `--ui-language` / JSON `locale` | `uiLanguage` are the same field. */
export function parseLocaleInput(opts: {
  locale?: string | null;
  uiLanguage?: string | null;
}): string | undefined {
  const a = opts.locale?.trim() ? opts.locale.trim() : undefined;
  const b = opts.uiLanguage?.trim() ? opts.uiLanguage.trim() : undefined;
  if (a && b && normalizeLocale(a) !== normalizeLocale(b)) {
    throw new CliError("--locale and --ui-language must match", EXIT_USAGE);
  }
  const raw = a ?? b;
  return raw ? normalizeLocale(raw) : undefined;
}
