---
id: guide-package-migration
title: Migrate to one Pibbl package
summary: Replace first-party feature packages with subpath imports from core.
kind: guide
slug: package-migration
order: 65
keywords: [packages, migration, installation, physics, bundles]
---

# Migrate to one Pibbl package

Install `@pibbl/core` for drawing, particles, visualization, textures, and physics.
Keep `@pibbl/three` and `three` when using the Three adapter.

| Previous import              | Current import                    |
| ---------------------------- | --------------------------------- |
| `@pibbl/particles`           | `@pibbl/core/particles`           |
| `@pibbl/viz`                 | `@pibbl/core/viz`                 |
| `@pibbl/textures`            | `@pibbl/core/textures`            |
| `@pibbl/physics/2d`          | `@pibbl/core/physics/2d`          |
| `@pibbl/physics/2d/geometry` | `@pibbl/core/physics/2d/geometry` |
| `@pibbl/physics/2d/testing`  | `@pibbl/core/physics/2d/testing`  |

Remove the previous feature packages and `@pibbl/types` from your dependencies.
The empty types compatibility package has been removed; import core types from
`@pibbl/core` or `@pibbl/core/types`, and feature types from their feature entry.
There are no forwarding packages. Root, filters, JSX runtime, and Three imports
keep their existing names. JSX configuration still uses `@pibbl/core`.

Feature APIs keep their existing names and behavior. The root entry does not
re-export optional features. Subpaths share one core runtime and one version.

## Physics and bundle size

Rapier's precompiled WASM and JavaScript bindings are included privately in the
physics entry. Applications do not install or configure Rapier. Importing the
physics runtime initializes its embedded engine asynchronously through top-level
await. A dynamic import can defer that work until physics is needed.

Core drawing and pure geometry imports do not retain Rapier or its WASM in a
production bundle. Other optional modules remain tree-shakable. Once physics is
used, the engine is included; JavaScript tree shaking does not promise to prune
individual algorithms inside compiled WASM. The installed core package contains
all features even when the application's browser bundle uses only a subset.

After building the repository, `corepack pnpm@11.21.0 test:bundle-sizes` runs
three fast esbuild checks: core drawing, pure geometry, and physics. They report
minified/gzipped bytes, check engine inclusion explicitly, and enforce size
ceilings. Packed-consumer checks also verify that core needs no external Rapier
installation.
