import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, normalize, resolve, sep } from "node:path";
import { CliError, EXIT_OK, EXIT_USAGE } from "../errors.ts";
import { gitHead } from "../git.ts";
import { envelope } from "../json.ts";
import { findRepoRoot, snowshoePackageRoot } from "../paths.ts";

/** Packaged product skill files (SoT under skills/snowshoe/). */
export const SKILL_PACKAGE_FILES = ["SKILL.md", "drain.md", "learn.md", "install.md"] as const;
export type SkillPackageFile = (typeof SKILL_PACKAGE_FILES)[number];

const SKILL_DIR_NAME = "snowshoe";

export function packagedSkillDir(packageRoot = snowshoePackageRoot()): string {
  return join(packageRoot, "skills", SKILL_DIR_NAME);
}

function assertPackagedSkill(dir: string): void {
  if (!existsSync(dir)) {
    throw new CliError(`Packaged skill not found at ${dir}`, EXIT_USAGE);
  }
  for (const name of SKILL_PACKAGE_FILES) {
    if (!existsSync(join(dir, name))) {
      throw new CliError(`Packaged skill missing ${name} under ${dir}`, EXIT_USAGE);
    }
  }
}

function isSkillFile(name: string): name is SkillPackageFile {
  return (SKILL_PACKAGE_FILES as readonly string[]).includes(name);
}

/** Resolve --skills-path relative to cwd; reject empty / null bytes. */
export function resolveSkillsPath(cwd: string, skillsPath: string | undefined): string {
  if (skillsPath === undefined || skillsPath === null || String(skillsPath).trim() === "") {
    throw new CliError(
      "skill install requires --skills-path <dir> (e.g. .cursor/skills)",
      EXIT_USAGE,
    );
  }
  const raw = String(skillsPath).trim();
  if (raw.includes("\0")) {
    throw new CliError("--skills-path is invalid", EXIT_USAGE);
  }
  const abs = isAbsolute(raw) ? normalize(raw) : resolve(cwd, raw);
  return abs;
}

export function skillInstallTarget(skillsPathAbs: string): string {
  return join(skillsPathAbs, SKILL_DIR_NAME);
}

export function runSkillList(cwd = process.cwd()): {
  exitCode: number;
  body: Record<string, unknown>;
} {
  const repoRoot = findRepoRoot(cwd);
  const sourceDir = packagedSkillDir();
  assertPackagedSkill(sourceDir);
  const files = SKILL_PACKAGE_FILES.map((name) => {
    const text = readFileSync(join(sourceDir, name), "utf8");
    return { name, bytes: Buffer.byteLength(text, "utf8") };
  });
  return {
    exitCode: EXIT_OK,
    body: envelope("skill.list", repoRoot, gitHead(repoRoot), {
      sourceDir,
      packageName: SKILL_DIR_NAME,
      files,
    }),
  };
}

export function runSkillCat(
  file: string | undefined,
  cwd = process.cwd(),
): { exitCode: number; body: Record<string, unknown> } {
  const repoRoot = findRepoRoot(cwd);
  const name = (file ?? "").trim();
  if (!name) {
    throw new CliError(
      `skill cat requires a file name (${SKILL_PACKAGE_FILES.join(", ")})`,
      EXIT_USAGE,
    );
  }
  if (name.includes("/") || name.includes("\\") || name.includes("..") || name.includes("\0")) {
    throw new CliError(
      `skill cat file must be one of: ${SKILL_PACKAGE_FILES.join(", ")}`,
      EXIT_USAGE,
    );
  }
  if (!isSkillFile(name)) {
    throw new CliError(
      `Unknown skill file ${name}. Allowed: ${SKILL_PACKAGE_FILES.join(", ")}`,
      EXIT_USAGE,
    );
  }
  const sourceDir = packagedSkillDir();
  assertPackagedSkill(sourceDir);
  const text = readFileSync(join(sourceDir, name), "utf8");
  return {
    exitCode: EXIT_OK,
    body: envelope("skill.cat", repoRoot, gitHead(repoRoot), {
      sourceDir,
      file: name,
      text,
    }),
  };
}

export function runSkillInstall(
  opts: { skillsPath?: string; force?: boolean },
  cwd = process.cwd(),
): { exitCode: number; body: Record<string, unknown> } {
  const repoRoot = findRepoRoot(cwd);
  const skillsPath = resolveSkillsPath(cwd, opts.skillsPath);
  const targetDir = skillInstallTarget(skillsPath);
  const sourceDir = packagedSkillDir();
  assertPackagedSkill(sourceDir);

  // Refuse to write through a path that escapes via weird normalization (belt).
  const targetNorm = normalize(targetDir);
  if (targetNorm.includes(`${sep}..${sep}`) || targetNorm.endsWith(`${sep}..`)) {
    throw new CliError("--skills-path resolves to an unsafe path", EXIT_USAGE);
  }

  mkdirSync(skillsPath, { recursive: true });
  mkdirSync(targetDir, { recursive: true });

  const written: string[] = [];
  const unchanged: string[] = [];
  let changed = false;

  for (const name of SKILL_PACKAGE_FILES) {
    const src = join(sourceDir, name);
    const dst = join(targetDir, name);
    const next = readFileSync(src, "utf8");
    if (existsSync(dst)) {
      const prev = readFileSync(dst, "utf8");
      if (prev === next) {
        unchanged.push(name);
        continue;
      }
      if (!opts.force) {
        throw new CliError(
          `Refusing to overwrite ${dst} (differs from packaged skill). Pass --force.`,
          EXIT_USAGE,
          { file: name, targetDir },
        );
      }
    }
    writeFileSync(dst, next, "utf8");
    written.push(name);
    changed = true;
  }

  return {
    exitCode: EXIT_OK,
    body: envelope("skill.install", repoRoot, gitHead(repoRoot), {
      skillsPath,
      targetDir,
      sourceDir,
      force: Boolean(opts.force),
      changed,
      written,
      unchanged,
      files: [...SKILL_PACKAGE_FILES],
    }),
  };
}
