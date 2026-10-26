import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, normalize, resolve, sep } from "node:path";
import { CliError, EXIT_OK, EXIT_USAGE } from "../errors.ts";
import { gitHead } from "../git.ts";
import { envelope } from "../json.ts";
import { findRepoRoot, snowshoePackageRoot } from "../paths.ts";

/** Product skill files (SoT under skills/snowshoe/). */
export const SKILL_PACKAGE_FILES = ["SKILL.md", "drain.md", "learn.md", "install.md"] as const;
export type SkillPackageFile = (typeof SKILL_PACKAGE_FILES)[number];

/** Satellite skill files (SoT under skills/snowshoe-scratch/). */
export const SCRATCH_PACKAGE_FILES = ["SKILL.md"] as const;

export type PackagedSkillSpec = {
  name: string;
  files: readonly string[];
};

/** Packaged skills copied by `skill install` (product + satellite). */
export const PACKAGED_SKILLS: readonly PackagedSkillSpec[] = [
  { name: "snowshoe", files: SKILL_PACKAGE_FILES },
  { name: "snowshoe-scratch", files: SCRATCH_PACKAGE_FILES },
] as const;

const DEFAULT_PACKAGE = "snowshoe";

export function packagedSkillDir(packageName: string, packageRoot = snowshoePackageRoot()): string {
  return join(packageRoot, "skills", packageName);
}

export function findPackagedSkill(name: string): PackagedSkillSpec {
  const spec = PACKAGED_SKILLS.find((p) => p.name === name);
  if (!spec) {
    throw new CliError(
      `Unknown skill package ${name}. Allowed: ${PACKAGED_SKILLS.map((p) => p.name).join(", ")}`,
      EXIT_USAGE,
    );
  }
  return spec;
}

function assertPackagedSkill(spec: PackagedSkillSpec, dir: string): void {
  if (!existsSync(dir)) {
    throw new CliError(`Packaged skill not found at ${dir}`, EXIT_USAGE);
  }
  for (const name of spec.files) {
    if (!existsSync(join(dir, name))) {
      throw new CliError(`Packaged skill missing ${name} under ${dir}`, EXIT_USAGE);
    }
  }
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

export function skillInstallTarget(skillsPathAbs: string, packageName: string): string {
  return join(skillsPathAbs, packageName);
}

function packageInventory(spec: PackagedSkillSpec, packageRoot?: string) {
  const sourceDir = packagedSkillDir(spec.name, packageRoot);
  assertPackagedSkill(spec, sourceDir);
  const files = spec.files.map((name) => {
    const text = readFileSync(join(sourceDir, name), "utf8");
    return { name, bytes: Buffer.byteLength(text, "utf8") };
  });
  return { name: spec.name, sourceDir, files };
}

export function runSkillList(cwd = process.cwd()): {
  exitCode: number;
  body: Record<string, unknown>;
} {
  const repoRoot = findRepoRoot(cwd);
  const packages = PACKAGED_SKILLS.map((spec) => packageInventory(spec));
  const product = packages.find((p) => p.name === DEFAULT_PACKAGE)!;
  return {
    exitCode: EXIT_OK,
    body: envelope("skill.list", repoRoot, gitHead(repoRoot), {
      packages,
      // Back-compat fields for the product package.
      sourceDir: product.sourceDir,
      packageName: product.name,
      files: product.files,
    }),
  };
}

export function runSkillCat(
  file: string | undefined,
  opts: { packageName?: string } = {},
  cwd = process.cwd(),
): { exitCode: number; body: Record<string, unknown> } {
  const repoRoot = findRepoRoot(cwd);
  const packageName = (opts.packageName ?? DEFAULT_PACKAGE).trim() || DEFAULT_PACKAGE;
  const spec = findPackagedSkill(packageName);
  const name = (file ?? "").trim();
  if (!name) {
    throw new CliError(`skill cat requires a file name (${spec.files.join(", ")})`, EXIT_USAGE);
  }
  if (name.includes("/") || name.includes("\\") || name.includes("..") || name.includes("\0")) {
    throw new CliError(`skill cat file must be one of: ${spec.files.join(", ")}`, EXIT_USAGE);
  }
  if (!(spec.files as readonly string[]).includes(name)) {
    throw new CliError(
      `Unknown skill file ${name} for package ${spec.name}. Allowed: ${spec.files.join(", ")}`,
      EXIT_USAGE,
    );
  }
  const sourceDir = packagedSkillDir(spec.name);
  assertPackagedSkill(spec, sourceDir);
  const text = readFileSync(join(sourceDir, name), "utf8");
  return {
    exitCode: EXIT_OK,
    body: envelope("skill.cat", repoRoot, gitHead(repoRoot), {
      sourceDir,
      packageName: spec.name,
      file: name,
      text,
    }),
  };
}

type InstallPackageResult = {
  name: string;
  targetDir: string;
  sourceDir: string;
  written: string[];
  unchanged: string[];
  changed: boolean;
};

function installOnePackage(
  spec: PackagedSkillSpec,
  skillsPath: string,
  overwrite: boolean,
): InstallPackageResult {
  const targetDir = skillInstallTarget(skillsPath, spec.name);
  const sourceDir = packagedSkillDir(spec.name);
  assertPackagedSkill(spec, sourceDir);

  const targetNorm = normalize(targetDir);
  if (targetNorm.includes(`${sep}..${sep}`) || targetNorm.endsWith(`${sep}..`)) {
    throw new CliError("--skills-path resolves to an unsafe path", EXIT_USAGE);
  }

  mkdirSync(targetDir, { recursive: true });

  const written: string[] = [];
  const unchanged: string[] = [];
  let changed = false;

  for (const name of spec.files) {
    const src = join(sourceDir, name);
    const dst = join(targetDir, name);
    const next = readFileSync(src, "utf8");
    if (existsSync(dst)) {
      const prev = readFileSync(dst, "utf8");
      if (prev === next) {
        unchanged.push(name);
        continue;
      }
      if (!overwrite) {
        throw new CliError(
          `Refusing to overwrite ${dst} (differs from packaged skill). Pass --update.`,
          EXIT_USAGE,
          { file: name, targetDir, packageName: spec.name },
        );
      }
    }
    writeFileSync(dst, next, "utf8");
    written.push(name);
    changed = true;
  }

  return {
    name: spec.name,
    targetDir,
    sourceDir,
    written,
    unchanged,
    changed,
  };
}

export function runSkillInstall(
  opts: { skillsPath?: string; force?: boolean; update?: boolean },
  cwd = process.cwd(),
): { exitCode: number; body: Record<string, unknown> } {
  const repoRoot = findRepoRoot(cwd);
  const skillsPath = resolveSkillsPath(cwd, opts.skillsPath);
  const overwrite = Boolean(opts.update || opts.force);

  mkdirSync(skillsPath, { recursive: true });

  const packages = PACKAGED_SKILLS.map((spec) => installOnePackage(spec, skillsPath, overwrite));
  const product = packages.find((p) => p.name === DEFAULT_PACKAGE)!;
  const changed = packages.some((p) => p.changed);

  return {
    exitCode: EXIT_OK,
    body: envelope("skill.install", repoRoot, gitHead(repoRoot), {
      skillsPath,
      update: Boolean(opts.update),
      force: Boolean(opts.force),
      changed,
      packages,
      // Back-compat fields for the product package.
      targetDir: product.targetDir,
      sourceDir: product.sourceDir,
      written: product.written,
      unchanged: product.unchanged,
      files: [...SKILL_PACKAGE_FILES],
    }),
  };
}
