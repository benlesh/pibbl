# Child-defined drag handles

> **Historical status: APPROVED DESIGN RECORD.** This dated record captures the approved child-defined handle behavior and does not claim shipped behavior.

Approved in conversation on 2026-09-29. This supersedes the earlier rectangular
DragHandle target contract; resize and rotation controls keep their explicit
control geometry.

## Public behavior

DragHandle is a structural event listener. It moves its controller's frame when
a participating descendant receives a primary press which bubbles to it. It
owns no implicit rectangle, does not merge child paths, and never computes
bounds from descendants. Circle corners, gaps, empty wrappers, clipped-out
regions, and pointerEvents="none" descendants cannot initiate a drag.

Style has ordinary Group-like presentation and layout participation semantics.
Visual and hit transforms stay aligned. Cursor and keyboard focusability belong
to child targets. Readout presentation remains in style.readout because it draws
a real label. The wrapper observes descendant focus for focused readout styling;
Escape bubbles from focused children to the existing cancellation behavior.
Capture remains owned by the drag listener once armed, so movement outside the
child continues the gesture. Existing threshold, nested-handle precedence,
preventDefault, click suppression, teardown and source-ownership rules remain.

Children can be ordinary function components, fragments, drawing primitives,
and clipped/transformed structural subtrees. Existing renderer hit testing and
propagation are authoritative; no retained geometry union or extra scene walk is
introduced.

## Position readout

The default label displays applied left/top in parent-local logical units.
formatReadout receives { left, top }, supporting document-unit conversion.
Visibility, font, fill, stroke, opacity, state precedence, gap and canvas
containment reuse resize/rotation readout behavior. Labels never add targets.
Manipulable.dragHandle forwards style and formatting options to its content
wrapper. Only actual participating descendants initiate dragging.

## Migration and evidence

Replace empty rectangular DragHandle overlays with actual target children.
Wrap the visible title bar rather than duplicating its height in an invisible
interaction sibling. Set keyboardFocusable and cursor on the visible target;
mark decorative text pointerEvents="none" when it should not occlude it.

Verify native pointer misses for circle bounding corners, gaps, empty wrappers,
clipped-out content and opt-out descendants; successful movement from the shape;
child cancellation; capture outside the shape; focus and Escape; inherited
transforms; teardown; and applied-position formatting. Migrate the public
learning example, deterministic lab, packed consumer and editor declarations.
Run the focused manipulation suites plus source/build declaration and consumer
checks. Unrelated existing positioning failures are not evidence against or for
this changed contract and must remain reported separately.
