# WebGL islands implementation field note

> **Historical status: FINAL INTEGRATED EVIDENCE.** This note records the fresh
> aggregate verification of the WebGL-islands implementation in its isolated
> feature worktree. It is evidence for the named revision and environment, not
> a promise about later revisions.

Date: 2026-09-10

Branch: `codex/webgl-islands`

Base revision: `7053bae8f8b0c277bf725a2bd9681399b9f2b6b4`

Verified implementation revision: `66addd0367c554bacf59d76c6b637cd3f5a8c3ee`

The later evidence-note commit changes only this Markdown record.

Workspace: `/private/tmp/pibbl-webgl-islands`

## Environment

- Node: `v26.7.0`
- pnpm: `11.21.0` through Corepack
- Host: macOS `26.6.2` (`25G83`)
- Browser harness: Playwright `1.62.1` with its bundled headless Chromium

The repository's documented environment is Node 24.15 or newer on the Node 24
LTS line. This run used a newer, noncanonical Node major, so the aggregate result
is fresh local evidence but does not replace a Node 24 CI result.

## Verified scope

The integrated branch includes the `@pibbl/webgl` package, the matching-version
`@pibbl/core/internal` friend seam, fixed global Canvas/WebGL hit resolution,
JSX and `createElement` authoring, default and explicit cameras, Cube, Sphere,
Mesh, Group3D, geometry and primitive extension APIs, animation/context hooks,
context-loss recovery, package consumers, Studio examples, documentation, and
resource/performance evidence.

The documentation preservation manifest accounts for 667 pre-Task-14 units and
782 current semantic units across all 12 normative contracts. It records 75
translations, 55 additions, and 52 direct source/test evidence mappings under
the approved WebGL design.

## Fresh aggregate result

The exact command was:

```sh
CI=true corepack pnpm@11.21.0 trust
```

It exited successfully. The aggregate gate reported:

- 51 learning lessons and 18 deterministic test labs discovered and cataloged;
- documentation verification across 117 current/migration files, including
  872 passing adversarial mutation probes;
- Studio API coverage of 58 core values, 154 core types, 9 WebGL values, and
  23 WebGL types, plus 176-type source/built structural declaration coverage;
- source, built, packed Bundler and NodeNext consumers with one shared core
  identity and blocked unsupported deep imports;
- package and Studio production builds, including the built smoke scenario;
- 1,943 browser tests passed and 2 skipped across 156 files;
- all 6 full-page Studio visual baselines matched;
- 29 lifecycle/ownership tests passed across 5 files; and
- 24 structural-performance tests passed and 2 controlled wall-clock tests
  skipped across 4 files.

The WebGL laboratory baseline was manually inspected before acceptance. Its
SHA-256 is
`b3788e6b915c20aa9da850be5e41071719c295fb97164cb75cd97d763fa967ec`.
The three Studio baselines intentionally changed by the new public guide were
also inspected: the Learn landing page adds the WebGL guide, the Filters lesson
now links forward to WebGL islands, and the search overlay inherits the updated
Learn page beneath it.

## Deliberate boundaries

The result does not add a retained scene graph, DOM overlay, semantic or
accessibility tree, worker renderer, WebGL 1 fallback, arbitrary shader graph,
transparent-pixel readback picker, or automatic picking for raw context draws.
`pointerEvents="none"` remains the explicit visual-only opt-out, and raw custom
WebGL drawing participates only through its declared hit capability.
