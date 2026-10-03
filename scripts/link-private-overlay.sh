#!/usr/bin/env bash
# Link maintainer-only overlay from sibling snowshoe-maintainers into this checkout.
# - .cursor/skills/gan-*           (Orca GAN skills)
# - docs/private                   (notes / evidence out of the public tree)
# - .cursor/rules/maintainer-chat.mdc  (optional Russian chat preference)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MAINTAINERS="${SNOWSHOE_MAINTAINERS:-$ROOT/../snowshoe-maintainers}"

link_path() {
  local src="$1"
  local dst="$2"
  if [[ ! -e "$src" ]]; then
    echo "error: missing path: $src" >&2
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
  ln -sfn "$(cd "$(dirname "$src")" && pwd)/$(basename "$src")" "$dst"
  echo "linked $dst -> $(readlink "$dst")"
}

if [[ ! -d "$MAINTAINERS" ]]; then
  echo "error: maintainers repo not found at: $MAINTAINERS" >&2
  echo "Clone snowshoe-maintainers next to this repo, or set SNOWSHOE_MAINTAINERS." >&2
  exit 1
fi

PRIVATE_SKILLS=(gan-orchestrate gan-generate gan-critique)
for name in "${PRIVATE_SKILLS[@]}"; do
  link_path "$MAINTAINERS/.cursor/skills/$name" "$ROOT/.cursor/skills/$name"
done

if [[ -d "$MAINTAINERS/docs" ]]; then
  link_path "$MAINTAINERS/docs" "$ROOT/docs/private"
else
  echo "warn: no $MAINTAINERS/docs yet; skipped docs/private" >&2
fi

CHAT_RULE="$MAINTAINERS/.cursor/rules/maintainer-chat.mdc"
if [[ -f "$CHAT_RULE" ]]; then
  link_path "$CHAT_RULE" "$ROOT/.cursor/rules/maintainer-chat.mdc"
else
  echo "warn: no maintainer-chat.mdc; skipped Russian chat overlay rule" >&2
fi

echo "Private overlay linked from: $MAINTAINERS"
