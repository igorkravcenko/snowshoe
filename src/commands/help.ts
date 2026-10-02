import { EXIT_OK } from "../errors.ts";
import { gitHead } from "../git.ts";
import { envelope } from "../json.ts";
import { findRepoRoot } from "../paths.ts";

/** Compact index for agents (`snowshoe help --json`). Payloads stay in drain.md / per-command --help. */
export const AGENT_HELP = {
  audience: "agent",
  always: [
    "Pass --json and parse stdout.",
    "Do not write .snowshoe/ yourself.",
    "Entry for drain is work next.",
  ],
  mark: "map mark|unmark or map detail mark|cancel only if this turn the human asked (named slug / this node / cancel that mark). Work kinds: expand (grow), enrich (fields/body), fix (repair). Do not crawl unmarked nodes.",
  commands: [
    {
      run: "snowshoe help --json",
      when: "Command index (this document).",
    },
    {
      run: "snowshoe work next --json",
      when: "Drain entry. Follow todo, then items. Repeat until idle (unless they asked --wait).",
    },
    {
      run: "snowshoe work next --json --wait",
      when: "Only if they asked to keep draining as they mark. One waiter per session.",
    },
    {
      run: "snowshoe work complete --json",
      when: "After a claimed step. Envelope on stdin or --input. See drain.md for payloads. Match item.kind (expand|enrich|fix).",
    },
    {
      run: "snowshoe init --json",
      when: "When work next todo says so. Optional --locale on first/amend.",
    },
    {
      run: "snowshoe routine refresh --json",
      when: "When work next todo says so (HEAD left the map epoch).",
    },
    {
      run: "snowshoe routine advance --json",
      when: "When work next todo says so.",
    },
    {
      run: "snowshoe map status --json",
      when: "Read the map. Default columns slug,children. --slug is one node; --depth subtree; --neighborhood ego graph; --all-fields full row. See map status --help.",
    },
    {
      run: "snowshoe map mark --json --slug <slug> --kind expand",
      when: "Queue expand (grow/fill). Other work kinds: enrich (fields/body only), fix (repair). learn/quiz are not work next. Only if this turn they asked.",
    },
    {
      run: "snowshoe map detail mark --json --slug <slug>",
      when: "Alias of map mark kind=expand. Only if this turn they asked to mark/expand that node.",
    },
    {
      run: "snowshoe map detail cancel --json --slug <slug>",
      when: "Drop pending expand/enrich/fix on that slug. Only if this turn they asked to cancel.",
    },
    {
      run: "snowshoe map serve",
      when: "Local map UI. Only if they asked to start it.",
    },
    {
      run: "snowshoe map view --json",
      when: "Learn/PTY: focused slug from a running map serve (env SNOWSHOE_MAP_URL / SNOWSHOE_VIEW).",
    },
    {
      run: "snowshoe feedback add --json",
      when: "Optional local note about Snowshoe. Not required. stdin { text, command? }.",
    },
  ],
} as const;

export function runHelp(cwd = process.cwd()): { exitCode: number; body: Record<string, unknown> } {
  const repoRoot = findRepoRoot(cwd);
  return {
    exitCode: EXIT_OK,
    body: envelope("help", repoRoot, gitHead(repoRoot), { ...AGENT_HELP }),
  };
}
