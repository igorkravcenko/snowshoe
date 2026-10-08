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
    "If this repo has no snowshoe skill yet: snowshoe skill install --json --skills-path <harness-skills-dir> (e.g. .cursor/skills). Not part of init.",
  ],
  mark: "map mark|unmark or map detail mark|cancel only if this turn the human asked (named slug / this node / cancel that mark). Work kinds: detail (grow and/or rewrite), expand (grow), enrich (fields/body), fix (repair). Do not crawl unmarked nodes.",
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
      when: "After a claimed step. Envelope on stdin or --input. See drain.md for payloads. Match item.kind (detail|expand|enrich|fix).",
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
      when: "Read the map. Default columns slug,children. --slug is one node; --depth subtree; --neighborhood ego graph; --all-fields full row. Prefer bodyOverview when scanning many nodes. See map status --help.",
    },
    {
      run: "snowshoe map mark --json --slug <slug> --kind detail",
      when: "Queue detail (grow and/or rewrite body). Narrow: expand (grow only), enrich (fields/body only), fix (repair). learn/quiz are Later; new/decayed are system inbox. Only if this turn they asked.",
    },
    {
      run: "snowshoe map detail mark --json --slug <slug>",
      when: "Queue kind=detail (grow and/or rewrite). Only if this turn they asked to mark that node.",
    },
    {
      run: "snowshoe map detail cancel --json --slug <slug>",
      when: "Drop pending detail/expand/enrich/fix on that slug. Only if this turn they asked to cancel.",
    },
    {
      run: "snowshoe map metric --json --slug <slug> --overview 0.8",
      when: "Set node metric floats (overview/contracts/internals in [0,1]). Not work next. Only if they asked to set understanding.",
    },
    {
      run: "snowshoe map serve",
      when: "Local map UI. Only if they asked to start it.",
    },
    {
      run: "snowshoe map view --json",
      when: "Learn/PTY: focused slug from a running map serve (env SNOWSHOE_MAP_URL / SNOWSHOE_VIEW / SNOWSHOE_MAP_TOKEN).",
    },
    {
      run: "snowshoe feedback add --json",
      when: "Optional local note about Snowshoe. Not required. stdin { text, command? }.",
    },
    {
      run: "snowshoe feedback remove --json --id <id>",
      when: "Delete one local feedback note by id (from feedback list).",
    },
    {
      run: "snowshoe skill list --json",
      when: "List packaged product skill files (SKILL.md / drain / learn / install).",
    },
    {
      run: "snowshoe skill cat --json SKILL.md",
      when: "Print one packaged skill file (bootstrap without writing to the repo).",
    },
    {
      run: "snowshoe skill install --json --skills-path .cursor/skills",
      when: "Copy packaged skill into <skills-path>/snowshoe/. Opt-in; harness picks the path. --force to overwrite diffs.",
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
