# WebGL Lighting Vertical Slices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development`. Implement and review one browser-visible vertical slice at a time. Do not run broad verification before the explicit visual checkpoint.

**Goal:** Resume the original composition-first WebGL goal and fold its approved lighting, materials, backgrounds, orbit-camera, and genuine-shadow work into one implementation stream that becomes browser-visible early.

**Architecture:** `WebGLLayer` continues to compose one CPU-only scene, settle the completed declarations, render required light-space depth maps, render the main opaque/transparent queues, transfer one bitmap, and transactionally publish bitmap/pick/focus generations. `crcOrbitCamera()` returns plain pose values plus stable ordinary CRC event handlers; it does not create a camera instance or add controls to `WebGLLayer`.

**Binding specs:**

- [`2026-09-14 WebGL lighting, materials, and background design`](../specs/2026-09-14-webgl-lighting-materials-and-background-design.md)
- [`2026-09-15 WebGL orbit camera and genuine shadows design`](../specs/2026-09-15-webgl-orbit-camera-and-genuine-shadows-design.md)

## Execution constraints

- Work only in `/Users/benlesh/GitHub/crc/.worktrees/webgl-lighting-materials` on `codex/webgl-lighting-materials`. Never modify the main checkout.
- Existing commits through `5e9e5e9` already provide settled-scene lighting, Lambert materials/emission, solid backgrounds, and eleven same-scene lessons. Preserve that work.
- Use a fresh implementation subagent and a separate review subagent for each task. Implementation subagents must not spawn their own agents.
- Every runtime change starts with focused failing evidence. Tasks 1-4 may run only their named tests/checks and a narrow `@crc/webgl` build.
- Do not run `trust`, `trust:*`, `test:ci`, packed consumers, broad lifecycle/performance suites, visual aggregates, or baseline updates during Tasks 1-4.
- After Task 1, start the Studio from this worktree and give the user `http://127.0.0.1:5173/#/examples/webgl/multiple-lights` immediately. Keep the server available while later slices land.
- Task 1 completes orbit plus genuine directional shadows end to end. Task 2 completes genuine point shadows and updates its same-scene lesson. Task 3 completes genuine spot shadows and updates its same-scene lesson.
- Task 4 makes all twelve lessons and the deterministic lighting laboratory browser-visible, then stops for the user's visual inspection. Do not begin Task 5 until the user explicitly approves the visible demonstrations.
- Tasks 5-6 are the post-approval documentation, compatibility, visual-baseline, broad-review, and aggregate-verification tail.
- `WebGLLayer.camera` remains a plain `CRCWebGLPerspectiveCamera`. Do not add a camera class, a `controls` prop, a WebGL input subsystem, or an independent animation loop.
- `crcOrbitCamera()` returns exactly `{ position, lookAt, handlers }`. Its handler object/functions are stable for the hook-slot lifetime; unchanged vectors reuse their snapshots; input changes schedule work only when state changes.
- `WebGLLayer.style.shadows` is `false | "low" | "medium" | "high"`, defaults to `"medium"`, requests 0/512/1024/2048 pixels per view, and uses 0/1/4/9 depth comparisons.
- Directional, point, and spot lights cast by default. Ambient and hemisphere lights cannot cast. CRC never silently chooses one primary shadow light.
- Opaque meshes cast and receive by default. Partial-alpha meshes receive when lit but do not cast by default. Final-alpha-zero meshes never color-raster or shadow-raster, even under explicit `true`, while existing pick/focus eligibility remains unchanged.
- Shadowing attenuates only the matching direct light's diffuse Lambert contribution. Ambient, hemisphere, other direct lights, and emission remain independent.
- Directional and spot lights use one 2D depth view. Point lights use six cube-map depth views. Camera-only orbit reuses valid light-space generations.
- Preserve one child traversal, settled opaque/transparent rules, geometry ray picking/focus, source identity/tie ordering, context-generation isolation, and transactional bitmap/pick/focus publication.
- Do not add panning, damping, autorotation, pinch, cascades, fake/screen-space shadows, public shadow cameras/bias/map sizes, textures, PBR, HDR environments, bloom, or raw GL access.

---

### Task 1: Ship the orbitable directional-shadow vertical slice

**Outcome:** The existing `multiple-lights` and `directional-light` lessons can be dragged and wheel-zoomed in the Studio, and their objects cast genuine directional shadows on the common plane.

**Files:**

- Create: `packages/webgl/src/lib/hooks/crc-orbit-camera.ts`
- Create: `packages/webgl/src/lib/hooks/crc-orbit-camera.test.tsx`
- Modify: `packages/core/src/internal.ts`
- Modify: `packages/webgl/src/index.ts`
- Modify: `packages/webgl/src/lib/types.ts`
- Modify: `packages/webgl/src/lib/components/{webgl-layer,lights,mesh}.ts`
- Modify focused component tests beside those files
- Modify: `packages/webgl/src/lib/{layer-controller,backend}.ts`
- Modify focused tests beside those files
- Modify: `packages/webgl/src/lib/scene/{types,composer,settle,renderer}.ts`
- Create: `packages/webgl/src/lib/scene/shadows.ts`
- Create/modify focused tests beside those files
- Modify: `packages/webgl/src/lib/math/matrix4.ts`
- Modify: `packages/webgl/src/lib/math/matrix4.test.ts`
- Modify: `packages/webgl/src/lib/gpu/{program-sources,program,renderer-resources,state}.ts`
- Create: `packages/webgl/src/lib/gpu/shadow-resources.ts`
- Create/modify focused tests beside those files
- Modify: `packages/webgl/src/lib/lighting-rendering.test.tsx`
- Modify: `packages/scenarios/src/learning/webgl/{directional-light,multiple-lights}.example.tsx`
- Modify minimally: `playground/src/crc-editor-types.txt`

- [ ] **Step 1: Add the focused RED evidence.**

Add public hook tests for validation, initial pose, live transactional options, stable handlers/vectors, primary pointer capture, unrelated-pointer rejection, root-logical drag, pole and distance clamps, pixel/line/page wheel normalization, `preventDefault`, one coalesced scheduled update, teardown, and no idle frame. Add focused layer/component/settlement tests for quality default/validation, light/mesh participation, directional Group3D pose, no composition-time GL, and unchanged pick/focus queues. Add pure tests for orthographic fitting, transformed eight-corner bounds, directional plan equality, camera exclusion, and exact quality mappings. Add fake/real WebGL2 tests for the depth program, 2D depth resources, rollback, state restoration, cache reuse, and a real occluded ground pixel.

- [ ] **Step 2: Run only the focused RED set.**

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/hooks/crc-orbit-camera.test.tsx packages/webgl/src/lib/components/webgl-layer.test.tsx packages/webgl/src/lib/components/lights.test.tsx packages/webgl/src/lib/components/mesh.test.tsx packages/webgl/src/lib/scene/settle.test.ts packages/webgl/src/lib/scene/shadows.test.ts packages/webgl/src/lib/gpu/program.test.ts packages/webgl/src/lib/gpu/shadow-resources.test.ts packages/webgl/src/lib/scene/renderer.test.ts packages/webgl/src/lib/lighting-rendering.test.tsx --browser.headless --browser.ui=false
```

- [ ] **Step 3: Implement `crcOrbitCamera()`.**

Expose `CRCOrbitCameraOptions`, `CRCOrbitCameraHandlers`, `CRCOrbitCameraResult`, and `crcOrbitCamera` from `@crc/webgl`. Add only `getCurrentLogicalViewport()` and `onCurrentRenderFinish(callback)` to `@crc/core/internal`. Required options are `orbitPoint` and `initialPosition`; defaults are min `0.1`, max `Infinity`, and speeds `1`. Vectors must be finite and initial position must differ from the orbit point. Bounds are finite positive values and max cannot be below min; speeds are finite nonnegative values.

Store azimuth, polar angle, distance, one active pointer, latest committed live options, cached immutable pose vectors, one reactive revision, and one frozen handler bundle in the mounted hook slot. Validate before acquiring the slot. Candidate options affect that render's pose but become handler-visible only after successful render. Primary drag uses `0.01 * rotateSpeed` radians per root-logical pixel and clamps polar to `0.001..PI-0.001`. Wheel uses multipliers pixel=1, line=16, page=root logical height and distance multiplier `exp(deltaY * 0.001 * zoomSpeed)`.

- [ ] **Step 4: Carry shadow quality and participation through composition and settlement.**

Add `CRCWebGLShadowQuality` and `WebGLLayerStyle.shadows`, normalize omission to `"medium"`, and include quality in controller retained equality and the closed scene draft. Add `castShadow?: boolean` only to direct-light styles and assign each mounted direct light one stable private identity. Add `castShadow?`/`receiveShadow?` to mesh styles. Derive effective values from final alpha and `lit` exactly as specified. Leave ambient/hemisphere shadow-field-free.

- [ ] **Step 5: Plan and cache directional depth generations.**

Add immutable world bounds and `SettledWebGLShadowPlan`. Directional plans fit an orthographic projection to relevant settled caster/receiver bounds and contain the light identity/index, one projection-view matrix, private bias, caster queue, requested resolution, and comparison count. Semantic equality includes quality/resolved resolution, light pose/projection, caster identity/geometry/model/final-alpha class/effective state, receiver-derived extents, context generation, and shadow-program generation; it excludes presentation camera, colors, emission, and background.

Implement a renderer-owned transactional shadow cache with one framebuffer, complete fallback depth textures, lazy 2D depth allocation using `DEPTH_COMPONENT24`, target-specific resolution clamping, framebuffer-completeness errors, resident reuse, candidate rollback, omitted-light sweep, context-loss abandonment, cleanup-error continuation, and exact healthy teardown.

- [ ] **Step 6: Render and sample directional shadows.**

Add a `shadow-depth` program. The depth vertex stage uses shadow projection-view times model; non-point depth uses `gl_FragCoord.z`. Extend Lambert with eight fixed 2D and eight fixed cube sampler uniforms using generated constant-slot branches, plus fixed shadow metadata and per-mesh receive state. Unused slots bind complete fallbacks. For this first slice, only directional shadow slots are enabled; point and spot stay temporarily disabled inside the renderer until their own slices.

Render dirty directional depth views before clearing the default framebuffer. Depth state uses depth test/write, disabled blending/color writes, polygon offset, and lease resolution, then restores the full renderer baseline. Multiply only the matching directional diffuse term by its visibility. Commit ordinary and shadow transactions only after both color queues finish; rollback candidates on allocation/depth/color failure. A later bitmap-transfer failure publishes no bitmap/pick/focus generation and leaks nothing, while an already-valid renderer shadow cache may remain reusable.

- [ ] **Step 7: Make the two lessons visible immediately.**

In both lessons call `crcOrbitCamera({ orbitPoint: [0, -0.25, 0], initialPosition: [5.8, 4.2, 7.8], minDistance: 3, maxDistance: 18 })`. Wrap the viewport in `<Group {...orbit.handlers}>`, place a transparent 720×420 Rectangle beneath the island as empty-space hit geometry, and pass `orbit.position`/`orbit.lookAt` into the otherwise plain perspective camera. Preserve the existing scene geometry/material/background. In `multiple-lights`, temporarily set point and spot `castShadow: false` so only the completed directional path participates. Synchronize only the declarations required for the Studio editor to accept the new public symbols.

- [ ] **Step 8: Run only the focused GREEN set and narrow package build.**

Run the Step 2 command, then:

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 -C packages/webgl run build
```

- [ ] **Step 9: Review, commit, and expose the slice.**

After the separate task review is clean, commit the slice. The controller then starts the Studio in the isolated worktree, opens `#/examples/webgl/multiple-lights`, confirms no editor diagnostics, and immediately gives the user the exact URL. Do not wait for point/spot work before exposing this slice.

---

### Task 2: Ship the point-shadow vertical slice

**Outcome:** The same orbitable `point-light` scene casts an omnidirectional point-light shadow, and `multiple-lights` enables its point shadow without changing the shared geometry.

**Files:**

- Modify: `packages/webgl/src/lib/scene/{shadows,renderer}.ts`
- Modify tests beside those files
- Modify: `packages/webgl/src/lib/gpu/{program-sources,program,shadow-resources}.ts`
- Modify tests beside those files
- Modify: `packages/webgl/src/lib/lighting-rendering.test.tsx`
- Modify: `packages/webgl/src/lib/context-lifecycle.test.tsx`
- Modify: `packages/webgl/src/lib/webgl-performance.test.tsx`
- Modify: `packages/scenarios/src/learning/webgl/{point-light,multiple-lights}.example.tsx`

- [ ] **Step 1: Add focused point RED evidence.**

Assert six canonical 90-degree view/projection matrices and up-vector fallbacks; finite-range and derived-far behavior; `DEPTH_COMPONENT24` cube allocation; exactly six attached/cleared faces in +X/-X/+Y/-Y/+Z/-Z order; radial depth values; cube sampling; real point occlusion pixels; equal-plan reuse; camera-only color rerender with zero shadow draws; one-light replacement; caster invalidation; allocation/depth/color rollback; context restoration; and exact cleanup.

- [ ] **Step 2: Run only the focused point set and confirm RED.**

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/scene/shadows.test.ts packages/webgl/src/lib/gpu/program.test.ts packages/webgl/src/lib/gpu/shadow-resources.test.ts packages/webgl/src/lib/scene/renderer.test.ts packages/webgl/src/lib/lighting-rendering.test.tsx packages/webgl/src/lib/context-lifecycle.test.tsx packages/webgl/src/lib/webgl-performance.test.tsx --browser.headless --browser.ui=false
```

- [ ] **Step 3: Implement point planning, cube resources, and radial rendering.**

Point plans use six canonical views, finite `range` when present, otherwise relevant settled bounds. Allocate complete cube depth textures, attach `TEXTURE_CUBE_MAP_POSITIVE_X + face`, and render every dirty face with radial `gl_FragDepth = distance(worldPosition, lightPosition) / far`. Bind point textures in fixed cube slots and compare normalized radial receiver distance minus private bias with the tier's 1/4/9 deterministic offsets. Preserve all directional behavior and per-light independent attenuation.

- [ ] **Step 4: Update the point lesson and combined lesson.**

Apply the same orbit Group/backing Rectangle/plain-camera pattern to `point-light`. Remove only the temporary point-light `castShadow: false` from `multiple-lights`; keep spot disabled until Task 3. The common plane must visibly receive the point shadow in both scenes.

- [ ] **Step 5: Run the same focused set and narrow build, review, and commit.**

Run Step 2 and the `packages/webgl` build from Task 1. After separate review approval, commit and let the live Studio reload. Do not run visual aggregates or broad suites.

---

### Task 3: Ship the spot-shadow vertical slice

**Outcome:** The same orbitable `spot-light` scene casts a cone-aligned genuine shadow, and `multiple-lights` enables all of its direct-light shadows.

**Files:**

- Modify: `packages/webgl/src/lib/scene/{shadows,renderer}.ts`
- Modify tests beside those files
- Modify: `packages/webgl/src/lib/gpu/{program-sources,program,shadow-resources}.ts`
- Modify tests beside those files
- Modify: `packages/webgl/src/lib/lighting-rendering.test.tsx`
- Modify: `packages/scenarios/src/learning/webgl/{spot-light,multiple-lights}.example.tsx`

- [ ] **Step 1: Add focused spot RED evidence.**

Assert an outer-cone perspective projection from settled position/direction, finite range or bounds-derived far, pole-parallel up fallback, one 2D depth pass, matching fixed-slot sampling, real occluded ground pixels inside the cone, no shadow contribution outside the cone, Group3D-transformed pose, per-light opt-out, and cache invalidation/reuse.

- [ ] **Step 2: Run only the focused spot set and confirm RED.**

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/components/lights.test.tsx packages/webgl/src/lib/scene/shadows.test.ts packages/webgl/src/lib/gpu/program.test.ts packages/webgl/src/lib/gpu/shadow-resources.test.ts packages/webgl/src/lib/scene/renderer.test.ts packages/webgl/src/lib/lighting-rendering.test.tsx --browser.headless --browser.ui=false
```

- [ ] **Step 3: Implement the spot plan and projected sampling.**

Reuse the transactional 2D depth path with the spot outer cone, settled world position/direction, and deterministic near/far/bias. Enable only the matching spot slot and attenuate only its own direct diffuse contribution. Preserve point/directional caches and the existing eight-total-light limit.

- [ ] **Step 4: Update the spot and combined lessons.**

Apply the common orbit target/camera pattern to `spot-light`. Remove the final temporary spot `castShadow: false` from `multiple-lights`, leaving all direct lights at their public default. Preserve the same cube, sphere, plane, materials, and background.

- [ ] **Step 5: Run the same focused set and narrow build, review, and commit.**

Run Step 2 and the narrow WebGL build. After separate review approval, commit and let the live Studio reload.

---

### Task 4: Complete every visible demonstration and the deterministic lab

**Outcome:** Twelve same-scene lessons and the private lighting laboratory are browser-visible and exercise the complete approved runtime. This task ends at the user's visual checkpoint.

**Files:**

- Modify: `tooling/webgl-lighting-example-contract.ts`
- Modify: `tooling/webgl-lighting-example-contract.check.ts`
- Modify: all existing `packages/scenarios/src/learning/webgl/*.example.tsx`
- Create: `packages/scenarios/src/learning/webgl/shadow-quality.example.tsx`
- Modify: `packages/scenarios/src/learning-catalog.ts`
- Create: `packages/scenarios/src/webgl-lighting-lab.example.tsx`
- Create: `packages/scenarios/src/webgl-lighting-lab.ts`
- Modify: `packages/scenarios/src/{catalog,index}.ts`
- Modify: `packages/scenarios/package.json`
- Create: `packages/core/test/webgl-lighting-lab.test.ts`
- Modify generated: `docs/scenario-index.md`
- Modify only if needed for visible source acceptance: `playground/src/crc-editor-types.txt`

- [ ] **Step 1: Strengthen the source contract and add focused lab evidence.**

Require exactly these ordered IDs: `lit-and-unlit`, `ambient-light`, `hemisphere-light`, `directional-light`, `point-light`, `spot-light`, `emissive-material`, `webgl-background`, `custom-geometry-normals`, `multiple-lights`, `transformed-light`, `shadow-quality`. Require one common hook call, handler Group, transparent 720×420 target, dynamic position/lookAt, identical camera/geometry/material/background outside each concept-delta region, and one `layerShadows: CRCWebGLShadowQuality = "medium"` delta literal. Only the quality lesson changes that literal.

The lab uses public imports and test-owned signals to cover every light/background/material mode, transformed lights, custom normals, opaque/partial/zero alpha, lit/unlit/emissive meshes, all quality modes, orbit drag/wheel, direct shadow pixel contrast, ambient/hemisphere non-shadow behavior, point six-direction coverage, cache probes, and disposal. Register scenario id `webgl-lighting`, source id `webgl-lighting-laboratory-example`, route `#/testing/webgl-lighting`, and package subpath `@crc/scenarios/webgl-lighting-lab`.

- [ ] **Step 2: Run only the source-contract and lab RED checks.**

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec tsx tooling/webgl-lighting-example-contract.check.ts
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec vitest run packages/core/test/webgl-lighting-lab.test.ts --browser.headless --browser.ui=false
```

The lab visual assertion must be skipped or semantic-only until Task 6; do not create/update PNG baselines here.

- [ ] **Step 3: Replicate the exact shared scene and complete the laboratory.**

Use the same orbit options from Task 1 in every lesson. Every direct-light lesson visibly shadows the common plane. Ambient-only and hemisphere-only lessons explicitly explain why they cannot. The quality lesson exposes one editable quality literal. Keep background click-through, pick/focus geometry, and lesson-specific concept deltas intact.

- [ ] **Step 4: Run the same focused checks, regenerate only the index, review, and commit.**

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 scenarios:write-index
```

After separate review approval, commit without visual baselines.

- [ ] **Step 5: Expose every demonstration, then stop.**

Using the already-running Studio, inspect `#/examples/webgl/multiple-lights`, each individual light lesson, `#/examples/webgl/shadow-quality`, and `#/testing/webgl-lighting` for compilation/runtime diagnostics. Give the user exact URLs and ask them to visually inspect drag, zoom, silhouettes, and quality. Stop here. Do not dispatch Task 5 before explicit user approval.

---

### Task 5: Publish contracts, Learn/API docs, Studio types, and consumers

**Gate:** Begin only after the user approves the browser-visible demonstrations.

**Files:**

- Modify: `AGENTS.md`, `README.md`, `docs/library-status.md`
- Modify: relevant contracts under `docs/design/`, including drawing, style, surface, hooks, user/mouse/focus events, event ownership, and runtime resource ownership
- Create: `docs/site/learn/guides/webgl-lighting.md`
- Modify: `docs/site/learn/README.md`, `docs/site/learn/guides/webgl-islands.md`
- Create: `docs/site/api/hooks/crc-orbit-camera.md`
- Modify: `docs/site/api/README.md`
- Modify: WebGL component/type/function API pages, including WebGLLayer, Group3D, Mesh/Cube/Sphere, direct lights, WebGL types, and custom geometry
- Modify: `tooling/studio-docs/fixtures/api/webgl.ts`
- Modify: `playground/src/crc-editor-types.txt`
- Modify: source, JSX, runtime, and packed package-consumer fixtures
- Modify: `tooling/verify-studio-visuals.mjs` to register only Studio route `webgl-lighting`

- [ ] **Step 1: Add failing focused static/consumer inventories.**

Exercise every public quality/participation option and all four orbit symbols in source and JSX consumers; pass the returned pose into a plain camera and spread handlers onto CRC event participants. Add runtime/packed export expectations, Studio fixture ownership/related-type links, and the Studio visual route without a baseline.

- [ ] **Step 2: Synchronize normative and public documentation.**

Document compose → settle → shadow depth → color → transfer/commit; light/material/background behavior; exact quality/default/alpha rules; independent per-light attenuation; six-view point cost and camera-only reuse; handler attachment and structural hit geometry; validation, failure, context loss, and teardown; and current non-goals.

- [ ] **Step 3: Run only narrow static checks.**

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 -C packages/webgl run build
fnm exec --using=v24.15.0 -- node tooling/verify-studio-types.mjs
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec tsx tooling/studio-docs/studio-docs.check.ts
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec tsc -p playground/package-consumer/tsconfig.bundler.json --noEmit
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 exec tsc -p playground/package-consumer/tsconfig.nodenext.json --noEmit
```

- [ ] **Step 4: Review and commit the shipping surfaces.**

Do not update baselines or run aggregate verification yet.

---

### Task 6: Final review, intentional visuals, aggregate trust, and browser confirmation

**Files:**

- Create after inspection: `packages/core/test/visual-baselines/webgl-lighting.expected.png`
- Create after inspection: `packages/core/test/visual-baselines/studio-webgl-lighting.expected.png`
- Create: `docs/testing/field-notes/2026-09-15-webgl-lighting-orbit-and-shadows.md`
- Modify only for reviewed fixes: files already in Tasks 1-5
- Mark both lighting implementation plans complete only after evidence is final

- [ ] **Step 1: Run one broad whole-branch review.**

Compare `a356be2...HEAD` against both approved specs. Review public API drift, one-traversal settlement, shadow math/pixels, independent lights, point six-view cost, cache keys, transaction/failure order, context loss/disposal, orbit lifecycle, interaction/focus, examples, docs, and consumers. Dispatch one focused fix wave if needed, with only covering checks, then one scoped re-review.

- [ ] **Step 2: Capture and inspect only the two new visual baselines.**

Run the dedicated lab test once to create its missing-baseline actual candidate, inspect it, install only that reviewed PNG, rerun the test, and inspect expected/actual/diff. Build the Playground, update only Studio route `webgl-lighting`, inspect expected/actual, then rerun that route without `--update`. Never rewrite unrelated baselines.

- [ ] **Step 3: Run the complete aggregate gate once the branch is ready.**

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 trust
```

If it fails, preserve the first output, diagnose only the failed gate, add focused evidence where appropriate, commit the fix, rerun the focused gate, and rerun full trust only when ready for a fresh completion claim.

- [ ] **Step 4: Perform final browser confirmation.**

Inspect `#/examples/webgl/multiple-lights`, all individual light lessons, `#/examples/webgl/shadow-quality`, and `#/testing/webgl-lighting`. Drag empty space and geometry, wheel zoom, orbit behind objects, and verify genuine silhouettes on the plane without editor diagnostics.

- [ ] **Step 5: Record evidence and hand off safely.**

Record environment, commit range, review findings/fixes, focused commands, baseline rationale, aggregate output, and browser observations. Commit the evidence. Report worktree, branch, final commit, trust result, URLs, and intentional non-goals. Do not merge, rebase, push, delete the worktree, or modify the main checkout without explicit instruction.
