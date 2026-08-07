# Corridor brand assets

The mark is a one-point-perspective passage: a near wall, a far wall, and a single
sightline joining them. It reads as an abstract corridor and, at a glance, as a route
on a map: a line from one point to another.

## Where the logo actually lives

The mark has three representations. They are not independent, and they are not equal:

| | | |
|---|---|---|
| [`corridor-identity.html`](../../corridor-identity.html) | phase 1 spec | **the source of truth** |
| [`components/Mark.tsx`](../../components/Mark.tsx) | in-product, live SVG | ported from the spec |
| `assets/brand/src/*.svg` | exports, this folder | ported from the spec |

Geometry is identical in all three: a 100-unit viewBox, walls at `x=30` and `x=66`,
the sightline running `(30,80) → (66,32)`, arrival dot at the far wall.

**Changing the mark means changing the identity spec first, then re-porting.** That
direction is the whole point of having a locked identity phase, the same rule
[`theme/tokens.ts`](../../theme/tokens.ts) already states for colour and spacing.

## Layout

```
assets/brand/
  src/     hand-authored SVGs; the only files to edit
  logo/    generated and shareable; grab from here
```

Plus `assets/{icon,adaptive-icon,splash-icon,favicon}.png`, generated into place
because [`app.json`](../../app.json) points at those paths.

## Picking a file

**In the app**, don't use any of these. Use `<Mark />`, which scales its stroke to
hold optical weight at any size.

**For a portfolio, deck or README**, everything you want is in `logo/`:

| File | |
|---|---|
| `corridor-logo.png` / `.svg` | **the default.** Plated, so it works on any background |
| `corridor-logo-on-dark.png` / `.svg` | transparent, only for dark surfaces |
| `corridor-mark.png` / `.svg` | mark alone, transparent |

PNGs are 2400px (1024 for the mark); the SVG beside each one covers every other size.
Both lockup SVGs have their **text converted to paths**, so they carry no font
dependency and render correctly in any tool, on any machine.

The plated default is the row people get wrong when they skip it. The wordmark is set
in `paper` (#F6F3EC) on transparency, so it vanishes on a white page. On any surface
Corridor doesn't control, plate it.

`src/` also holds `mark-plain.svg`, the mark without the arrival dot, for small or
repeated use. It's a source, not an export; nothing outside the app needs it yet.

## Geometry is measured, not eyeballed

Both lockups are cropped to a **measured** content box of 258.8×68.4 units:

- `lockup.svg` sits in a viewBox cropped to the artwork. Its first cut used a round
  300×120 canvas, which left ~35 units of invisible trailing whitespace, enough to
  make the logo centre wrong in every layout it was dropped into.
- `lockup-on-void.svg` uses a 330-wide plate giving 35.6 units of margin left and
  right against 35.8 top and bottom. Its first cut used 360 and *looked* balanced in
  the markup while actually running 35.8 left against 65.4 right.

If you change the wordmark, re-measure:

```
rsvg-convert assets/brand/src/lockup.svg -w 3000 -h 1200 -o /tmp/lk.png
magick /tmp/lk.png -trim info:
```

There is deliberately no light-background lockup. It would need a darker sightline to
stay legible on white (`gold-bright` on paper is nearly invisible), and no such value
exists in the locked palette. Adding one is an identity-spec decision.

## Two intentional departures from the canonical mark

Both are optical-size corrections, not different marks:

- **`favicon.svg`** drops the arrival dot (under 2px at 48, where it reads as a compression
  artefact) and thickens the walls from 4 units to 5.5 to hold weight once rasterised.
- **`adaptive-icon.svg`** draws the mark at ×7.333 where iOS uses ×8.667, so the
  bounding-box diagonal lands at 513px inside Android's 676px safe circle and survives
  the roundest OEM mask.

## Regenerating

```
npm run brand
```

The SVGs are the source; **every PNG is derived and safe to delete.** Re-run after
touching any SVG.

Needs `librsvg` (`brew install librsvg`); ImageMagick is optional but strips the alpha
channel off `icon.png`, which App Store Connect rejects. The wordmark is set in
Bricolage Grotesque, a project dependency rather than a system font, so the script points
fontconfig at the copy in `node_modules` rather than asking anyone to install it.

## Generated files

`npm run brand` writes these; they are wired into
[`app.json`](../../app.json):

- `assets/icon.png`: 1024, iOS + store, no alpha
- `assets/adaptive-icon.png`: 1024, Android foreground, transparent
- `assets/splash-icon.png`: 1024, transparent; `expo-splash-screen` paints `void`
  behind it, so the hand-off into the welcome screen has nothing to flash
- `assets/favicon.png`: 48, web

Plus the shareables in `logo/`: `corridor-logo.{png,svg}`,
`corridor-logo-on-dark.{png,svg}`, `corridor-mark.{png,svg}`.

**Nothing outside `src/` is hand-editable**; the next `npm run brand` overwrites all
of it.
