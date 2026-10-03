#!/usr/bin/env bash
# Back-compat wrapper. Prefer ./scripts/link-private-overlay.sh
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/link-private-overlay.sh" "$@"
