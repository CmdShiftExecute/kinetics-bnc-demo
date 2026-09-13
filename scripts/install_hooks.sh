#!/usr/bin/env bash
# Points this clone's git hooks at the repo's own scan, so the scan runs itself before every
# commit, on every commit message, and before every push. Run once per clone: bash scripts/install_hooks.sh
set -euo pipefail
cd "$(dirname "$0")/.."
git config core.hooksPath scripts/hooks
echo "hooksPath set to scripts/hooks"
