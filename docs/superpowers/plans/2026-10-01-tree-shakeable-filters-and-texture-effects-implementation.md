# Tree shakeable filters and texture effects implementation plan

> **Historical status: Design or implementation record; current behavior is defined by runtime contracts.**

Status: reviewed and corrected implementation plan, 2026-10-01. Production implementation may begin.
Approved design: [tree shakeable filters and texture effects](../specs/2026-10-01-tree-shakeable-filters-and-texture-effects-design.md).

## Scope and success

Implement the full approved design: individually imported native filters, removable
capture machinery, independently removable texture production, texture-backed GPU
displacement, animated water, transaction-safe pixel publication, migration,
consumer bundle evidence, public Studio examples, ownership evidence and aggregate
verification. Interactive ripple simulation remains outside scope. Do not replace
this objective with just a blur refactor or a shader demo.

## Isolation and concurrent work

Base is c838c434, the current committed texture-handle implementation. Main checkout
has unrelated agent-verification, electric-texture and WASM work. Preserve all of
it. Implementation uses managed `optional-filter-effects` checkout; plan review
uses separate managed `filter-plan-review` checkout. Each agent receives its exact
absolute checkout and permitted scope. No agent edits the shared primary checkout.
Root coordinates integration and runs the visible preview from the implementation
checkout. Commits contain only this work. Integrate back only after reviewing the
latest main diff and resolving overlaps explicitly; never restore whole files from
an old snapshot over concurrent work.

WASM spike currently lives under `tooling/texture-wasm-spike` and changes no
production package. Do not copy, rewrite, or benchmark against its changing files.
The borrowing protocol describes committed Canvas pixels and a revision, independent
of whether generation is JS or WASM. Keep texture callback signatures, synchronous
message delivery, typed queue semantics, and source dimensions intact. Candidate
publication must not retain WASM memory views or assume a generator buffer can be
transferred. Re-read that thread's status before touching producer lifecycle or
integrating recipe/module changes. Additive `water-waves.ts` avoids simulation files.

## Plan review gate

Before production implementation, an independent subagent reviews this plan against
the full approved design and current code in its isolated checkout. Require concrete
findings about missing acceptance evidence, transaction hooks, dependencies,
resource ownership, migration, and concurrent work. Record findings and corrections
here. Reuse that reviewer for changed-code review later; do not launch overlapping
reviews or implement before plan corrections are recorded.

## Step 1 Establish the baseline and focused failing contracts

- Inspect AGENTS.md and current contracts in each checkout; copy only this design
  and plan into the isolated checkout. Provision dependencies without pointing
  workspace package links back to the shared primary checkout.
- Resolve documented Node 24.15+ on the Node 24 line and pnpm 11.21.0; record actual
  executable paths and versions. If only another version is available, report
  the mismatch and provision the supported environment before final verification.
- Add public named factory blur test and a consumer-bundle fixture performing an
  observable plain Rectangle mount. Confirm existing behavior fails factory use
  and retains filter implementation. Record fresh red output.
- Establish source and packed attribution tooling. Start focused, then extend the
  same harness after slice feedback. Never use absence of filenames in minified
  code as the only proof, and never allow fixture elimination to fake success.

## Step 2 First runnable native filter slice

Primary implementation agent owns core protocol, capture changes and native blur.

- Add inert `@crc/core/filters` entry and declarations/aliases/editor resolution
  needed for this slice. Keep CRCFilter type from core, change its semantics to
  opaque values. Reject old descriptors with actionable migration diagnostics.
- Add private value-owned prepare/executor capabilities; no global installer or
  central operation switch. Keep custom-style interception and pure measurement.
- Move core mounting and backend off direct pool/implementation imports; lazy
  service creation and occurrence ownership release on last boundary removal.
- Make native compilation and reverse influence operation-owned. Preserve exact
  native source/result pooling, one subtree invocation and native-only two draws.
- Implement blur with explicitly declared numeric signals and receiver ownership.
  Preserve empty-list direct path, world/paint transforms and contextual failures.
- Add public Studio optional-filter example with enable/disable and a click target.
  Run focused behavior and consumer bundle checks and start a dedicated port.
- Report exact live URL, checks, and what to inspect as soon as slice works. Ask for
  experiential feedback asynchronously; use waiting time for migration needed by
  the already approved end state, not exhaustive overlapping review.

## Step 3 Migrate native filters and isolate texture consumption

- Implement remaining nine native factories with unchanged options/defaults and
  individual compiler/extent/validation imports. Fuse adjacent native operations.
- Migrate runtime tests, scenarios, tutorial source and public docs. Retain no hidden
  legacy parser. Replace named descriptor types with option types; scan for dynamic
  descriptor construction and `.type` access before automated replacements.
- Split texture protocol/placement consumption from producer lifecycle. Ensure
  Path/Text/Image/viz consumers import protocol only; native paint fast path stays
  direct. Keep defineTexture/useTexture public authoring stable.
- Split unrelated texture recipes and review pure top-level initialization. Root
  exports stay inert. Avoid touching simulation implementation/WASM spike.
- Extend source/packed bundle fixtures for plain mount, Layer, blur, marble,
  water-as-paint and user-defined map. Fix actual retained dependencies rather than
  weakening expected exclusions. Confirm native-only behavior remains unchanged.

## Step 4 Committed texture publication

This step is sequential with texture protocol integration; no competing producer edit.

- Inspect scheduler batch commit/abort and render transaction callbacks. Bind
  candidate raster and revision to the same commit outcome using existing hooks,
  or add the smallest transaction notification needed with focused failure tests.
- Maintain last committed raster while Advance produces a candidate; publish both
  pixels and revision only on successful Commit. Reject/abort releases or explicitly
  requeues the candidate. Initial rendering, updates and resets obey ownership.
- Private simulation state rollback is not promised; do not silently advertise it.
- Add two-consumer public evidence (paint + filter when available; two paints first)
  for one rasterization/revision, failed Commit, failed generation, removal,
  definition replacement, source resize, cross-root rejection and teardown.
- Borrow raster synchronously through value capabilities, validate owner tree and
  liveness, subscribe receiver to revision, and forbid public backing-canvas access.

## Step 5 Displacement and water vertical slice

Implementation agent owns GPU pass and mixed execution. An independent agent may
implement additive water recipe/tests in its own checkout after protocol interfaces
are stable; integrate by reviewed commit. Keep at most one implementation agent and
one reviewer unless genuinely independent recipe work saves time.

- Add displacement options exactly as designed: map, nonnegative logical strength,
  explicit region. Map supports declared signals, placement uses existing repeat/
  stretch view rules with region as anchor. Zero strength skips GPU and map revisions.
- Implement required-input expansion including bilinear footprint, map RG byte
  decoding neutral at 128, alpha weighting, premultiplied scene sampling, transparent
  source edges, consistent Y orientation and numeric sRGB map upload.
- Add lazy WebGL2 service per root tree with shaders/scratch reuse and borrower-counted
  map uploads. Dispose after last consumer. No Three, readPixels/getImageData scene
  readback, hidden CPU fallback or independent frame loop.
- Implement ordered native/custom segments, intermediate window planning, bounded
  scratch leases, nested completion and discard behavior. Never composite incomplete
  output; restore Canvas state and leases in finally. Test context loss/restoration.
- Add waterWaves recipe in an isolated module, seeded periodic modes, static zero-speed,
  pause/reset messages, delta baseline, resolution behavior and rejected palette.
- Expand runnable lesson with strength/speed/pause/toggle/map preview and explicit
  Layer example. Include interactive content; demonstrate unchanged event geometry.
- Present exact URL for visual feedback. Measure full pipeline separately from shader
  execution before claiming benefit. Do not wait for broad hardening to expose it.

## Step 6 Harden after feedback

- Run/extend native filters, empty/invalid input, ordered mixed chains, nested effects,
  custom primitives, DPR/transforms/clips/Layer and external-renderer scenarios.
- Add exact geometry/input/focus/physics/animation comparisons at controlled logical
  times and deterministic texture lifecycle/error counters. Verify outer map updates
  do not dirty a clean child Layer's content; inner effects dirty their Layer.
- Test neutral/extreme/transparent RG maps, repeat seams, stretch clamp, rotated map,
  alpha/color, enlarged input windows and source edges. Inspect visual diffs rather
  than replacing baselines to silence failures.
- Fault-inject context allocation, shader compilation, upload/security failure,
  context loss/restoration, rejected publication and failed rendering. Check exact
  release of GPU uploads, services, leases, candidates, consumer edges and listeners.
- Verify import-only inertness and structural absence for every scoped bundle case
  under esbuild and Vite, source and packed, minified/unminified. Record sizes and
  versions. Add positive detector controls and include emitted chunks/assets.
- Audit animation, layout, render-layer, geometry, viz and particle optionality;
  record concrete follow-up issues for unrelated contracts instead of silently
  declaring the whole library tree shakeable.

## Step 7 Documentation, final review and integration

- Update style/surface/texture/ownership/scheduling contracts to implemented behavior,
  preserving original component texture contracts and distinguishing shared handles.
  Publish migration guide and factory/underwater authoring references in docs/site.
- Verify all export/declaration/package/Studio consumers and canonical imports.
- Reuse review agent in separate checkout at integrated head. Review changed code
  and unresolved findings; correct material issues and rerun affected tests only.
- Run aggregate `corepack pnpm@11.21.0 trust` in supported Node 24 environment after
  focused checks. Record command, fresh output, versions, and remaining limitations.
- Recheck concurrent main/WASM/electric changes, integrate without overwriting them,
  and run proportional integration checks on the combined result. Preserve worktrees
  still used by preview/tests. Do not archive the active preview checkout.

## Completion checklist

- [x] Plan reviewed independently in isolated workspace and corrected before code
- [x] Native factories and capture are actually removable in consumer bundles
- [x] Texture production and recipe families are independently removable
- [x] Texture pixels and revisions publish together on successful transactions
- [ ] Displacement and animated water satisfy all specified semantics
- [ ] Public runnable lessons inspected; focused checks and feedback incorporated
- [x] Geometry/physics/animation/input remain appearance-independent
- [ ] Ownership, failures, capability handling and no-readback behavior evidenced
- [x] Migration/docs/contracts/packed/declaration/Studio parity complete
- [x] Optional feature audit and byte evidence recorded
- [ ] Independent final review corrected and aggregate trust gate passes
- [ ] Integrated result preserves concurrent WASM/electric/agent work

## Review findings and corrections

Independent review completed by `filter_review` in the managed
`filter-plan-review` checkout before production implementation. Corrections:

1. **P0 publication order:** Add batch-local resource publication registration.
   Validate writer permissions/equality and all fallible preparation before signal
   assignment. Adopt already-prepared raster pointers in the existing pre-observer
   applied phase, then notify observers. Adoption must be nonthrowing. Rejected
   batches and discarded writers run exact abort cleanup. Scheduler commit
   acknowledgements run too late and are not used for pixel publication. Verify
   notification observers can read only the matching new raster and revision.
2. **P0 separate transactions:** Advance publication belongs to scheduler Commit.
   A later render failure does not roll back a committed raster/revision. Initial
   creation during Render uses a transaction-local provisional raster visible only
   to that render transaction; successful finish adopts it, failure disposes it.
   Test both outcomes and dependency cleanup. Never wait until Complete to adopt
   an already committed Advance raster.
3. **P1 stable producer canvas:** Keep `TextureContext.canvas` as the stable producer
   working surface. Copy completed producer output into a candidate publication
   surface; maintain separate committed publication pixels until adoption. This
   adds an explicit small-raster copy, measured in full-frame costs. Do not swap a
   frozen context property or change callback signatures. Candidate publication
   buffers are CRC-owned and never alias retained WASM linear-memory views.
4. **P1 writer identity:** Store one stable participant function/token and use that
   exact writer for signal staging and publication registration. `discardWriter`
   must abort its candidate. Test a throw after staging, rejected Commit, disposal
   during notification, and absence of stale retry/continuing work.
5. **P1 ownership precision:** Native pools remain lazy per CRC instance because
   Layer captures have independent target lifetimes. GPU service is separately
   owned by the root CRC tree, with cross-Layer occurrence reference counts. Remove
   concrete imports/fields from mount-crc, global-state, types, backend, and style
   dispatch; only generic optional services are visible to base core. Test one GPU
   context across nested Layers and final-borrower release.
6. **P1 packaging decision:** Begin with an explicit `src/filters.ts` build entry,
   export map, declaration entry and `typesVersions` entry; use one source module
   per native operation and recipe. Keep current split ESM only if both downstream
   bundlers prove exclusions from the packed artifact. If they fail, change affected
   output to preserve modules (with `.js` ESM internal paths and public export paths
   updated consistently) rather than adding public per-effect deep imports. Step 1
   must establish this decision with built attribution before broad migration.
7. **P2 identity validation:** Strength zero validates genuine map identity, owning
   root, liveness and placement without subscribing to pixel revisions or allocating
   a service. Disposed/foreign maps still reject when encountered by rendering.
   This does not proactively rerender an identity filter when an unused map dies.
   Add source-region, rotated receiver, map rotation, repeat/stretch tests.
8. **P2 migration evidence:** Reject old descriptors before optional allocation;
   migrate SystemStyle, types, source/built aliases and Studio editor declarations.
   The packed texture verifier has stale export expectations; update it to the
   actual authoritative committed surface before adding water and treat the
   historical three-export list as drift, not a target to regress to.

Baseline observed before production edits: an observable source-bundled plain
Rectangle mount retains 37,212 unminified attributed bytes across filter validator,
region, capture, pool and Canvas-state modules (esbuild in the isolated checkout).
This is a diagnostic baseline, not a packed/minified guarantee. Node 24.15.0 was
provisioned at `/Users/benlesh/.npm/_npx/1c56de6e9acc34f8/node_modules/node/bin/node`;
isolated workspace dependencies were installed from the lockfile with pnpm 11.21.0.

These corrections govern the earlier step summaries where more specific. They
clarify the approved architecture without narrowing feature scope.

## Verification progress — 2026-10-01

The isolated integration branch implements both public slices. The underwater
lesson at `http://127.0.0.1:4392/#/examples/composition/underwater` passed automated
motion, pause, control, click, and page-error checks after the map-subscription fix.
This is inspected runnable evidence; explicit user visual acceptance is not recorded.

The aggregate run on Node 24.15.0 / pnpm 11.21.0 passed static checks, source/built
Studio declaration parity, packed consumer exclusions and import inertness, then
3,304 browser tests (five skipped). It stopped at the examples-landing screenshot
comparison; that difference is under investigation, and the aggregate gate is not
yet claimed complete. Separate subsequent gates passed built smoke (two tests),
lifecycle (32), structural performance (48, four skipped), identity, and watchdog.

Additional focused public evidence covers map replacement and old-consumer
cleanup, cross-root/disposed map rejection including zero strength, controlled
animation values, focus/keyboard/cursor geometry, and external-render-layer routing.
Texture publication tests also verify a stable producer canvas across resolution
reset and exact disposal; the focused texture suite passed seven tests. The WASM
chat was rechecked and remains a tooling-only spike with production defaults unchanged.

GPU fault injection covers real context, shader, program, allocation, and upload
failure paths with cleanup and successful retry; exact handle-count assertions are
being finalized. Measured per-frame pipeline costs and packed bundle baselines are
recorded in the associated testing field notes. Shared-checkout integration is still
pending: temporary three-way merge drafts preserve concurrent electric exports,
editor declarations, example changes, and agent-verification tooling.

### Inspected Studio baseline correction

The reviewer reproduced exactly 5,612 changed pixels in five fresh integration
contexts and one current primary-build context, confined to the hero Canvas text
(x=870–1077, y=356–430). Font readiness was stable; hero source and geometry are
unchanged by this feature. Root inspected expected, actual, and a computed diff
showing only “DRAW.” / “MOVE. LEARN.” glyphs. The single examples-landing baseline
is intentionally refreshed for current Chromium generic-sans rendering. No mask,
tolerance, font wait, or runtime change was introduced.
