# Component manipulation design

> **Historical status: Design or implementation record; current behavior is defined by runtime contracts.**

Status: product design approved, 2026-09-28. The user approved hooks plus
convenience components, explicit geometry, configurable snapping,
agent-friendly authoring and verification, unified left/top positioning,
nested layout support, and development/test runtime errors for ignored
positioning and requested an implementation plan. Those agreed decisions are
recorded below; technical execution decisions are captured in the linked plan.
This document does not describe shipped behavior or claim implementation.

Implementation plan:
[Component manipulation](../plans/2026-09-28-component-manipulation-implementation.md).

## Intent

Make moving, resizing, and rotating CRC components easy to author and verify.
Provide standard handles and a composable controller without a retained scene
graph, inferred descendant bounds, or imperative mutation of component nodes.
Application signals remain the geometry source of truth. Resize changes an
allocation; scaling artwork is a distinct operation outside the first slice.

## Agreed direction

- A component-owned `useManipulation` controller owns gesture state.
- `ManipulationFrame` applies geometry and supplies the frame coordinate context.
- `DragHandle`, `ResizeHandle`, `ResizeHandles`, and `RotationHandle` provide
  explicit hit regions and standard presentation.
- `Manipulable` is a convenience composition over the same behavior.
- A box contains finite parent-space `left`, `top`, `width`, and `height`.
- Component positioning uses left/top only, including outside layout containers.
  Positioning-style x/y are removed without compatibility aliases.
- Flex/Flow/Grid own direct-child placement. Explicit left/top have no effect
  in production and cause runtime errors in development and tests.
- Flex/Flow/Grid nested inside a manipulation frame consume its allocation and
  reflow normally on resize. Absolute is supported but is not a required host.
- Optional rotation is a writable signal in radians; `degrees(n)` would be a
  convenience conversion if no suitable existing public helper exists.
- Application-controlled proposals are a possible later binding mode. The first
  slice binds writable signals, avoiding two competing state ownership models.

The implementation plan fixes the initial names/types and exports from @crc/core.
No additional package or public solver entry is needed for the first delivery.

## Authoring sketch

```tsx
const manipulation = useManipulation({
  box,
  rotation,
  move: { snap: { step: 16, when: "shift" } },
  resize: {
    minWidth: 80,
    minHeight: 48,
    snap: { target: "size", step: 8, when: "always" },
    aspectRatio: { value: "initial", when: "shift" },
  },
  rotate: { snap: { step: degrees(15), when: "shift" } },
  onCommit: ({ before, after, changed }) => {
    if (changed) recordUndo(before, after);
  },
});

return (
  <ManipulationFrame {...manipulation.frameProps}>
    <Card />
    <DragHandle controller={manipulation} style={titleBarBox} />
    <ResizeHandles controller={manipulation} positions="corners" />
    <RotationHandle controller={manipulation} />
  </ManipulationFrame>
);
```

The frame establishes an overlay allocation for content and handles. Ordinary
children follow source paint order; it does not silently raise itself on press.
Handle position selects the solver operation and standard placement. Custom
handle children change visuals without replacing the operation.

## Proposed gesture and state rules

1. Primary-button pointer down arms a candidate gesture. Capture must succeed.
   One pointer and operation own a controller at a time.
2. A 3 CSS-pixel movement threshold starts manipulation, preserving ordinary
   presses below the threshold. Begin geometry and pointer anchor are recorded
   on press; the first applied change uses the full displacement.
3. Each movement derives its unsnapped candidate from the gesture origin,
   applies current activation rules, then solves constraints. Never integrate
   from the preceding rounded or clamped result.
4. Accepted box and rotation changes publish atomically through ordinary signals.
   Rendering uses the existing realm scheduler; there is no second frame loop.
5. Pointer up applies the terminal pointer sample and commits once. A gesture
   returning to its initial geometry produces no history-worthy change.
6. Explicit cancellation, pointer cancellation, unexpected capture loss, or
   disabling an active operation restores its initial geometry while the
   gesture still owns those values. Cancellation never emits commit.
7. An external geometry write ends the gesture and preserves the external
   geometry. It must not be overwritten by rollback or the next pointer move.
   Equal-value writes do not count as geometry changes.
8. Teardown releases capture and session resources immediately and restores
   gesture-owned preview values, without invoking callbacks from disposed
   components. If teardown occurs under a render or other signal-write guard,
   enqueue one generation-checked rollback for the existing scheduler's next
   Begin. A newer external write or controller owner invalidates it. Do not
   weaken write guards or leave a permanent half-completed preview. This finite
   cleanup record is not a measurement feedback loop or continuing animation.
9. Handle gestures take precedence over enclosing drag surfaces. Child controls
   can reject manipulation through a documented event cancellation rule.
   Gesture claiming must not rely on JSX handler spread order.

The exact suppression of browser click activation after a completed drag needs
an explicit extension to the existing activation contract. It must suppress
only that gesture's activation, not unrelated pointers or ordinary clicks.

Escape cancellation is available through CRC's existing logical focus path when
FocusManagement is installed and the handle is focused. A controller also
exposes `cancel()` for application keyboard/toolbars. No hidden document-wide
keyboard listener or implicit focus policy is introduced.

## Proposed geometry rules

### Approved positioning direction

The user chose one component-positioning vocabulary: `left` and `top`.
Remove `x` and `y` as component-positioning style fields rather than retaining
aliases or a second additive local offset. This is an intended migration of
the shipped style/layout contract, not a description of current behavior.

At the root or under a non-layout structural component, the runtime applies
left/top placement. When a layout parent places a child, the renderer consumes
the parent's resolved placement exactly once and must not apply the authored
offset again. A child cannot use x/y to bypass or add to that allocation.
Flex/Flow/Grid retain ownership of their placement algorithms and ignore authored
left/top in production. Development and test execution reject explicit ignored
positioning with the diagnostics defined below. Future right/bottom positioning
fields must follow the same policy; this design does not add them.

This decision concerns component positioning, not pointer-event coordinates,
Path2D points, line endpoints, physics vectors, or other geometric data.
Rectangle/Image move their local origin to zero after left/top placement.
Text uses the translated local anchor (0,0), preserving textAlign/textBaseline;
left/top does not infer an ink bounding box. Center-based shapes retain local
center geometry; left/top translates their coordinate space. Remove the public
positioning x/y fields from Rectangle/Text/Image, not true geometry records.
Rotation, scale, and explicit Group transforms remain separate presentation
operations rather than alternate ordinary placement fields.

Implement this shared positioning contract as part of the manipulation work.
Absolute remains a supported layout container, but is not required to
position or allocate a standalone Manipulable. Nested Flex/Flow/Grid content
still receives the frame's finite local allocation.

- Position and movement grids use the frame parent's local coordinates.
- Width and height use the frame's unrotated local axes.
- Rotation is radians about the box center. Rotated resizing adjusts position
  as well as dimensions to preserve the opposite anchor in parent space.
- The manipulation frame supplies coordinate conversion; applications should
  not manually undo zoom, layout placement, or ancestor transforms.
- Hit geometry, handle visuals, and conversion must use the same committed
  presentation. Gesture-owned geometry changes are supported. A changed ancestor
  coordinate mapping cancels the gesture initially rather than silently rebasing.
- Singular transforms cannot start manipulation and must produce an actionable
  diagnostic through the chosen error/reporting surface.
- Handles use CSS-pixel visual and hit sizes. Their centers follow object
  geometry; their targets stay usable under zoom and device density changes.
- The first slice supports free placement. Flex/Grid reordering and editing
  layout constraints are separate operations, not side effects of dragging.

CRC parents inspect direct-child style before evaluating a custom component.
The frame therefore exposes geometry through the existing style channel. The
runtime distinguishes parent-resolved placement from standalone placement,
without rendering a child to discover its box or applying offsets twice.
The plan carries parent ownership in the existing per-element placement/style
handoff; standalone placement uses the normal presentation transform path.

### Layout composition

Layout inside a manipulation frame is a first-class supported use case. The
frame supplies its finite content allocation. A nested Flex, Flow, or Grid
with omitted dimensions consumes that allocation and runs its existing layout
algorithm. Resize changes allocation and causes normal reflow; movement and
rotation change presentation without changing local content dimensions.
Explicit fixed child dimensions remain fixed; manipulation does not stretch
arbitrary drawing or override authored child dimensions. Handles are frame
chrome, not items in the nested content layout. Content clipping must not
accidentally clip the frame's own external handles, although ancestor clips
still apply to both. Resizing must preserve component identity.

Expose geometry through the existing direct-child `style` channel. This
standalone example intentionally requires no Absolute wrapper:

```tsx
<Manipulable style={box} draggable resizable>
  <Flex style={{ flexDirection: "column", gap: 12 }}>
    {/* ordinary explicitly sized/flexible content */}
  </Flex>
</Manipulable>
```

Here `box` is the writable finite geometry signal, also visible to an enclosing
Absolute when one is used. There is no competing hidden geometry channel.
The exact type separates writable geometry binding from additional decoration
and layout-item inputs; readonly/computed style must not silently become writable.
For the controller form, a stable `frameProps` bundle exposes both
the controller and its same geometry signal as `style` on the element descriptor.
No new signal or geometry mirror is created. User-authored wrapper components
must forward layout style normally rather than relying on descendant discovery.

The outer parent still owns final allocation. Under Absolute, finite box
position and dimensions map directly to placement. Under Flex/Flow/Grid,
position is parent-owned and authored dimensions may be redistributed. Editing
left/top does not reorder siblings or add a presentation offset. A free-position
box binding with left/top is invalid in development/test execution as a direct
child of those layouts, even if its move operation is disabled.

Do not silently provide drag handles that only write ignored position fields.
An intentional resize-only binding to layout sizing inputs needs a separate
explicit type/policy without left/top, and must distinguish authored size from
used allocation. Reordering or presentation transforms are separate operations,
not implicit fallbacks. That binding remains a later design decision; it does
not restrict using any of these layouts inside a freely positioned frame.

Performance acceptance: reuse existing style inspection, used-size handoff,
placement identity, and scheduler paths. Do not pre-render content, scan it for
bounds, read pixels, or schedule feedback frames to copy measured geometry into
signals. Gesture calculations and the fixed number of handles add bounded work;
ordinary content layout/render costs still apply. Do not promise that movement
skips descendant layout in CRC's full-traversal renderer. Verify proportional
layout/visit counts against an equivalent manually positioned scene and verify
that multiple pointer updates coalesce onto the existing scheduled frame.

## Snapping and constraints

`snap` absent means disabled. Present snapping defaults `enabled` to true and
`when` to `always`. `enabled` explicitly accepts a boolean or readonly boolean
signal. Nested signal resolution is schema-declared, never generic recursion.

`when` initially accepts `always`, `shift`, `alt`, `ctrl`, or `meta`. Enabled
and activation are combined with AND. The held modifier activates even if
another modifier is also held. Modifier changes reevaluate the last pointer
sample when the appropriate keyboard event reaches the interaction; otherwise
they take effect at the next pointer event.

- Move: snap left/top to a parent-space lattice with an optional origin.
- Resize size: snap width/height to positive steps from zero.
- Resize grid: snap the moving edge/corner to the parent grid; initially only
  unrotated boxes in a supported aligned coordinate mapping.
- Rotate: snap the unwrapped angle to an angular lattice with optional origin.
  Preserve continuous angle values across full turns; do not normalize on write.
- Nearest lattice point wins; exact ties select the larger lattice index,
  including negative coordinates.
- Step values must be finite and strictly positive; origins must be finite.
- Hard bounds, minimum/maximum sizes, the fixed opposite anchor, and a locked
  aspect ratio take precedence over snapping. A legal result may be off-grid.
- Invalid static constraint combinations fail before a gesture starts. If a
  live constraint change makes a session unsatisfiable, cancel it.
- With a ratio lock, corner resizing uses the greater relative dimension change
  as its driver, with width winning ties; edge resizing changes the secondary
  dimension symmetrically. Project the driver into the feasible interval from
  both dimensions and derive its partner, as specified in the implementation plan.

Size and grid snapping are discriminated types. Grid options cannot appear on
size snapping. Shared activation vocabulary does not imply a single generic
solver for all operations.

## Agent-facing evidence and diagnostics

### Agreed ignored-positioning errors

Development and test builds throw an actionable runtime error when Flex, Flow,
or Grid inspects a direct child's style and finds an explicitly supplied,
resolved left or top value. This includes zero. Omitted/undefined values and
internally generated defaults do not trigger the error. Inspect after declared
style signal resolution but before normalization introduces defaults; preserve
authored-field provenance when necessary. Validate actual normalized direct
children under existing fragment/array rules; a layout nested deeper inside
a child does not change that child's parent placement policy.

The diagnostic has a stable code (`CRC_LAYOUT_IGNORED_POSITION`), parent layout,
child component, offending fields and values, and available JSX source metadata.
Include a stable child key when available; do not invent unavailable source
locations. Explain that the parent owns positioning and suggest its alignment,
gap, or explicit placement options, or an Absolute region for freely positioned
content. For example:

```text
CRC_LAYOUT_IGNORED_POSITION: Rectangle inside Flex declares left: 10, top: 440.
Flex controls this child's position; these fields have no effect.
Use Flex alignment/gap or an Absolute region for positioned content.
Source: Editor.tsx:42 (when available)
```

This is an error, not an optional warning or a separate opt-in strict mode.
Use normal renderer failure isolation and cleanup; do not repeatedly log and
continue rendering the invalid child. Production does not apply these offsets
and does not perform development-only reporting. Production still performs
ordinary validation required by existing runtime contracts.

These checks run during actual layout, including dynamic children and resolved
signal styles. They do not require a drag to start. TypeScript still rejects
removed positioning-style x/y and invalid value types, but does not prove JSX
ancestry. No custom ESLint rule, compiler plugin, or ancestor-dependent JSX type
system is included initially. Agents must execute the affected public scenario
or browser test; successful typecheck alone is insufficient positioning evidence.

The repository's development/test versus production build mechanism must be
identified explicitly during implementation planning, with evidence that both
source and packed/built modes select the intended behavior. No extra public
strict-validation configuration is assumed by this design.

### Interaction evidence

Expose readonly active operation/handle state and snapshots with initial,
proposed, and applied geometry. Distinguish snapping requested from snapping
actually satisfied after hard constraints. Callback payloads are immutable
values, not borrowed event scratch or mutable renderer references.

Start/change/commit/cancel notifications have explicit ordering. Commit includes
`before`, `after`, and `changed`; consumers use `changed` to avoid empty undo
entries. Cancellation includes a closed reason vocabulary.

A pure geometry solver is a candidate public capability for numeric edits and
keyboard commands. Do not expose an input-injection or manual runtime clock API.
Decide its minimal input/output contract after the first interaction slice.

Public browser tests must operate actual handles and assert signal geometry,
capture cleanup, and exactly-once outcomes. Pure solver tests supplement these.
Screenshots demonstrate handle presentation but do not replace numeric evidence.

## Delivery

The unified positioning migration and its diagnostics are part of this feature's
scope and precede the first manipulation slice where needed. Define the mapping
for each affected built-in (especially Text baseline/alignment and image/shape
origins), then migrate runtime style types, placement/rendering, examples,
tests, editor declarations, and public documentation together. Do not globally
rename geometric x/y data. Do not change center coordinates, path points,
event coordinates, physics, or WebGL coordinates merely because their names
match. Preserve Group transform semantics, event/paint alignment, identity,
and exact cleanup.

Focused acceptance evidence must include:

- Standalone left/top placement under ordinary composition and Group transforms.
- Absolute placement applied exactly once, including nested inside Flex.
- Development/test errors for explicit left/top under each of Flex/Flow/Grid,
  including zero, resolved signal styles, and dynamically produced children.
- Omitted offsets remain valid; production ignores supplied offsets without
  moving or double-translating the item.
- Removed positioning-style x/y fail public declaration/consumer checks.
- A freely positioned Manipulable works without Absolute; the same geometry
  under Absolute yields equivalent placement.
- Flex, wrapping Flow, and explicit Grid inside the frame reflow on resize,
  preserve child identity, and do not treat handles as layout items.
- Structural counters show no additional content traversal, speculative render,
  geometry feedback frame, or independent scheduler loop.

Use one focused failing public observable test at a time to establish the first
slice. Complete the remaining matrix, package/source/built verification, and
documentation hardening after hands-on feedback, proportional to this migration.

The first slice is a compound card with an explicit drag region, corner resize
handles, position/size snapping, minimum dimensions, and a geometry readout.
Use the supported public package surface and add one focused failing observable
test before production code. Deliver its exact runnable Studio URL for feedback.

Rotation, rotated resizing, screen-sized handles under general transforms,
advanced constraints, and the broader lifecycle matrix are subsequent slices.
They remain part of the intended design, not claims about the first slice.
Document and verify the accepted behavior proportionally after hands-on feedback.

The implementation plan assigns placement ownership to the existing per-element
placement/style handoff, specifies development gating and callback ordering,
and covers external-write ownership, click suppression, constraint projection,
and package exports. Its focused tests establish these technical choices before
production changes. Deferred controlled bindings and layout-owned resizing do
not block the agreed freely positioned manipulation feature.
