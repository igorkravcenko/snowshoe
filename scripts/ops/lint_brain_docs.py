#!/usr/bin/env python3
"""Lean brain-docs lint for Snowshoe (adapted from sorites, no trading validity packs)."""

from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import enum
import re
import sys
from pathlib import Path

ALLOWED_STATUSES = {
    "active",
    "accepted",
    "proposed",
    "in-progress",
    "superseded",
    "rejected",
    "archived",
    "done",
    "note",
    "evidence",
    "draft",
    "canonical",
    "living",
    "registry",
}

# Docs that are canon indexes / may omit research frontmatter
FRONTMATTER_OPTIONAL = {
    "docs/brain/CURRENT.md",
    "docs/brain/ROADMAP.md",
    "docs/brain/EXPERIMENTS.md",
    "docs/brain/START_HERE.md",
    "docs/brain/DECISIONS/README.md",
    "docs/brain/notes/README.md",
    "docs/evidence/README.md",
    "docs/product/README.md",
    "docs/README.md",
    "docs/archive/README.md",
}


class Severity(enum.Enum):
    ERROR = "error"
    WARNING = "warning"


@dataclasses.dataclass(frozen=True)
class Finding:
    path: Path
    message: str
    severity: Severity = Severity.ERROR


_FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
_MD_LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")


def _parse_date(value: str, *, path: Path, key: str) -> tuple[dt.date | None, list[Finding]]:
    findings: list[Finding] = []
    value = value.strip()
    if not value:
        return None, findings
    try:
        return dt.date.fromisoformat(value), findings
    except ValueError:
        findings.append(Finding(path, f"Invalid {key} date (expected YYYY-MM-DD): {value!r}"))
        return None, findings


def _extract_frontmatter(text: str) -> str | None:
    match = _FRONTMATTER_RE.match(text)
    return None if match is None else match.group(1)


def _parse_frontmatter_kv(frontmatter: str) -> dict[str, str]:
    data: dict[str, str] = {}
    for raw_line in frontmatter.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        key, value = line.split(":", 1)
        data[key.strip()] = value.strip().strip("\"'")
    return data


def _iter_markdown(root: Path) -> list[Path]:
    docs = root / "docs"
    if not docs.is_dir():
        return []
    return sorted(
        p
        for p in docs.rglob("*.md")
        if p.is_file() and "templates" not in p.relative_to(docs).parts
    )


def _rel(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def lint_file(path: Path, *, root: Path) -> list[Finding]:
    findings: list[Finding] = []
    rel = _rel(path, root)
    text = path.read_text(encoding="utf-8")
    fm = _extract_frontmatter(text)

    if fm is None:
        if rel not in FRONTMATTER_OPTIONAL and not rel.endswith("/README.md"):
            # Canon indexes often lack FM; research docs under DECISIONS/notes/evidence should have it
            if any(
                rel.startswith(prefix)
                for prefix in (
                    "docs/brain/DECISIONS/ADR-",
                    "docs/brain/notes/",
                    "docs/evidence/",
                )
            ) and not rel.endswith("README.md"):
                findings.append(Finding(path, "Missing YAML frontmatter"))
        return findings

    data = _parse_frontmatter_kv(fm)
    status = data.get("status")
    if status:
        if status not in ALLOWED_STATUSES:
            findings.append(
                Finding(path, f"Unknown status {status!r}; allowed: {sorted(ALLOWED_STATUSES)}")
            )
    elif any(
        rel.startswith(prefix)
        for prefix in ("docs/brain/DECISIONS/ADR-", "docs/brain/notes/", "docs/evidence/")
    ) and not rel.endswith("README.md"):
        findings.append(Finding(path, "Frontmatter missing status:"))

    for key in ("updated", "date", "accepted"):
        if key in data:
            _, date_findings = _parse_date(data[key], path=path, key=key)
            findings.extend(date_findings)

    # Relative markdown links that look like repo paths
    for target in _MD_LINK_RE.findall(text):
        target = target.strip()
        if not target or target.startswith(("http://", "https://", "mailto:", "#")):
            continue
        target = target.split("#", 1)[0].split("?", 1)[0]
        if not target:
            continue
        candidate = (path.parent / target).resolve()
        try:
            candidate.relative_to(root.resolve())
        except ValueError:
            continue
        if not candidate.exists():
            findings.append(
                Finding(path, f"Broken relative link: {target}", severity=Severity.WARNING)
            )

    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path.cwd(),
        help="Repo root (default: cwd)",
    )
    args = parser.parse_args()
    root = args.root.resolve()

    findings: list[Finding] = []
    for path in _iter_markdown(root):
        findings.extend(lint_file(path, root=root))

    errors = [f for f in findings if f.severity == Severity.ERROR]
    warnings = [f for f in findings if f.severity == Severity.WARNING]

    for f in findings:
        rel = _rel(f.path, root)
        print(f"{f.severity.value.upper()}: {rel}: {f.message}")

    print(f"\n{len(errors)} error(s), {len(warnings)} warning(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
