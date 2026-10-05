import { describe, expect, test } from "bun:test";
import { runInit } from "../src/commands/init.ts";
import { runMapInboxRead, runMapInboxReadAll, runMapMetric } from "../src/commands/map.ts";
import { withSession } from "../src/commands/session.ts";
import { makeGitRepo } from "./helpers.ts";

describe("inbox marks", () => {
  test("create stamps new; metric drop stamps decayed; read clears inbox only", () => {
    const repo = makeGitRepo("snowshoe-inbox-");
    runInit(repo);
    withSession((session) => {
      expect(session.ledger.hasMark("root", "new")).toBe(true);

      session.ledger.upsertNode({
        slug: "cli",
        title: "CLI",
        type: "module",
        leaf: false,
      });
      session.ledger.setEdge("root", "cli", "parent");
      session.ledger.seedZeroMetrics("cli");
      session.ledger.setMetric("cli", "overview", 0.9);
      expect(session.ledger.hasMark("cli", "new")).toBe(true);
      expect(session.ledger.hasMark("cli", "decayed")).toBe(false);

      session.ledger.addMark("cli", "learn");
      session.ledger.setMetric("root", "overview", 0.8);
      runMapMetric(session, "cli", { overview: 0.4 });
      expect(session.ledger.hasMark("cli", "decayed")).toBe(true);
      expect(session.ledger.hasMark("root", "decayed")).toBe(true);

      const read = runMapInboxRead(session, "cli");
      expect(read.exitCode).toBe(0);
      expect(session.ledger.hasMark("cli", "new")).toBe(false);
      expect(session.ledger.hasMark("cli", "decayed")).toBe(false);
      expect(session.ledger.hasMark("cli", "learn")).toBe(true);

      const all = runMapInboxReadAll(session);
      expect(all.exitCode).toBe(0);
      expect(session.ledger.hasMark("root", "new")).toBe(false);
      expect(session.ledger.hasMark("root", "decayed")).toBe(false);
    }, repo);
  });

  test("seedZeroMetrics does not stamp decayed", () => {
    const repo = makeGitRepo("snowshoe-inbox-seed-");
    runInit(repo);
    withSession((session) => {
      session.ledger.upsertNode({
        slug: "x",
        title: "X",
        type: "module",
        leaf: true,
      });
      session.ledger.removeMark("x", "new");
      session.ledger.seedZeroMetrics("x");
      expect(session.ledger.hasMark("x", "decayed")).toBe(false);
    }, repo);
  });
});
