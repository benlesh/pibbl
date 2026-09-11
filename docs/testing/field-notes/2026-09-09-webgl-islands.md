# WebGL islands documentation field note

> **Historical status: DOCUMENTATION-TRACK EVIDENCE ONLY.** This note records fresh checks
> run in the isolated Task 14 documentation worktree. It is not an aggregate
> trust result, browser result, or implementation-completion claim. Joined
> integration owns the final status-bearing evidence.

Date: 2026-09-10

Branch: `codex/webgl-task14-docs`

Base revision: `7a1435384d0f8eb77915dce693b042ba639be734`

Workspace: `/private/tmp/crc-webgl-task14-docs`

## Environment

- Node: `v24.15.0` through `fnm exec --using=24.15.0`
- pnpm: `11.21.0` through Corepack
- Host: local macOS
- Browser: not invoked by this documentation track

## Scope and inspected evidence

This track reconciled public Markdown with the implementation already present
at the base revision. Source inspection confirmed the nine root runtime values
and 23 named types exported by `@crc/webgl`, the current Canvas/WebGL default
pointer-participation model, and the implementation/test paths cited by the
new guide, API pages, migration, library inventory, and design contracts.

The principal executable evidence available for joined verification is:

- the public `webgl-islands` learning example and deterministic `webgl-islands`
  laboratory;
- the WebGL component, geometry, context, animation, event-integration,
  lifecycle, scene-picker, cache, GPU state/resource, and structural tests;
- the headless WebGL laboratory, ownership, performance, and visual-baseline
  suites under `packages/core/test`.

These paths were inspected as documentation sources; this field note does not
convert their mere presence into a passing result.

## Fresh documentation checks

Results below are limited to commands actually run in this worktree. The final
documentation, package-consumer, Studio, browser, visual, lifecycle, and
structural results must be recorded after the documentation and tooling tracks
are joined.

| Check                                                              | Fresh result                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node/pnpm environment                                              | `v24.15.0` / `11.21.0` confirmed.                                                                                                                                                                                                                                                                   |
| Prettier over all 38 changed Markdown files, including `AGENTS.md` | Passed: all files use Prettier code style. The check used the already provisioned repository dependency because the isolated worktree has no installed dependency links.                                                                                                                            |
| Read-only relative-link scan over all 38 changed Markdown files    | Passed: every relative target exists.                                                                                                                                                                                                                                                               |
| Read-only Studio route/heading scan from changed documents         | Passed: all 68 checked public-document routes and heading anchors resolve. Generated Example/Testing routes were intentionally outside this Markdown-only scan.                                                                                                                                     |
| `@crc/webgl` export/frontmatter comparison                         | Passed: all 9 values and 23 types exported by the package root occur exactly once in API `symbols` metadata.                                                                                                                                                                                        |
| `git diff --check`                                                 | Passed with no whitespace errors.                                                                                                                                                                                                                                                                   |
| `node tooling/verify-docs.mjs`                                     | Reached and passed its current local-link/snippet phase, then failed at the expected pre-WebGL closed-path classification. The 13 reported paths are the package README, migration, WebGL guide, five component pages, two function pages, two hook pages, and WebGL type page added by this track. |

The first workspace-local Prettier invocation attempted dependency resolution
and could not complete because registry DNS is unavailable in this isolated
environment. It changed no tracked dependency, manifest, lock, or tooling file;
the transient install directory was removed before verification.

## Known integration boundary

The base revision's documentation verifier uses a closed Markdown
classification and API inventory that predates these new WebGL pages. The
parallel tooling track owns the corresponding `typeDomain: webgl`, package/API
inventory, and new-path classification updates. This Markdown-only worktree
does not edit JavaScript, JSON, package manifests, locks, or tooling.

No aggregate `trust` result is claimed here.
