# Weighted electric sources

Implementation contract for the electric-texture refinement, 2026-10-01.

## Geometry and selection

`tendrils({ sources, center, ...visualOptions })` connects a common electrode
(`center`, default 0.5/0.5) to weighted attachment sites. `ElectricSource` is
structured-cloneable `{ id: string, point: { x, y }, weight: number }` data in
normalized texture coordinates. Here “source” means an attachment/emission site,
not electrical polarity. There is no implicit circular geometry, radius,
perimeter/interior mode, or pointer-specific attractor API. Omitted sources mean
an empty collection, not a generated globe.

Collections contain at most 512 unique IDs (1..128 characters). Coordinates are
finite 0..1 and weights are finite 0..1,000,000. Zero-weight sites are disabled.
Validation is atomic. Site order does not affect seeded selection. Weighted
exponential-race selection assigns each persistent filament a site; increasing a
site's weight increases its selection likelihood. It does not reserve a fixed
number of filaments or guarantee every positive site a filament.

A moving site keeps its ID; attached filaments approach its new position smoothly.
Membership/weight additions reconsider attachment through that same selection
rule, including while paused. No event type receives privileged selection.
Source weight also controls brightness and terminal discharge size.

## Motion and removal

CRC Advance updates persistent endpoints; rasterization only paints them.
Filaments retain connections between decisions. Optional upward crawling selects
nearby higher sites using their weights, while strong sites tend to retain their
connections. Paths bow upward. This is an artistic point-cloud model, not gas,
rigid-body, or collision physics; arbitrary concave path containment remains the
receiving shape's clipping responsibility.

Removing or disabling an attached site preserves its current endpoint. The
filament continues upward from there, may find a nearby higher site, and otherwise
fades before being born at another weighted site. Removing one site does not
reassign unaffected filaments. Repeated removals are inert. No removal returns a
filament to a stored circular idle endpoint.

## Commands, ownership, and bounds

- `upsert-source`: add/update one ordinary source, including pointer contacts.
- `remove-source`: remove a source by ID.
- `set-sources`: atomically replace the baseline/current collection.
- `configure`: change visual controls without replacing sites or time.
- `pause`: stop animation; commands still update the collection and paused output.
- `reset`: restore the latest baseline, remove transient upserts, restart seeded
  time, optionally choose a new seed, and preserve pause/visual settings.

The resource keeps at most 32 filaments and 512 sites. Neighborhood selection runs
at bounded decision intervals, not for every rendered path vertex. Each CRC frame
admits at most 50 ms and performs no catch-up loop. There is no additional RAF,
worker, WASM requirement, core dependency beyond the public API, or pixel readback.
The resource owns its arrays/maps; core owns and releases its single source canvas.
Reproduction requires identical seed, source changes, commands, and frame deltas;
no arbitrary-time seeking is promised.

## Demo adapter

One `PathGeometry` defines each vessel. `flattenPath` plus arc-length resampling
produces a bounded outline cloud, rather than weighting short segments more
heavily by accident. Interior samples are additional low-weight points. The demo
removes the old perimeter/interior selector; “show sources” reveals the actual
attachment data. Circle, square, and star changes replace the cloud, not just the
paint mask. Pointer and manual contacts use identical `upsert-source` and
`remove-source` messages. Release/cancel/leave remove only the relevant source.
The independently reusable standard lightning resource remains a separate preview;
weighted contact crackles are part of the tendril implementation, so pointer
handlers do not fabricate a second contact effect.

## Verification evidence

Verified on Node 26.9.0, pnpm 11.21.0, and Playwright Chromium. This is not a
claim of verification on the documented Node 24 environment or of a full trust run.

- Texture browser suite: 47 tests across 11 files passed.
- Built public smoke: 2 tests passed, including weighted messages and shared fills.
- Packed Bundler/NodeNext consumers, public export parity, Studio declarations,
  TypeScript, and focused lint passed.
- Browser interaction checks cover all three vessel shapes, source overlay,
  cutout hit testing, two simultaneous contacts, independent release/cancellation,
  manual input, pause/reset, and mobile presentation.
- Structural work bound: a maximum-size pool of 512 sites with 32 filaments uses
  1,152 strokes for one raster shared by two consumers, with no pixel readback.
  This is bounded-work evidence, not a wall-clock frame-rate guarantee.

Seeded replay tests use the same frame steps and command history. Source-order
changes preserve selection. Release, empty/zero-weight pools, reset, atomic
validation, and disposal are covered through public resource handles.
