# Interactive examples studio

The documentation renderer follow-up described here has been implemented as the CRC Interactive Examples Studio. It remains part of the existing Vite playground rather than a second application or publication pipeline.

## Current model

- `learningExampleCatalog` drives the 28 learner pages under `#/examples`.
- `scenarioCatalog` drives deterministic fixtures under `#/testing`.
- Learning pages load their canonical TypeScript and Monaco editor only when visited.
- Existing `#/scenarios` routes redirect to their matching automated-test routes.
- The generated [example catalog index](./scenario-index.md) documents both catalogs.

## Implemented experience

- Persistent categorized desktop navigation and an accessible narrow-screen drawer.
- One focused page for every drawing/composition primitive and mouse event,
  four advanced interaction lessons, and four layout lessons for
  absolute/overlay, Flow, Flex, and Grid.
- Large live previews, type-aware editable TypeScript, diagnostics, completion and hover support, automatic debounced execution, copy/reset/share/format controls, prompts, API notes, and previous/next links.
- One replaceable opaque sandbox frame that remains untouched when type or syntax checks fail.
- A visually subordinate automated-testing area with collapsed highlighted source.

## Maintained boundaries

- Canonical example code lives only in `*.example.ts` files and is loaded by its validated catalog path.
- Playground presentation does not leak into example or scenario definitions.
- Existing scenario IDs, slugs, actions, and source markers remain intact for headless consumers.
- Test-only metadata and controls stay out of learner pages.
- There is no backend, account system, server-side snippet store, analytics layer, or separate docs app.

## Possible later work

Search, versioning, analytics, and publication remain independent future decisions. They should build on the two catalogs without merging learner content back into diagnostic test fixtures.
