#!/usr/bin/env bash
# Staged-diff scan, run before every commit (pre-commit hook) and again before every push.
#
#   bash scripts/scan_staged.sh            # scans the staged diff
#   bash scripts/scan_staged.sh --tree     # scans every tracked file instead (used before a push)
#   bash scripts/scan_staged.sh --message <file>   # scans a commit message (commit-msg hook)
#
# Refuses: credential shapes, em and en dashes, AI attribution, and any term in
# scripts/forbidden_terms.txt (whole word, case-insensitive). The terms file
# itself and this script are excluded from the terms check, and only from that check.
set -uo pipefail
cd "$(dirname "$0")/.."
TERMS=scripts/forbidden_terms.txt
mode=${1:-staged}
fail=0
say() { printf '%s\n' "$*"; }

if [ "$mode" = "--message" ]; then
  msg=$(cat "$2")
  if printf '%s' "$msg" | grep -q -e $'\xe2\x80\x94' -e $'\xe2\x80\x93'; then say "REFUSED: commit message contains an em or en dash"; fail=1; fi
  if printf '%s' "$msg" | grep -qiE 'co-authored-by|generated with|claude|anthropic|chatgpt|copilot'; then say "REFUSED: commit message carries AI attribution"; fail=1; fi
  exit $fail
fi

if [ "$mode" = "--tree" ]; then
  files=$(git ls-files)
  content() { cat -- "$1"; }
else
  files=$(git diff --cached --name-only --diff-filter=ACMR)
  content() { git show ":$1"; }
fi
[ -z "$files" ] && { say "scan: nothing to check"; exit 0; }

# 1. credentials, 2. dashes, 3. attribution: every file
while IFS= read -r f; do
  [ -f "$f" ] || continue
  case "$f" in *.png|*.jpg|*.woff|*.woff2|*.lock) continue;; esac
  c=$(content "$f")
  if printf '%s' "$c" | grep -nE 'AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|gh[pous]_[A-Za-z0-9]{20,}|xox[baprs]-|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|(api[_-]?key|secret|token|password)\s*[:=]\s*["'"'"'][^"'"'"']{8,}' | head -3 | grep -q .; then
    say "REFUSED: credential shape in $f"; printf '%s' "$c" | grep -nE 'AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|gh[pous]_[A-Za-z0-9]{20,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|(api[_-]?key|secret|token|password)\s*[:=]\s*["'"'"'][^"'"'"']{8,}' | head -3; fail=1
  fi
  if printf '%s' "$c" | grep -n -e $'\xe2\x80\x94' -e $'\xe2\x80\x93' | head -3 | grep -q .; then
    say "REFUSED: em or en dash in $f"; printf '%s' "$c" | grep -n -e $'\xe2\x80\x94' -e $'\xe2\x80\x93' | head -3; fail=1
  fi
  if [ "$f" != "scripts/scan_staged.sh" ] && printf '%s' "$c" | grep -niE 'co-authored-by|generated with \[?claude|anthropic\.com|written by (claude|an ai)' | head -3 | grep -q .; then
    say "REFUSED: AI attribution in $f"; fail=1
  fi
done <<< "$files"

# 4. forbidden terms, whole word, case-insensitive, every file except the list and this script
pattern=$(grep -v '^#' "$TERMS" | grep -v '^\s*$' | sed 's/[.[\*^$\/]/\\&/g' | paste -sd'|' -)
while IFS= read -r f; do
  [ -f "$f" ] || continue
  case "$f" in "$TERMS"|scripts/scan_staged.sh|*.png|*.jpg|*.woff|*.woff2|*.lock) continue;; esac
  # The repository slug is a path token chosen outside this repo (the directory, the nginx site,
  # the remote) and carries the vendor shorthand; it is masked before the term check so the
  # bare term is still refused everywhere else.
  hits=$(content "$f" | sed 's/kinetics-bnc-demo/REPO-SLUG/g' | grep -noiE "\b($pattern)\b" | head -5)
  if [ -n "$hits" ]; then say "REFUSED: forbidden term in $f:"; say "$hits" | sed 's/^/    /'; fail=1; fi
done <<< "$files"

if [ $fail -eq 0 ]; then say "scan: clean ($(printf '%s\n' "$files" | grep -c .) files, mode $mode)"; fi
exit $fail
