#!/usr/bin/env bash
# Installs or re-installs the nginx site for the Halvard Project Intelligence System demo on node-ss. Idempotent:
# run it after any change to deploy/kinetics-bnc-demo.nginx or after a rebuild that needs nothing more
# than a reload (a rebuild alone needs no reload, nginx serves dist/ as static files).
#
#   bash /home/sharmas0910/code/kinetics-bnc-demo/deploy/install-site.sh
#
# What it does, every time: copies the site file when it differs, runs sudo nginx -t, reloads only on
# a passing test, then proves port 928 answers from 127.0.0.1 with the built index.html. It never
# touches any other site file, including the MIS demo on 926.
set -euo pipefail

REPO=/home/sharmas0910/code/kinetics-bnc-demo
SRC="$REPO/deploy/kinetics-bnc-demo.nginx"
DST=/etc/nginx/sites-enabled/kinetics-bnc-demo
say() { printf '%s %s\n' "$(date '+%H:%M:%S')" "$*"; }

[ -f "$REPO/dist/index.html" ] || { say "dist/index.html is missing; run bun run build first"; exit 1; }

if sudo cmp -s "$SRC" "$DST" 2>/dev/null; then
  say "site file unchanged at $DST"
  changed=0
else
  sudo install -m 0644 "$SRC" "$DST"
  say "site file written to $DST"
  changed=1
fi
sudo nginx -t
if [ "$changed" = 1 ]; then
  sudo systemctl reload nginx
  say "nginx reloaded"
fi

# proof: the port answers with this build's index.html, and 926 and 927 still answer. The reload is
# asynchronous, so the probe retries for up to five seconds before it judges.
code=000
for _ in $(seq 1 10); do
  code=$(curl -sk -o /tmp/pis-index.html -w '%{http_code}' --resolve node-ss.tail640a1e.ts.net:928:100.100.228.66 https://node-ss.tail640a1e.ts.net:928/ || true)
  [ "$code" = 200 ] && break
  sleep 0.5
done
title=$(grep -o '<title>[^<]*' /tmp/pis-index.html | head -1)
say "928 answers $code, $title"
[ "$code" = 200 ] || exit 1
grep -q 'Halvard Project Intelligence System' /tmp/pis-index.html || { say "928 did not serve the PIS index"; exit 1; }
mis=$(curl -sk -o /dev/null -w '%{http_code}' --resolve node-ss.tail640a1e.ts.net:926:100.100.228.66 https://node-ss.tail640a1e.ts.net:926/ || true)
wms=$(curl -sk -o /dev/null -w '%{http_code}' --resolve node-ss.tail640a1e.ts.net:927:100.100.228.66 https://node-ss.tail640a1e.ts.net:927/ || true)
say "926 (MIS demo, untouched) answers $mis; 927 (WMS demo, untouched) answers $wms"
