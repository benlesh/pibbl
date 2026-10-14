# Pibbl Original Tangram logo kit

Version 1.1: the blue curved shape's bottom now aligns exactly with the coral
rectangle's top. Both meet the same horizontal guide at y=140 in the master
geometry. The original raster concept is retained as a historical reference.

Start with `svg/pibbl-horizontal-color.svg` on a light background or
`svg/pibbl-horizontal-color-on-dark.svg` on a dark background. Use
`svg/pibbl-icon-color.svg` when the wordmark is unnecessary.

Open `index.html` for the visual catalog, or read
`Pibbl-Tangram-Brand-Guide.pdf` for usage guidance.

## Included

- Four arrangements: horizontal, stacked, icon-only and wordmark-only.
- Four colorways: full color with dark lettering, full color with white
  lettering, monochrome dark, and monochrome white.
- Editable SVG masters, all lettering outlined; no font dependency or embedded
  raster artwork.
- Transparent PNG exports: icons at 128, 256, 512, 1024 and 2048 px wide;
  horizontal logos at 512, 1024, 2048 and 4096 px wide; stacked and wordmark
  logos at 512, 1024 and 2048 px wide.
- Vector PDF and EPS versions of every master for print/design workflows.
- Favicon SVG, multiresolution ICO and 16/32/48 px PNGs; app/touch icons at
  180/192/512 px; a maskable 512 px icon; lossless horizontal WebP exports.
- Four 1024 px profile images that leave room for circular cropping.
- Light and dark share cards (1200 x 630), wide banners (1500 x 500),
  presentation covers (1920 x 1080), square posts (1080 x 1080), and wallpapers
  (2560 x 1440). These are general-purpose canvases, not a claim about every
  social platform's current crop rules.
- Geometric pattern tile and background, transparent sticker artwork with a
  white border, email logo and simple HTML signature, and a one-time assembly
  SVG animation that respects reduced-motion preferences.
- Color tokens in CSS and JSON, an editable identity specification, export
  builders, original concept, asset manifest and checksum inventory.

## Choosing a file

| Need | File family |
| --- | --- |
| Website or editable design | `svg/` |
| Slides, documents or quick placement | `png/` |
| Print vendor or desktop publishing | `print/pdf/` or `print/eps/` |
| Browser/app icon | `web/` |
| Marketing layout | `marketing/` |

All SVGs and core PNGs have transparent backgrounds. White artwork can appear
blank on a white canvas; use it on a dark background. Marketing PNGs and JPGs
include a background. PDF/EPS masters contain vector artwork; a white PDF page
preview does not make white artwork visible.

## Identity rules

Preserve the triangle, square and curved bowl, their color order, and the
approved lowercase wordmark. Keep a clear margin of at least one eighth of the
mark's painted height (35 units for a 280-unit mark). Masters include that
padding. Use the icon at a recommended minimum of 24 px high; horizontal logo
at 160 px wide; stacked at 120 px wide; wordmark at 100 px wide. A dedicated
16 px favicon is included for browser chrome.

The palette is Blue `#006CFE`, Yellow `#FEC104`, Coral `#FD4534`, Ink `#111211`,
White `#FFFFFF`, with Dark `#141820` and Paper `#F5F5F0` as background colors.
Assets use sRGB. Approximate CMYK values in the guide are a starting point for
printer proofs; the PDFs/EPS are RGB vector masters, not press-profiled PDF/X.
Sticker artwork is the graphic with a white border; a vendor should create its
own bleed and technical cut line to match the chosen size and process.

## Web installation

Copy the contents of `web/` to the desired public asset directory, preserving
relative paths for the supplied manifest:

```html
<link rel="icon" href="/brand/favicon.ico" sizes="any">
<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
<link rel="manifest" href="/brand/site.webmanifest">
```

The web manifest supplies icon metadata only; add application-specific PWA
fields if needed. If using the HTML email signature, host its image at a public
HTTPS URL or attach it inline and replace the relative image source with the
matching CID before inserting the signature into an email client.

## Source and reproduction

The selected source is `reference/original-tangram-concept.png`. The production
artwork is a clean geometric vector reconstruction of that concept, retaining
its silhouette, proportions, color order and lowercase character. The source
image's shading was replaced by sampled flat colors. Lettering was rebuilt as
custom paths rather than traced pixel-for-pixel or assigned an unverified font.

`source/identity.json` defines geometry, placements and palette;
`source/wordmark-paths.json` contains the generated glyph paths. The SVG files
are directly editable in standard vector applications.

To regenerate image exports, run `node source/build.mjs` with `sharp` installed
or point `PIBBL_SHARP_PATH` to that package. To regenerate vector print files
and the guide, run `python3 source/build_pdf.py` with `reportlab` installed.
The gallery and delivery manifest are static handoff files and are not
rewritten by these builders. Run `python3 source/verify.py` with Pillow,
pypdf and reportlab to check the asset set, then `python3 source/pack.py` to rebuild the
manifest, checksums and ZIP. No runtime changes have been made to Pibbl.
