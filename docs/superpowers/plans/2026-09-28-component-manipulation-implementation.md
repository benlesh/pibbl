# Component Manipulation Implementation Plan

> **Historical status: IMPLEMENTATION RECORD.** This dated plan preserves the approved execution sequence and its task-level evidence.

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans task by task. The user selected parallel subagents; preserve that choice. Repository thin-slice and review rules override repeated per-task review ceremonies. Track execution with the checkboxes below.

**Goal:** Ship unified component positioning and agent-verifiable moving, resizing, rotation, handles, and snapping through the public CRC API.

**Architecture:** Layout and standalone rendering share a single left/top placement contract with explicit placement ownership. Component-owned manipulation controllers write ordinary geometry signals; frames and handles reuse existing rendering, event capture, and the realm scheduler. Pure gesture math is separate from runtime ownership and handle presentation.

**Tech Stack:** TypeScript, CRC automatic JSX, Canvas2D, native Pointer Events, Vitest browser mode with Playwright Chromium, Vite, esbuild, pnpm.

**Spec:** [Component manipulation design](../specs/2026-09-28-component-manipulation-design.md). Product direction approved by the user on 2026-09-28; this plan resolves implementation details rather than reopening that approval.

## Global constraints

- Node 24.15 or newer on the Node 24 LTS line; pnpm 11.21.0; Playwright Chromium.
- No React dependency, second animation loop, retained scene graph, speculative component rendering, or pixel-based bounds discovery.
- Remove positioning-style x/y without aliases. Preserve event coordinates, geometry points, line endpoints, center coordinates, physics vectors, and WebGL geometry.
- Explicit left/top under Flex/Flow/Grid throws in development/tests and has no placement effect in production. Zero is explicit; absent/undefined is not.
- Future right/bottom follows the same policy but is not added here.
- Preserve unrelated changes. Current checkout includes active responsive-style work in renderer/layout, exports, catalogs, declarations, tests, and documentation. Re-read those files at execution time; do not reset, overwrite, or include those changes in this work's commits accidentally.
- Use managed worktree tools when isolation is required, after inspecting attached artifacts. A new worktree does not copy uncommitted responsive changes: establish the intended base explicitly before implementation.
- No new public input injection, manual clocks, semantic DOM, or global keyboard interception.
- Typecheck is insufficient evidence of parent-child positioning correctness: execute the affected public scenario.
- New runtime API exports live in @crc/core; no new package or entry point is needed for this feature. Pure solver functions remain internal initially.
- Public docs live under docs/site. Test-lab metadata stays out of public search.

## Review focus

Each condition has a test owner below; these are review priorities, not excuses to expand the first slice prematurely.

1. Parent-resolved placement followed by plain-component forwarding must not translate twice (Tasks 1 and 7).
2. Production and development differ even when both consume packed/built output (Tasks 2 and 9).
3. Resize/rotation or capture loss cannot roll back a newer external signal write (Tasks 4 and 8).
4. A completed drag cannot activate a child button or start an ancestor gesture (Tasks 4 and 8).
5. Responsive styles, filters, Layers, zoom, and device density must keep painted handles and hit regions aligned (Tasks 6–8).

## Execution topology and ownership

Use the root agent as integrator and two reusable worker slots (three concurrent agents total). Keep configured model/reasoning defaults; task-specific overrides require an actual need, not a blanket upgrade. Assign high-judgment integration to the root; bound worker prompts to exact files and contracts.

| Wave        | Root/integrator                                                | Worker A                                    | Worker B                                       |
| ----------- | -------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| Preparation | Confirm base, inventory changed files, freeze interfaces below | Read placement/diagnostics integration      | Read gesture ownership integration             |
| First slice | Task 4 then Task 5 integration                                 | Tasks 1–2, shared renderer/layout ownership | Task 3 pure math; then example body for Task 5 |
| Feedback    | Demonstrate exact running Studio URL and collect feedback      | Available for targeted fixes                | Available for targeted fixes                   |
| Expansion   | Integrate Task 6 and own shared surfaces                       | Task 6 solver/rotation work                 | Task 7 independent layout/transform fixtures   |
| Hardening   | Resolve findings and integrate                                 | Task 8 lifecycle/event hardening            | Task 9 consumer/docs work in disjoint files    |
| Final       | Run aggregate gate once after integration                      | Reused reviewer checks final changed scope  | No duplicate review                            |

Dependencies: Task 3 can start with Task 1. Task 2 depends on Task 1 placement interfaces. Task 4 can develop controller internals against the Task 3 solver contract, but frame integration waits for Task 1. Task 5 waits for Tasks 1–4. Tasks 6–9 follow hands-on feedback; their disjoint parts can run together. Task 10 waits for all accepted scope.

Only one agent edits render.ts, primitive-presentation.ts, element metadata, shared style/layout normalization, core exports, or catalogs at a time. Workers report patches/commits and precise verification, not broad claims. Reuse one reviewer; re-review changed code or unresolved material findings only. Do not create separate user-owned chats.

## Interfaces and implementation decisions

### Positioning

Standalone left/top translates the component's local origin before its own presentation transforms. A parent placement record consumes those fields and supplies the used allocation; renderer traversal never reapplies them. Carry this record through existing element metadata/pre-normalized-style paths, preserving keyed identity and receiver-owned style resolution. Plain components retain authored props and receive the positioned allocation without changing ordinary style-forwarding behavior.

Rectangle and Image render at local origin after placement. Text renders at local anchor (0,0), preserving textAlign/textBaseline; left/top positions that anchor, not an inferred ink bounding box. Center-based shapes and paths retain their local geometric coordinates. Existing examples using both layout placement and x/y must explicitly restructure local drawing or combine offsets where semantically valid; do not blindly replace keys inside Flex/Flow/Grid. Group transforms keep their existing ordering, units, and meaning after placement.

### Public manipulation surface

Names below are the implementation target. Export their option/controller/event types with a CRC prefix. The configuration uses declared signal-valued fields, not arbitrary recursive signal discovery.

```ts
type CRCManipulationBox = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;
type CRCManipulationGeometry = Readonly<{
  box: CRCManipulationBox;
  rotation: number;
}>;
type CRCManipulationWhen = "always" | "shift" | "alt" | "ctrl" | "meta";
type CRCResizePosition =
  | "top-left"
  | "top"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom"
  | "bottom-left"
  | "left";
type CRCManipulationOperation = "move" | "resize" | "rotate";
type CRCManipulationCancelReason =
  | "explicit"
  | "escape"
  | "pointer-cancel"
  | "capture-lost"
  | "disabled"
  | "external-change"
  | "coordinate-space-changed"
  | "constraints-unsatisfiable";
```

- `useManipulation(options: CRCManipulationOptions): CRCManipulationController` binds `box: WritableSignal<CRCManipulationBox>`, optional `rotation: WritableSignal<number>`, optional `move`, `resize`, `rotate`, and `onStart/onChange/onCommit/onCancel` callbacks. Missing operations are disabled; supplying an operation object enables it unless its `enabled` boolean/signal is false. Rotation configuration requires rotation state.
- `move` accepts `axis: 'both' | 'x' | 'y'` (default both), optional parent-space rectangular `bounds`, and snap `{ enabled?, when?, step: number | {x:number;y:number}, origin?: {x:number;y:number} }`.
- `resize` accepts optional min/max dimensions, optional `bounds`, aspect ratio `{ value: 'initial' | number, when? }`, and discriminated snap: size `{ target:'size', step:number | {width:number;height:number}, enabled?, when? }` or grid `{ target:'grid', step:number | {x:number;y:number}, origin?, enabled?, when? }`. Size target is the shorthand default. Width/height must stay positive; default minimum is one local unit, no flipping. Bounds use the parent-space rotated corners for containment.
- `rotate` accepts snap `{ step:number, origin?:number, enabled?, when? }`. Radians are manipulation units; `degrees(n:number):number` converts finite degrees to radians. Adapt to Group rotationDegrees internally without changing Group's public units.
- Controller has readonly `active` and `snapshot` signals, `cancel():void`, and stable `frameProps: {controller, style}` referencing the original writable box signal. A controller attaches to exactly one frame; duplicate or cross-root frame attachment is an actionable error. Handles must belong to that frame.
- Active value is null or `{operation, handle: CRCResizePosition | null, pointerId}`. Snapshot includes initial/proposed/applied geometry and snapActive/snapSatisfied. Callbacks receive immutable snapshots plus before/after; commit includes changed, cancel includes reason. No callback receives borrowed scratch.
- `ManipulationFrame` accepts frameProps and children, applies geometry, and establishes overlay allocation. `DragHandle` has required declared region style. `ResizeHandle` accepts position, optional children, and hitSize. `ResizeHandles` accepts positions array, corners, or edges-and-corners. `RotationHandle` uses a top-center handle with a 24 CSS-pixel outward offset. Standard handle size is 8 CSS pixels; default hitSize is 24 CSS pixels. Validate positive finite sizes.
- `Manipulable` binds `style: WritableSignal<CRCManipulationBox>`, optional rotation, `draggable/resizable/rotatable` boolean-or-operation options, resize handle selection, callbacks, and children. It owns one controller and composes the same frame/handles. A false/absent flag disables its operation; true uses defaults. Keep the geometry binding distinct from readonly/computed decoration; do not silently mutate arbitrary styles.
- Signal form ships first. Controlled callback-only geometry binding, public pure solver, Flex/Grid resize-only binding, layout reordering, and automatic selection/history stay deferred.

### Gesture and solver rules

Record geometry, parent mapping, and pointer origin on press; activate at 3 CSS pixels of displacement. Primary-button capture must succeed. Recompute from initial geometry and current pointer on each admitted event, then publish accepted values atomically. Modifier-only recomputation occurs only through the existing logical keyboard path; pointer events always supply current modifiers. Canvas touch-action remains a documented application/host setting, not a global side effect.

Nearest-step rounding uses the larger lattice index at ties, including negatives. Bounds/min/max and opposite-anchor preservation take priority over snapping. For ratio-locked corners, compare relative width/height change from the initial box; larger magnitude drives, width wins ties. Project that dimension to the feasible interval derived from both dimensions, then derive its partner. Edge resizing changes the perpendicular dimension symmetrically. With a ratio lock, snap only the driver and report snapSatisfied false if the applied result cannot satisfy all requested lattices. Rotation angles remain unwrapped.

Pointer up evaluates the final sample then emits commit exactly once if activated (changed may be false). Clear ownership before callbacks; release-generated capture loss cannot produce a second terminal event. Press/up below threshold emits no manipulation lifecycle events. After activation, any effective geometry change emits onChange after publication. onStart precedes the first write; recheck liveness/ownership after each callback. Throwing callbacks follow existing event error reporting and never prevent cleanup.

## Task 1: Unified placement through public rendering

**Owner:** Worker A. **Files:** modify `packages/core/src/lib/style/types.ts`, `style/resolve-built-in.ts`, `style/resolve-dispatch.ts`, `element/metadata.ts`, `layout/place-child.ts`, `layout/absolute.ts`, `render.ts`, `primitive-presentation.ts`, `components/rect.ts`, `components/text.ts`, `components/img.ts`; create `style/positioning.ts` and `packages/core/test/component-positioning.test.tsx`. Existing directories are relative to `packages/core/src/lib` unless fully qualified.

**Interfaces:** internal `resolveStandalonePosition(style, percentageBasis)` returns finite `{left,top}`; metadata distinguishes parent-consumed placement from standalone placement. It is not a new public style mode. Use existing stable placement identity and used-size handoff.

- [ ] Add `positions standalone Rectangle with left/top`: public mount at (10,20), width 80/height 40; assert paint and pointer hit at translated geometry.
- [ ] Add `does not double-place an Absolute child`: same final geometry under Absolute. Add one plain function forwarding style to a primitive to pin exactly-once semantics.
- [ ] Run `corepack pnpm@11.21.0 exec vitest run packages/core/test/component-positioning.test.tsx --browser.headless --browser.ui=false`; observe the expected missing-behavior failure before production edits.
- [ ] Implement placement ownership; remove positioning-style x/y, move Rectangle/Image local geometry to zero and preserve Text anchor semantics. Keep public geometric x/y intact.
- [ ] Migrate affected source usages necessary to keep this slice runnable and type-correct. Inventory with rg, classify each occurrence; no repository-wide textual x/y rename.
- [ ] Rerun focused test and `corepack pnpm@11.21.0 typecheck`; newly invalid usages are migration work, not reasons for compatibility aliases. Commit only owned files/hunks after checks pass.

## Task 2: Runtime diagnostics and environment parity

**Owner:** Worker A after Task 1. **Files:** create `packages/core/src/lib/development.ts`, `layout/positioning-diagnostics.ts`, `packages/core/test/layout-positioning-diagnostics.test.tsx`, `tooling/verify-positioning-environments.mjs`; modify `layout/absolute.ts`, `layout/flex.ts`, `layout/flow.ts`, `layout/grid.ts`, `element/create-element.ts`, `tooling/crc-runtime-source.ts`, `vitest.config.ts`, and package verification wiring as needed.

**Interfaces:** `assertSupportedChildPosition(layout, child, authoredResolvedStyle): void` uses `CRC_LAYOUT_IGNORED_POSITION`, source metadata and stable keys. Shared `isDevelopment` detection uses the existing optional import.meta.env.DEV mechanism; do not add an application strict-mode flag.

- [ ] Add parameterized public tests for Flex/Flow/Grid: explicit left/top including zero errors; omitted/undefined succeeds; signal-valued and dynamic children are checked; error identifies parent, child and fields. Read authored resolved values before defaults.
- [ ] Run focused diagnostics tests red, then integrate one shared check at direct-child inspection. Do not add a speculative traversal, render pass, or measurement resource acquisition.
- [ ] Correct Studio sandbox's hardcoded `import.meta.env.DEV: false`: use actual dev/test versus production environment, independently of source/built package selection. Development server consuming dist still validates.
- [ ] Build probes in `verify-positioning-environments.mjs` against source and packed output with DEV true/false; prove diagnostics versus unchanged parent-owned position. Unknown raw ESM environments retain existing false fallback; document that boundary rather than claiming automatic browser environment detection.
- [ ] Run focused test and `node tooling/verify-positioning-environments.mjs` after building required artifacts. Test failure cleanup and unchanged unrelated-root rendering. Commit owned changes.

## Task 3: Pure move/resize calculation for first slice

**Owner:** Worker B, parallel with Tasks 1–2. **Files:** create `packages/core/src/lib/manipulation/types.ts`, `geometry.ts`, `snap.ts`, `solve.ts`, `solve.test.ts`.

**Interfaces:** `solveManipulation(input: ManipulationSolveInput): ManipulationSolveResult` is internal and side-effect-free. Input carries operation/handle, initial geometry, initial/current points in declared parent coordinates, modifier flags, and resolved options. Result contains proposed/applied geometry and snapActive/snapSatisfied. The math layer never reads signals, events, globals, or clocks.

- [ ] Test move from left 32 by 23 units with step 16 gives 48; without Shift gives 55. Test negative halfway rounding and nonzero grid origin.
- [ ] Test bottom-right resize from 100×80 by (23,11) with size step 8 gives 120×88 and preserves top-left. Test top-left resize preserves opposite corner; minimum dimensions win over snapping.
- [ ] Run `corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/manipulation/solve.test.ts --browser.headless --browser.ui=false` red.
- [ ] Implement unrotated move, resize, axis locking, min/max, snapping activation and finite positive-step validation. Leave rotation implementation for Task 6; do not silently accept unsupported operations.
- [ ] Rerun focused tests; deliver signatures to root. Commit only manipulation math files.

## Task 4: Component-owned gesture controller and explicit handles

**Owner:** Root, integrating Tasks 1 and 3. **Files:** create `manipulation/controller.ts`, `session.ts`, `frame.ts`, `handles.ts`, `coordinates.ts`, `ownership.ts`, `packages/core/test/manipulation-interaction.test.tsx`; modify `packages/core/src/index.ts`, existing event dispatch/capture integration, and signal/teardown internals only through narrow owned seams.

**Interfaces:** public surface and gesture ordering above. Internal coordinate snapshots come from committed presentation and root-surface mapping; no public GL/context or transform injection API. Reuse native listener hub and logical capture.

- [ ] Add native-browser pointer test through public JSX: below-threshold click, drag outside geometry under capture, terminal sample, one commit, same box signal rendered at new position. Do not mock capture success for the main oracle.
- [ ] Add cancellation test restoring original geometry, plus newer external write preserved. Add nested resize/drag ownership test.
- [ ] Run `corepack pnpm@11.21.0 exec vitest run packages/core/test/manipulation-interaction.test.tsx --browser.headless --browser.ui=false` red.
- [ ] Implement one hook slot/controller, one frame attachment, stable frameProps, capture ownership and CSS threshold. Register terminal handlers before starting capture; handle native failure without a half-started session.
- [ ] Publish box/rotation atomically and inspect source revisions to distinguish own writes from external changes. Ignore equal-value geometry writes. Two controllers cannot manipulate the same writable source concurrently. Do not bypass animation writer-lease guards; reject conflicting activation before capture/state mutation.
- [ ] Add targeted activation suppression to the existing event root for an activated gesture, rather than changing all click semantics or swallowing unrelated events. Child handlers can preventDefault to reject an enclosing drag start; deepest applicable handle claims first.
- [ ] Rerun focused tests. Commit only owned hunks; broad event hardening follows feedback.

## Task 5: First runnable public slice

**Owner:** Root integrates; Worker B authors example in disjoint files. **Files:** create `manipulation/manipulable.ts`, `packages/scenarios/src/learning/user-events/manipulation.example.tsx`, `packages/core/test/manipulation-example.test.ts`; modify `packages/scenarios/src/learning-catalog.ts`, `packages/scenarios/src/index.ts`, public exports and Studio declarations through their single owner.

**Interfaces:** one compound card, title drag region, corner resize handles, grid toggle, Shift snapping, minimum size, reset, and visible box/gesture readout. Demonstrate nested Flex content using finite allocation. Learning example imports @crc/core only and is independent from exhaustive test fixtures.

- [ ] Add failing browser evidence that actual handle interaction changes displayed signal geometry and nested content allocation.
- [ ] Implement Manipulable convenience composition and the minimal example; integrate exports/editor declarations needed to run it. Avoid a separate controller implementation.
- [ ] Run `corepack pnpm@11.21.0 exec vitest run packages/core/test/manipulation-example.test.ts --browser.headless --browser.ui=false` and relevant focused suites.
- [ ] Start `corepack pnpm@11.21.0 playground`. Verify actual origin/port and open `#/examples/user-events/manipulation`; do not claim a localhost URL until it is running and checked.
- [ ] **Slice ready for feedback:** send the exact verified URL and inspection steps (drag title, Shift snap, resize, cancellation, nested reflow). Incorporate experiential feedback before broader hardening. Do not call the whole feature complete.

## Task 6: Rotation, aspect ratio, bounds, and complete snapping

**Owner:** Worker A after first-slice feedback; root integrates frame presentation. **Files:** extend `manipulation/solve.ts`, `geometry.ts`, `snap.ts`, `types.ts`, `handles.ts`, `frame.ts`, `solve.test.ts`; create `packages/core/test/manipulation-rotation.test.tsx`.

**Interfaces:** extend the same solver/controller; no alternate geometry model. Frame converts radians to Group-compatible degrees internally. Rotation uses the box center, corner resize preserves its parent-space opposite point. Restrict resize target:grid to unrotated geometry with aligned parent mapping; diagnose unsupported use rather than approximate it.

- [ ] Add failing solver cases: angle 22° snaps to 15° at step 15°, 22.5° ties to 30°; crossing ±π and multiple turns stays continuous. Ratio-locked 100×50 corner resize chooses relative dominant axis with width tie-break; opposite anchor stays fixed.
- [ ] Add bound/min/max conflicts: legal hard constraints win over snapping; statically impossible option combinations fail before capture; live unsatisfiable combinations cancel.
- [ ] Implement ray-to-angle unwrap, rotated anchor preservation, ratio projection, axis locking, and all modifier activation values. For parent-space bounds, solve the feasible interval of rotated corners against each rectangular bound; reject empty intervals. For unconstrained aspect ratio, project snapped width/height to the nearest feasible point in the resulting convex size region, with width then height tie-breaking. Do not depend on iteration-count-sensitive approximations.
- [ ] Add size/grid target distinctions: left 3 plus width 32 need not end on a step-16 grid; grid resizing targets the moving edge instead. Bounds with an initial box outside the permitted region reject activation; mid-gesture mapping/options changes use defined cancellation.
- [ ] Run solver suite and `corepack pnpm@11.21.0 exec vitest run packages/core/test/manipulation-rotation.test.tsx --browser.headless --browser.ui=false`. Extend the existing public example with rotation and ratio controls; give the user updated inspection steps.
- [ ] Commit owned files after focused verification.

## Task 7: Nested layouts, transformed handles, and clipping

**Owner:** Worker B test fixtures; root owns shared presentation integration. **Files:** extend `manipulation/coordinates.ts`, `frame.ts`, `handles.ts`; create `packages/core/test/manipulation-layout.test.tsx`, `manipulation-transforms.test.tsx`; extend learning example and add `packages/scenarios/src/manipulation-lab.example.tsx` and `manipulation-lab.ts` as separate deterministic fixtures.

**Interfaces:** internal frame mapping stores committed parent-to-root and root-to-CSS transforms. Map pointer coordinates through the inverse parent mapping. Handle center follows rotated box; map CSS-sized visual/hit polygons through the inverse frame-to-CSS linear transform so 24 CSS pixels remains 24 at any supported density/zoom. Use no pixel readback and no GL API.

- [ ] Add failing layout tests: Flex column allocation changes, Flow wraps, Grid fractional tracks resize, fixed tracks stay fixed, and keyed child signal state survives. Handles never consume tracks/items. Nested content left/top errors still name its actual layout parent.
- [ ] Add transform tests: Group translation/rotation/nonuniform scale, Canvas fit/density, Clip, nested Layer, and filtered frame; hit at the visible handle center and outside its 24-pixel target. Ancestor clipping still limits handles; content-only clipping does not clip external frame controls.
- [ ] Implement finite frame allocation and separate content/chrome traversal. Preserve explicit source order in ManipulationFrame; convenience Manipulable emits its standard chrome after content. Do not add an implicit z-index or remount when enabling handles.
- [ ] Reject singular mappings before activation. Detect ancestor/root coordinate mapping changes during a gesture and cancel; changing the frame's own gesture geometry does not count as an ancestor change.
- [ ] Run `corepack pnpm@11.21.0 exec vitest run packages/core/test/manipulation-layout.test.tsx packages/core/test/manipulation-transforms.test.tsx --browser.headless --browser.ui=false`. Inspect screenshots only where numeric geometry cannot establish handle appearance; never rewrite baselines to silence failures.
- [ ] Commit owned files after focused verification.

## Task 8: Ownership, terminal paths, and structural performance

**Owner:** Worker A; reuse the existing reviewer after implementation, not another overlapping reviewer. **Files:** extend `manipulation/ownership.ts`, `session.ts`, `controller.ts`, `events/dispatch.ts`, `events/event-facade.ts`, `events/types.ts`, root interaction state, and narrow signal/teardown integration. Create `packages/core/test/manipulation-ownership.test.tsx`, `manipulation-performance.test.tsx`, and extend existing event activation tests.

**Interfaces:** manipulation owns a bounded synchronous source observer only while armed/active. Self-published expected geometry is recorded before writes; inspect after batch and before callbacks to detect reentrant external updates. On external change, end without rollback. Release source edges, capture, frame/handle records, and pending work exactly once.

Teardown is special: release input resources synchronously, mark controller dead, and restore preview immediately only outside protected scopes. Otherwise enqueue one private `queueBeginCommand` with `{signals, before, lastApplied, generation}`; execute rollback only if values and ownership generation still match. The finite record belongs to the scheduler until consumed and cannot retain a mounted tree. Never weaken render/computed/reaction-cleanup write guards. No lifecycle callback runs for an unmounted owner. A later controller activation/external write invalidates stale rollback, even before another native pointer event. Tests explicitly allow next-Begin rollback for teardown under protected traversal.

- [ ] Add failing cases: pointercancel, native lost capture, disabled operation, Escape through FocusManagement, capture failure, duplicate frame, frame replacement, two pointers/controllers, unmount during render, root disposal, and repeated cleanup.
- [ ] Assert external writes between moves, inside onStart/onChange, and before queued rollback win. Equal geometry writes do not cancel. An active animation lease rejects conflicting manipulation without stealing state.
- [ ] Assert a threshold-exceeding drag suppresses its own click/compatibility activation and resets its double-click streak; ordinary clicks, unrelated pointers, and another target's later click still fire. Suppression survives the normal release-generated lostpointercapture until its matching activation is consumed, and clears on the next corresponding press if no click arrives. Do not expire it merely because release delivered capture loss.
- [ ] Assert nested controls can decline drag through preventDefault and resize handles claim before ancestor drag. Use target/bubble ordering, not an ancestor capture starter that runs before children.
- [ ] Implement the terminal and ownership cases; preserve existing realm error isolation. Run focused suite red then green as cases are added.
- [ ] Compare layout/render/target counters with an equivalent manually positioned scene: one content traversal per rendered generation, bounded handle work, no private RAF, no readback, coalesced pointer updates. Measure balanced acquired/released counts after teardown settles; do not substitute GC or heap timing.
- [ ] Run `corepack pnpm@11.21.0 exec vitest run packages/core/test/manipulation-ownership.test.tsx packages/core/test/manipulation-performance.test.tsx --browser.headless --browser.ui=false`. Commit owned changes and review only unresolved/changed scope.

## Task 9: Migration completeness, documentation, and public consumers

**Owner:** Worker B, after interfaces stabilize; root owns shared catalogs/exports during integration. **Files:** affected drawing usages under `packages/core`, `packages/scenarios`, `packages/webgl`, `packages/particles`, `packages/physics`, `packages/viz`, `packages/three`, and `playground` as identified by the classified migration inventory. Add `playground/package-consumer/manipulation.tsx`; modify consumer tsconfigs, `playground/src/crc-editor-types.txt`, `tooling/verify-studio-types.mjs`, `tooling/verify-packed-consumer.mjs`, `tooling/verify-docs.mjs` and environment verification wiring. Update `docs/design/style-system-contract.md`, `layout-system-contract.md`, `drawing-components-contract.md`, `user-events-contract.md`, `runtime-resource-ownership.md`, and add `docs/design/component-manipulation-contract.md`, `docs/site/learn/guides/manipulation.md`, API entries for the public surface and migration guidance.

**Interfaces:** root package exports, public declarations, Bundler/NodeNext consumers, packed runtime, Studio editor types, docs and examples all agree. Do not update historical completed-plan claims as though they described the new runtime.

- [ ] Add type fixtures proving Rectangle/Text/Image positioning-style x/y is rejected, left/top is accepted, geometric point/endpoint APIs stay intact, readonly geometry cannot be passed as writable binding, and invalid snapping discriminants fail.
- [ ] Migrate examples semantically, retaining intended pixels and event geometry. Reparenting a control to resolve ignored offsets can change identity: preserve stable keys/structure where possible and document intentional changes. Audit responsive-style branches only when they resolve; never reject an inactive alternative merely because it contains an offset.
- [ ] Document Text anchor semantics, parent-owned positioning, root/Group standalone use, permanent/modifier snapping, cancellation timing, touch-action host setup, and the limitation that typecheck alone does not detect dynamic ancestry errors. Include one minimal canonical example and one custom-handle example.
- [ ] Wire the manipulation lab through private scenario catalogs and ownership/performance suites. Regenerate indexes with `corepack pnpm@11.21.0 scenarios:write-index`; public search indexes only Learn/API/learning metadata.
- [ ] Run `corepack pnpm@11.21.0 typecheck`, `corepack pnpm@11.21.0 scenarios:check`, `corepack pnpm@11.21.0 docs:check`, `corepack pnpm@11.21.0 studio-docs:check`, and `corepack pnpm@11.21.0 test:package-consumer:packed`. Integrate failures attributable to this migration; distinguish unrelated active work.
- [ ] Build declaration/editor parity and run environment probes against source and built/packed code. Add those probes to the normal verification gate so production-ignore semantics remain covered.
- [ ] Commit only owned migration/docs/consumer changes after integration checks.

## Task 10: Proportional final verification and handoff

**Owner:** Root with one reused reviewer. **Files:** only fixes found by review and the plan/spec completion record.

- [ ] Review changed runtime interfaces, placement, cancellation, and production boundary against the spec. Ensure no new unapproved free-placement semantics leak into Flex/Flow/Grid.
- [ ] Run the full focused manipulation/positioning suite in source mode, then the public browser oracles in built mode after a fresh build. Remember built tests are not production-environment evidence; run the explicit environment probe too.
- [ ] Run `corepack pnpm@11.21.0 trust` once the integrated scope is stable. Record actual Node/pnpm versions, command, exit status, and fresh counts. Do not repeat aggregate runs absent changes/failures justifying them, and never report historical test totals.
- [ ] Keep relevant visuals inspected and justified. Verify handle usage manually in the running Studio as well as through native-browser tests.
- [ ] Mark **feature complete** only after agreed behavior, migration, docs, public consumer parity, ownership, and proportional final checks pass. Report any remaining limitations explicitly; keep deferred controlled bindings, reordering, and semantic accessibility out of shipped claims.

## Planning self-review

- Coverage: unified positioning and diagnostics (1–2); move/resize/snap (3–5); rotation/aspect/bounds (6); nested layouts/transforms/handles (7); ownership and agent-readable evidence (8); complete migration/public surface (9); final trust evidence (10).
- Parallelism: math, fixtures, and later docs have independent file ownership. Shared renderer/events/catalogs are serialized by owner. No worker creates a competing frame/solver/controller implementation.
- Delivery: the first verified Studio slice is an explicit feedback milestone before broad matrices/docs/review. This feature includes the positioning migration; migration work required for a runnable/type-correct slice cannot be deferred into a broken intermediate state.
- Design deviations resolved: safe deferred teardown rollback preserves signal guards; Text preserves anchor semantics; manipulation radians adapt to existing Group degrees; production proofs are distinct from built-artifact tests.
- This document is a plan, not execution evidence. No runtime implementation or passing feature tests are claimed by its creation.
