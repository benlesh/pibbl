---
id: api-types-electric-textures
title: Electric textures
summary: Reusable tendril and lightning recipes for ordinary Canvas fills.
kind: api
slug: electric-textures
apiCategory: types
symbols:
  [
    ElectricControl,
    ElectricOptions,
    ElectricPoint,
    ElectricSource,
    ElectricSourceMessage,
    LightningMessage,
    LightningOptions,
    TendrilsMessage,
    TendrilsOptions,
    lightning,
    tendrils,
  ]
---

# Electric textures

These TypeScript recipes from `@crc/textures` use the public resource-backed
`defineTexture` lifecycle. Mount with `useTexture`, use the handle in `style.fill`
or `style.stroke`, and send typed commands outside component evaluation. Paint
views share source pixels and lifetime within the owning CRC tree.

## tendrils

`tendrils(options?)` creates slow wandering filaments between weighted sites and a common electrode with transparent
surroundings. It is independent of globe presentation and pointer handling.

## lightning

`lightning(options?)` creates branching connections with persistent coarse shape,
fast flicker, and optional edge destinations. Positive and negative are artistic
source/destination names. The Plasma Globe shows an independent lightning preview alongside its weighted
tendrils; weighted sources control the tendrils’ own terminal crackles.

## ElectricPoint

`{ x, y }` uses normalized 0..1 texture coordinates, including padding. Map
CRC root-logical pointer coordinates into the fill placement in application code.

## ElectricOptions

`seed` selects seeded geometry; `branching` is 0..1 and `glow` is 0..2. Glow
changes halo strokes without widening the white core. Leave space around paths:
texture and shape boundaries still clip pixels. The globe reserves 10% per side.

## ElectricControl

Both resources accept `{ type: "pause", paused }` and `{ type: "reset", seed? }`.
Reset clears contacts and time, preserves pause and visual controls, and optionally
selects another seed. Reproduction requires the same configuration, frame deltas,
and command history; pixel antialiasing can vary by browser. No arbitrary-time
seek or replay checkpoint is provided.

## ElectricSource

A structured-cloneable `{ id, point, weight }` attachment site in normalized
texture coordinates. IDs are unique strings of 1..128 characters; weights are
finite 0..1,000,000. Zero disables a site. At most 512 sites may be active.
Weights control seeded selection preference, brightness, and terminal crackle size.
There is no special pointer site: input adds an ordinary high-weight source.

## ElectricSourceMessage

`upsert-source` accepts one `source`; `remove-source` accepts its `id`.
`set-sources` replaces the collection and reset baseline atomically. Reordering
sites does not affect seeded selection. Moving a site with the same ID preserves
connections and approaches the new point smoothly. Reset removes transient upserts
and restores the latest baseline supplied by configuration or `set-sources`.

## TendrilsOptions

Adds `sources` (default empty), `center` (the common electrode, default 0.5,0.5),
`count` (integer 1..32, default 15), `rise` (0..1, default 0), `crackle`
(0..1, default 0), and `frequency` (1..30 crackle refreshes/second, default 18).
There is no implicit circular geometry or perimeter/interior mode. Supply shape
outline samples and interior points together as ordinary weighted sources.
Optional `boundary` supplies 3..256 normalized points forming one simple closed
polygon. Rising endpoints stop at it and follow upward edges, holding at local
peaks until rebirth. Omit it for free drift. This guides endpoints, not full
branch collision physics; use the same path for clipping the fill.
The Plasma Globe derives its sites from `PathGeometry` using `flattenPath` and
even arc-length sampling; its source overlay displays the data.

## TendrilsMessage

Accepts `ElectricSourceMessage`, pause/reset, and `configure` for branching, glow,
rise, crackle, or frequency. High-weight sources attract more persistent filaments;
no source is guaranteed a fixed number. Every source uses the same selection rule.
Sources choose birth locations. Endpoints then rise continuously instead of
hopping to other sites. Weight resists convection by scaling upward speed with
1 / (1 + weight²), so heavy contacts hold filaments nearly stationary.
Removing a site preserves its endpoints: they continue upward and fade within
five seconds before rebirth. No old idle endpoint is restored. CRC shapes still clip pixels;
an optional boundary guides endpoints along the vessel edge.

## LightningOptions

Adds `positive`, `negative`, optional `edge` (`top`, `right`, `bottom`, `left`),
`active` (default true), `frequency` (1..30 topology refreshes per second,
default 15), and `contactCore` (default false). Edge mode chooses an inset
negative point and changes it every six flickers. `active: false` disables only
the configured connection, allowing a texture of manually supplied connections.

## LightningMessage

`connect` takes a string `id`, `positive`, and `negative`; sending the same id
moves that connection. `disconnect` fades it out. Up to 24 manual connections
are retained. `configure` changes source, destination, edge, active state,
branching, glow, or frequency. Contact glow, when enabled, appears at each source.

Both effects cap admitted frame time at 50 ms and use CRC's scheduler. Pause
stops continuing frame requests; commands can still change paused output.
Resolution belongs to `useTexture` and is independent of display size. The
Plasma Globe uses two 320 × 320 resources shared across all its consumers.
