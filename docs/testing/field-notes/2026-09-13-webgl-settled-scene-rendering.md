# WebGL settled-scene rendering delivery field note

> **Historical status: COMPLETED FIELD RECORD.** Results are dated evidence for
> the named candidate and environment, not current API guidance or reusable test
> totals.

Delivery verification date: 2026-09-13

Branch: `codex/webgl-settled-scene-rendering`

Actual branch base: `0e837735598344282e509046e5804824997f93c5`

Verified implementation revision: `916dd7e6894d8752ce654bff660492a9107a9549`

The later evidence commit changes only this note and the implementation plan's
historical-status banner.

## Environment

- macOS `26.6.2` (`25G83`), arm64
- Node.js `v24.15.0`, selected for every gate with
  `fnm exec --using=v24.15.0 --`
- Corepack `0.34.6`; pnpm `11.21.0`
- Vitest `4.1.10`; Playwright `1.62.1`
- Playwright Chromium `151.0.7922.34`, headless

This is the repository's canonical Node 24 LTS environment. The system shell's
Node 26 runtime was not used for verification.

## Focused semantic and type evidence

The final post-correction focused commands were:

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 typecheck
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib packages/core/test/webgl-lab.test.ts packages/core/test/webgl-ownership.test.ts packages/core/test/webgl-performance.test.ts --browser.headless --browser.ui=false
```

Typecheck exited zero. The Chromium run passed 28 files and 270 tests. These
tests explicitly cover one component traversal, no GL work before successful
composition, late sibling collection, opaque and transparent queues,
far-to-near sorting, geometry picking, candidate rollback, cache hits, context
loss/restoration, and exact final disposal.

The first root typecheck at revision `5d067fae85694cecff4a34ceff5f600eb23ef962`
had stopped verification with 23 errors in seven test files. Production package
typecheck was already green. Root-cause analysis found test-fixture drift around
readonly matrices, moved camera ownership, the camera discriminant, generic
primitive props, and ordinary-component typing. The independently authored
test-only correction `916dd7e` restored the root contract without production
changes or weakened assertions; its review reported no Critical, Important, or
Minor findings. The fresh commands above then passed.

## Package, Studio, lifecycle, and performance evidence

Each command below used the canonical prefix shown verbatim:

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 build
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 test:package-consumer
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 test:package-consumer:packed
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 playground:build
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 playground:build:built
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 test:lifecycle
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 test:performance
```

All seven commands exited zero. Package declarations and production bundles
built; source and packed Bundler/NodeNext consumers passed runtime exports,
blocked-deep-import, no-source, shared-core-identity, and focus-elimination
checks. The source Studio built 1,425 modules in 1.32 seconds with declaration
parity across 190 types; the built-package Studio built 1,264 modules in 1.22
seconds. Lifecycle passed 7 files and 32 tests in 10.19 seconds. Structural
performance passed 35 tests and intentionally skipped 2 opt-in wall-clock tests
across 6 files in 2.17 seconds, with no extra traversal, transfer, framebuffer,
or readback work.

## Visual inspection

The exact visual commands were:

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 test:visual-safeguard
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 test:studio-visual
```

The safeguard rejected its deliberate mutation, preserved every baseline byte,
and recovered green. The Studio gate matched all 6 full-page baselines.

The WebGL safeguard's expected, actual, and diff artifacts under
`test-screenshots/webgl-islands/` were each inspected at their original 480×300
resolution. Expected and actual were visually identical and byte-identical at
SHA-256
`ea9ed7ac801052eae0e0c93b016e4ed5ccb623d8dda23985533f27fab6585ae8`;
the neutral diff artifact had SHA-256
`0f14fb095a12447605979f7490fe81179b221d2f66d0ff9ab1c33bee6c72b00c`.
The image shows the opaque filtered composition and the truthful footer
`cube 0 · sphere 0 · revision 1`. Task 7 intentionally changed only that footer
from `generation 1` to `revision 1`; this reviewed baseline is authoritative,
its Git blob is unchanged from `c360a6a`, and Task 9 did not update it.

Transparency remains separate semantic and pixel evidence outside the opaque
baseline. A transparent island-background probe falls through to the lower
Canvas target. The near-first-source transparency case records
`near-first source → far-to-near blend` and observes far-only
`[127, 216, 174, 255]`, overlap `[183, 142, 121, 255]`, and near-only
`[229, 151, 161, 255]`, with two-channel tolerance; the overlap is explicitly
not the obsolete near-first/depth-write result.

## Aggregate trust evidence

The required final aggregate command was:

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 trust
```

The first invocation reached the browser suite after all preceding static and
package phases passed, then Vite's one-time dependency optimizer discovered
`lz-string` and `minisearch`, reloaded the browser, left one suite with zero
loaded tests and one shell assertion failed, and stopped making progress. It
was terminated with exit 130 after root-cause isolation. The exact affected
boundary passed 2 files and 13 tests in 928 ms once the optimizer cache was
warm. No source or test change was made.

The complete aggregate command was then rerun from the beginning and exited
zero. Its fresh results were:

- 53 learning lessons and 20 deterministic test laboratories;
- documentation verification across 12 guides, 137 current/migration files,
  76 historical/work records, 77 values, 175 types, 27 acceptance rows, 197
  parsed snippets, 8 extracted TypeScript programs, and 64 API examples;
- all 953 documentation mutation probes, with 667 baseline and 804 current
  semantic units across 14 contracts, 107 exhaustively mapped post-baseline
  units, 53 evidence mappings, 85 field migrations, and 135 presentation
  sources;
- Studio documentation/API parity for 77 core values, 176 core types, 7 WebGL
  values, and 15 WebGL types;
- typecheck, lint, formatting, package builds, source/built Studio builds,
  source and packed consumers, documentation acceptance, and production
  boundary checks;
- complete browser suite: 180 files, 2,360 passed and 2 intentionally skipped
  tests of 2,362 in 25.79 seconds;
- visual safeguard recovery and all 6 Studio baselines matched;
- built-package smoke: 1 file and 1 test passed in 671 ms;
- lifecycle: 7 files and 32 tests passed in 10.20 seconds; and
- structural performance: 6 files, 35 passed and 2 opt-in wall-clock tests
  skipped in 2.16 seconds.

## Public removals and audit

The intentional breaking removal consists of runtime values
`defineWebGLPrimitive` and `crcWebGLContext` plus types
`CRCWebGLCameraSnapshot`, `CRCWebGLContext`, `CRCWebGLHitCapability`,
`CRCWebGLPrimitiveCapabilities`, `CRCWebGLPrimitiveHitInput`,
`CRCWebGLPrimitiveInput`, `CRCWebGLPrimitiveRender`, and
`CRCWebGLProgramProps`. The public package retains 7 runtime values and 15
types. `createWebGLGeometry` remains public; custom shapes are ordinary
components that return `Mesh`.

The exact raw-name scan across current packages, playground, tooling, README,
agent guidance, design contracts, public site, and library status found exactly
10 matches. Every match is an intentional `@ts-expect-error` negative
package-boundary probe in `playground/package-consumer/index.ts`; excluding that
file produced zero matches, including for the removed ownership names
`WebGLResourceGenerationRegistry`, `ownedResourceGeneration`,
`recordCustomWebGLPick`, and `beginWebGLFrame`.

The implementation worktree was clean before evidence edits.
`git diff --check 0e837735598344282e509046e5804824997f93c5..HEAD` passed. The
baseline blob and bytes are unchanged from the reviewed Task 7 revision. The
separately committed particle-effects design has no branch diff. In the user's
main checkout, the unrelated `tooling/verify-docs.mjs` edit and untracked
`docs/strategy/particle-effects-research.md` remained present and untouched.

Known non-fatal output is limited to Vite's future native-loader extension
warnings, ignored bare imports from packages declaring `sideEffects: false`,
ineffective dynamic-import notices, and large-chunk notices. The one-time
optimizer reload is recorded above; the clean complete rerun is authoritative.

## Next project boundary

Lighting, material, and environment work is the next separate project. The
settled compose → settle → render → commit lifecycle verified here is its
prerequisite and must not be reopened by that follow-on work.

## Post-final-review verification on the repaired head

This addendum preserves the pre-fix evidence and cold-cache Vite investigation
above while recording the final repaired implementation revision
`8218d34a809be16176155b2b2fd3608de96cefb3`.

The final review found one Important context-loss cleanup gap. Partial shader,
program, buffer, and vertex-array construction could begin while the context
was healthy and then try to detach or delete successfully created handles after
the WebGL generation became lost. Commit `27574b8` (`fix(webgl): abandon lost
partial resources`) made failure cleanup share one conservative context-loss
decision. Scoped follow-up review then required realistic browser-loss evidence
and found that a normally returning no-op geometry upload could still publish a
resource after loss. Commit `8218d34` (`fix(webgl): fence geometry publication
on context loss`) added the post-upload validity fence and corrected one
adjacent renderer fixture to lose the context at its intended failing draw.

The repaired evidence now covers compile/link status becoming false during
loss, null creation handles after earlier acquisitions, normal-returning upload
calls that transition the context to lost, and throwing `isContextLost()`
detectors. Lost or uncertain generations abandon unpublished JavaScript handle
references without issuing GL detach/delete calls, healthy generations retain
their exact cleanup, publication occurs only after the validity fence, and an
operational failure remains primary over detector or cleanup errors. The final
scoped reviewer found no remaining Critical or Important issue; one unused
test-double control was left as an optional Minor cleanup only.

Per the final verification instruction, no standalone gate was repeated. The
single aggregate command was run once:

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 trust
```

It ran on macOS `26.6.2` (`25G83`), arm64, with Node.js `v24.15.0`, pnpm
`11.21.0`, Playwright `1.62.1`, and Playwright Chromium `151.0.7922.34`. It
exited zero on repaired head `8218d34` with these fresh results:

- scenario and documentation checks passed for 53 lessons, 20 test labs, 12
  guides, 137 current/migration files, 77 historical/work records, 667 baseline
  and 804 current semantic units, 107 mapped post-baseline units, 53 evidence
  mappings, and all 953 mutation probes;
- typecheck, lint/format, package builds, source/built Studio builds, source and
  packed consumers, Studio documentation acceptance, and the production
  boundary passed;
- the complete Chromium suite passed 180 files with 2,369 passed and 2
  intentionally skipped tests of 2,371 in 25.19 seconds;
- built-package smoke passed 1 file and 1 test in 670 ms;
- lifecycle passed 7 files and 32 tests in 10.19 seconds; and
- structural performance passed 35 tests and intentionally skipped 2 opt-in
  wall-clock tests across 6 files in 2.15 seconds.

The aggregate visual safeguard again rejected its deliberate mutation,
preserved every baseline byte, and recovered green; all 6 full-page Studio
baselines matched. The WebGL expected, actual, and neutral diff artifacts were
reinspected at 480×300. Expected and actual remain byte-identical at SHA-256
`ea9ed7ac801052eae0e0c93b016e4ed5ccb623d8dda23985533f27fab6585ae8`,
the committed expected-image blob remains
`1e91eb3a8547811283410cfa3e347a64df70939e`, and the footer still reads
`cube 0 · sphere 0 · revision 1`. The reviewed Task 7 baseline was not changed.

Non-fatal output remained the previously disclosed ignored bare-import warning
for the side-effect-free core package, Vite's future native-config-loader
extension warnings, ineffective dynamic-import notices, and large-chunk
notices. No cold-cache optimizer reload recurred in this final aggregate.
