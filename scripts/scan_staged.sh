#!/usr/bin/env bash
# Staged-diff scan, run before every commit (pre-commit hook) and again before every push.
#
#   bash scripts/scan_staged.sh            # scans the staged diff
#   bash scripts/scan_staged.sh --tree     # scans every tracked file instead (used before a push)
#   bash scripts/scan_staged.sh --message <file>   # scans a commit message (commit-msg hook)
#
# Refuses: credential shapes, em and en dashes, AI attribution, real source register
# references (the masked register's private originals), and any term in
# .private/forbidden_terms.txt (whole word, case-insensitive). The terms file
# itself and this script are excluded from the terms check, and only from that check.
#
# The terms file is NOT in the repository and must never be: it is the list of real employer and
# vendor names this tree may not mention, so shipping it would publish exactly what it hides.
# It lives in .private/ (gitignored). When it is absent - a fresh clone, or CI - the other three
# checks still run and this one is skipped with a warning, so an outside build is not blocked by
# a file it cannot have. Anyone can restore the gate by writing their own list at that path.
set -uo pipefail
cd "$(dirname "$0")/.."
TERMS=${FORBIDDEN_TERMS:-.private/forbidden_terms.txt}
mode=${1:-staged}
fail=0
say() { printf '%s\n' "$*"; }

# The imported register: data copied verbatim from the supplied workbooks rather than authored
# here. Two of the four checks below are about text we write and do not apply to it.
is_imported() { case "$1" in public/data/*|dist/data/*) return 0;; *) return 1;; esac; }

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
  # The dash rule is a typography rule for prose WE write. The imported register under
  # public/data/ is copied verbatim from the source workbooks, where a dash sits inside a real
  # project or company name; rewriting one would falsify the record, so the register is exempt.
  if ! is_imported "$f" && printf '%s' "$c" | grep -n -e $'\xe2\x80\x94' -e $'\xe2\x80\x93' | head -3 | grep -q .; then
    say "REFUSED: em or en dash in $f"; printf '%s' "$c" | grep -n -e $'\xe2\x80\x94' -e $'\xe2\x80\x93' | head -3; fail=1
  fi
  if [ "$f" != "scripts/scan_staged.sh" ] && printf '%s' "$c" | grep -niE 'co-authored-by|generated with \[?claude|anthropic\.com|written by (claude|an ai)' | head -3 | grep -q .; then
    say "REFUSED: AI attribution in $f"; fail=1
  fi
  # The licensed market register's own project reference numbers are masked by the generator and
  # kept only in .private/ref-map.json. One reaching a tracked file means the published view was
  # restored (bun run refs:restore) and not masked again, or a real reference was pasted by hand.
  if printf '%s' "$c" | grep -nE '\bPRJ[A-Z]{2}[0-9]{3,}\b' | head -3 | grep -q .; then
    say "REFUSED: real source reference in $f (run: bun run refs:mask)"; printf '%s' "$c" | grep -nE '\bPRJ[A-Z]{2}[0-9]{3,}\b' | head -3; fail=1
  fi
done <<< "$files"

# 4. forbidden terms, whole word, case-insensitive, every file except the list and this script
# Two tiers, split by the '--- AUTHORED ONLY' marker in the terms file. HARD terms (above the
# marker) are the principal's employer and its brands: they identify him, and are refused in every
# file including the imported register. AUTHORED terms (below it) guard hand-written examples from
# colliding with real brands, a concern that does not apply to a register of genuine firms.
esc() { sed 's/[.[\*^$\/]/\\&/g'; }
if [ ! -f "$TERMS" ]; then
  say "scan: WARNING - no terms file at $TERMS, so the employer and vendor name check is SKIPPED."
  say "scan: the credential, dash and attribution checks above still ran."
  if [ $fail -eq 0 ]; then say "scan: clean ($(printf '%s\n' "$files" | grep -c .) files, mode $mode, name check skipped)"; fi
  exit $fail
fi
hard_pattern=$(sed -n '1,/--- AUTHORED ONLY/p' "$TERMS" | grep -v '^#' | grep -v '^\s*$' | esc | paste -sd'|' -)
authored_pattern=$(sed -n '/--- AUTHORED ONLY/,$p' "$TERMS" | grep -v '^#' | grep -v '^\s*$' | esc | paste -sd'|' -)
[ -n "$hard_pattern" ] || { say "REFUSED: terms file has no HARD section - refusing to run a gate that checks nothing"; exit 1; }
while IFS= read -r f; do
  [ -f "$f" ] || continue
  case "$f" in "$TERMS"|scripts/scan_staged.sh|*.png|*.jpg|*.woff|*.woff2|*.lock) continue;; esac
  # The repository slug is a path token chosen outside this repo (the directory, the nginx site,
  # the remote) and carries the vendor shorthand; it is masked before the term check so the
  # bare term is still refused everywhere else.
  if is_imported "$f"; then pattern="$hard_pattern"; else pattern="$hard_pattern|$authored_pattern"; fi
  hits=$(content "$f" | sed 's/kinetics-bnc-demo/REPO-SLUG/g' | grep -noiE "\b($pattern)\b" | head -5)
  if [ -n "$hits" ]; then say "REFUSED: forbidden term in $f:"; say "$hits" | sed 's/^/    /'; fail=1; fi
done <<< "$files"

if [ $fail -eq 0 ]; then say "scan: clean ($(printf '%s\n' "$files" | grep -c .) files, mode $mode)"; fi
exit $fail
