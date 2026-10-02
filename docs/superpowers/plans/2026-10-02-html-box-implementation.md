# HtmlBox implementation design

Status: approved for complete implementation, 2026-10-02. Plan review by the
`review` subagent is complete; dispositions are below. The user explicitly
requested continuous overnight implementation, implementation review, fixes, and
a commit. Deliver the first runnable slice promptly, then continue hardening
without waiting for experiential feedback. Preserve unrelated working-tree work.
Active execution: [Plan 004](../../project-plans/004-html-box.md).

**Target:** [Finalized HtmlBox design](../specs/2026-10-02-html-host-design.md).

**Outcome:** Public `HtmlBox` mounts a persistent native HTML subtree in a CRC
allocation, follows affine transforms and portable clipping, and coordinates
native focus with CRC source-order navigation. HTML remains above all Canvas paint.

**Delivery:** One runnable public slice, hands-on feedback, then Layer integration
and broader hardening. This is user-requested capability work, not implementation
of a speculative strategy initiative.

## Baseline and implementation constraints

Inspection found the existing geometry, optional-service, render-transaction,
focus, and Studio extension points listed below. This records the pre-implementation baseline; implementation evidence is in Plan 004.
Preserve current unrelated texture/scenario/editor edits in the shared checkout;
reinspect working-tree state before coding.

- Component identity and teardown stay owned by CRC component refs.
- One optional HTML service belongs to the root event surface, not each Layer.
- Nested Layer instances own local registration snapshots, not independent DOM
  containers or focus managers.
- No per-frame DOM measurement loop, HTML rasterization, React dependency,
  separate scheduler, or generic retained scene graph is introduced.
- Add focused failing public behavior tests before implementation. Characterize
  native clipping and Tab relay first because the browser behavior determines
  whether those mechanisms satisfy the contract.
- Defer broad reviews, exhaustive fixtures, documentation polish, and the trust
  gate until the first slice is available for feedback. Work inline by default.
- Use Node 24.15+ on Node 24 LTS, pnpm 11.21.0, and Playwright Chromium for coding
  evidence. The design session's shell reported Node 26.9.0; do not silently call
  that the documented verification environment.

## Public API and typing

Export `HtmlBox`, `HtmlBoxProps<T>`, `HtmlBoxStyle`, `HtmlMountCallback<Props>`,
`HtmlUpdateFunction<Props>`, and `HtmlBoxFocusState` from `packages/core/src/index.ts`.
Keep `htmlOverlay` as the root configuration property: it describes the shared
overlay container, not an individual component.

Implement a branded primitive with a generic public call signature preserving
the relationship between `data`, mount initial data, and update data. Internal
registration erases `T` only after those public inputs are checked. Prove JSX and
`createElement` inference through package consumer tests; do not solve generic
inference by publishing `any` or widening update inputs to `unknown`.

Use `pointerEvents` as a prop. `style` combines box/layout participation, the
existing Group transform fields, and opacity. The generic `data` prop is opaque:
preserve it in internal primitive metadata so a supplied signal is not
automatically resolved by the primitive dispatcher. The current public
`preserveSignalProps` type permits only exact signal-typed props, so it cannot
directly express arbitrary generic data. Give this built-in private opaque-prop
metadata using the existing input resolver's preservation path; do not widen
the public `definePrimitive` contract for this one component. Ordinary callers use
`data={value.get()}` to subscribe their component.

Mount receives `(element, initialProps, signal)` and returns only
`HtmlUpdateFunction<Props>`. The signal is native `AbortSignal`, not a CRC signal.
No mount context or custom programmatic focus API remains: native descendant
`focus()` drives the existing focus bridge. Initial props go only to mount.

Mount callback identity is mount-only. Update callbacks receive the latest data
only when their component executes in a successful generation. Retained Layer
reprojection does not invoke update. Key changes replace the entire host.

Use existing `resolveBox`, percentage allocation, and Group presentation helpers.
Do not derive CRC size from `scrollWidth`, `getBoundingClientRect`, or DOM content.
The stable shell represents the border box, and a fixed inner content frame
positions the supplied DIV at the padding offset. Both remain CRC-owned geometry;
applications own the content DIV's children.

## Code boundaries

Proposed new files; keep private helpers together until complexity justifies a split:

| File under `packages/core/src/lib/` | Responsibility                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `components/html-box.ts`            | Primitive registration, public generics, style resolution, mount slot, candidate emission.           |
| `html/types.ts`                     | Public lifecycle/focus types and private registration types.                                         |
| `html/html-service.ts`              | Root overlay lease, candidate collection, publication, retained-instance snapshots, failure cleanup. |
| `html/html-projection.ts`           | Matrix projection, stable shell styling, SVG definition chains, change comparison.                   |
| `html/portable-clips.ts`            | Geometry/revision snapshots and portable bounds with native-path rejection.                          |
| `focus/html-focus-region.ts`        | Native region membership, focus transfer, modality, managed Tab bridge and sentinels.                |
| `focus/dom-tab-stops.ts`            | Isolated, browser-tested light-DOM eligibility/order calculation.                                    |
| `render-transaction.ts`             | Shared transaction implementation only if needed to make both current completion paths consistent.   |

Existing integration points:

| Existing file(s)                                                                          | Required change                                                                                        |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `surface/types.ts`, `mount-crc.ts`, `types.ts`                                            | Capture mount-only `htmlOverlay`, root ownership, optional erased bridge.                              |
| `optional-services.ts`, `global-state.ts`                                                 | Reuse lazy service lookup and root cleanup; add only hooks actually needed.                            |
| `primitive-presentation.ts`, `components/clip.ts`, `util/push-clipping-path.ts`           | Carry portable snapshot alongside native clip and world transform.                                     |
| `layout/place-child.ts`, layout clipping producers, `components/layer.ts`                 | Preserve portable allocation clips and replay HTML snapshots on clean composition.                     |
| `execute-render.ts`, `scheduler/realm-scheduler.ts`                                       | Shared successful-publication stage before focus transaction callbacks.                                |
| `focus/types.ts`, `focus-manager.ts`, `keyboard-defaults.ts`, `directional-navigation.ts` | Explicit Canvas/HTML candidate kinds and shared ordering.                                              |
| `focus/dom-focus-host.ts`, `focus/focus-events.ts`                                        | Surface-aware native ownership, transitions, and Canvas event dispatch boundaries.                     |
| `element/resolve-primitive-inputs.ts`, element metadata, `style/resolve-dispatch.ts`      | Preserve opaque data through private built-in metadata; retain existing signal-aware style resolution. |

All paths in the table are relative to `packages/core/src/lib/`. Confirm each
clip producer during implementation; do not assume only explicit `Clip` clips.

## Internal data flow

Use these conceptual records, adapting exact names to the current type model:

```ts
type HtmlIdentity = object; // Stable component-owned mount slot.

interface PortableClipSnapshot {
  readonly svgPath: string;
  readonly fillRule: CanvasFillRule;
  readonly transform: DOMMatrixReadOnly;
}

interface HtmlRegistration {
  readonly identity: HtmlIdentity;
  readonly owner: CRCInstance;
  readonly generation: number;
  readonly sourceOrder: readonly number[];
  readonly localMatrix: DOMMatrixReadOnly;
  readonly borderBox: Readonly<LayoutBox>;
  readonly contentBox: Readonly<LayoutBox>;
  readonly clips: readonly PortableClipSnapshot[];
  readonly opacity: number;
  readonly interactive: boolean;
  readonly didRender: boolean;
  // Erased data, mount callback, and focus policy membership remain private.
}
```

Treat stored matrices as value snapshots; TypeScript readonly alone does not stop
a `DOMMatrix` owner mutating them. Copy at registration/commit. Internal source
order must reuse traversal positions shared with Canvas focus collection, not a
separate HTML counter that loses interleaving. A retained subtree contributes its
local sequence at the current parent traversal position.

The root service holds `liveHosts`, per-instance committed snapshots, and one
transaction-local candidate map. A live host holds its shell/content nodes,
captured mount function, returned update function, abort controller,
last published projection, and focus membership. New candidates do not acquire
connected DOM until publication succeeds.

Lifecycle is `candidate -> mounted -> disposed`. Updates retain the mounted
state. Disposal is terminal and idempotent. An aborted candidate that never
mounted does not invoke application cleanup. A mounted host is cleaned exactly
once even if root failure, component teardown, and controller disposal overlap.

### Root configuration

Capture `htmlOverlay` at mount like existing surface configuration; later calls
to `crc` on the same canvas update only the root element. Reject a foreign
document, nonadjacent container, occupied overlay, or another live root's lease.
Use `ownerDocument` for nodes/listeners and realm-safe element validation.

The lease/DOM manager can be acquired lazily at the first HtmlBox render, but a
configured overlay must not be concurrently used by two roots. Reserve ownership
with lightweight mount metadata, release on root disposal, and load DOM/focus
work only on feature use. Verify zero feature listeners/nodes for ordinary roots.

Align through the application-supplied common wrapper. The manager measures only
the agreed surface box on setup and resize. Validate untransformed local box
dimensions, not rotated viewport bounding rectangles. Common ancestor transforms
must not trigger false alignment diagnostics.

### Presentation

Compute `M = inverse(backingDensity) × rootProjection × worldMatrix`. Reuse
surface snapshots and world-transform tracking, not the active context's raw
matrix. Apply unrounded CSS matrix coefficients and stable source-order z-index.
Normalize negative zero only for stable serialization, not geometric rounding.

Portable clip snapshots capture SVG data at a particular PathGeometry revision.
Preserve native Canvas path caching. A raw Path2D remains valid for Canvas-only
subtrees, and becomes an error only when a descendant HtmlBox needs projection.
Avoid eager SVG conversion in roots not using HTML.

For each projected clip, retain source SVG data and update its SVG path transform
with `inverse(M) × clipWorldToCss`. Chain the `clipPath` elements themselves to
intersect clips. IDs are unique across live roots, references are acyclic, and
all definitions use user-space coordinates. Dynamic clip depth only modifies
definitions; it never modifies application content ancestry. Reuse matching
definitions/attributes instead of replacing the full SVG tree each frame.

Reject known nonempty Canvas filters and unsupported composition state before
publishing any candidate. State explicitly in diagnostics that CSS effects inside
the HTML subtree remain available but cannot affect combined Canvas/HTML pixels.

### Publication and scheduler ordering

There are currently two transaction implementations: the private class at the
bottom of `execute-render.ts` and the scheduler transaction factory near the end
of `realm-scheduler.ts`. Both must honor the same ordering and error semantics.
Ordinary `queueFrameCompletion` is insufficient: focus currently commits through
transaction callbacks before ordinary Complete callbacks run.

Add an internal `onPublish(callback)` stage to `CRCRenderTransaction`, ahead of
existing `onFinish(callback)`. Publish callbacks run only for a successful render.
A publish error changes the completion result to failure, suppresses later
publication, and still delivers failure to every finish callback. Collect errors
and throw after all cleanup callbacks run. Preserve the original render failure
when cleanup also fails. Existing no-HTML transactions keep their ordering.

The HTML service registers one publication callback per root transaction and a
finish callback to clear candidates/clean up after failure. In the scheduler this
occurs at the start of Complete, before reactions and application completion
notifications. The direct/private render path finishes synchronously before its
caller returns; it must not schedule a second frame merely to publish DOM.

Publication order:

1. Validate all candidate projections, unsupported state, and ownership.
2. Resolve retiring identities and deactivate their focus ownership.
3. Create styled attached shells and call mount with connected content DIVs;
   eligible hosts permit native focus during setup, reconciled after collection.
4. Apply existing-host projection changes and call required updates.
5. Expose successful hosts; finalize the matching generation's HTML registrations.
6. Run normal finish callbacks so focus indices see only mounted regions.
7. Deliver focus notifications after publication/collection is settled.

Guard application mount/update and synchronous abort dispatch using
`withSignalWriteForbidden`. Mount must return an update function; reject other
values and thenables. An update function may be a no-op. Defer synchronous focus events raised by application mount/update until
the candidate generation is committed; their intermediate state cannot enroll a
half-mounted region. Failed publication clears this root's HTML service while
leaving unrelated roots schedulable. Focus finish callbacks receive failure.

Component teardown invalidates its registration immediately. Queue connected-node
retirement through the current transaction where possible; failure/disposal paths
must also work with no active transaction. Abort the supplied signal exactly once
while the content DIV is still connected, then remove the subtree in `finally`.
Applications register framework/observer cleanup as abort listeners; there is no
returned unmount/dispose callback. Mount failure or an invalid return also aborts
the signal to release partial setup. Native abort-listener errors use browser
error reporting, so do not claim they propagate through `abort()` into scheduler
error aggregation. Test continued CRC cleanup even when an abort listener throws.
Avoid aborting twice from component and service teardown.

### Cached Layer integration

Reuse the current Layer bridge and source traversal rather than storing root-world
matrices in retained HTML records. Each instance snapshot stores transforms/clips
relative to its owning Layer frame. Parent composition contributes that Layer's
current placement, bounds, ancestor clips, opacity, and traversal position.

On cache hits, replay HTML metadata alongside the existing focus subtree replay.
On dirty child renders, adopt new local records only with the successful root
transaction. Nested Layers compose each boundary exactly once. Track rendering
and placement independently so an outer move neither remounts content nor calls
update. Zero/singular outer transforms deactivate projection without attempting
an inverse and without destroying the committed local content.

## Focus implementation

Extend the focus candidate model to a discriminated union: an existing Canvas
event target or an HTML region. Keep the current event registration type intact;
do not fabricate invisible Canvas click targets to host native inputs. Factor
candidate identity, source position, and directional bounds into shared fields.

Canvas keyboard resolution returns a Canvas target only while the canvas owns
browser focus. HTML regions expose entry/exit operations and focus-within state,
not CRC key/click handlers. Refactor navigation to focus a candidate by kind and
run Canvas activation defaults only for Canvas candidates.

Keep existing Canvas-to-Canvas focus event order. Canvas-to-HTML sends the Canvas
target's logical blur sequence, then adopts native focus within the region.
HTML-to-Canvas sends native blur by moving browser focus and the Canvas target's
logical focus sequence. CRC `relatedTarget` remains a logical Canvas target or
undefined when crossing into HTML; never stuff an HTMLElement into that type.
Host notifications report region state independently.

### Native Tab bridge

Install sentinels only when the root has active HTML and managed navigation.
They surround the adjacent canvas/overlay pair, not individual content controls.
They take over native entry while CRC owns the canvas tabindex mutation. Do not
overwrite an externally changed tabindex; relinquish ownership and report that
the supported entry configuration has been changed.

At each boundary Tab, calculate current tabbable descendants and determine
whether native default stays inside this region. Preserve native internal
traversal. At an internal CRC boundary prevent default and focus the next eligible
candidate. At a surface boundary focus the outgoing sentinel under an exit token
without preventing default, so the same key exits through native page order.
Incoming sentinel focus redirects to the appropriate committed endpoint.

Disable both sentinels when there are no eligible candidates. Use a scoped
MutationObserver for descendant/eligibility changes and recompute on entry/Tab;
do not cache a stale control list. The browser characterization must exercise a
last control disappearing during focus handling. If the relay cannot preserve
one-key exit under supported conditions, revise the mechanism before expanding
the first slice; do not accept an extra hidden Tab stop or focus trap.

Implement light-DOM tabbability in one isolated utility, including radio groups,
disabled fieldsets/legend exceptions, hidden/inert ancestors, contenteditable,
negative indices, and details/summary visibility. Positive tabindex violates
the managed-region contract. Browser-driven tests establish these rules;
enumerating tags alone is not sufficient. Shadow trees, iframe internals,
top-layer portals, and widgets cancelling boundary Tab remain outside the initial
managed guarantee, as specified by the feature design.

Pointer entry updates modality; native focusin/out synchronize region ownership.
Use a guarded transfer token plus settled activeElement check to avoid clearing
the logical region during canvas/HTML transfers. For a removed focused region,
retain its last committed order position for the next Tab decision, and do not
override focus already moved elsewhere by application cleanup.

`onFocusChange` uses the latest successful callback prop, deduplicates unchanged
snapshots, and runs after internal state settles. It may write CRC signals; mount,
update, and synchronous abort cleanup may not. Root cleanup cancels queued notifications.

## First vertical slice

Before production code, create a small browser characterization for SVG clip
intersection and native forward/reverse sentinel exit with controls before and
after a surface. This is focused uncertainty reduction, not a broad browser
compatibility project. Record observed behavior when coding begins.

Add one public integration fixture that mounts a Canvas button, an HtmlBox with
a labelled input and native button, and another Canvas button. Place the HtmlBox
under a Group and curved PathGeometry Clip. Add external native controls before
and after the surface. The first failing contract proves:

- Typed input value and DOM node identity survive translation, rotation, scale,
  and a data update; root fitting keeps Canvas and DOM aligned.
- Pointer activation succeeds inside the clip and misses the HTML outside it.
- Forward and reverse Tab traverse Canvas, both HTML controls, Canvas, and page
  controls with no duplicate stop, trap, or duplicate button activation.
- Unmount/dispose removes owned DOM and calls cleanup once.

Implement only the necessary files/paths above for this slice. Until supported,
reject HtmlBox inside a Layer rather than claiming cache behavior. The slice is
not feature complete until the later Layer milestone passes.

### Runnable Studio surface

Create `packages/scenarios/src/learning/composition/html-box.example.tsx` with
`export default function mount(canvas: HTMLCanvasElement): CRCController`.
The example itself explicitly creates the wrapper/overlay around its supplied
canvas and restores that application-owned arrangement on disposal. Keep this
setup visible and copyable in the lesson; the CRC runtime never reparents canvas.
Use a placeholder to preserve the original insertion position and restore only
example-owned styles still unchanged by others.

This fits the existing Studio sandbox's single canvas argument and avoids a new
preview API. Verify `playground/src/sandbox-runner.ts` sizing with the wrapper,
especially its body grid and fullscreen preview. Change that harness only if the
example's explicit sizing cannot satisfy the existing contract.

Register the lesson in `packages/scenarios/src/learning-catalog.ts`, update
`playground/src/crc-editor-types.txt`, and drive that exact exported mount in
`packages/core/test/learning-examples.test.ts` plus the focused integration test.
Proposed route: `#/examples/composition/html-box`. Confirm actual catalog routing
and give the full running localhost URL at delivery; this document does not claim
a server or route already exists.

The visible example provides move/rotation/scale controls, a curved clip, the
editable input, a native click counter, and Canvas buttons bracketing the host.
Provide concise manual steps with expected alignment, clipping, retained text,
and Tab order. Keep exhaustive diagnostics in a separate private lab.

**Slice ready for feedback:** this lesson is runnable, focused checks pass, and
the exact URL and inspection steps have been provided. Continue to full implementation under the user’s explicit overnight authorization.

## Subsequent implementation milestones

| Milestone                 | Work after feedback                                                                                                                                               | Completion evidence                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Layer and nested geometry | Cached/nested Layer replay, nested clips and clip-depth changes, source reorder, inherited alpha, root resize/fit, zero/singular transforms.                      | Public semantic geometry and identity assertions; no content callback on clean replay. |
| Native focus hardening    | Dynamic controls, radios/fieldsets/details, programmatic focus, cancelled Tab, focused removal, policy removal, multiple roots, event failure isolation.          | Browser keyboard tests plus existing Canvas focus suites unchanged.                    |
| Ownership and failure     | Render/publication errors, mount/update/abort-listener errors, partial mount abort, obsolete SVG definitions, repeated mount/dispose, external tabindex mutation. | Deterministic resource counters and healthy unrelated roots after failures.            |
| Public completion         | Contracts, API/guide, packed exports/types, Studio consistency, narrow visual evidence, browser support claims.                                                   | Proportional suites followed by one stable aggregate gate.                             |

Preserve the existing one-focus-manager-per-root rule and nested directional
boundary membership. HTML regions enroll only during that manager’s collection.

## Verification and delivery record

Suggested new evidence files:

- `packages/core/test/html-box.test.tsx`: public lifecycle/geometry/clip slice.
- `packages/core/test/html-box-focus.test.tsx`: browser input and navigation.
- `packages/core/test/html-box-layers.test.tsx`: retained-layer behavior.
- `packages/core/src/lib/focus/dom-tab-stops.test.ts`: focused native eligibility.
- `docs/testing/field-notes/html-box.md`: actual browser findings when work begins.

Run individual new tests and directly affected suites using the repository's
Vitest browser configuration, for example:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/html-box.test.tsx --browser.headless --browser.ui=false
```

Add the corresponding focus/Layer suites only when their paths are changed or
their milestone is under verification. Typecheck public generic authoring early.
Run formatting only on changed documents during design work. No screenshots or
test output are claimed by this implementation design.

For feature completion, update current contracts only to describe implemented
behavior, add the HtmlBox API page and guide, regenerate required catalog/editor
artifacts, and exercise Bundler/NodeNext packed consumers. Verify no unwanted
focus/HTML initialization in ordinary roots. Inspect any visual diff rather than
refreshing baselines indiscriminately. Run:

```sh
corepack pnpm@11.21.0 trust
```

Record command, Node/pnpm/browser versions, fresh results, and unresolved failures.
Chromium is the correctness gate; Firefox/WebKit clipping and Tab-relay checks
are required before advertising those engines supported. Preserve the distinction
between first-slice evidence and complete feature evidence.

## Next execution handoff

The numbered execution plan is active and selects the first vertical slice. The design decisions are settled; remaining
browser characterization is implementation evidence, not another general design
phase. Do not begin with full hardening or a fresh speculative API redesign.

## Plan review dispositions (2026-10-02)

All findings from the requested subagent review were assessed before production
implementation:

1. **Tab exit feasibility (P0): resolved by browser evidence.** A real Playwright
   Chromium 151.0.7922.34 prototype under Node 24.15.0 confirmed unprevented Tab
   after focusing the end sentinel lands on the external following button, and
   Shift+Tab via the start sentinel lands on the preceding button. Keep the
   mechanism and commit characterization/regression coverage, including dynamic
   removal and cancellation. Other engines are not claimed supported.
2. **SVG intersection (P0): resolved by browser evidence.** The same prototype
   confirmed `clip-path` on a `clipPath` definition intersects both paths for
   native hit testing. This is also specified by CSS Masking. Keep one zero-size
   SVG with no viewBox, userSpaceOnUse definitions, clipPath elements in host-local
   coordinates, and transforms only on their path children. Test transformed and
   nested cases; no groups with unsupported content inside clipPath are needed.
3. **Transaction timing (P1): clarified.** Scheduled executeRender inherits the
   scheduler transaction, finished at the start of Complete; direct renders own
   their synchronous transaction. Shared onPublish must precede onFinish in both.
   Never publish in optional-service endRender. A backend failure cancels publish.
4. **Configuration (P1): accepted.** Test mount-only config and overlay lease,
   document/connection/adjacency validation, internal Layer configuration rejection,
   and resize integration with root surface snapshots. Local box comparisons
   preserve common-ancestor CSS transforms.
5. **Ancestor effects (P1): accepted.** Track active CRC filter boundaries and
   retained Layer composition effects, check composite state, and reject at every
   current composition boundary. Raw unregistered custom clips remain expressly
   unsupported. Test ancestor filters, not only HtmlBox style.
6. **Path revisions (P1): clarified.** Snapshots refresh only on traversal after
   an explicit render request or other legitimate invalidation. Add a test for
   mutation followed by public crc rerender; do not introduce mutation observers.
7. **Native focus listeners (P1): accepted.** Dedicated root-owned overlay focus/
   key/pointer listeners coordinate with the existing manager without synthetic
   CRC key/click delivery. Teardown and cross-boundary relatedTarget semantics
   are required evidence.
8. **Keyed source order (P2): accepted.** Test multiple HTML hosts interleaved
   with Canvas targets after keyed reorder; intercept each region boundary while
   preserving stable DOM ancestry and native traversal within the region.
9. **Overnight scope (P2): applied.** User authorization supersedes waiting for
   feedback. Complete Layers, lifecycle, declarations, docs, trust, final review,
   and commit; the first slice is not the stopping point.
10. **Callback errors (P2): accepted.** Abort on invalid mount return and update
    failure; test browser-reported abort listener errors independently of scheduler
    errors, including continued cleanup and healthy unrelated roots.
11. **Style shape (P3): accepted.** Reuse BoxStyle, LayoutItemStyle and Group
    transform fields, plus opacity; pointerEvents stays a prop. Default HtmlBox
    overflow is clip, as the approved design explicitly specifies.
12. **Multiple focus managers: corrected during inspection.** Current CRC permits
    only one focus manager per root. Preserve that rule; do not implement the
    draft’s hypothetical multiple-manager support. Nested directional policies
    remain supported.

## Event extension implementation slice

The user extended the goal before the final commit. Follow the added native event
contract in the design. Add a focused failing public test first, then a dedicated
host-owned native bridge with a stable virtual event node, current callback map
and committed inverse matrices. Reuse the existing facade and node-invocation
machinery but split native capture and native bubble around descendant DOM work.
Do not enter Canvas hit testing or its synthetic activation/default-action path.
Use the overlay SVG screen matrix with explicit zero-origin positioning; its
zero-sized viewport without viewBox was characterized in Chromium under shared
ancestor rotation and scale. Extend the same public lesson with the Canvas effect
and preserve built-mode smoke coverage. Review the implementation, update approved
contract-unit mappings, and include all work in the final local commit.

Review clarifications: nonbubbling focus/blur preserve existing CRC ancestor
capture semantics and omit ancestor bubble. Element-targeted selectionchange is
observable; document-only selectionchange is not relayed into an arbitrary host.
Native enter/leave listeners are direct host-boundary observations and do not use
Canvas's over/move event dependency expansion. A dedicated virtual node never
acquires Canvas native subscriptions or logical Canvas pointer capture.
