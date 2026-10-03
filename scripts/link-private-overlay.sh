#!/usr/bin/env bash
# Link maintainer-only overlay from sibling snowshoe-maintainers into this checkout.
# - .cursor/skills/gan-*  (Orca GAN skills)
# - docs/private          (notes / evidence that stay out of the public tree)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MAINTAINERS="${SNOWSHOE_MAINTAINERS:-$ROOT/../snowshoe-maintainers}"

link_dir() {
  local src="$1"
  local dst="$2"
  if [[ ! -d "$src" ]]; then
    echo "error: missing directory: $src" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$dst")"
  if [[ -e "$dst" || -L "$dst" ]]; then
    if [[ -L "$dst" ]]; then
      rm -f "$dst"
    else
      echo "error: $dst exists and is not a symlink; refuse to overwrite" >&2
      exit 1
    fi
  fi
  ln -sfn "$(cd "$src" && pwd)" "$dst"
  echo "linked $dst -> $(readlink "$dst")"
}

if [[ ! -d "$MAINTAINERS" ]]; then
  echo "error: maintainers repo not found at: $MAINTAINERS" >&2
  echo "Clone snowshoe-maintainers next to this repo, or set SNOWSHOE_MAINTAINERS." >&2
  exit 1
fi

PRIVATE_SKILLS=(gan-orchestrate gan-generate gan-critique)
for name in "${PRIVATE_SKILLS[@]}"; do
  link_dir "$MAINTAINERS/.cursor/skills/$name" "$ROOT/.cursor/skills/$name"
done

if [[ -d "$MAINTAINERS/docs" ]]; then
  link_dir "$MAINTAINERS/docs" "$ROOT/docs/private"
else
  echo "warn: no $MAINTAINERS/docs yet; skipped docs/private" >&2
fi

echo "Private overlay linked from: $MAINTAINERS"
