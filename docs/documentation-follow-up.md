# Interactive examples studio

The documentation renderer follow-up described here has been implemented as the CRC Interactive Examples Studio. It remains part of the existing Vite playground rather than a second application or publication pipeline.

## Current model

- `learningExampleCatalog` drives the 42 learner pages under `#/examples`.
- `scenarioCatalog` drives deterministic fixtures under `#/testing`.
- Learning pages load their canonical TSX and Monaco editor only when visited.
- Existing `#/scenarios` routes redirect to their matching automated-test routes.
- The generated [example catalog index](./scenario-index.md) documents both catalogs.

## Implemented experience

- Persistent categorized desktop navigation and an accessible narrow-screen drawer.
- Focused pages cover JSX and non-JSX setup, every descriptive drawing and
  composition primitive, DOM-aligned user events, focus/keyboard policies,
  accessibility boundaries, state/lifecycle, and all five layout families.
- Large live previews, type-aware editable TSX, diagnostics, completion and
  hover support, automatic debounced execution, copy/reset/share/format
  controls, prompts, API notes, and previous/next links.
- One replaceable opaque sandbox frame that remains untouched when type or syntax checks fail.
- A visually subordinate automated-testing area with collapsed highlighted source.

## Maintained boundaries

- Canonical example code lives only in `*.example.tsx` files and is loaded by
  its validated catalog path.
- Playground presentation does not leak into example or scenario definitions.
- Existing scenario IDs, slugs, actions, and source markers remain intact for headless consumers.
- Test-only metadata and controls stay out of learner pages.
- There is no backend, account system, server-side snippet store, analytics layer, or separate docs app.

## Possible later work

Search, versioning, analytics, and publication remain independent future
decisions. They should build on the two catalogs without merging learner
content back into diagnostic test fixtures. The current Markdown API reference
is maintained in-repository; this deferral concerns a separately published
renderer or site.
