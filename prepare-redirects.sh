#!/usr/bin/env bash
set -euo pipefail

mkdir -p dist
touch dist/.nojekyll
cp redirect.html dist/index.html
cp redirect.html dist/404.html

for game in civrush royal-rummy; do
  mkdir -p "dist/$game"
  cp redirect.html "dist/$game/index.html"
done
