#!/bin/sh
# Stamp every local script/stylesheet URL in the pages with ?v=<timestamp>, so phones never mix
# a new page with old cached code after an update (GitHub Pages caches files for 10 minutes).
# Run before each push:  sh scripts/bump-version.sh
set -e
cd "$(dirname "$0")/.."
V=$(date +%Y%m%d%H%M)
for f in index.html app.html make.html play.html darkroom/index.html tests/browser.html; do
  [ -f "$f" ] || continue
  perl -pi -e 's{((?:src|href)="(?!https?:|//|#|mailto:)[^"?]+\.(?:js|css|webmanifest))(?:\?v=\d+)?"}{$1?v='"$V"'"}g' "$f"
done
echo "assets stamped v=$V"
