import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FEEDBACK_MAX_TEXT } from "../src/commands/feedback.ts";
import { makeGitRepo, snowshoe } from "./helpers.ts";

describe("feedback inbox", () => {
  test("add without init; list newest first; reject empty", async () => {
    const repo = makeGitRepo();
    const empty = await snowshoe(repo, ["feedback", "add", "--json"], {
      stdin: JSON.stringify({ text: "   " }),
    });
    expect(empty.exitCode).not.toBe(0);

    const first = await snowshoe(repo, ["feedback", "add", "--json"], {
      stdin: JSON.stringify({
        text: "unclear map status default columns",
        command: "map status --json",
      }),
    });
    expect(first.exitCode).toBe(0);
    expect(first.json.command).toBe("feedback.add");
    const entry = first.json.entry as { id: string; text: string; command?: string };
    expect(entry.text).toContain("unclear");
    expect(entry.command).toBe("map status --json");
    expect(existsSync(join(repo, ".snowshoe", "feedback", "log.jsonl"))).toBe(true);

    await snowshoe(repo, ["feedback", "add", "--json"], {
      stdin: JSON.stringify({ text: "second note" }),
    });
    const list = await snowshoe(repo, ["feedback", "list", "--json"]);
    expect(list.exitCode).toBe(0);
    const entries = list.json.entries as Array<{ text: string }>;
    expect(entries[0]?.text).toBe("second note");
    expect(entries[1]?.text).toContain("unclear");
    const raw = readFileSync(join(repo, ".snowshoe", "feedback", "log.jsonl"), "utf8")
      .trim()
      .split("\n");
    expect(raw.length).toBe(2);
  });

  test("rejects oversized text", async () => {
    const repo = makeGitRepo();
    const big = await snowshoe(repo, ["feedback", "add", "--json"], {
      stdin: JSON.stringify({ text: "x".repeat(FEEDBACK_MAX_TEXT + 1) }),
    });
    expect(big.exitCode).not.toBe(0);
  });
});
