# Agent verification capability inventory

- **Status:** Design input; non-normative capability inventory, not an approved
  implementation plan or a claim that these capabilities exist.
- **Date:** 2026-09-28.
- **Last reconciled against code:** 2026-09-29, checkout `e8a1cf29`.
- **Primary audience:** Agents building, changing, debugging, and verifying Pibbl
  applications. Human inspection is a secondary consumer of the same evidence.
- **Scope:** Complex Canvas 2D applications and data visualization, including
  signals, scheduling, animation, hybrid DOM applications, and optional renderers.
- **Authority:** Current public code, executable tests, and implemented contracts
  remain authoritative. This document does not amend them.
- **Review trigger:** A new runtime capability, changed public contract, new
  verification consumer, or evidence that a listed need is unnecessary or missing.

## Purpose

An agent needs to establish that an application does the requested thing,
understand why it does something else, make a targeted repair, and demonstrate
that the repair did not break another behavior. Seeing a plausible screenshot
and receiving a successful build are insufficient.

This inventory aims for exhaustive coverage of that workflow within Pibbl's
application boundary. It is deliberately broader than any sensible first
implementation. Exhaustiveness cannot cover unknown future capabilities; new
packages and application domains must supply their own verification facets.
Every entry describes a useful question, control, or evidence requirement, not
a demand for a new core API.

### Navigation

| Questions                                                           | Sections |
| ------------------------------------------------------------------- | -------- |
| What is running, what should happen, and what do queries mean?      | 01–03    |
| What exists, where is it, and what was painted?                     | 04–09    |
| Can real input reach it and produce the intended action?            | 10–12    |
| Why did state or pixels change, and when is the result ready?       | 13–16    |
| Is the visualization or optional backend correct?                   | 17–21    |
| Does the complete application work and recover correctly?           | 22–24    |
| Is it efficient, distributable, reproducible and adequately tested? | 25–29    |
| Can an agent trust and use the evidence?                            | 30–32    |
| What should we design, test, exclude and revisit?                   | 33–36    |

The previous strategy favors human-first tooling. This inventory intentionally
uses the user's agent-first lens without silently rewriting that broader
strategy. It remains in `docs/strategy`, outside public Studio documentation and
search. Related context: [strategy](./README.md),
[trust gate](../testing/trust-gate.md), and
[existing tooling opportunities](../testing/test-tooling-opportunities.md).

## How to design against this inventory

Requirement IDs are stable references, not implementation order or priorities.
Do not renumber existing IDs when adding entries. Retire an entry with its
reason rather than reusing its ID. No checkbox means “not implemented”: this is
an inventory of needs, not a completion tracker.

For a proposed slice, record the IDs it serves, the specific user questions,
evidence source, owner, capability dependencies, costs, and acceptance tests.
Each selected entry needs a disposition: existing public capability, existing
internal evidence, application/harness responsibility, proposed tooling,
conditional future capability, unnecessary for this slice, or deliberately
rejected. “Not selected” is not a test failure.

### Ownership vocabulary

| Owner            | Responsibility                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Runtime/tooling  | Facts only Pibbl can reliably know; optional bounded instrumentation and read-only queries         |
| Browser/harness  | Real input, viewport, host timing, assets, process isolation, screenshots, execution and artifacts |
| Application      | Business meaning, data identity, expected outcomes, commands, semantic alternatives and fixtures   |
| Build/package    | Types, exports, dependency identity, production output and reproducible setup                      |
| Optional package | Backend-specific facts, counters and invariants behind capability discovery                        |

An entry can span owners. That is a coordination requirement, not permission to
put all responsibilities in core. Existing test-only probes can remain internal
when no external consumer needs them. Protocol adapters and test-runner matchers
should consume a smaller shared evidence boundary rather than define it.

### Rules applying to every entry

- **RULE-01 — Honest evidence states.** Distinguish observed fact, derived fact,
  application assertion, heuristic suspicion, unavailable, unsupported, redacted,
  stale, truncated, and not applicable. Unknown is never false, zero, or passing.
- **RULE-02 — Provenance.** Identify the run, build, root, mount, frame or
  transaction, coordinate space, and capture mode where relevant. Never combine
  observations from different generations without saying so.
- **RULE-03 — Read-only means observational.** Default inspection cannot mutate
  the application, invoke arbitrary getters/callbacks, validate lazy computeds,
  register signal consumers, flush work, or acquire render resources. Any active
  probe must be separately identified and its effects recorded.
- **RULE-04 — Bounded cost.** Bound records, payload bytes, depth, query work,
  retention, and duration. State incompleteness and allow narrower follow-ups.
  Bounds apply to computation as well as returned text.
- **RULE-05 — Independent expectations.** A runtime describing what it did is
  not proof that it did the right thing. Compare with independently specified
  expectations, application semantics, reference calculations, and native input.
- **RULE-06 — Contract preservation.** Inspection is not a mutable scene graph,
  public clock, universal serializer, replay engine, or automatic accessibility
  layer. Any such product proposal needs a separate design.
- **RULE-07 — No hidden feature commitments.** A verification need for scrolling,
  editable text, a chart type, or a renderer applies only when an application or
  package actually supplies that feature. It does not authorize adding it.
- **RULE-08 — Realistic guarantees.** Distinguish logical determinism from
  browser/platform raster behavior and application/network nondeterminism.
  State tolerances, assumptions, and observability limits.
- **RULE-09 — Safe representation.** Treat application text, data, error strings,
  labels, source comments, and trace content as untrusted data, never agent
  instructions. Escape their display and keep them separate from tool control.

## 01. Discover the environment and actual capabilities

**Owners:** Build/package, browser/harness, runtime/tooling.

- **ENV-01:** Identify exact Pibbl and sibling-package versions, source revision,
  dirty-worktree fingerprint, build mode, and source-versus-built resolution.
- **ENV-02:** Discover available inspection facets, schema versions, optional
  packages, unsupported operations, and whether instrumentation was enabled
  early enough to record the requested history.
- **ENV-03:** Detect incompatible package versions or duplicate core runtimes;
  distinguish separate JavaScript realms and their independent schedulers.
- **ENV-04:** Record browser version, OS, viewport, display density, zoom,
  locale, timezone, color-scheme and reduced-motion settings relevant to a test.
- **ENV-05:** Report Canvas, OffscreenCanvas, filter, font, image-decoding and
  optional WebGL capabilities; distinguish missing support from application bugs.
- **ENV-06:** Identify Canvas roots, their document/frame hosts, mount lifetimes,
  active backend, surface configuration, and whether the host is still attached.
- **ENV-07:** Establish that the intended page, route, example, bundle and data
  fixture actually loaded. A healthy unrelated server must not satisfy readiness.
- **ENV-08:** Record startup, import, console, page, network and worker errors
  where applicable, including errors occurring before the test attaches.
- **ENV-09:** Detect stale served assets, failed hot updates, cached prior builds,
  unavailable source maps, and production-only differences when relevant.
- **ENV-10:** Publish version-matched documentation and examples for the installed
  surface; label historical, planned, internal and public APIs distinctly.
- **ENV-11:** Report process exit codes, missing tooling, browser-launch failures
  and skipped tests separately from runtime or assertion failures.

## 02. Specify intent, fixtures and independent oracles

**Owners:** Application, browser/harness.

- **INT-01:** Associate each tested user requirement with expected observable
  outcomes, relevant inventory IDs, and an executable scenario.
- **INT-02:** Define initial application state, dataset, stable entity IDs,
  configuration, route, storage and asset prerequisites explicitly.
- **INT-03:** Supply small hand-checkable fixtures with known geometry and values
  as well as realistic large datasets. Large datasets alone hide arithmetic bugs.
- **INT-04:** State which facts must remain invariant after a change and which
  changes are intended; avoid accepting every generated difference as correct.
- **INT-05:** Distinguish user intent from runtime mechanics: “selected customer
  A” is an application assertion, not merely “pointer handler ran.”
- **INT-06:** Specify empty, missing, invalid, loading, stale, error, disabled and
  successful states only where the application supports those distinctions.
- **INT-07:** Provide exact, tolerance-based, range, ordering, set-membership and
  eventual expectations as appropriate; record units and rationale.
- **INT-08:** Use independent reference calculations for layouts, mappings,
  summaries and selections. Reusing the production helper is supplemental evidence.
- **INT-09:** Identify unsupported requests before testing; distinguish a product
  gap from a regression and from a malformed test.
- **INT-10:** Keep setup/reset actions explicit and separate from actions under
  test. A fixture that sets selected state directly cannot prove clicking works.

## 03. Query and snapshot semantics

**Owners:** Runtime/tooling, optional package, browser/harness.

- **QRY-01:** Obtain a coherent snapshot at a named observation boundary;
  distinguish attempted, completed, failed and last-successful work.
- **QRY-02:** Scope queries by root, surface, subtree, application ID, record kind,
  region, frame or transaction rather than returning the entire application.
- **QRY-03:** Offer field projection, summary counts and bounded detail expansion
  so an agent can inspect a large scene within a small context budget.
- **QRY-04:** Make pagination snapshot-consistent; cursors must not silently mix
  changing scene generations. Report cursor expiration and incomplete history.
- **QRY-05:** Return explicit no-match, ambiguous-match, unsupported-query and
  invalid-selector results; never silently choose the first duplicate name.
- **QRY-06:** Preserve stable ordering where meaningful and identify unordered
  collections so incidental enumeration changes do not create false diffs.
- **QRY-07:** Represent absent, null, undefined, NaN, infinities, negative zero,
  cyclic structures, functions and opaque handles without lossy JSON ambiguity.
- **QRY-08:** Return immutable evidence values or snapshots, not mutable live
  objects that change after the agent reads them.
- **QRY-09:** Include validity, completeness, precision and redaction metadata at
  the relevant field or facet, not only in an easily missed global warning.
- **QRY-10:** Support semantic snapshot diffs that identify additions, removals,
  remounts and changed facts without treating addresses or timestamps as meaning.
- **QRY-11:** Permit bounded subscriptions or trace windows where polling misses
  transient behavior; expose dropped records, overflow and backpressure.
- **QRY-12:** Cancel expensive queries and release snapshot/subscription resources;
  detect queries against disposed roots and obsolete runtime sessions.
- **QRY-13:** Define forward/backward schema compatibility and unknown-enum
  handling. Machine consumers must not infer schemas by parsing prose errors.
- **QRY-14:** Distinguish queries answered from already recorded facts from active
  geometry/backend probes. A custom hit resolver may execute application code;
  such a probe cannot silently inherit a read-only snapshot guarantee.

## 04. Identity, structure and source correlation

**Owners:** Runtime/tooling, application, build/package.

- **ID-01:** Distinguish application entity ID, component lifetime, element
  descriptor, layout box, paint record, event target and backend resource.
- **ID-02:** Relate these identities without promising a one-to-one mapping;
  one component may emit many records or no paint at all.
- **ID-03:** Locate entities through deliberate application labels/IDs without
  depending on private ref paths or unstable component occurrence numbers.
- **ID-04:** Detect duplicate labels and document their scope; do not turn an
  inspection label into a new lifecycle key implicitly.
- **ID-05:** Explain mount, retained identity, replacement and remount across
  keyed reorder, unkeyed insertion, function changes, wrappers and reparenting.
- **ID-06:** Show logical ancestry separately from paint order, event ancestry,
  focus order and render-surface ownership.
- **ID-07:** Identify transparent versus keyed fragments and components whose
  output is empty, conditional, flattened or iterable.
- **ID-08:** Correlate a diagnostic with source file/line/column when available;
  disclose missing production metadata and source-map uncertainty.
- **ID-09:** Reject stale handles after remount or disposal even when a new entity
  reuses the same application label; expose the replacement relationship if known.
- **ID-10:** Retain only bounded historical tombstones needed to explain a
  removal. Inspection must not keep deleted components or application data alive.

## 05. Surfaces, coordinate spaces and geometry

**Owners:** Runtime/tooling, browser/harness, optional package.

- **GEO-01:** Inspect logical viewport, CSS content box, backing size, effective
  density, fit, centering and rounding; distinguish declared from effective values.
- **GEO-02:** Inspect local, root-logical, surface, CSS/client and backing-space
  transforms with named spaces and transformation order.
- **GEO-03:** Convert points and vectors between supported spaces using the
  observed generation; report singular or unsupported mappings explicitly.
- **GEO-04:** Distinguish allocation bounds, geometric bounds, stroke bounds,
  conservative paint extents, clipped extents, hit geometry and focus bounds.
- **GEO-05:** Identify whether bounds are exact, conservative, sampled or unknown.
  An axis-aligned bounding box is not an exact rotated shape or path.
- **GEO-06:** Inspect clip ancestry, local clip geometry when representable,
  transform at clip capture, and the surface on which each clip applies.
- **GEO-07:** Verify agreement between known painted landmarks and native pointer
  locations after nested transforms, root fitting, page scrolling and resizing.
- **GEO-08:** Handle fractional dimensions, density changes, zero-size/hidden
  hosts, negative scale, rotation and noninvertible transforms according to contract.
- **GEO-09:** Report host CSS borders, padding and supported host transforms
  relevant to coordinate mapping; do not silently claim arbitrary CSS 3D support.
- **GEO-10:** Explain geometry culled or excluded by a viewport/clip versus geometry
  with zero area, invalid inputs or no emitted drawing.
- **GEO-11:** Provide bounded geometry samples or geometry queries for opaque
  paths; do not assume native Path2D exposes reconstructible command data.

## 06. Styles, layout and measurement

**Owners:** Runtime/tooling, application.

- **LAY-01:** Compare specified, normalized and resolved style with the final
  allocation; identify defaults, explicit inputs and unsupported fields.
- **LAY-02:** Explain parent placement versus primitive-local drawing coordinates,
  including the difference between layout `left`/`top` and shape `x`/`y`.
- **LAY-03:** Report constraints, declared dimensions, padding, gaps, available
  space and resolved percentage/fraction values with their reference dimensions.
- **LAY-04:** Show the inputs and outputs of Absolute, Overlay, Flow, Flex and
  explicit Grid placement without exposing private algorithm data structures.
- **LAY-05:** Explain wrapping, alignment, justification, grow/shrink and minimum
  or maximum constraints only where those behaviors are supported.
- **LAY-06:** Identify overflow, overlap and out-of-allocation drawing as facts;
  diagnose them as errors only when an application expectation makes them errors.
- **LAY-07:** Distinguish pure measurement results from actual allocated and
  painted results; show when intrinsic measurement is absent or intentionally unused.
- **LAY-08:** Prove measurement does not render, run forbidden hooks, write signals
  or acquire runtime resources; report rejected side effects contextually.
- **LAY-09:** Explain responsive reflow across multiple independent panels,
  including which ancestor supplied each panel's finite allocation.
- **LAY-10:** Trace signal-valued layout input attribution if implemented, including
  reads performed before the receiving primitive evaluates.
- **LAY-11:** Verify layout-scope restoration after a failed child and isolation
  between siblings, roots and surfaces.
- **LAY-12:** Expose actionable validation errors for invalid lengths, unresolved
  allocations and unsupported CSS-like expectations without inventing inheritance.

## 07. Paint, composition and visibility

**Owners:** Runtime/tooling, browser/harness, optional package.

- **PNT-01:** Record whether a component emitted drawing, on which surface, and
  its paint order; separate absence of paint from absence of component evaluation.
- **PNT-02:** Inspect resolved fills, strokes, widths, alpha, composition and
  supported raster-affecting state, with opaque resources summarized safely.
- **PNT-03:** Verify save/restore isolation so a primitive's transform, clip,
  style or compositing changes do not contaminate siblings.
- **PNT-04:** Distinguish zero alpha, offscreen geometry, clipping, missing assets,
  covered paint and failed rendering as separate possible causes of invisibility.
- **PNT-05:** Separate proven causes from possible occlusion. Arbitrary blends,
  filters and custom drawing prevent a universal exact “visible pixel” answer.
- **PNT-06:** Inspect filter order, receiving subtree, nested boundary order,
  transient surface dimensions and composite transform where recorded.
- **PNT-07:** Verify filter effects change pixels without silently changing logical
  layout, measurement, hits or focus bounds.
- **PNT-08:** Detect double-applied density, unintended clipping of effect extents,
  incorrect alpha multiplication and coordinate drift using controlled fixtures.
- **PNT-09:** Explain root clearing and per-surface redraw/composite work; distinguish
  a reused bitmap from freshly executed drawing.
- **PNT-10:** Capture representative paint calls or bounded command traces in a
  controlled harness when useful; no universal production display list is required.
- **PNT-11:** Expose partial-frame failure honestly. Ordinary Canvas pixels painted
  before failure are not automatically rolled back to the last successful frame.
- **PNT-12:** Correlate semantic paint evidence with an actual browser screenshot
  or narrow pixel probe where raster output is the behavior being tested.

## 08. Text and fonts

**Owners:** Runtime/tooling, browser/harness, application.

- **TXT-01:** Inspect resolved text content, font request, alignment, baseline,
  wrapping, fitting and clipping settings supported by the component.
- **TXT-02:** Inspect measured advances, line boxes, rendered line breaks and
  available width/height; distinguish text metrics from exact glyph ink bounds.
- **TXT-03:** Record font loading/readiness and available evidence about fallback;
  do not claim reliable per-glyph font attribution without platform support.
- **TXT-04:** Verify Unicode, combining characters, emoji, directionality and
  long/unbreakable content for the application's supported text requirements.
- **TXT-05:** Distinguish intentional wrapping/truncation/clipping from accidental
  loss of text, and unavailable text features from rendering regressions.
- **TXT-06:** Test late font arrival and responsive size changes where relevant;
  record whether the app/runtime actually requests the necessary update.
- **TXT-07:** Separate exact text/geometry assertions from environment-sensitive
  font rasterization. Use a controlled font only when the test needs it.
- **TXT-08:** Preserve text redaction and payload limits while allowing explicit
  fixture text to serve as an assertion or locator.

## 09. Images and asynchronous assets

**Owners:** Runtime/tooling, browser/harness, application, optional package.

- **AST-01:** Observe requested source generation, pending/load/decode/error state,
  intrinsic dimensions and the generation actually used for drawing.
- **AST-02:** Verify that a late completion for an old source cannot replace the
  current image or schedule work for a disposed owner.
- **AST-03:** Control successful, delayed, failed and out-of-order asset completion
  using harness fixtures, without adding a production network scheduler to Pibbl.
- **AST-04:** Distinguish transport, decode, format, CORS/taint and render failures;
  report when screenshots or readbacks cannot inspect an asset.
- **AST-05:** Verify destination sizing, cropping and transforms against decoded
  dimensions rather than assuming request metadata describes the final asset.
- **AST-06:** Observe cancellation/listener cleanup and ownership of images,
  bitmaps, object URLs, textures and model assets where those resources exist.
- **AST-07:** Record asset identities or fixture hashes sufficient to reproduce
  output without exporting credentials, signed URLs or private payloads.
- **AST-08:** Separate application loading policy from Pibbl readiness; distinguish
  an intentionally displayed placeholder from a failed asset gate.

## 10. Coordinate targeting and actual input delivery

**Owners:** Runtime/tooling, browser/harness, application, optional package.

- **HIT-01:** Query the committed target result for a root-logical point, with the
  generation, paint order and participating surface boundaries.
- **HIT-02:** Explain considered candidates and exclusions: geometry miss, clip,
  participation opt-out, stale generation or a higher eligible target.
- **HIT-03:** Distinguish target, blocking geometry and miss where the backend has
  those outcomes; never equate transparent pixels with guaranteed pass-through.
- **HIT-04:** Distinguish structural listeners from independent hit geometry and
  explain why a handler-bearing container is not necessarily targetable.
- **HIT-05:** Inspect stroke hit width, fill participation, path rules and committed
  transforms; visual stroke width and interaction width may differ intentionally.
- **HIT-06:** Find a valid interaction point when one can be established; return
  uncertainty or no verified point for irregular, clipped or occluded targets.
- **HIT-07:** Convert a selected point to browser input coordinates using current
  host geometry; detect if the target changed before delivery.
- **HIT-08:** Drive native browser pointer movement, press and release, including
  button, pointer type, modifiers and drag waypoints supported by the harness.
- **HIT-09:** Verify click-through/pass-through behavior across overlapping Canvas
  primitives, Layers, renderer islands and application DOM overlays.
- **HIT-10:** Inspect active pointer capture separately from geometric hits, and
  verify movement outside bounds, cancellation, release and owner removal.
- **HIT-11:** Test gaps, thin strokes, boundary points, transformed targets and
  multiple pointers where applicable; document edge tolerances explicitly.
- **HIT-12:** Compare query predictions with actual event delivery. A successful
  synthetic hit query alone cannot prove browser input integration.
- **HIT-13:** Report intervening overlays, host occlusion and changed geometry at
  action time rather than silently force-clicking past them. Expected-hit identity
  should be checked against actual dispatch to expose query/action races.

## 11. Event propagation and application actions

**Owners:** Runtime/tooling, browser/harness, application.

- **EVT-01:** Record a bounded event path through capture, target and bubble with
  target/currentTarget, listener order and event type.
- **EVT-02:** Correlate native transport, logical dispatch, application action,
  resulting state changes and subsequent render completion when recorded.
- **EVT-03:** Verify stopPropagation, stopImmediatePropagation, preventDefault and
  native default cancellation under the relevant passive/listener contract.
- **EVT-04:** Inspect related-target and enter/leave transitions without confusing
  logical component boundaries with DOM host boundaries.
- **EVT-05:** Verify removal, listener replacement, root replacement and throwing
  handlers during dispatch against the documented snapshot/lifecycle rules.
- **EVT-06:** Distinguish pointer/mouse compatibility events and activation so tests
  catch accidental duplicate actions or missing releases.
- **EVT-07:** Exercise wheel units/modifiers, keyboard keys, composition, clipboard
  and drag/drop facades only through transports the environment actually supports.
- **EVT-08:** Label native automation, dispatchEvent, direct handler invocation and
  application command invocation as different test strengths and paths.
- **EVT-09:** Report event.isTrusted and browser permission/user-activation limits
  when relevant; do not promise all automation generates equivalent trusted input.
- **EVT-10:** Verify input while updates are pending uses the documented committed
  geometry and target generation, not an uncommitted candidate.
- **EVT-11:** Assert final domain outcomes, not merely listener counts; record
  deliberate no-op/canceled actions when their absence is the requirement.

## 12. Focus and keyboard navigation

**Owners:** Runtime/tooling, browser/harness, application.

- **FOC-01:** Inspect native focused host and logical focused target separately,
  including active policy, enrollment and committed focus order.
- **FOC-02:** Verify entry, Tab/Shift+Tab traversal, exit and restoration relative
  to surrounding DOM controls, not only cycling within Canvas targets.
- **FOC-03:** Inspect focus-visible modality and verify that the application's
  visible indicator agrees with logical focus state.
- **FOC-04:** Explain directional-navigation candidates, bounds, scope and tie
  resolution; distinguish source order from geometric directional order.
- **FOC-05:** Verify pointer focus, keyboard activation, repeat handling and
  cancellation without invoking an action twice.
- **FOC-06:** Test removal, disabled/ineligible application state, clipping or
  scene replacement according to the actual focus contract, not DOM assumptions.
- **FOC-07:** Verify native non-coordinate input has the expected logical target
  and that an unconfigured Canvas does not invent one.
- **FOC-08:** Assert keyboard operability separately from accessibility semantics;
  logical focus is not evidence of a screen-reader-accessible application.

## 13. Signals, computed values and reactions

**Owners:** Runtime/tooling, application. Core signal inputs, batching, owned
computeds and reactions are implemented. Their general inspection facets are
not implied by those authoring APIs; inspect actual tooling coverage separately.

- **SIG-01:** Identify signal cells, readonly views, revisions, owner lifetimes and
  optional debug names without exposing mutable internal nodes.
- **SIG-02:** Observe last-known published values with safe previews; distinguish
  a cached value, dirty/unvalidated computed, cached error and never-read computed.
- **SIG-03:** Inspect recorded dependencies and observers, including dynamic
  branch changes and untracked reads where trace instrumentation captured them.
- **SIG-04:** Explain whether a write published, was equality-suppressed, was
  rejected by a guard, or threw from an updater/equality callback.
- **SIG-05:** Trace a changed source through computed validation/equality barriers
  to affected consumers and owning render surfaces.
- **SIG-06:** Distinguish dependency invalidation, component evaluation and pixel
  redraw. A leaf subscription does not imply a leaf-only Canvas repaint.
- **SIG-07:** Explain receiver-owned signal inputs versus explicit caller reads
  when supported, and which declared input positions resolve signals.
- **SIG-08:** Verify opaque row/custom payloads are not recursively subscribed or
  unwrapped. Detect invalid nested signals at declared boundaries where required.
- **SIG-09:** Verify batching, deduplicated notification and atomic visibility at
  the defined boundary; distinguish scheduler coalescing from synchronous batching.
- **SIG-10:** Inspect computed cycles, dependency paths and failure/recovery;
  diagnostics must not create the edges or evaluations they claim to inspect.
- **SIG-11:** For transactional owned computeds, distinguish candidate formula,
  provisional reads, successful publication and rollback after failure.
- **SIG-12:** For owned reactions, trace setup, dependencies, scheduling and cleanup
  without confusing reaction reads with render dependencies.
- **SIG-13:** Verify removed consumers and observation leases detach; a retained
  signal may remain usable without keeping its former component active.
- **SIG-14:** Diagnose likely in-place-mutation mistakes through documented equality
  semantics and explicit app assertions; no universal deep mutation detector is assumed.

## 14. Scheduler, transactions and readiness

**Owners:** Runtime/tooling, browser/harness.

- **SCH-01:** Observe pending versus executing work, current phase, participating
  roots and the realm's host-frame ownership.
- **SCH-02:** Explain request causes, coalescing, monotonically scoped revisions,
  same-frame admission and next-frame deferral.
- **SCH-03:** Correlate Begin, Advance, Commit, Plan, Render and Complete for a
  bounded trace without requiring applications to depend on private queue layouts.
- **SCH-04:** Distinguish requested revision, completed revision and presented
  evidence. A queued update is not evidence that the Canvas shows it.
- **SCH-05:** Provide an observable completion condition for a selected update or
  root; a generic “wait two frames” is not a reliable readiness oracle.
- **SCH-06:** Explain outstanding work on timeout: active playback, dirty root,
  deferred completion, pending asset, app fetch or browser task, with unknowns noted.
- **SCH-07:** Define scoped readiness predicates rather than global quiescence:
  a continuously animated app may never become idle and may already be testable.
- **SCH-08:** Verify unrelated roots continue after one participant fails and that
  errors surface after required cleanup/completion stages.
- **SCH-09:** Verify staged writes publish under the correct transaction, failed
  participants discard their staged writes and unrelated successful work survives.
- **SCH-10:** Correlate bitmap, targeting and focus generations at renderer commit;
  do not claim whole-page or ordinary Canvas pixel atomicity.
- **SCH-11:** Test root replacement, reentrant requests, dispose/abort during work
  and later remount without losing work or admitting stale callbacks.

## 15. Animation and temporal behavior

**Owners:** Runtime/tooling, browser/harness, application, optional package.

- **ANI-01:** Inspect playback identity, program summary, status, direction,
  current time and commanded versus published state where supported.
- **ANI-02:** Inspect track targets and writer ownership; explain writer conflicts,
  explicit replacement and released leases.
- **ANI-03:** Verify start, pause, resume, stop, seek, reverse, repeat and completion
  according to the chosen definition/program, not assumed universal semantics.
- **ANI-04:** Assert intermediate values as well as endpoints for tweens, keyframes,
  springs and custom definitions, with an independent formula or fixture.
- **ANI-05:** Distinguish logical time, host time, fixed-step integration and
  presentation interpolation; record clamping or accumulated/dropped time if relevant.
- **ANI-06:** Verify commands enter the correct scheduler phase and values/status
  publish together before ordered milestones are delivered.
- **ANI-07:** Detect unwanted jumps on transition retargeting, interruption or
  replacement; define what continuity means for the specific animation.
- **ANI-08:** Use a controlled harness clock where justified; also test real browser
  scheduling because a synthetic clock does not prove actual input-to-frame behavior.
- **ANI-09:** Verify teardown, exceptions and stale callbacks release owned state
  and do not keep requesting frames after the last active participant is gone.
- **ANI-10:** Test application reduced-motion behavior, hidden-page/resume behavior
  and frame gaps only against an explicit policy; Pibbl cannot infer product intent.

## 16. Layers, caches and isolated surfaces

**Owners:** Runtime/tooling, optional package, browser/harness.

- **LYR-01:** Inspect the surface ownership tree separately from logical ancestry,
  including dimensions, density, parent composite placement and generation.
- **LYR-02:** Explain why a surface is dirty, reused, resized, recreated or retired;
  record a cache invalidation cause rather than only a cache-hit total.
- **LYR-03:** Verify dirty descendants render before ancestor composition while
  clean siblings retain their caches under the documented model.
- **LYR-04:** Distinguish placement-only updates from content changes and verify
  reuse does not leave input geometry or focus bounds stale.
- **LYR-05:** Verify root-logical transforms and clipping remain correct through
  upright local surfaces, nested filters and multiple density levels.
- **LYR-06:** Inspect transient filter leases versus persistent Layer resources;
  a transient pool is not evidence of persistent pixel caching.
- **LYR-07:** Observe surface pixel area and estimated memory with assumptions;
  report unknown browser/GPU overhead rather than claiming exact total memory.
- **LYR-08:** Verify failed composite/transfer work does not publish mismatched
  bitmap and interaction generations where transactional guarantees exist.
- **LYR-09:** Explain provider/context scope boundaries across independently
  scheduled surfaces, including visualization scale scope where supported.
- **LYR-10:** Demonstrate isolation with a real interaction: moving a crosshair or
  selection overlay should perform only the work promised by that composition.

## 17. Visualization data, lineage and analytical correctness

**Owners:** Application, optional visualization package, browser/harness.
The linear-scale, line/point/custom-series and hover-query surface is implemented.
Additional chart families and data-pipeline operations remain capability-specific;
this inventory does not imply that all listed operations ship in `@pibbl/viz`.

- **DAT-01:** Identify dataset version, stable row keys, schema, units, source and
  freshness expectations without requiring full data disclosure.
- **DAT-02:** Trace a displayed value to its source rows or a bounded provenance
  summary supplied by the application's data pipeline.
- **DAT-03:** Verify accessor selection and input types; distinguish numbers,
  numeric strings, dates, categories, nulls, undefined and nonfinite values.
- **DAT-04:** Inspect input/output counts for filtering, grouping, aggregation,
  sorting, joins, binning and sampling when the app provides those operations.
- **DAT-05:** Detect duplicated/dropped records, unstable keys, unintended reorder,
  stale derived arrays and incorrect join cardinality with explicit fixtures.
- **DAT-06:** Assert aggregates, denominators, weights, units and rounding against
  independent results. Correct pixels cannot establish analytical correctness.
- **DAT-07:** Verify missing, zero and invalid values retain distinct semantics;
  do not treat missing data as zero unless the application explicitly requires it.
- **DAT-08:** Record category order, time interpretation, timezone and daylight-saving
  rules where relevant. Numeric elapsed time is not a calendar-time scale.
- **DAT-09:** For streaming data, verify append/replace/remove behavior, rolling
  windows, bounded retention, late arrivals and the application's ordering policy.
- **DAT-10:** Verify visible marks, tooltip content, summaries and exported/table
  data refer to the same intended data generation or explicitly identify lag.
- **DAT-11:** For decimation or aggregation, preserve stated invariants such as
  extrema, gaps or totals and distinguish original data from displayed samples.
- **DAT-12:** Define empty/all-invalid/singleton/constant-domain policy in the
  application or package; do not silently invent a domain or a successful chart.
- **DAT-13:** Permit bounded row/aggregate queries by semantic identity and allow
  data redaction while retaining counts, types and safe fixture provenance.

## 18. Scales, axes, series and marks

**Owners:** Optional visualization package, application, runtime/tooling.
Apply each entry only to implemented scale/series families.

- **VIZ-01:** Inspect scale ID, nearest provider, scope, signal identity, resolved
  domain/range, frame allocation and committed generation.
- **VIZ-02:** Explain auto or explicit domains, clamping, reversal, niceness and
  unknown-value policies only when the chosen scale actually implements them.
- **VIZ-03:** Test map/invert round trips with declared tolerances; account for
  discontinuous, categorical or noninvertible scales instead of assuming bijection.
- **VIZ-04:** Verify local allocation drives range sizing and density is not applied
  twice; independent panels must not accidentally use the whole Canvas dimensions.
- **VIZ-05:** Inspect tick values, positions, formatting and axis side; distinguish
  exact evenly spaced ticks from “nice” or calendar-aware tick algorithms.
- **VIZ-06:** Assert labels correspond to tick values, units and locale; detect
  clipping or collisions only against an application readability expectation.
- **VIZ-07:** Verify each supported series' geometry: connected runs, independent
  marks, baselines, bar widths, stacks or error extents as applicable.
- **VIZ-08:** Verify invalid/missing coordinates break or skip geometry according
  to contract; no accidental bridging, interpolation or fabricated observations.
- **VIZ-09:** Relate batched marks to row IDs, accessors and scale generation without
  requiring a component, signal observer or hit record for every datum.
- **VIZ-10:** Verify styling precedence and resolver behavior for supported constant,
  per-datum or per-segment styles, including their effect on batching.
- **VIZ-11:** Compare custom annotations and ordinary Pibbl primitives with series
  mappings so all geometry uses the same local frame and scale generation.
- **VIZ-12:** Verify explicit plot clipping, overflow and gutters; do not assume a
  scale provider creates a chart box, padding, hit region or clipping boundary.
- **VIZ-13:** Verify resized/retargeted scale signals preserve the promised identity,
  publish current mappings without an unintended stale frame and recover on failure.
- **VIZ-14:** Explain provider shadowing, unknown IDs and cross-Layer restrictions;
  exercise shared-scale compositions under the actually supported scope model.
- **VIZ-15:** Verify quantitative color/size encodings, categorical palettes,
  legends and baseline choices against the intended analytical meaning when used.
  A geometrically valid chart can still encode area, sign, units or categories wrongly.

## 19. Visualization interaction and linked views

**Owners:** Application, optional visualization package, browser/harness.

- **VIN-01:** Distinguish stroke/mark hit, nearest x-domain observation, nearest
  screen-space point and nearest segment; identify the chosen metric and tolerance.
- **VIN-02:** Verify nearest selection for unsorted data, duplicate coordinates,
  gaps, ties, transformed plots and points outside the range as supported.
- **VIN-03:** Inspect selected row/series IDs and source data generation; do not
  substitute an unstable array index for business identity.
- **VIN-04:** Verify tooltip/crosshair location and content match the selected datum,
  including interpolated versus actual observations where interpolation is used.
- **VIN-05:** Verify brush/selection geometry converts into the intended domain
  interval or set, with explicit inclusive/exclusive boundary policy.
- **VIN-06:** Test selection replacement, extension, clearing and retained selection
  after data changes using the application's documented semantics.
- **VIN-07:** Verify pan/zoom anchoring, bounds and shared-axis synchronization,
  separating view-domain changes from source-data mutation.
- **VIN-08:** Verify linked views agree on shared selection/filter state and do not
  produce feedback loops, accidental cross-panel updates or inconsistent generations.
- **VIN-09:** Verify legend toggles, annotations, keyboard alternatives and blank-plot
  interaction only when supplied; decorative labels should not steal plot input.
- **VIN-10:** Measure requested nearest lookup/index work and demonstrate that
  unrequested expensive queries do not run on every pointer movement.
- **VIN-11:** Verify cached spatial indexes or domain searches invalidate when data,
  mappings or relevant transforms change and release with their owner.
- **VIN-12:** Verify off-plot movement, capture, touch gestures and DOM tooltip
  overlays preserve intended event and focus behavior.

## 20. Optional renderers and custom drawing

**Owners:** Optional package, runtime/tooling, browser/harness, application.

- **REN-01:** Discover backend-specific inspection coverage; opaque custom drawing
  must identify itself as opaque rather than claiming inferred structure.
- **REN-02:** Let custom primitives provide bounded semantic/geometry evidence
  without requiring them to serialize arbitrary closures or drawing programs.
- **REN-03:** Validate supplied custom evidence against representative actual output;
  extension metadata is an assertion, not inherently an independent oracle.
- **REN-04:** Verify backend boundaries reject incompatible children and preserve
  one shared core identity, scheduler and event model where that is promised.
- **REN-05:** For external renderers, correlate the committed layer generation
  with renderer-supplied camera/projection, transforms and bounds where available.
  Three owns its scene and render queues; Pibbl does not reconstruct the removed
  custom WebGL settled-scene model or promise private queue inspection.
- **REN-06:** Distinguish source order, depth-aware raster order, transparent sorting,
  pick order and focus order; do not force them into one universal z-order.
- **REN-07:** Verify picking and projected focus bounds use the committed camera,
  geometry and transform generation that corresponds to the displayed bitmap.
- **REN-08:** Inspect renderer-supplied material, lighting and background evidence
  where supported; distinguish missing geometry from an appearance explained by
  those inputs. Shadow-cache explanations require explicit renderer evidence,
  not assumptions inherited from Pibbl's removed custom renderer.
- **REN-09:** Verify context loss/restoration, resize, transfer/composite failure
  and stale GPU generations with controlled backend tests and browser evidence.
- **REN-10:** Inspect resource counts and logical ownership without exposing public
  GL handles or assuming exact driver memory accounting.
- **REN-11:** For third-party renderer adapters, identify whose state and timing are
  authoritative, what is mirrored, and which facts cannot be observed reliably.
- **REN-12:** Verify raw Canvas extensions respect active transforms/clips and
  cleanup; native command instrumentation must not change drawing semantics.

## 21. Physics, particles and simulation-driven scenes

**Owners:** Optional package, application, browser/harness.
These are optional facets, not prerequisites for ordinary 2D verification.
Pibbl owns a 2D physics runtime and Canvas 2D particles. Pure 3D geometry remains,
but there is no Pibbl-owned 3D world or renderer-coupled 3D particle runtime.
Third-party simulation inside Three belongs to an application/adapter facet.

- **SIM-01:** Distinguish authoritative simulation state, interpolated presentation
  state and last committed paint/pick state, with times and generations.
- **SIM-02:** Observe body/system identity, owned handles, configuration, commands
  and public query results without requiring a mutable internal world snapshot.
- **SIM-03:** Verify collision/query outcomes, event ordering, sleep/wake and
  generation-bound handle validity for the scenarios that use them.
- **SIM-04:** Compare physics-derived transforms with renderer presentation and
  interaction geometry; identify legitimate interpolation differences explicitly.
- **SIM-05:** For particles, record seed/configuration, active count, capacity,
  births/deaths and effect age; do not require per-particle components or observers.
- **SIM-06:** Verify fixed-step, clamping, repeatability and bounded catch-up under
  controlled conditions without promising cross-platform bit-identical simulation.
  The existing `@pibbl/physics/2d/testing` harness advances requested host frames;
  one host frame must not be reported as one guaranteed physics tick.
- **SIM-07:** Detect double-driving a value through physics, animation and direct
  writes where ownership rules prohibit that combination.
- **SIM-08:** Verify disposal removes world/system participants, subscriptions,
  handles and backend resources and rejects stale commands appropriately.
- **SIM-09:** Use analytical fixtures for simple motion and geometry plus tolerant
  aggregate assertions for complex simulation; screenshot similarity alone is weak.

## 22. Application semantics, DOM integration and accessibility

**Owners:** Application, browser/harness; runtime/tooling supplies correlations.

- **APP-01:** Expose a deliberate application verification model: entity IDs,
  selected/expanded/disabled state, values, validation and available operations.
- **APP-02:** Correlate those entities with Canvas evidence and relevant DOM
  controls without equating paint records with semantic UI nodes.
- **APP-03:** Verify native controls, menus, editors, portals and tooltips reflect
  the same authoritative state and do not drift during asynchronous updates.
- **APP-04:** Verify anchoring after resize, page scroll, transforms and density
  changes, including focus entry/exit and overlay removal.
- **APP-05:** Verify text entry, IME, selection and clipboard through actual editable
  DOM adapters when present; Pibbl event facades alone do not establish editing support.
- **APP-06:** Verify scrolling/virtualization supplied by the app or a future package:
  visible range, stable row identity, navigation and retained versus recycled state.
- **APP-07:** Inspect browser accessibility roles, names, states and relationships
  for the real semantic alternative; never fabricate them from Canvas geometry.
- **APP-08:** Verify important information and actions have equivalent semantic
  access, including chart data/summary and keyboard alternatives to gestures.
- **APP-09:** Detect duplicate keyboard paths or hidden focusable overlays and
  verify focus restoration, announcements and modality transitions as specified.
- **APP-10:** Verify selection/undo/redo, save/load and exports if the application
  supplies them; test domain state and rendered state after each operation.
- **APP-11:** Record loading/error/retry and asynchronous response ordering for
  application data; stale responses must follow the application's declared policy.
- **APP-12:** Identify what automated accessibility checks cannot establish and
  retain assistive-technology/user validation for the remaining human outcomes.

## 23. Errors, diagnosis and controlled failures

**Owners:** All owners at their boundary.

- **ERR-01:** Return structured diagnostic category/code, severity, receiver,
  relevant input, phase, generation and source correlation where available.
- **ERR-02:** Preserve original error/cause chains and distinguish a primary failure
  from cleanup failures or cascading consequences.
- **ERR-03:** Explain expected versus actual contract with a concrete correction
  where known; avoid suggesting unsupported APIs or speculative automatic fixes.
- **ERR-04:** Correlate console/page errors with the failed scenario step and
  capture late errors after an apparently successful render.
- **ERR-05:** Identify which operations succeeded, which transaction failed, what
  was discarded, and what output may still be partially visible.
- **ERR-06:** Verify failure isolation across roots, participants, listeners and
  completions against the actual contract rather than expecting universal recovery.
- **ERR-07:** Inject controlled component, accessor, computed, handler, asset and
  backend failures through fixtures or internal tests at the appropriate boundary.
- **ERR-08:** Verify temporary globals, Canvas state, provider scopes and ownership
  leases restore after each relevant failure path.
- **ERR-09:** Verify retry/remount/explicit-update recovery only where promised;
  distinguish fail-closed behavior from an automatic retry loop.
- **ERR-10:** Detect repeated diagnostic storms, swallowed errors and duplicate
  reporting; preserve occurrence counts when deduplicating messages.
- **ERR-11:** State whether a diagnosis is causal evidence or a heuristic. A cycle
  path can be proven; “this overlap is unintended” usually needs application intent.
- **ERR-12:** Test diagnostics on known seeded failures and benign lookalikes to
  measure missed failures and false positives.
- **ERR-13:** Preserve causes across asynchronous boundaries only when recorded;
  distinguish a proven causal chain from temporal proximity or a shared label.

## 24. Ownership, disposal and resource retention

**Owners:** Runtime/tooling, optional package, browser/harness, application.

- **OWN-01:** Identify resource owner, acquisition generation and release condition
  for listeners, observers, surfaces, bitmaps, subscriptions and scheduler work.
- **OWN-02:** Compare baseline, mounted, updated and disposed counts by resource
  class; isolate a test's owners from unrelated roots using the same realm.
- **OWN-03:** Verify release on subtree removal, key/type replacement, root update,
  failure, abort, explicit disposal and fresh remount as applicable.
- **OWN-04:** Verify idempotent disposal and cleanup even when one cleanup throws;
  detect both leaks and double releases.
- **OWN-05:** Distinguish legitimate reusable pool/cache retention from active
  leases and leaked owner references. Not every counter should be zero each frame.
- **OWN-06:** Verify stale callbacks/handles cannot mutate a replacement owner,
  publish old assets, target removed geometry or restart disposed animation.
- **OWN-07:** Verify shared resources remain alive while another valid owner needs
  them and release when their actual ownership policy allows it.
- **OWN-08:** Run bounded repeated lifecycle cycles and compare steady-state or
  high-water behavior; do not infer absence of leaks from one successful unmount.
- **OWN-09:** Use deterministic ownership evidence first. Heap/GC and GPU-memory
  samples are supplemental, environment-dependent evidence rather than exact oracles.
- **OWN-10:** Include the inspector's own subscriptions, retained snapshots, traces
  and browser instrumentation in cleanup evidence.

## 25. Performance and scalability

**Owners:** Runtime/tooling, optional package, browser/harness, application.

- **PER-01:** Measure phase-specific work: component evaluation, layout,
  derivation, geometry construction, targeting, paint, transfer and composition.
- **PER-02:** Count work as well as time: traversals, dependencies, invalidations,
  paths/segments, batches, hit candidates, allocations and surface pixel area.
- **PER-03:** Distinguish CPU-side timings from GPU submission, GPU execution and
  browser presentation; unavailable timing is not zero cost.
- **PER-04:** Correlate input with the state change and rendered evidence it caused;
  state what portion of end-to-end latency the harness actually observes.
- **PER-05:** Report workload dimensions: rows, visible marks, component count,
  surfaces, active animations, interaction frequency and viewport/density.
- **PER-06:** Compare cold start, warmed steady state, resize, streaming update,
  pan/zoom, hover and mount/unmount workloads separately.
- **PER-07:** Record repetitions, warmup, distribution, environment and contention;
  do not turn one wall-clock sample into a reliable regression claim.
- **PER-08:** Demonstrate scaling across several input sizes and identify the
  expected algorithmic work without declaring complexity from one timing curve.
- **PER-09:** Detect unnecessary work: full series recomputation on hover, repeated
  index builds, per-datum graph overhead, excess readbacks or redundant composites.
- **PER-10:** Compare instrumentation off, enabled-idle and active-query modes;
  disclose whether measurement itself materially changes the workload.
- **PER-11:** Apply explicit structural budgets in routine tests and controlled
  wall-clock budgets where justified; keep noisy performance guards separate.
- **PER-12:** Verify optimization preserves geometry, events, focus, state and
  teardown, not merely a faster screenshot or lower draw-call total.
- **PER-13:** For competing implementations, match features, data, quality, hardware,
  interaction and correctness or explicitly list the differences.

## 26. Types, builds, packages and documentation

**Owners:** Build/package, browser/harness.

- **BLD-01:** Compile representative valid and invalid consumers through supported
  package imports, including JSX and equivalent createElement authoring.
- **BLD-02:** Verify public declarations match runtime exports, compiler entries
  and supported Bundler/NodeNext resolution modes.
- **BLD-03:** Test real packed artifacts in an external consumer so workspace
  aliases do not hide missing files, undeclared dependencies or private imports.
- **BLD-04:** Verify matching official packages share the intended core identity
  and do not silently embed a second scheduler or signal implementation.
- **BLD-05:** Exercise source and built browser modes plus representative production
  output; distinguish development diagnostics from required production validation.
- **BLD-06:** Verify Studio execution and editor declarations agree with supported
  imports; examples must not depend on private friend entries.
- **BLD-07:** Validate documentation examples, links, exported names and capability
  status; historical plans must not appear as current supported API guidance.
- **BLD-08:** Verify public search/catalog boundaries keep test-lab controls,
  internal documentation and private source metadata out of public results.
- **BLD-09:** Record dependency/toolchain versions and exact invocation needed to
  reproduce checks; distinguish provisioned environment failures from code failures.
- **BLD-10:** Preserve relevant negative probes proving the checker rejects known
  bad output rather than merely passing the current repository.

## 27. Harness controls, isolation and reproducibility

**Owners:** Browser/harness, application. Controls are not automatically core APIs.

- **HAR-01:** Start a known application build and isolated test session with a
  verified route, fixture and actual server URL; record launch failures clearly.
- **HAR-02:** Set viewport, density, supported media preferences, locale/timezone,
  and fixture fonts/assets before the scenario begins where determinism requires it.
- **HAR-03:** Reset application state, relevant storage and owned resources without
  deleting unrelated user data or changing shared environmental state unexpectedly.
- **HAR-04:** Control relevant clock/random/data inputs at the harness or application
  boundary; record which uncontrolled inputs remain.
- **HAR-05:** Drive native input sequences with modifiers, waypoints and release
  events; clean up pressed keys/buttons and capture after failures.
- **HAR-06:** Await explicit readiness/assertion predicates with deadlines and
  diagnostic output rather than arbitrary sleeps or infinite idle waits.
- **HAR-07:** Preserve equivalent manual and headless scenarios through the same
  supported application construction; avoid a separate test-only reimplementation.
- **HAR-08:** Support independent contexts/roots and repeatable teardown so tests
  cannot pass through state leaked by earlier scenarios.
- **HAR-09:** Record a reproducible action/fixture recipe. Full replay is conditional
  on control of external inputs and is not arbitrary heap restoration.
- **HAR-10:** Distinguish replay from a clean mount, public animation seeking and
  unsupported reverse execution of arbitrary application state.
- **HAR-11:** Permit targeted failure injection and instrumentation only in the
  intended test scope; label tests that substitute browser/runtime behavior.
- **HAR-12:** Run the supported environment matrix and report untested browsers,
  devices or input modalities; emulation is not evidence of all real hardware behavior.
- **HAR-13:** Serialize or explicitly coordinate competing test actors. Record
  manual intervention, concurrent agent input and external changes that invalidate
  a reproduction instead of attributing them to Pibbl nondeterminism.
- **HAR-14:** Use an external watchdog for hung rendering, infinite application
  loops or a crashed browser; an inspector on the blocked page cannot diagnose
  itself reliably. Preserve available evidence before bounded process cleanup.

## 28. Assertions, temporal properties and coverage quality

**Owners:** Application, browser/harness, build/package.

- **TST-01:** Assert presence and absence, exact counts, uniqueness, identity,
  ancestry, ordering, geometry and state with useful expected/actual differences.
- **TST-02:** Express temporal requirements: eventually updated by a deadline,
  unchanged until an action, ordered milestones, and no duplicate delivery.
- **TST-03:** Bound negative observations explicitly: “no late action during this
  interval/after these controlled completions,” not “this can never happen.”
- **TST-04:** Exercise operation sequences and state machines, including canceled,
  interrupted and repeated actions, not only isolated happy-path calls.
- **TST-05:** Use property/metamorphic tests where meaningful: coordinate round
  trips, keyed reorder preservation, independent-panel isolation and equivalent inputs.
- **TST-06:** Generate adversarial boundary cases with recorded seeds and shrink
  failures into small fixtures without crossing unsupported input contracts.
- **TST-07:** Check combinations at subsystem boundaries: signals plus resize,
  filters plus input, Layers plus scope, animation plus teardown, DOM plus focus.
- **TST-08:** Distinguish unit, internal invariant, public API, browser integration,
  native input, pixel and user/assistive-technology evidence in reports.
- **TST-09:** Use mutation/negative checks for important assertions so a test is
  known to fail when the intended contract breaks.
- **TST-10:** Report skipped, quarantined, retried and flaky cases; passing after
  retries must not erase the original failure or conceal environmental dependence.
- **TST-11:** Select proportional tests for a change and explain remaining gaps;
  line coverage or a large passing count is not proof of behavioral completeness.
- **TST-12:** Preserve independent expectations when updating tests after a change;
  never modify the oracle merely to agree with the new implementation.
- **TST-13:** Detect vacuous success: zero discovered tests, assertions never reached,
  unawaited asynchronous checks, empty candidate sets and fixtures that never mounted.
  Required action and assertion completion must be observable in the test report.

## 29. Screenshots and raster evidence

**Owners:** Browser/harness, application.

- **PIX-01:** Capture screenshots with run/frame provenance, viewport, density,
  asset/font readiness and relevant crop coordinates.
- **PIX-02:** Distinguish Canvas bitmap output from page composition including DOM
  overlays, CSS transforms and browser clipping; capture the surface needed by the claim.
- **PIX-03:** Retain expected, actual and diff images plus a machine-readable
  comparison result and changed-region summary.
- **PIX-04:** Define masks and tolerances narrowly with reasons; identify masked
  content and ensure masks do not hide the behavior being tested.
- **PIX-05:** Use targeted pixels for exact raster contracts and semantic geometry
  for portable assertions; neither universally replaces the other.
- **PIX-06:** Require intentional baseline changes to include inspected differences
  and a behavioral explanation; automatic acceptance is not verification.
- **PIX-07:** Record capture/readback errors, tainted surfaces, unsupported GPU
  readback and environment mismatches as unavailable evidence, not empty success.
- **PIX-08:** Use bounded frame sequences for transient artifacts when a final
  screenshot would miss flicker, stale frames or incorrect intermediate animation.
- **PIX-09:** Keep diagnostic overlays out of baseline captures unless the overlay
  itself is under test; overlays must not intercept input or alter layout.

## 30. Evidence artifacts and machine-readable reports

**Owners:** Browser/harness, runtime/tooling, build/package.

- **EVD-01:** Produce a run manifest with revision/build fingerprint, commands,
  environment, fixtures, seeds, timestamps and instrumentation capabilities.
- **EVD-02:** Give each action, observation, assertion, diagnostic and artifact a
  correlation identity that can link a failure across subsystems.
- **EVD-03:** Report pass, fail, blocked, inconclusive, skipped and not-applicable
  explicitly, including why each non-pass state occurred.
- **EVD-04:** Attach structured expected/actual values, tolerances, predicate,
  relevant snapshot slice and causal trace excerpt to a failed assertion.
- **EVD-05:** Include the exact rerun recipe, scenario/test selector and artifact
  locations; do not require reconstructing them from a long terminal transcript.
- **EVD-06:** Provide compact summaries first and bounded detail on demand so agents
  can investigate without loading all logs, data or screenshots into context.
- **EVD-07:** Record truncation, dropped trace records, missing source maps and
  excluded/redacted fields in the evidence bundle.
- **EVD-08:** Preserve the first failure and distinguish it from effects of retries,
  recovery attempts, later edits or different builds.
- **EVD-09:** Support semantic before/after comparison with explicit environmental
  and fixture differences; refuse misleading comparisons when provenance is incompatible.
- **EVD-10:** Make artifact retention and cleanup explicit; evidence needed for a
  reported result must not disappear when the test process exits.
- **EVD-11:** Capture only the authorized local/test data needed for diagnosis;
  redact secrets and sensitive application values without falsifying assertions.
- **EVD-12:** Keep reports protocol-neutral and data-only so CLI, browser tools,
  test runners and future agent adapters can share the evidence.
- **EVD-13:** Distinguish monotonic durations, scheduler logical time and wall-clock
  timestamps; correlate clocks explicitly rather than sorting incomparable values.
- **EVD-14:** Retain enough completed steps and last-known observations to diagnose
  aborted or crashed runs; never label a partial run successful because its
  completed subset passed.

## 31. Verify the verification tooling itself

**Owners:** Runtime/tooling, browser/harness, optional package.

- **OBS-01:** Compare instrumentation-disabled and enabled behavior for representative
  successful and failing scenarios, including scheduling and teardown.
- **OBS-02:** Prove inspection does not create signal dependencies, validate lazy
  values, execute arbitrary property getters or change resource ownership.
- **OBS-03:** Define any unavoidable observation effects, such as readback cost or
  explicit eager probes, and keep them separate from default read-only queries.
- **OBS-04:** Verify snapshot coherence and stale-handle rejection under concurrent
  updates, root disposal, hot replacement and multiple browser sessions.
- **OBS-05:** Ensure inspection failures cannot crash or corrupt the application;
  isolate optional extension facets and surface their errors as evidence gaps.
- **OBS-06:** Test payload/query limits, cancellation, recursion/cycles, huge arrays,
  hostile labels and bounded serialization without executing application code.
- **OBS-07:** Confirm source paths, props and private data are not exported merely
  because instrumentation is enabled; make access and redaction behavior explicit.
- **OBS-08:** Ensure production builds omit or appropriately gate tooling costs and
  remote access; no unauthenticated general mutation endpoint is required.
- **OBS-09:** Verify tracing and subscriptions release and do not grow indefinitely
  during idle sessions, continuous animation or repeated root replacement.
- **OBS-10:** Cross-check internal facts against independent browser behavior and
  fixtures; an internally consistent but wrong inspector can mislead every agent.
- **OBS-11:** Version and test custom facets/adapters, including unsupported schemas
  and partially available facts, instead of silently dropping evidence.
- **OBS-12:** Treat unknown application objects and proxies as opaque by default.
  Enumerating or copying an arbitrary object can execute traps even without an
  explicit getter call; safe previews must come from controlled recorded values.

## 32. Efficient agent workflow and limited human support

**Owners:** All owners, composed through tooling rather than one giant API.

- **AGT-01:** Discover the smallest relevant scenario and evidence query for the
  requested change, without needing the entire repository history in context.
- **AGT-02:** Move from requirement to source, runtime entity, failed assertion and
  reproducer through explicit correlations rather than approximate text search alone.
- **AGT-03:** Diagnose first, then choose the smallest targeted check; retain broad
  regression checks for the appropriate milestone instead of repeating them blindly.
- **AGT-04:** Produce an evidence-backed repair hypothesis with competing causes
  distinguished and uncertainty preserved; tooling must not claim intent it cannot know.
- **AGT-05:** After repair, rerun the original failing scenario and affected adjacent
  contracts; preserve the original evidence so success can be compared honestly.
- **AGT-06:** Report verified scope, remaining gaps and exact reproduction details
  in a compact handoff another agent can continue without private memory.
- **HUM-01:** Offer optional overlays for bounds, clips, targets, allocation and
  redraw surfaces using the same facts consumed by machine queries.
- **HUM-02:** Permit source-linked selection and readable event/signal explanations
  without requiring a graphical inspector for headless verification.
- **HUM-03:** Present failures with annotated screenshots and plain-language
  explanations while preserving structured evidence underneath.
- **HUM-04:** Reserve human judgment for product intent, visual quality and
  accessibility outcomes automation cannot establish reliably.

## 33. Cross-cutting scenario matrix

This is a coverage audit, not a demand to run the full Cartesian product. Select
combinations according to the changed contracts, using small fixtures first.

| Dimension   | Cases to consider                                                                       | Important boundary                                          |
| ----------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Lifetime    | Fresh mount, update, reorder, removal, abort, failure, disposal, remount                | Old capabilities cannot affect a replacement owner          |
| Surface     | Fixed/responsive, fit modes, fractional size, hidden/zero size, density change          | Logical, display and backing spaces stay distinct           |
| Composition | Nested groups, clips, filters, Layers, optional renderer islands                        | Paint, target and focus generations stay aligned            |
| Data        | Empty, singleton, constant, duplicates, gaps, invalid, reordered, large, streaming      | Data identity and analytical meaning survive rendering      |
| Reactivity  | Plain value, source signal, computed, equal result, dynamic dependency, batch           | Fine-grained invalidation is not independent pixel repaint  |
| Timing      | Pending update, interrupted interaction, delayed asset, frame gap, continuous animation | Readiness is scoped and generation-aware                    |
| Input       | Pointer, mouse, touch/pen if supported, wheel, keyboard, capture, cancellation          | Native transport is exercised where its behavior matters    |
| Geometry    | Fractional, rotated, negative scale, clipped, offscreen, singular mapping               | Bounds do not falsely substitute for exact geometry         |
| Failure     | Callback, resolver, computed, draw, asset, transfer, cleanup                            | Failed work and successful unrelated work are distinguished |
| Host        | DOM overlay, page scroll, browser focus change, supported media preferences             | Whole application behavior agrees with Canvas evidence      |
| Build       | Source, built, packed consumer, dev, production                                         | Workspace aliases do not conceal unsupported dependencies   |
| Tooling     | Disabled, idle, active, truncated, stale, canceled, disposed                            | Observation does not become the cause of the behavior       |

### Reference tasks for evaluating agent usefulness

Each task should have a normal case, a seeded failure, a benign lookalike and an
independent acceptance oracle. Use the same application behavior manually and
headlessly. These are candidate evaluation tasks, not assertions of current bugs.

1. Diagnose a missing shape caused by the wrong allocation, a clip, zero alpha,
   a covering target or no emitted paint; avoid giving the same answer to all five.
2. Repair dragging after nested transforms, responsive resize and page scrolling;
   prove pointer capture and final domain position through native input.
3. Explain an unexpected remount after wrapping/reparenting or changing a key;
   distinguish lost component state from a failed signal update.
4. Diagnose an apparently stale signal value without evaluating it from the
   inspector and accidentally changing the evidence.
5. Explain why hover redraws an expensive chart and verify an isolation fix
   preserves scale mapping, tooltip identity and keyboard behavior.
6. Find a line chart that joins across missing data or chooses the wrong datum
   after a data reorder; verify both painted and interactive geometry.
7. Verify linked plots update together under resize/data changes while an unrelated
   panel stays logically unchanged and performs only its promised work.
8. Reproduce a late image completion after source replacement or disposal and
   prove stale work cannot publish into the new generation.
9. Verify animation interruption, milestone ordering and writer release after
   component removal without relying on a final screenshot alone.
10. Diagnose a visible but inaccessible/keyboard-inoperable action through the
    actual application semantic alternative, without inventing Canvas semantics.
11. Verify optional renderer failure does not mismatch visible and pick generations
    or strand independent roots; separate backend evidence from browser raster limits.
12. Prove a repaired package works from its packed public surface, not only a
    source-linked Studio example.

Measure correct diagnosis, correct repair, regressions, elapsed time, number of
tool calls, evidence volume and failed attempts. Run repeated trials with
version-matched documentation and compare like-for-like task implementations.
Do not turn a smaller token count or more verbose trace into a quality claim.

## 34. Things deliberately not required

These exclusions remove ideas that sound useful but do not follow from agent
verification needs. A later concrete use case can justify a separate proposal.

| Tempting demand                                       | Why it does not make sense as a universal requirement                                          | Useful narrower requirement                                                          |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| A complete mutable retained scene graph               | Changes Pibbl's rendering and ownership model; inspection does not require it                  | Bounded recorded facts about observed frames                                         |
| One inspect call returning everything                 | Unbounded cost, ambiguous generations, data leakage and excessive agent context                | Scoped summaries, queries and optional facets                                        |
| Exact visible area for every object                   | Custom drawing, blends, filters and occlusion make universal geometric answers unreliable      | Proven exclusion reasons, conservative bounds and targeted raster evidence           |
| Perfect per-pixel provenance                          | Expensive or impossible across arbitrary native/backend operations                             | Logical paint attribution plus clearly scoped pixel probes                           |
| Deterministic pixels on every platform                | Font rasterization, browser and GPU behavior are platform-owned                                | Logical invariants and controlled-environment raster comparisons                     |
| DOM selectors for every Canvas primitive              | Canvas primitives are not DOM nodes; a mirror adds ownership and scaling costs                 | Application IDs and geometry queries, with real DOM semantics where needed           |
| An accessibility tree inferred from shapes            | Geometry does not establish role, purpose, names or equivalent operations                      | Application-authored semantic alternatives and actual browser accessibility evidence |
| Production manual clocks or free stepping of worlds   | Would change current scheduler/animation/physics contracts                                     | Harness-owned timing and supported public commands                                   |
| Universal time travel or arbitrary application replay | External inputs, native resources and arbitrary closures cannot be reconstructed automatically | Controlled fixtures and reproducible action recipes with stated limits               |
| Snapshotting every prop, closure and signal value     | May execute code, expose secrets, retain resources or force lazy evaluation                    | Safe previews, opaque summaries, explicit app facets and recorded dependencies       |
| Automatically mutating any internal state to test it  | Bypasses real contracts and can create impossible application states                           | Public commands for setup, native input for user paths, isolated fault fixtures      |
| Exact heap/GPU bytes and GC timing                    | Not generally available or deterministic                                                       | Ownership ledgers, surface estimates and supplemental profiler evidence              |
| One component/event record per chart datum            | Destroys batching and creates unnecessary overhead                                             | Batched geometry with bounded datum queries and application identity                 |
| Global idle before every assertion                    | Animated/streaming applications may never idle                                                 | Scoped update completion and application readiness predicates                        |
| Treating every overlap or unhandled event as a bug    | Often intentional; the runtime does not know product intent                                    | Facts plus explicit application assertions and high-confidence diagnostics           |
| Testing every possible state combination              | Infinite/unmanageable and often redundant                                                      | Risk-based boundary coverage, generated cases and targeted interaction matrices      |
| Duplicating the entire browser test platform in Pibbl | Wrong ownership boundary and substantial maintenance                                           | Existing browser tools plus the facts only Pibbl can supply                          |
| An MCP server or a specific test-runner DSL first     | Transport and syntax do not establish trustworthy facts                                        | Protocol-neutral evidence and thin adapters after a real consumer exists             |
| A universal business/data correctness oracle          | Pibbl cannot infer units, denominators, validity or intended user outcomes                     | Application schemas, fixtures and independent expected results                       |
| A promise to serialize/reconstruct native Path2D      | Native paths do not expose universal command inspection                                        | Known-path fixtures, optional construction recording and point/geometry queries      |
| Every inventory item in production core               | Many needs belong to the app, harness, build system or an optional package                     | Explicit ownership and opt-in tooling boundaries                                     |

## 35. Current evidence and known gaps

The original 2026-09-28 snapshot is superseded by this 2026-09-29 code audit
of checkout `e8a1cf29`. This is not a fresh runtime test result. The separate
agent-targeting worktree was inspected read-only, including its uncommitted
hardening changes. Its implementation is not integrated into this checkout.
See the [continuation audit](./agent-verification-progress.md) for coverage,
evidence gaps and the next executable task. No passing totals are inferred
from source files or another chat's historical report.

| Area                      | Evidence inspected                                                                      | Implication for design                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Public controller         | `packages/core/src/lib/types.ts`                                                        | General scene inspection is not a public controller capability                                                                             |
| Identity/source metadata  | `packages/core/src/lib/render.ts` and runtime/hooks contract                            | Useful internal facts exist; avoid making private ref paths public IDs                                                                     |
| Targeting prototype       | Branch `codex/agent-verification`, commit `51821c12` plus uncommitted hardening         | Bounded root-path snapshots and active probes exist separately; integration and fresh verification remain outstanding here                 |
| Signals                   | `packages/core/src/index.ts`, signal graph and owned hook sources                       | Receiver-owned inputs, batch, useComputed, useConst and useReaction are implemented; general signal tracing is separate work               |
| Visualization             | `packages/viz/src/index.ts` and `packages/viz/test/`                                    | Scales, axes, line/point/custom series, hover queries/cards and anchored layout exist; do not duplicate their calculations in an inspector |
| External rendering        | `docs/design/render-layer-and-three-contract.md`, core and Three public entries         | Inspect Pibbl composition/lifecycle and request optional Three facts; no removed custom WebGL package or 3D runtime should be recreated    |
| Physics observations      | `packages/physics/src/2d.ts`, `packages/physics/src/2d-testing.ts` and physics contract | inspectPhysics2D, PhysicsDebug2D and the isolated host-frame harness already serve part of the simulation requirements                     |
| Ownership/performance     | Runtime ownership contract and trust-gate policy                                        | Existing internal counters/tests are candidates for evidence reuse, not proof of an external inspection API                                |
| Browser/scenario evidence | Trust gate and test-tooling opportunities                                               | Preserve shared manual/headless scenarios and native input verification                                                                    |
| Accessibility             | Canvas accessibility guidance                                                           | Application-authored semantics remain necessary                                                                                            |

### Local sources to revisit during design

- [External render layers and Three](../design/render-layer-and-three-contract.md)
- [2D physics](../design/physics-2d-contract.md)
- [Runtime and hooks](../design/runtime-hooks-contract.md)
- [Signals and scheduling](../design/signals-and-scheduling-contract.md)
- [Animation](../design/animation-contract.md)
- [Canvas surfaces](../design/canvas-surface-contract.md)
- [Drawing](../design/drawing-components-contract.md)
- [Styles](../design/style-system-contract.md)
- [Layout](../design/layout-system-contract.md)
- [User events](../design/user-events-contract.md)
- [Focus and keyboard navigation](../design/focus-and-keyboard-navigation-contract.md)
- [Event ownership](../design/event-resource-ownership.md)
- [Runtime ownership](../design/runtime-resource-ownership.md)
- [Canvas accessibility](../design/canvas-accessibility-guidance.md)
- [Signals-centric design](../superpowers/specs/2026-09-23-signals-centric-authoring-design.md)
- [Signals implementation record](../superpowers/plans/2026-09-24-signals-centric-authoring-implementation.md)
- [Visualization foundation and first slice](../superpowers/specs/2026-09-24-first-class-data-visualization-foundation.md)

## 36. Design decomposition and acceptance template

The inventory is exhaustive by topic, not a recommendation to implement all
topics at once. Useful boundaries to evaluate are:

1. **Evidence foundation:** version/capability discovery, generation-aware scoped
   snapshots, identity, bounds, coordinate mappings and trustworthy result states.
2. **Interaction diagnosis:** target queries, exclusions, native-input correlation,
   focus and event traces.
3. **Reactive/temporal diagnosis:** invalidation causes, completion predicates,
   signal/transaction evidence and Layer work.
4. **Domain facets:** visualization data/scales/selection first for the chosen
   application; optional renderer/simulation facets only where used.
5. **Harness/report integration:** fixtures, artifacts, independent assertions,
   negative probes and reproducible repair tasks.

These are separable design areas, not sequential implementation stages. Select
the smallest vertical slice that diagnoses and verifies a real failure end to
end. It may need a narrow portion of several areas. Do not build all snapshot
infrastructure before proving the first useful agent task.

For each proposed capability, complete this design record:

| Field                   | Required answer                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------- |
| User question           | What concrete uncertainty or failure does this resolve?                                |
| Inventory IDs           | Which needs are covered, partially covered or explicitly excluded?                     |
| Existing mechanism      | Can current public APIs, internal tests or browser tools already supply it?            |
| Owner and boundary      | Runtime, optional tooling/package, application, harness or build system?               |
| Observation contract    | Which generation, scope and readiness boundary does the result describe?               |
| Evidence strength       | Recorded fact, derived fact, application assertion or heuristic?                       |
| Representation          | Units, coordinate spaces, identity lifetime, unknown/redacted/truncated states?        |
| Safety and perturbation | Can it execute code, validate a computed, retain resources or change scheduling?       |
| Cost                    | Disabled, enabled-idle, query and retained-data budgets?                               |
| Acceptance              | Public scenario, independent oracle, seeded failure and benign lookalike?              |
| Limits                  | Unsupported backends, opaque custom drawing, platform variance or unavailable history? |
| Delivery                | Smallest runnable agent task, manual reproduction and stopping condition?              |

### Consistency review recorded for this inventory

The document was self-reviewed against the inspected contracts and the intended
agent workflow. This is a content review, not runtime implementation validation.

- **Immediate mode:** Requirements use bounded frame evidence, not a retained
  mutable scene or component-level repaint promise.
- **Transactions:** Evidence distinguishes ordinary partial Canvas paint from
  transactional renderer bitmap/pick/focus publication.
- **Reactivity:** Default inspection does not call lazy getters or become an
  observer. Shipped signal authoring APIs are distinguished from proposed
  inspection capabilities.
- **Identity:** Application IDs, mount lifetimes and render-record identities
  remain separate; stale references cannot silently identify replacement objects.
- **Geometry:** Exact paths, conservative bounds, clips and visible pixels are
  not conflated. Unsupported mappings and opaque drawing remain explicit unknowns.
- **Visualization:** Analytical correctness belongs to application/package
  evidence; batching is preserved and planned features are not labeled shipped.
- **Input:** Hit queries, synthetic dispatch, public commands and native input
  provide different evidence and are not interchangeable.
- **Time:** Scoped readiness replaces impossible global-idle requirements;
  the existing public physics test harness advances host frames without adding
  manual stepping to production worlds or introducing a second scheduler.
- **Ownership:** Shared resources, caches and pools have legitimate retention;
  exact GC/GPU-memory claims are excluded.
- **Accessibility:** Real semantics are application-authored and tested separately
  from logical Canvas focus; automation limits remain visible.
- **Oracle independence:** Runtime introspection is checked against application
  requirements, known fixtures and actual browser behavior.
- **Scope:** Build checks, business state, networking and browser controls have
  explicit owners; the list does not place every need in core.
- **Tooling trust:** Inspection cost, stale/truncated results, data redaction,
  untrusted text and instrumentation cleanup are first-class verification concerns.
- **Delivery:** Broad coverage does not override the repository's vertical-slice
  workflow, and this document authorizes no product implementation.

The remaining design question is which small collection of these needs most
reduces an agent's time to a correct, verified repair. That should be demonstrated
with the reference tasks before committing to a broad public tooling surface.
