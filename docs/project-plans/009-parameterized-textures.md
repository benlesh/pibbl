# 009 — Parameterized texture library

Date: 2026-10-09. Status: first collection and fabric slice accepted on 2026-10-12; noise/composition and emboss slice accepted.
Authorization: the user approved documenting the complete texture direction and
starting stripes, checkers, hair, and expanded Gray–Scott. “Strips” is interpreted
as stripes from the preceding proposal. Later families are a recorded backlog,
not a claim of implemented behavior or authorization to implement everything now.
This work does not mark unfinished financial-charting work complete.

## Goal and baseline

Create a large library of recognizable, recolorable, resizable procedural
materials, with motion and interaction where useful. Current shipped foundations
are `defineTexture`, `useTexture`, shared fill/stroke handles, repeating placement,
seeded marble/paper/cellular, Gray–Scott spots/stripes, water, electric textures,
and rain on glass. See [the resource contract](../design/textures-contract.md).

Generators and curated presets are separate: a few dozen generators should support
hundreds of recognizable presets. Private implementation may be shared; public
factories have descriptive names and fixed return/message contracts. No public
`texture({ kind })` factory or backend selector. Simulation model names identify
distinct recipes; a Gray–Scott preset is ordinary configuration of one solver.

## Status board

| Step                                                   | State               | Completion bar                                                                                   |
| ------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------ |
| 1. Document direction and implement first public slice | Done                | Focused tests, shared manually/headlessly driven Studio example, exact URL                       |
| 2. Incorporate feedback and harden first slice         | Next after feedback | Accepted appearance, edge cases, ownership, docs, package/type/editor parity, proportional gates |
| 3. Expand families and living models                   | Backlog             | Select a separately approved vertical slice                                                      |

### [DONE] 1. First slice

Add `stripes`, `checkers`, and `woodGrain` recipes in `@pibbl/core/textures`, plus
Gray–Scott presets and bounded feed/kill controls on the existing recipe and
component. Keep old spots/stripes numerical defaults. Add an interactive Texture
Explorer with one tile and repeated previews, palette, tile size, pattern controls,
motion, and reaction selection. Test first through public imports. Provide the URL
as soon as runnable; do not wait for exhaustive hardening.

### 2. Feedback and hardening

After hands-on evaluation, add broader edge cases, resource counters, final API
reference/guide details, adversarial review, and aggregate checks appropriate to
the accepted change. New APIs must agree across exports, declarations, Bundler,
NodeNext, packed/browser builds, and Studio editor declarations.

### [TODO] 3. Later families

Choose the next family after first-slice feedback. Candidate order: fabrics,
noise/composition, Schnakenberg/Barkley/Brusselator, then other materials.

## Decision log

- Reuse texture ownership/publication and the realm scheduler. No second RAF loop,
  worker API, raw raster accessor, cross-root sharing, or renderer rewrite.
- Distinguish spatially seamless, animated, and exactly looping. Do not advertise
  stateful reaction diffusion as an exactly looping or seekable animation.
- Palette belongs to `useTexture`; logical tile size belongs to paint placement.
  Resolution controls raster quality independently of display and feature sizes.
- Periodic generators retain periodic structure during motion. Arbitrary paint
  rotation rotates the repeat lattice; arbitrary feature rotation within a fixed
  tile needs its own periodic construction.
- Simple pattern recipes may rasterize directly using Canvas/ImageData; this adds
  no backend choice and does not change existing WASM kernels. Gray–Scott stays
  in WASM, with bounded numerical stepping and memory ownership unchanged.
- 2026-10-11 feedback: the user accepted the first slice and identified the strand
  recipe as wood rather than hair. Rename the unreleased factory to `woodGrain`,
  replace regular sinusoidal bending with seeded multiscale periodic noise, and
  add optional knot count/size. Zero knots gives clear grain. Actual hair/fur
  remains a separate backlog family.
- 2026-10-12 feedback: knots must displace grain outward and keep a round-to-
  elliptical outline elongated along the grain. Use an inverse flow coordinate
  around each knot, with periodic compact support. The Explorer pattern detail
  preserves square texture proportions instead of squeezing knots sideways.
- Stripe frequency is integer; checker rows/columns are even integers to preserve
  alternation across repeats. Wave frequencies are integer on the periodic tile.
- Motion defaults to zero for geometric/fiber recipes so unchanged materials idle.
  Speed is cycles per second; phase is in cycles. No new public operation selectors.
- Expanded Gray–Scott presets are curated feed/kill pairs, not new solvers. Expose
  numeric feed/kill overrides with bounded validation. Preset/chemistry changes
  reset consistently; recoloring preserves the simulation. Warm-start is deferred.
- Do not promise seam-identical border pixels for simulations: periodic neighbor
  evolution is the correct lattice boundary. Existing paint clipping and clamped
  stirring remain unchanged in slice one; periodic interaction is later work.
- Parameter vocabulary should be specific: curl, duty cycle, thread thickness,
  grout width, spot density. Avoid an unexplained catch-all detail control.

## Complete visual catalog

These are proposed visual directions, not individual implementation commitments.

| Family                 | Ten candidate textures                                                                                                                           | Controls                                                        | Motion                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ----------------------------------- |
| Stripes                | Pinstripe, candy stripe, barcode, ticking, uneven bands, broken stripes, dashed stripes, wavy stripes, braided stripes, zebra stripe             | Width, spacing, angle, duty cycle, irregularity, wave amplitude | Scroll, wave, breathe, spacing      |
| Checks/plaids          | Checkerboard, gingham, buffalo check, tartan, windowpane, graph check, madras, argyle, checker weave, distorted checker                          | Row/column widths, band colors, offsets, intersections          | Crossing bands, ripples, colors     |
| Dots/marks             | Polka dots, staggered dots, halftone, stipple, confetti, dashes, plus signs, crosses, diamonds, stars                                            | Density, radius, jitter, shape, spacing, distributions          | Pulse, twinkle, drift, rotate       |
| Grids/tiling           | Square, triangle, honeycomb, diamond lattice, brick bond, basketweave, herringbone, hex mosaic, octagonal tile, interlocking blocks              | Cell size, border, stagger, grout, bevel                        | Highlights, pulses, offsets         |
| Decorative geometry    | Truchet curves, Truchet triangles, chevrons, zigzags, scallops, overlapping circles, interlocking rings, guilloché, rosettes, woven knots        | Radius, line weight, symmetry, density, orientation             | Morph, phase, line highlights       |
| Woven fabric           | Plain weave, twill, satin, denim, canvas, linen, burlap, silk, wool weave, jacquard                                                              | Warp/weft, thickness, fuzz, slubs, crossing relief              | Shimmer, fabric waves, light        |
| Knit/stitch            | Stockinette, garter, rib knit, cable knit, crochet mesh, lace, cross-stitch, running stitch, quilted diamonds, embroidery                        | Stitch size, yarn, tension, openings, relief                    | Stretch, sway, reveal, light        |
| Hair/fibers            | Straight hair, wavy hair, curls, tight coils, short fur, long fur, brushed fur, felt, grass fibers, feather barbs                                | Direction, length, density, curl, clumps, taper, flyaways       | Wind, comb, flutter, sheen          |
| Wood/plants            | Straight grain, wavy grain, burl, knotty wood, plywood edges, bamboo, cork, bark, leaf veins, palm fibers                                        | Grain, knots, distortion, pores, branches                       | Warp, light, vein growth            |
| Stone/minerals         | Granite, limestone, sandstone, slate, travertine, terrazzo, agate, geode bands, crystals, sediment                                               | Grain, inclusions, veins, pores, layers                         | Glints, vein pulse, growth          |
| Earth/granules         | Sand, dunes, gravel, pebbles, dirt, cracked mud, clay, ash, salt, snow                                                                           | Particle sizes, packing, ridges, cracks, roughness              | Drift, migration, settle, sparkle   |
| Paper/print            | Recycled, handmade, parchment, watercolor paper, cardboard, newsprint, tissue, ink bleed, toner grain, risograph                                 | Fibers, grain, flecks, spread, registration                     | Soak, flicker, reveal               |
| Manufactured           | Brushed metal, hammered metal, machined rings, knurling, diamond plate, perforated sheet, expanded mesh, carbon fiber, rubber, scratched plastic | Direction, dents, holes, relief, scratches                      | Sheen, shimmer, scanning light      |
| Weathering             | Rust, patina, tarnish, peeling paint, chipped enamel, crazed glaze, scratches, scuffs, dust, soot                                                | Coverage, clustering, wear, cracks, layers                      | Corrode, accumulate, flake          |
| Skin/animals           | Leather, pores, fingerprints, scales, fish scales, snakeskin, crocodile plates, leopard rosettes, giraffe patches, tiger stripes                 | Cells, ridges, relief, spots, irregularity                      | Breathe, shimmer, growth            |
| Organic microstructure | Cells, membranes, bubbles, foam, sponge, coral pores, lichen, moss, mycelium, vessels                                                            | Cell size, walls, branches, packing, density                    | Divide, grow, pulse, merge          |
| Liquid/atmosphere      | Clouds, fog, smoke, ink clouds, oil slicks, caustics, flowing water, lava, sea foam, frost                                                       | Turbulence, direction, viscosity appearance, breakup, contrast  | Flow, billow, swirl, ripple, freeze |
| Noise/fields           | White noise, value noise, gradient noise, cellular distance, fractal, ridged, billow, curl-flow marks, blue-noise dots, warped noise             | Frequency, octaves, persistence, anisotropy, warp               | Evolve, advect, loop                |
| Optical/digital        | Moiré, interference, diffraction-like rainbows, holographic foil, scanlines, CRT phosphors, pixels, dithering, glitch blocks, circuits           | Frequency, phase, channels, pitch, disruption                   | Drift, scan, shimmer, glitch        |
| Illustration/maps      | Crosshatching, pencil, charcoal, brush strokes, contours, topographic bands, stippled shading, doodles, mazes, streets                           | Stroke, angle, intervals, density, connectivity                 | Reveal, contours, wandering         |

## Common control vocabulary

Color: background, foreground, accents, palette, contrast, distribution.
Dimensions: tile width/height, feature size, spacing, aspect ratio, direction.
Variation: seed, jitter, irregularity, density, clustering.
Appearance: relief, light direction, highlight strength, softness.
Motion: speed, direction, amplitude, phase, loop duration only when supported.
Interaction: paint, erase, comb, stir, nudge, excite, deposit as appropriate.
Not every recipe needs every control.

## Gray–Scott expansion backlog

Candidate appearances: fine spots, large spots, dense spots, sparse islands,
dividing cells, bursting colonies, worms, wandering worms, broken stripes, dense
labyrinths, broad labyrinths, coral fronts, perforated sheets, inverted spots,
mixed spots/stripes, moving patches, pulsing colonies, expanding fronts,
recovering painted trails, turbulent ink. Validate before naming a preset.
Some require initialization, forcing, or spatial coefficients beyond feed/kill.

Extensions: curated feed/kill regions, diffusion coefficients with stability
bounds, directional diffusion, periodic spatial feed/kill maps, flow advection,
repeated excitation, speckle/patch/ring/band/checker/noise seeds, warm starts,
freeze after growth, concentration/difference/edge/contour/relief presentations.
Periodic interactive painting/stirring must wrap all operations, not just stepping.

## Additional simulation models

| Model            | Proposed visual direction                                                   | Controls                                       |
| ---------------- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| Schnakenberg     | Organized spots and labyrinths                                              | Reaction rates, diffusion ratio, initial noise |
| Brusselator      | Spots/labyrinths and oscillation in suitable regimes                        | Feed, diffusion, regime                        |
| FitzHugh–Nagumo  | Excitable waves, target rings, spirals, labyrinths in suitable formulations | Excitability, recovery, stimulus               |
| Barkley          | Traveling spirals and excitable fronts                                      | Excitability, threshold, recovery              |
| Oregonator       | Chemical spirals, wave trains, oscillating fronts                           | Excitability, forcing, pacemakers              |
| Gierer–Meinhardt | Activator/inhibitor patterns and biological ornament                        | Activation, inhibition, diffusion, sources     |

Prioritize Schnakenberg, Barkley, and Brusselator for visibly distinct behavior.
Neighboring systems: Cahn–Hilliard phase separation/coarsening; complex
Ginzburg–Landau phase waves/defects; Swift–Hohenberg wavelength-selected patterns.
Experimental engines: cyclic and excitable cellular automata, continuous cellular
automata, slime-mold agents, diffusion-limited aggregation, flow-advection fields,
coupled oscillator grids, vegetation/water, crystallization, erosion/deposition,
foam evolution, crack propagation. These need visual and performance prototypes.

## Composition directions

Hair + directional sheen + wind → fur. Twill + dye + fuzz → denim.
Cells + mineral speckles → granite. Voronoi + recessed borders + grain → leather.
Reaction diffusion + contours → living topography; + relief → embossed growth;

- weave → biological jacquard. Flowing noise + stripes → marbled liquid.
  Grain + ink bleed + registration → risograph. Phase separation + interference
  colors → stylized oil film. Cracks + pigment + fibers → aged paint.
  Interference + moving highlights → holographic foil.

Future shared operations: warping, layering, thresholding, contouring, and relief.
Design composition through typed definitions; do not introduce raw raster access.

## Texture Explorer direction

Search appearance tags and filter seamless/animated/looping/interactive capability.
Show one tile beside repeats. Edit palette, sizes, seed, motion, recipe controls.
Randomize within useful bounds, copy configurations, compare presets, show raster
resolution/cost, and freeze simulations. First slice implements only essential
comparison and controls; search/export/freeze are later work.

## Integration and manual contract

Use public recipes through `useTexture` as real shape/text fills. Change controls
without creating another scheduler. Observe crisp stripes/checkers, directional
hair with curl/clumps/sheen, seamless repeats during motion, recoloring and tile
resizing, and differing Gray–Scott patterns. Static recipes stop scheduling.
The headless driver imports the exact public example; focused pixel/geometry
assertions supplement it. No visual baseline rewrites.

## Research references

- [Pearson: Complex patterns in a simple system](https://pubmed.ncbi.nlm.nih.gov/17829274/)
- [Schnakenberg/Brusselator/FitzHugh–Nagumo patterns](https://pmc.ncbi.nlm.nih.gov/articles/PMC11140185/)
- [Barkley and FitzHugh–Nagumo spiral dynamics](https://link.aps.org/doi/10.1103/PhysRevE.81.066202)
- [Oregonator spirals](https://journals.aps.org/pre/abstract/10.1103/PhysRevE.97.022206)
- [Gierer–Meinhardt original paper](https://pure.mpg.de/pubman/faces/ViewItemOverviewPage.jsp?itemId=item_3489341)
- [Phase separation](https://pmc.ncbi.nlm.nih.gov/articles/PMC5889637/)
- [Ginzburg–Landau overview](https://www.sciencedirect.com/science/article/pii/S0370157315000514)
- [Pattern formation review](https://journals.aps.org/rmp/abstract/10.1103/RevModPhys.65.851)

## Session log

2026-10-09: recorded complete catalog and design decisions before implementation.
First slice in progress. Verification and Studio URL will be recorded after tests.

2026-10-09 slice ready: stripes/checkers/hair recipes, six Gray–Scott presets,
feed/kill overrides, bounded warmup, public API documentation, type consumers,
editor declarations, and interactive Texture Explorer are available. Source
focused browser checks: 29 passed; built public smoke: 2 passed. Packed Bundler /
NodeNext / runtime checks, core build, full typecheck, scoped lint, public JSDoc,
scenario discovery/catalog, original numerical parity, and desktop/mobile browser
QA passed. Repository documentation gate remains blocked by an unrelated
unclassified financial-inspection evidence README. Aggregate trust was not run.
Next: evaluate the first collection before broader hardening.
See [the field note](../testing/field-notes/2026-10-09-texture-library-first-slice.md).

## 2026-10-12 acceptance and continuation

The user accepted stripes, checkers, wood grain, and expanded Gray–Scott,
authorized committing them, and requested the next texture set. Begin the fabric
family with plain weave, twill, and herringbone: shared recoloring, thread size,
fiber variation, and periodic motion. Deliver a public Studio slice before broad
hardening. Acceptance does not imply a completed aggregate trust run.

### Fabric slice ready for feedback

2026-10-12: `plainWeave`, `twill`, and `herringbone` are available with thread count,
thread width, relief, seeded fiber variation, palette, tile size, and motion.
The Fabric Explorer is manually and headlessly driven through public APIs at
`#/examples/composition/fabric-explorer`. Nine source tests and one built example
check pass; packed texture consumers pass. Broad hardening follows evaluation.

2026-10-12 fabric feedback: verify against actual weaving references. Plain weave
and 2/2 twill checked; herringbone corrected to CottonWorks' offset broken twill
rather than a duplicated-end reversal. Crossing-level public tests added. Yarn
edges now use soft coverage and seeded fiber irregularity; Explorer detail uses
512² textures. Eleven source tests and one built-example test pass. Painted-canvas
image overlays are a future composition use case, not a new filter commitment.

## Fabric acceptance

2026-10-12: the user accepted the reference-checked fabric revision and authorized
a local commit. The next recorded candidate is noise/composition, followed by
additional reaction-diffusion models. The noise/composition slice below has now started.

## Noise and composition feedback slice

2026-10-12: `softNoise` and `ridgedNoise` expose seeded seamless fields with
frequency, octaves, persistence, contrast, phase, and speed. The Painted Canvas
example at `#/examples/composition/material-overlay` applies grayscale canvas or
paper texture and independent pigment variation to an image through an app-owned
multiply scope. Controls cover strength (including exact restoration at zero),
tile size, surface, seed, pigment, and motion. Twelve focused browser tests and
packed consumers pass; desktop/mobile Studio controls were checked. Await
experiential feedback before broader hardening or the next reaction-diffusion
family. See the dated noise/composition field note for limitations.

2026-10-12 follow-up: surface brightness alone did not satisfy the requested
embossed canvas appearance. The demo now uses `emboss(map, options)` on the image:
grayscale height gradients produce normals and directional highlights/shadows.
Relief and light-direction controls make this observable. The previous screen
highlight layer is replaced. This is a public filter feedback slice awaiting
visual acceptance, not the full filter hardening milestone.

## Noise, composition, and emboss acceptance

2026-10-12: the user accepted the height-lit canvas appearance and public emboss
API, and authorized a local commit. The next texture family is additional
reaction-diffusion models: start with Schnakenberg for spots/labyrinths, followed
by Barkley for moving excitable fronts and Brusselator for oscillatory patterns.

## Three additional chemical models: feedback slice

2026-10-12: the user approved the proposed named public factories and requested
all three models with a parameter explorer. `schnakenberg`, `barkley`, and
`brusselator` share the existing texture lifecycle and InkMessage capability.
Six immutable presets are available; parameter experiments informed the curated
Schnakenberg labyrinth and Brusselator spot warmups. The public explorer is at
`#/examples/composition/chemical-explorer`. Source and built focused tests pass,
and packed Bundler/NodeNext consumers pass. Await experiential feedback before
broader numerical, scheduling, resource and performance hardening.

## Additional chemical models accepted

2026-10-12: the user accepted all three models and the parameter explorer, and
authorized a local commit. The next recommended collection is geometric/decorative
textures: polka dots and halftone, plaids, and seeded Truchet curves, with seamless
placement, palette, density, line-weight and motion controls.
