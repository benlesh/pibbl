# Task 7 report: public static GLB feedback slice

## Status

Implemented the public, runnable static-GLB vertical slice through the supported
`@crc/webgl/gltf` hook and root `Model` component. The learning example, separate
deterministic test laboratory, semantic browser probes, Studio declarations,
sandbox asset delivery, catalog metadata, and provenance-complete vendored GLB
are green in the focused evidence collected for this task.

Environment: Node `v26.7.0`, pnpm `11.21.0`, Playwright Chromium, branch
`codex/static-glb-feedback-slice`, Task 7 base
`3c90c9244278261a2708eaf2d2e4f7475889316d`.

## Asset provenance

`playground/public/models/crc-static-glb-slice.glb` is an original CRC-authored
calibration asset, dedicated under CC0 1.0. It has no upstream download or
third-party payload. Its authoritative repository URL, authorship, creation
date, full license link/text, SHA-256, and every deterministic generation step
are recorded in `crc-static-glb-slice.LICENSE.md`.

- SHA-256: `ba852d0135ef287aa93ff7fbbb52d8647f5a34b382b80088db180ad783ed48e8`
- Size: 4,212 bytes
- Content: one selected scene; root plus two child nodes; two independent
  indexed cuboid primitives; flat normals; UV0; one embedded 8x8 RGBA PNG;
  two base-color texture users; metallic/roughness factors `(0.15, 0.72)` and
  `(0.82, 0.28)`.
- No external URI, environment, HDR, tone map, deferred map, animation, skin,
  camera, or unsupported glTF feature is claimed.

## Files

Created:

- `playground/public/models/crc-static-glb-slice.glb`
- `playground/public/models/crc-static-glb-slice.LICENSE.md`
- `packages/scenarios/src/learning/webgl/static-glb.example.tsx`
- `packages/scenarios/src/static-glb-slice.ts`
- `packages/scenarios/src/static-glb-slice.test.ts`
- `packages/core/test/static-glb-slice.test.ts`
- this report

Modified:

- `packages/scenarios/src/learning-catalog.ts`
- `packages/scenarios/src/catalog.ts`
- `packages/scenarios/src/index.ts`
- `docs/scenario-index.md`
- `playground/src/crc-editor-types.txt`
- `playground/src/editor-workbench.ts`
- `playground/vite.config.ts`
- `tooling/learning-source-contract.ts`
- `tooling/scenario-source-discovery.ts`
- `vitest.config.ts`

## RED / GREEN evidence

Initial route/scenario RED:

```text
VITE_CONFIG_NATIVE_IGNORE_WARNING=true corepack pnpm@11.21.0 exec vitest run packages/scenarios/src/static-glb-slice.test.ts packages/core/test/static-glb-slice.test.ts
FAIL: missing static-glb.example.tsx and crc-static-glb-slice.glb
```

Integration REDs subsequently caught by the browser-first workflow:

- Source-mode `@crc/webgl/gltf` resolved to built output while `Model` resolved
  to source output, so the private asset brand did not match. Adding the exact
  source alias made the test exercise one public implementation realm.
- The live Studio threw `Unknown CRC Studio declaration module` because the
  seventh declaration marker had not been added to Monaco's module-path map. A
  focused regression test failed before the map was updated.
- The opaque `srcdoc` preview reached the public example's error UI because its
  `Origin: null` asset request lacked a CORS response. A focused config test
  failed before source and preview servers received the wildcard public-asset
  header. The iframe remains opaque; `allow-same-origin` was not added.

Final focused GREEN:

```text
VITE_CONFIG_NATIVE_IGNORE_WARNING=true corepack pnpm@11.21.0 exec vitest run packages/scenarios/src/static-glb-slice.test.ts packages/core/test/static-glb-slice.test.ts packages/core/test/webgl-lab.test.ts packages/core/test/webgl-ownership.test.ts --browser.headless --browser.ui=false
PASS: 4 files, 20 tests
```

## Semantic and ownership evidence

The deterministic browser scenario uses the actual public `useGLTF` and
`Model`; only fetch and decoded-image browser boundaries are controlled. It
asserts:

- load-to-ready publication and public model bounds
  `[-1.5, 0.25, -0.5]..[1.5, 1.75, 0.5]`;
- exactly two PBR model submissions with hierarchy translations
  `[-1, 1, 0]` and `[1, 0.75, 0]`;
- metallic factors `0.15, 0.82`, roughness factors `0.72, 0.28`, one image
  upload, one PBR program, one uploaded light count, and one net live shadow
  array;
- whole-model click, one Tab-focus candidate, a projected focus union wider
  than 150 and taller than 80, and empty-viewport drag changing orbit pose;
- in-place source replacement, malformed-source error, removal, remount, and
  exact decoded bitmap close progression `1, 2, 3, 4`;
- final runtime ownership counters all zero, GPU deletion advancing, and
  idempotent second disposal leaving the bitmap close count at four.

The public learning example imports only `@crc/core`, `@crc/webgl`, and
`@crc/webgl/gltf`. Loading/error UI is ordinary Canvas content outside the
island. The ready scene has one `Model`, one `DirectionalLight`, a simple
ground mesh, the existing perspective/orbit path, and a transparent explicit
viewport target so empty-space drag remains reachable.

## Catalog, declarations, and build

- Public route metadata resolves to
  `#/examples/webgl/static-glb`; the deterministic laboratory remains separate
  at `#/testing/static-glb`.
- Scenario discovery permits their intentionally shared readable source while
  preserving distinct learning and test-lab catalogs.
- The Studio declaration bundle now contains root asset/Model declarations and
  the seventh `@crc/webgl/gltf` source/result/hook module. Monaco maps all seven
  declaration entries.
- `corepack pnpm@11.21.0 scenarios:check`: PASS — 69 lessons, 12 tutorial
  snapshots, 23 test labs, and the generated scenario index.
- `VITE_CONFIG_NATIVE_IGNORE_WARNING=true corepack pnpm@11.21.0 playground:build`:
  PASS — exact export parity, 213-type structural coverage, strict TSX and
  runtime checks; 1,533 modules transformed.
- `corepack pnpm@11.21.0 typecheck`: PASS earlier in this task after the final
  harness structure; Task 8 owns aggregate verification.

Existing build warnings remained: package chunks marked side-effect-free,
ineffective dynamic imports for scenario modules already re-exported by the
root index, and large Studio chunks. No baseline was rewritten.

## Manual inspection

Requested URL:

```text
http://localhost:5173/#/examples/webgl/static-glb
```

Exact-host inspection was blocked by a pre-existing IPv6 listener owned by
`/Users/benlesh/GitHub/crc/playground` on `[::1]:5173`. That older checkout did
not contain this route and redirected it to `#/examples`. I did not terminate
or mutate the user's unrelated server.

The Task 7 worktree was therefore inspected on the same port over IPv4:

```text
http://127.0.0.1:5173/#/examples/webgl/static-glb
```

After the Monaco-map and opaque-sandbox CORS fixes, the page title was
`Load a static GLB · CRC Studio`; Monaco reported `No TypeScript issues`; the
preview reported `Live · changes run automatically`; one Canvas was mounted;
and no console warning/error was present. Visually, the ready scene showed two
separately proportioned, multicolor textured blocks, differing material
response, a gray reference ground, directional shading, and hard ground/model
shadows against the dark-blue viewport. The pre-fix error UI was observed
directly and disappeared after the asset-delivery fix. Automated semantic
evidence, rather than pixels, remains authoritative for click, focus, orbit,
replacement, error, removal, and disposal.

## Self-review

- Confirmed the learning source contains no private/source import and the test
  harness does not construct an asset or bypass fetch/decode/rendering.
- Confirmed source replacement retains the same loader component/hook slot;
  only explicit removal/remount tears it down.
- Confirmed the example has exactly one `Model` and one directional light and
  does not claim HDR, IBL, tone mapping, deferred maps, complete glTF, 3MF, or
  STL support.
- Confirmed generated failure screenshots were removed and `git diff --check`
  passed before commit.
- Browser inspection found two issues missed by the initial focused suite
  (Monaco's seventh module map and opaque-frame asset CORS); both now have
  regression assertions.

## Concerns / follow-up

- The exact `localhost:5173` GUI observation remains blocked by the unrelated
  pre-existing IPv6 Studio server described above. The same worktree route was
  inspected successfully at `127.0.0.1:5173`.
- Task 8 should run the aggregate trust gate on the documented Node 24.15+
  environment; this task's host reported Node 26.7.0.
