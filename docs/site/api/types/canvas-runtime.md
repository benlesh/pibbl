---
id: api-types-canvas-runtime
title: Canvas and runtime types
summary: Surface, controller, Canvas, and hook-value contracts.
kind: api
slug: canvas-runtime
apiCategory: types
typeDomain: canvas-runtime
symbols:
  [
    Canvas,
    CRCConfig,
    CRCController,
    CRCFit,
    CRCFixedViewportConfig,
    CRCPixelRatio,
    CRCRef,
    CRCResponsiveViewportConfig,
    RenderingContext2D,
    StateUpdater,
  ]
keywords: [canvas, viewport, controller, pixel ratio, runtime]
---

# Canvas and runtime types

These contracts describe CRC's Canvas host, root-surface configuration, and
the stable values returned by its runtime and state APIs. Import them with
`type` from `@crc/core`.

## Canvas

`Canvas` is the supported host union: `HTMLCanvasElement | OffscreenCanvas`.
CRC owns at most one live mount for a host Canvas.

## CRCConfig

`CRCConfig` selects either the fixed logical viewport configuration or the
responsive viewport configuration. The first `crc()` mount owns this choice.

## CRCController

`CRCController` is the stable controller returned by `crc()`. Its `dispose()`
method is idempotent and releases runtime-owned resources for that mount.

## CRCFit

`CRCFit` is the fixed-surface fitting mode. Fixed roots use centered `contain`
by default; the logical viewport remains distinct from CSS and backing pixels.

## CRCFixedViewportConfig

`CRCFixedViewportConfig` configures a fixed logical viewport with optional `fit`, `pixelRatio`, and `signal`. Omitting it captures the Canvas's initial logical
dimensions; the signal can abort runtime ownership.

## CRCPixelRatio

`CRCPixelRatio` describes the backing-pixel density policy. It keeps logical
geometry independent from the Canvas backing-store density.

## CRCRef

`CRCRef<T>` is the stable mutable `{ current }` object returned by `crcRef`.
Writing `current` does not schedule rendering and its lifetime is one component
identity.

## CRCResponsiveViewportConfig

`CRCResponsiveViewportConfig` is `{ viewport: "responsive", pixelRatio?,
signal? }`. Its logical root follows CSS content-box pixels instead of a fixed
captured viewport.

## RenderingContext2D

`RenderingContext2D` is the 2D-context union for the supported Canvas hosts.
`crcCanvasContext()` exposes it only while a CRC component is rendering.

## StateUpdater

`StateUpdater<T>` is the setter returned by `crcState`: it accepts a next value
or updater function. A valid update schedules CRC's coalesced animation-frame
render; stale setters safely do nothing after teardown.
