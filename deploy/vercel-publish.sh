#!/usr/bin/env bash
# Publish this demo's BUILT dist/ to Vercel as a static site.
#
#   deploy/vercel-publish.sh <vercel-project-name> [deep-route]
#
# Why this exists: the demo lives on node-ss behind the tailnet. This publishes the same
# built dist/ to Vercel so it survives node-ss being unreachable. It deploys the BUILT
# OUTPUT, never a rebuild of its own, so what Vercel serves is what the caller just built
# and gated. Two callers, one script: the GitHub Action (.github/workflows/publish.yml)
# on every push to main, with the token held as the repository secret VERCEL_TOKEN; and
# ~/server-ops/bin/kinetics-vercel-deploy.sh on node-ss by hand, which sources the token
# from ~/.vercel_token and calls this. The token is read from the environment only.
#
# Two things every one of these apps needs and a bare static upload does not give:
#   1. A single-page-app fallback. The app uses path-based routing (BrowserRouter), so
#      /projects is not a file on disk. Without the rewrite, every deep link and every
#      page refresh returns 404 and only the homepage works.
#   2. noindex headers. This is a closed client demo and must not reach a search engine.
set -euo pipefail

PROJECT=${1:?vercel project name required}
DEEP_ROUTE=${2:-/data-basis}
[ -n "${VERCEL_TOKEN:-}" ] || { echo "FAIL: VERCEL_TOKEN is not set in the environment"; exit 1; }

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
DIST="$ROOT_DIR/dist"
[ -f "$DIST/index.html" ] || { echo "FAIL: no build at $DIST (run the build first)"; exit 1; }

# The staging directory's BASENAME becomes the Vercel project name, so it must be exactly the
# project name: Vercel rejects uppercase, dots and the sequence '---', which a mktemp suffix
# supplies on its own and which fails only at upload time, after the whole directory is copied.
STAGE_ROOT=$(mktemp -d "/tmp/vercel-publish.XXXXXX")
trap 'rm -rf "$STAGE_ROOT"' EXIT
STAGE="$STAGE_ROOT/$PROJECT"
mkdir -p "$STAGE"
cp -a "$DIST/." "$STAGE/"

cat > "$STAGE/vercel.json" <<'JSON'
{
  "rewrites": [{ "source": "/((?!assets/|data/|.*\\.[a-zA-Z0-9]+$).*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "X-Robots-Tag", "value": "noindex, nofollow, noarchive" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "no-referrer" }
    ]}
  ]
}
JSON
printf 'User-agent: *\nDisallow: /\n' > "$STAGE/robots.txt"

echo "publishing $PROJECT from $DIST ($(du -sh "$DIST" | cut -f1))"

# The CLI prints progress, the preview URL and the final alias on STDERR, not stdout, so the
# URL is parsed from the log rather than captured from a pipe; a deploy that cannot name its
# own URL is indistinguishable from one that failed.
LOG="$STAGE_ROOT/vercel.log"
( cd "$STAGE" && npx --yes vercel@latest deploy --prod --yes --token "$VERCEL_TOKEN" ) >"$LOG" 2>&1 || {
  echo "FAIL: vercel deploy exited non-zero"; tail -25 "$LOG"; exit 1; }

ALIAS=$(grep -oE 'https://[A-Za-z0-9.-]+\.vercel\.app' "$LOG" | grep -vE '\-[a-z0-9]{9}-' | tail -1 || true)
PREVIEW=$(grep -oE 'https://[A-Za-z0-9.-]+\.vercel\.app' "$LOG" | tail -1 || true)
URL=${ALIAS:-$PREVIEW}
[ -n "$URL" ] || { echo "FAIL: no URL in the deploy log"; tail -25 "$LOG"; exit 1; }

# Verify from the live origin, not from the fact that the upload finished: the root must
# return 200, a deep route must ALSO return 200 (the single thing the rewrite exists to
# guarantee and the single thing that silently breaks on a static host), and the live
# index.html must name the same main script as the dist/ that was just built, so a deploy
# that landed an older build cannot read as a success.
sleep 3
ROOT=$(curl -s -o /dev/null -w '%{http_code}' "$URL/")
DEEP=$(curl -s -o /dev/null -w '%{http_code}' "$URL$DEEP_ROUTE")
BUILT=$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' "$DIST/index.html" | head -1)
SERVED=$(curl -sL "$URL/" | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1)
echo "$PROJECT -> $URL   root:$ROOT  deep-route:$DEEP  built:$BUILT  served:$SERVED"
[ "$ROOT" = "200" ] && [ "$DEEP" = "200" ] || { echo "FAIL: expected 200 on both the root and $DEEP_ROUTE"; exit 1; }
[ -n "$BUILT" ] && [ "$BUILT" = "$SERVED" ] || { echo "FAIL: the live origin serves a different build than dist/"; exit 1; }
