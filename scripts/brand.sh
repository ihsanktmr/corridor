#!/usr/bin/env bash
#
# Rasterise the brand SVGs into the PNGs the app and the stores actually consume.
#
#   npm run brand
#
# The SVGs in assets/brand are the source of truth; every PNG here is derived and
# safe to delete. Re-run this after touching any of them.
#
# The wordmark is set in Bricolage Grotesque, which is a project dependency rather
# than a system font, so instead of asking anyone to install it, this points
# fontconfig at the copy already in node_modules for the duration of the run.

set -euo pipefail

cd "$(dirname "$0")/.."

command -v rsvg-convert >/dev/null || {
  echo "rsvg-convert not found. Try: brew install librsvg" >&2
  exit 1
}

SRC=assets/brand/src     # hand-authored, source of truth
LOGO=assets/brand/logo   # generated, safe to delete
FONT_DIR=node_modules/@expo-google-fonts/bricolage-grotesque

mkdir -p "$LOGO"

[ -d "$FONT_DIR" ] || {
  echo "$FONT_DIR missing. Run npm install first" >&2
  exit 1
}

# Scratch fontconfig that knows about the bundled Bricolage and nothing else new.
FC_DIR=$(mktemp -d)
trap 'rm -rf "$FC_DIR"' EXIT
cat > "$FC_DIR/fonts.conf" <<EOF
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>$(pwd)/$FONT_DIR</dir>
  <dir>/System/Library/Fonts</dir>
  <dir>/Library/Fonts</dir>
  <cachedir>$FC_DIR/cache</cachedir>
</fontconfig>
EOF
export FONTCONFIG_FILE="$FC_DIR/fonts.conf"

render() { # svg out width height
  rsvg-convert "$1" -w "$3" -h "$4" -o "$2"
  echo "  $2  ${3}×${4}"
}

# Re-emit an SVG with its text converted to paths. The shareable logos get dropped into
# a portfolio, a deck, or someone else's design tool, none of which will have Bricolage
# Grotesque installed, and a lockup that silently falls back to Helvetica is worse than
# no vector at all. The hand-authored sources in src/ keep their live <text>.
outline() { # svg out
  rsvg-convert -f svg "$1" -o "$2"
  echo "  $2  vector, text outlined"
}

echo "app + web"
render $SRC/icon.svg          assets/icon.png           1024 1024
render $SRC/adaptive-icon.svg assets/adaptive-icon.png  1024 1024
render $SRC/splash-icon.svg   assets/splash-icon.png    1024 1024
render $SRC/favicon.svg       assets/favicon.png          48   48

# The shareable logos. One size each, at 2400/1024, big enough for print and any
# screen, and the SVG beside it covers everything else. An earlier cut also emitted
# 512/600/1200 variants; they were redundant next to a vector and just made the folder
# hard to choose from, which is its own kind of broken.
echo "logo"
render  $SRC/lockup-on-void.svg $LOGO/corridor-logo.png          2400 1018
outline $SRC/lockup-on-void.svg $LOGO/corridor-logo.svg
render  $SRC/lockup.svg         $LOGO/corridor-logo-on-dark.png  2400  646
outline $SRC/lockup.svg         $LOGO/corridor-logo-on-dark.svg
render  $SRC/mark.svg           $LOGO/corridor-mark.png          1024 1024
cp      $SRC/mark.svg           $LOGO/corridor-mark.svg  # no text, nothing to outline
echo "  $LOGO/corridor-mark.svg  vector"

# iOS rejects an alpha channel on the store icon; rsvg emits RGBA regardless.
if command -v magick >/dev/null; then
  magick assets/icon.png -background "#14120F" -alpha remove -alpha off assets/icon.png
  echo "  assets/icon.png  alpha flattened"
else
  echo "  ! magick not found. assets/icon.png still has an alpha channel," >&2
  echo "    which App Store Connect will reject on upload." >&2
fi

echo "done"
