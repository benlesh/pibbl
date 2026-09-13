# Diagram Editor Tutorial Design

> **Status: APPROVED.** Approved in conversation on 2026-09-13.

**Date:** 2026-09-13  
**Scope:** The complete twelve-chapter diagram-editor tutorial, its runnable
snapshots, its outcome-first landing experience, and the Studio support and
evidence required to publish it.

## Relationship to existing decisions

This design completes the deferred tutorial work identified by the implemented
[documentation information architecture and search
design](./2026-09-09-documentation-information-architecture-and-search-design.md).
It retains that design's canonical route family, Markdown content model,
build-time local search, shallow Learn navigation, and separation between
public learning material and Automated Test Labs. It expands the already
published twelve-chapter syllabus without changing its order or promising a
broader documentation-platform rewrite.

Current public code, package manifests, executable tests, and the implemented
contracts under `docs/design/` remain authoritative for CRC behavior. Tutorial
prose and examples must explain those contracts accurately and use only public
package entry points.

## Summary

The tutorial is an outcome-first, Studio-first course for developers who can
read TypeScript and JSX but may be new to CRC and immediate-mode Canvas
rendering. Across twelve cumulative chapters, the reader builds a polished
miniature workflow-diagram editor with nodes, connections, selection, node
dragging, workspace pan and zoom, clipping, a retained grid layer, typed filter
polish, and logical keyboard interaction.

The landing page tantalizes readers with a verified image of the finished
editor and two direct actions: **Start building** opens Chapter 1 and **Open the
finished editor** opens Chapter 12's live, editable workbench. The landing page
does not embed Monaco or the live runtime. This makes the result concrete
without imposing the heaviest learning UI or exposing a long final source file
before the reader has context.

Every chapter owns one complete, independently runnable TSX snapshot. A reader
can deep-link, edit, reset, share, or recover any chapter without replaying
earlier work. The tutorial teaches one visible change at a time, gives the
reader a prediction or exercise, and connects observed behavior to CRC's public
contracts. Visual spectacle serves the explanation; it never substitutes for
the explanation.

## Goals

1. Give a new CRC reader a satisfying, real-world project that demonstrates how
   drawing, composition, layout, state, events, transforms, retained layers,
   filters, and focus fit together.
2. Make each chapter educational in isolation while preserving a compelling
   cumulative visual progression.
3. Show the finished outcome on the first tutorial page and make the completed
   live editor reachable with one explicit action.
4. Keep every canonical snapshot editable in the existing sandboxed TypeScript
   workbench with its current compile, reset, share, diagnostics, and disposal
   behavior.
5. Teach important Canvas and CRC boundaries honestly: immediate-mode
   rerendering, root-logical event coordinates, explicit application state,
   decorative hit participation, pointer capture, retained-boundary ownership,
   and the difference between logical keyboard interaction and accessibility
   semantics.
6. Supply public-route, source, semantic, browser-interaction, ownership, and
   visual evidence sufficient to keep prose and runnable behavior aligned.

## Non-goals

The completed tutorial editor does not add or imply public CRC APIs for:

- creating, deleting, renaming, or resizing nodes;
- authoring or reconnecting edges;
- rich text or native text editing;
- persistence, import/export, serialization, undo/redo, collaboration, or
  history;
- minimaps, scrolling, automatic layout, routing algorithms, or a retained
  scene graph;
- a generated semantic DOM or accessibility tree;
- non-JSX authoring, WebGL islands, workers, or application-framework setup.

Moving nodes is sufficient to make the project an editor: the user changes the
diagram's spatial model and sees its derived connections update. Features that
would turn the course into a general diagramming product are intentionally
excluded.

## Audience and prerequisites

The primary reader is a TypeScript or JavaScript developer who understands
functions, objects, arrays, and basic event handling. React knowledge is not
required and the tutorial must not teach CRC through React analogies.

The default learning path runs entirely in the Studio. Each page provides a
ready-to-run TSX snapshot, so Chapter 1 begins with the CRC mount and Canvas
scene rather than package installation, Vite configuration, or `tsconfig`
setup. The landing page links to [Configure
JSX](#/learn/guides/configure-jsx) for readers moving the result into a local
project and to [Author without
JSX](#/learn/guides/author-without-jsx) as a separate supported authoring path.
The tutorial itself uses one automatic CRC JSX runtime consistently.

## Learning and presentation principles

### Outcome first

Readers see what they will build before they see the syllabus. The finished
image, short outcome statement, and two actions occupy the first meaningful
section after the page title and summary. The existing twelve-chapter syllabus
follows that invitation.

### One visible payoff per chapter

Every chapter changes the Canvas in a way the reader can point to: a node
appears, an edge joins two nodes, selection becomes visible, a drag continues
outside a node, or the viewport begins to pan. A chapter does not exist merely
to reorganize code or introduce vocabulary.

### Explain the mechanism behind the effect

Each visible payoff is paired with one primary mental model. For example,
Chapter 7's successful drag teaches logical target ownership and pointer
capture; Chapter 9's unchanged grid during outer presentation changes teaches
why an explicit retained boundary can be useful.

### Predict, change, observe

Before the full workbench, every chapter gives the reader a small prediction or
guided change. The prompt names the expected visual or interaction result, so
the reader can distinguish a successful modification from accidental output.

### Complete snapshots, focused excerpts

Prose shows only the focused change from the previous chapter. The workbench
contains the complete canonical file. No chapter imports application helpers
from another tutorial file because the current sandbox accepts only direct CRC
package imports. Deliberate source duplication is the mechanism that makes
deep-linking, reset, sharing, and recovery reliable.

### Honest boundaries

The tutorial identifies browser requirements and CRC non-promises at the point
where they matter. It does not call the final Canvas experience
screen-reader-accessible, does not imply that `Layer` is an automatic
optimization, and does not describe stateful component output as a retained
scene graph.

## The finished editor

### Canvas and composition

The canonical logical viewport is 960 by 600. It uses CRC's fixed logical
viewport behavior so the tutorial can discuss one stable coordinate space while
the Studio scales the Canvas presentation to available CSS space.

The final composition has three visually distinct regions:

1. A 56-pixel toolbar across the top with the project name, a concise gesture
   hint, and a Reset view control.
2. A clipped workspace from y=56 through y=568 with a subtle dot grid, four
   colored workflow nodes, curved directed connections, and generous blank
   space for pan and zoom.
3. A 32-pixel status strip reporting the selected node and rounded zoom
   percentage.

The default workflow reads from left to right:

- **Idea** — coral;
- **Sketch** — gold;
- **Build** — mint;
- **Ship** — cobalt.

Connections are `Idea -> Sketch`, `Sketch -> Build`, `Sketch -> Ship`, and
`Build -> Ship`. Each node is a rounded 168 by 84 card with a short secondary
label and visible input/output ports. Curved connections paint behind cards and
update from node geometry whenever a card moves. Arrowheads, labels, ports, the
grid, and selection decoration use `pointerEvents="none"` when they are not
intended to win coordinate targeting.

### Final interactions

- Clicking or keyboard-activating a node selects it.
- Pressing and moving a node drags it, even when the pointer leaves the card,
  until pointer up, pointer cancel, capture loss, or teardown ends the gesture.
- Pressing empty workspace and moving pans the view.
- Wheel input over the workspace zooms around the pointer and prevents native
  scrolling only while the workspace owns that interaction.
- Zoom is clamped to a documented range of 60% through 180%.
- Reset view restores the initial pan and zoom without resetting moved node
  positions or selection.
- Tab and Shift+Tab use CRC's source-order focus behavior. Directional arrows
  move among finite node/control bounds inside the declared directional
  navigation boundary. Enter or Space activates the focused node or reset
  control through the focus manager's click activation.
- The selected node uses one typed drop-shadow filter boundary. Filter pixels
  do not enlarge its layout, hit, or focus geometry.

The design does not add tutorial-only runtime hooks or test controls to the
Canvas. All state visible in the workbench comes from supported public authoring
and APIs.

### Application model and gesture data

The snapshots use stable application IDs rather than CRC target objects as
domain identity:

```ts
type NodeId = "idea" | "sketch" | "build" | "ship";

interface DiagramNode {
  readonly id: NodeId;
  readonly title: string;
  readonly subtitle: string;
  readonly color: string;
  readonly x: number;
  readonly y: number;
}

interface DiagramEdge {
  readonly id: string;
  readonly from: NodeId;
  readonly to: NodeId;
}

interface ViewTransform {
  readonly panX: number;
  readonly panY: number;
  readonly zoom: number;
}
```

Nodes, selection, and the view transform are ordinary application state. Edges
are immutable definitions whose endpoints are derived from the current nodes.
A component-owned ref holds the active node-drag or workspace-pan session
because gesture ownership must update synchronously between browser events even
when rendering is frame-coalesced. Domain updates replace nodes immutably.

Pointer event `x` and `y` remain root-logical coordinates. Drag and zoom helpers
explicitly subtract the workspace origin and invert current pan/zoom to obtain
workspace coordinates. Zoom keeps the workspace point beneath the pointer
stationary by calculating the next pan from that anchor. This conversion is an
application responsibility and an explicit teaching point.

## Landing-page experience

The root route remains `#/learn/tutorials/diagram-editor`. Its content order is:

1. Existing Studio breadcrumb, title, and summary.
2. **See what you will build**: a verified image of the final 960 by 600 Canvas
   with useful alternative text.
3. A two-sentence outcome description and the **Start building** and **Open the
   finished editor** actions.
4. A concise prerequisites note linking the JSX and non-JSX guides.
5. The twelve-chapter curriculum, now linked because all chapters exist.
6. The course contract: independent snapshots, edit/reset/share behavior, and
   the explicit feature boundaries.

The finished image is captured from the canonical Chapter 12 snapshot rather
than manually illustrated. The public asset lives at a stable Studio-served
path and the capture/check workflow fails if the expected final state cannot be
mounted. The image and Chapter 12 link are complementary: the image provides a
fast first impression, while the link provides the live result.

The landing page deliberately does not attach `exampleSlug`. Embedding the
finished workbench here would load Monaco, duplicate a live editor on two
routes, place a large final source file before the syllabus, and complicate
landing-page disposal without adding a distinct learning outcome.

## Chapter page contract

Every chapter is a `kind: tutorial` Markdown document whose `tutorial` value is
`diagram-editor`, whose `order` is its contiguous integer from 1 through 12,
and whose `exampleSlug` identifies exactly one tutorial snapshot.

The rendered page order is:

1. breadcrumb, title, and outcome-oriented summary;
2. the authored Markdown body;
3. the existing editable workbench;
4. generated tutorial pagination.

Each Markdown body uses the following authored sections:

- **What you will make** — the visible outcome and gesture to try;
- **How it works** — the primary CRC mental model;
- **Build the change** — focused excerpts and explanations, not the complete
  repeated source;
- **Predict and try** — one prediction plus one bounded modification;
- **Check your result** — concrete success observations and a likely mistake;
- **What you learned** — a short recap and links to the relevant public API and
  guide pages.

The complete source appears only in the workbench. The page may repeat a small
signature or excerpt when it is the object of explanation, but it does not
duplicate the entire snapshot in Markdown.

Reset restores that chapter's source only. Shared source is scoped to the
current chapter route and retains the existing 16,000-character URL limit and
recovery messages. Moving between chapters never carries user edits forward.

Pagination is derived from validated tutorial order, not hand-authored links or
sidebar position. Chapter 1's previous action returns to the tutorial landing
page. Chapter 12 has no next-chapter action and instead offers **Back to the
tutorial overview**. The page announces labels as `Previous: <title>` and
`Next: <title>` so destination purpose is available without visual context.

## Chapter syllabus in detail

### 1. Create the Canvas scene

**Outcome:** a complete 960 by 600 workspace frame with toolbar, empty
workspace, and status strip placeholders.

The chapter introduces an ordinary synchronous `DiagramEditor` component,
mounting with `crc(canvas, <DiagramEditor />)`, the returned controller, the
initial fixed logical viewport, scheduled rendering, and idempotent disposal.
It explains that component evaluation describes the next Canvas traversal; CRC
does not generate DOM or retain drawing commands.

The focused change is the initial background and region geometry. The exercise
changes the workspace color and toolbar label, then resets the snapshot. The
success check observes one mounted scene at the expected logical dimensions and
visible paint across all three regions. Local project setup remains a linked
prerequisite rather than chapter content.

### 2. Draw the first node

**Outcome:** the Idea card appears in the workspace with title, subtitle,
rounded body, and ports.

The chapter composes `Rectangle` and `Text` in a translated `Group`. It explains
local closed style, the separation between transform placement and child-local
geometry, and why label/port decorations opt out of hit participation. The
source still contains only one concrete node; extracting a general component is
deliberately deferred.

The exercise changes the card color and subtitle. The success check distinguishes
the card's local coordinates from its workspace placement and confirms that
decorative text does not become the topmost logical target.

### 3. Connect two nodes

**Outcome:** Sketch appears and a curved Idea-to-Sketch connection makes the
scene recognizable as a diagram.

The chapter constructs a `Path2D` cubic curve from the cards' port positions,
draws its stroke and arrowhead before the cards, and explains source paint order.
The connection is decorative and uses `pointerEvents="none"`, preventing a
wide stroke or arrowhead from blocking future workspace input. Endpoint
calculation remains a small named helper that returns ordinary numbers.

The exercise changes the second card's position and predicts how the connector
will respond after the endpoint constants change. The success check observes
the connector behind both cards with its endpoint attached to each port.

### 4. Extract a reusable node component

**Outcome:** all four workflow nodes and all four connections render from data.

The chapter introduces the `DiagramNode` and `DiagramEdge` models, a `NodeCard`
component, a `Connection` component, array children, fragments, props, and
stable node/edge keys. It explains that keys preserve identity only among
siblings under the same parent and that the component function itself
participates in identity.

The visual result grows substantially, but the primary lesson is authoring
structure rather than interaction. The exercise adds a temporary fifth node to
the local data and predicts where a missing edge would leave it. The success
check confirms deterministic source paint order: grid/background, connections,
then cards.

### 5. Build the editor chrome

**Outcome:** the toolbar, clipped-workspace allocation, and status strip become
a coherent editor frame.

The chapter uses CRC layout components for the outer regions while retaining
explicit drawing geometry inside custom region components. It explains
specified style versus the finite allocation available through
`crcLayoutBox()`, and it avoids blindly forwarding parent placement into inner
drawing primitives.

The Reset view control is visually present but inert until the view transform
exists. The exercise changes the toolbar/status proportions and predicts which
local drawing values should follow allocation. The success check verifies that
layout changes region boxes without changing node workspace coordinates.

### 6. Select nodes with state

**Outcome:** clicking a node selects it, updates its outline, and changes the
status strip.

The root owns `selectedNodeId` through `crcState`; stable node IDs remain the
domain identity. `NodeCard` receives `selected` and `onSelect` props. The
chapter explains default drawing participation, why the body is the intended
target, why decorations pass through, and how state changes request a future
coalesced frame rather than synchronously repainting pixels inside the handler.

The exercise changes the selection color and makes clicking the selected node
clear selection. The success check compares model state, status text, and
visible outline rather than relying only on a pixel sample.

### 7. Drag nodes safely

**Outcome:** a node follows a pressed pointer until release even outside its
painted card, and its connections update during the drag.

The chapter adds pointer down/move/up/cancel and got/lost-capture handling. The
pressed target requests capture for its pointer ID. A component ref stores the
active gesture's pointer ID, node ID, starting root-logical point, and starting
node position. Each move calculates an absolute position from that origin and
uses an immutable functional state update, avoiding dependence on a possibly
stale rendered closure.

The exercise clamps a dragged node to a generous workspace range. The success
check explicitly moves outside the original node bounds, observes continued
motion, and verifies that release, cancellation, capture loss, target removal,
and disposal cannot leave an active gesture owner.

### 8. Pan and zoom the workspace

**Outcome:** dragging empty workspace pans the diagram and wheel input zooms
around the pointer while toolbar/status remain fixed.

The chapter introduces `ViewTransform` and one outer workspace `Group`. Empty
background owns pan input; all decorative workspace paint stays non-targeting.
It converts root-logical event coordinates into workspace coordinates by
subtracting the workspace origin and inverting pan/zoom. Wheel zoom clamps to
60%-180%, preserves the workspace point beneath the pointer, and calls
`preventDefault()` only for the owned workspace interaction.

The Reset view control now restores initial pan and zoom while preserving moved
nodes and selection. The exercise changes the zoom step and predicts whether
the point under the cursor should move. The success check observes invariant
cursor anchoring, fixed chrome, and unchanged domain node coordinates during
pan/zoom.

### 9. Constrain the viewport

**Outcome:** panned and zoomed content is cropped to the workspace, and the
static dot grid is owned by an explicit `Layer`.

The chapter builds a rectangular `Path2D` for `Clip` and places the transformed
workspace beneath it. A fixed-size `Layer` owns only the stable grid subtree;
connections and cards remain on the immediate path because they change during
interaction. The chapter explains upright local surfaces, outer presentation,
interaction clipping, source paint order, browser `OffscreenCanvas`
requirements, and why adding a layer is an explicit measured choice rather
than a universal optimization.

The exercise temporarily moves the clip edge inward and predicts both pixel and
hit behavior. The success check shows clipped-away content cannot be targeted,
clean grid content may be reused, and cards/connections still repaint when
their application state changes.

### 10. Polish selection with filters

**Outcome:** the selected card receives one coherent drop-shadow/glow while the
unselected cards stay on the direct drawing path.

The typed `dropShadow` descriptor sits on the selected card's composition
boundary so the body, labels, and ports form one combined silhouette. The
chapter explains forward list order, inside-out nesting, the difference between
filter pixels and logical geometry, and the `OffscreenCanvas` plus native
Canvas-filter capability requirement for nonempty filters.

The exercise adds a subtle brightness descriptor before the shadow and predicts
the effect of reversing the list. The success check confirms that shadow-only
pixels outside the original card geometry do not become clickable or
focusable. An explicit note explains that `[]` is the capability-free no-op.

### 11. Add keyboard interaction

**Outcome:** keyboard users can traverse node/control targets, see focus-visible
styling, and activate selection or view reset.

The scene opts into `FocusManagement` and a directional
`KeyboardNavigation` boundary. `NodeCard` uses one grouped
`crcEventTarget()` with explicit rounded-card geometry and finite navigation
bounds; its decorative drawing primitives use `pointerEvents="none"` to avoid
creating competing targets. The returned focus snapshot drives the visible
focus ring. Enter/Space activation uses the same selection/reset actions as
pointer input.

The exercise changes source order and predicts Tab order while leaving
directional geometry unchanged. The success check covers Tab, Shift+Tab,
directional arrows, focus-visible state, activation, natural exit, and
non-wrapping edges.

The chapter states the accessibility boundary prominently: the Canvas remains
one native focus host and exposes no node names, roles, relationships, or
screen-reader tree. A real product must provide an application-owned semantic
workflow such as a synchronized node/connection list with equivalent editing
actions and must avoid duplicate keyboard paths.

### 12. Finish and harden the editor

**Outcome:** the exact editor promised on the landing page, with cohesive copy,
gesture hints, stable cleanup, and a production-readiness checklist.

The chapter consolidates named domain-update and coordinate-conversion helpers,
uses `crcMemo` only for immutable `Path2D` geometry that otherwise has a real
reconstruction cost, and retains refs only for synchronous gesture ownership.
It explains why `crcWhenChanged` is not added without an external resource to
synchronize. Stable keys, reparenting/remount implications, render-failure
teardown, already-painted-pixel behavior, Canvas/Path2D browser authority,
filter/layer capabilities, and idempotent controller disposal are reviewed
against code the reader has already seen.

The exercise changes the initial workflow data and verifies that interaction
and derived edges still come from the model rather than pixel inspection. The
success check runs the complete pointer and keyboard gesture list, resets
source through the workbench, and distinguishes tutorial completeness from
production completeness. The final page links back to the tutorial overview,
the focused guides, and the API destinations used throughout the course.

## Tutorial snapshot architecture

### Dedicated catalog

Tutorial snapshots are public learning sources but not browseable Examples and
not deterministic Test Labs. They receive a dedicated catalog in
`packages/scenarios` rather than exceptions in `learningExampleCatalog`.

The catalog's public internal shape is:

```ts
export interface TutorialSnapshotMetadata {
  readonly slug: string;
  readonly tutorial: "diagram-editor";
  readonly chapter: number;
  readonly title: string;
  readonly authoring: "jsx";
  readonly canvas: { readonly width: 960; readonly height: 600 };
  readonly source: { readonly path: string };
}

export interface TutorialSnapshotCatalogEntry extends TutorialSnapshotMetadata {
  readonly load: () => Promise<LearningExampleModule>;
}
```

Snapshot slugs are globally unique across learning examples and tutorial
snapshots because `exampleSlug` is one frontmatter namespace. The twelve slugs
are:

1. `diagram-editor-canvas-scene`
2. `diagram-editor-first-node`
3. `diagram-editor-connect-nodes`
4. `diagram-editor-reusable-node`
5. `diagram-editor-editor-chrome`
6. `diagram-editor-selection`
7. `diagram-editor-dragging`
8. `diagram-editor-pan-and-zoom`
9. `diagram-editor-viewport-and-layer`
10. `diagram-editor-filters`
11. `diagram-editor-keyboard-interaction`
12. `diagram-editor-finished`

The catalog validator enforces the stable slug pattern, exact tutorial name,
JSX authoring, positive Canvas dimensions, unique paths, contiguous chapters
1-12, canonical path convention, and a loadable module for every record. A
combined `getWorkbenchEntryBySlug()` lookup checks normal learning examples and
tutorial snapshots without merging their navigation or search roles.

### Canonical source files

Sources live at:

```text
packages/scenarios/src/tutorials/diagram-editor/
  01-canvas-scene.example.tsx
  02-first-node.example.tsx
  03-connect-nodes.example.tsx
  04-reusable-node.example.tsx
  05-editor-chrome.example.tsx
  06-selection.example.tsx
  07-dragging.example.tsx
  08-pan-and-zoom.example.tsx
  09-viewport-and-layer.example.tsx
  10-filters.example.tsx
  11-keyboard-interaction.example.tsx
  12-finished-editor.example.tsx
```

Every file:

- imports only named public values and types from `@crc/core`;
- uses descriptive JSX without `createElement` or private subpaths;
- exports exactly one synchronous
  `default function mount(canvas: HTMLCanvasElement): CRCController`;
- returns the controller created for that Canvas;
- is self-contained and contains no relative or dynamic imports;
- passes the existing learning-source syntax and removed-vocabulary checks;
- contains no hidden test controls, source markers, or package-internal access.

The Studio raw-source glob and loader cover both `learning/**/*.example.tsx`
and `tutorials/**/*.example.tsx`. The editor workbench accepts the shared
minimal entry shape it actually consumes: slug, Canvas dimensions, and source
path. Existing learning example metadata and routes remain unchanged.

### Documentation model and relationships

The documentation build receives normal public examples for navigation/search
and the combined workbench-source inventory for `exampleSlug` validation.
Tutorial snapshots never become example routes and their catalog metadata is
not independently indexed; chapter Markdown already supplies the searchable
title, headings, concepts, and API vocabulary.

After validating one tutorial root and contiguous chapter order, the build adds
derived browser metadata:

```ts
interface TutorialPageRelationship {
  readonly rootRoute: string;
  readonly chapter: number;
  readonly chapterCount: number;
  readonly previous?: { readonly route: string; readonly title: string };
  readonly next?: { readonly route: string; readonly title: string };
}
```

The root is not a chapter. Chapter 1's derived previous destination is the root;
subsequent previous/next destinations come from numeric order. The renderer
owns presentation and disposal of pagination; Markdown authors cannot create a
contradictory second ordering.

## Error handling and recovery

- Missing, duplicate, noncontiguous, or mis-parented chapters fail the
  documentation build.
- A chapter with no `exampleSlug`, an unknown workbench slug, a duplicate slug,
  or a snapshot assigned to the wrong tutorial/order fails the build.
- A catalog record without exactly one discoverable source file fails focused
  source validation.
- TypeScript diagnostics preserve the last good preview under the existing
  workbench contract. Runtime failures remain visible in the workbench output.
- Invalid or unsupported shared source restores the canonical chapter source
  and reports the existing recovery message.
- Navigating away disposes Monaco, its model, the sandbox preview, timers,
  listeners, and the mounted CRC controller through the current page lifecycle.
- Pointer cancellation, capture loss, target removal, render failure, and root
  disposal clear tutorial gesture ownership. The tutorial never depends only
  on an ordinary pointer-up event for cleanup.
- Nonempty-filter or `Layer` chapters state their browser capability
  requirements. An unsupported environment may show the normal runtime error;
  the prose does not claim a fallback CRC does not provide.
- If the public final-image asset is missing, its source snapshot cannot mount,
  or its capture dimensions differ, the teaser verification fails rather than
  silently publishing a stale or broken promise.

## Accessibility and input responsibilities

Tutorial prose, navigation, headings, actions, workbench tools, diagnostics,
and pagination remain semantic DOM owned by the Studio. The embedded Canvas has
an accessible name that identifies it as a live lesson preview.

Chapter 11 demonstrates CRC logical focus and keyboard navigation without
calling it semantic accessibility. Focus rings have adequate contrast and are
visible only from the focus snapshot intended for rendering. Pointer-only drag
and pan are presented as Canvas interactions, while the chapter explains that a
production diagram editor must supply equivalent application-owned semantic
operations and structured relationship data. The final editor is a teaching
artifact, not an assistive-technology conformance claim.

The landing image has concise alternative text describing the relevant outcome
rather than transcribing every decorative detail. Its two adjacent links make
the screenshot nonessential for navigation.

## Verification strategy

### Static and source evidence

- Validate twelve unique, ordered tutorial records and exact source discovery.
- Validate global workbench-slug uniqueness across ordinary examples and
  tutorial snapshots.
- Validate each chapter's tutorial name, order, `exampleSlug`, internal links,
  headings, and derived previous/next relationship.
- Validate that the root links Chapter 1 and Chapter 12 and references the
  published final asset.
- Parse and typecheck every complete source with the same Studio declaration
  bundle used by Monaco.
- Apply existing direct-public-import, descriptive-JSX, self-contained mount,
  and removed-vocabulary source checks to all snapshots.
- Keep tutorial snapshot metadata out of Examples navigation and independent
  search records.

### Runtime semantic evidence

Every snapshot mounts on a real Canvas, paints nontransparent output, and
supports idempotent controller disposal. Focused tests additionally assert:

- Chapter 6 selection state and status text;
- Chapter 7 immutable node movement, connector movement, continued captured
  drag outside the card, and all terminal gesture paths;
- Chapter 8 pan without domain movement, pointer-anchored zoom, clamping,
  cancellation, and view reset;
- Chapter 9 clip-aligned paint/hit behavior and clean grid-layer reuse;
- Chapter 10 selected/unselected filter behavior and unchanged target bounds;
- Chapter 11 source-order Tab, directional navigation, focus-visible paint,
  activation, natural exit, and teardown;
- Chapter 12 the complete pointer and keyboard happy path from canonical state.

Semantic state and geometry assertions precede exact pixel evidence.

### Studio browser evidence

- The landing route shows the final image before the curriculum and exposes
  working Start and Finished actions.
- All twelve chapter routes deep-link, render authored content, mount exactly
  one sandboxed workbench, and expose correct generated pagination.
- The final action opens Chapter 12 rather than a duplicate example route.
- Chapter reset restores only its canonical source; a valid shared edit
  round-trips on that route; malformed or too-long sharing preserves existing
  behavior.
- Back/forward navigation and route disposal leave no stale preview or editor.
- Desktop and narrow layouts keep the teaser, chapter content, workbench tools,
  and pagination usable by pointer and keyboard.

### Visual evidence

Two intentional visual outcomes receive reviewed baselines:

1. the diagram-editor landing page with its final-result teaser and actions;
2. the canonical completed editor Canvas after stable fonts and two animation
   frames, before any user gesture.

Expected, actual, and diff output are inspected before any baseline update.
The public teaser image is captured from the same canonical final snapshot at
960 by 600 and checked separately from the page baseline. Platform-sensitive
font pixels may use an existing narrow documented mask only if semantic and
geometry assertions already prove the intended content.

### Commands

Focused iteration uses the smallest owning checks, including:

```sh
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 studio-docs:check
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 test:studio-docs
corepack pnpm@11.21.0 test:studio-visual
```

The final implementation runs the documented aggregate gate from a provisioned
Node 24.15-or-newer environment with pnpm 11.21.0 and Playwright Chromium:

```sh
corepack pnpm@11.21.0 trust
```

Fresh output, environment, and any intentionally changed visual baselines are
recorded in a dated field note. Historical suite totals are not reported as the
current result.

## Delivery order

Implementation proceeds in independently reviewable vertical slices:

1. add the isolated tutorial-snapshot catalog and shared workbench lookup;
2. derive and render tutorial relationships;
3. author Chapters 1-4 and their cumulative snapshots;
4. author Chapters 5-6 and their cumulative snapshots;
5. author Chapters 7-8 and their interaction evidence;
6. author Chapters 9-10 and their composition/capability evidence;
7. author Chapters 11-12 and their focus, hardening, and full-flow evidence;
8. replace the forthcoming landing page with the verified outcome-first
   experience and final capture;
9. complete Studio/browser/visual evidence, public indexes, durable notes, and
   the aggregate trust gate.

The landing teaser ships only when Chapter 12 exists and passes its focused
behavior checks, so the first-page promise never links to unfinished material.

## Acceptance criteria

The tutorial is complete when:

1. The landing page shows a verified image of the canonical finished editor
   before its syllabus and links directly to Chapter 1 and Chapter 12.
2. Twelve linked chapter pages preserve the approved syllabus order and each
   contain the required educational sections plus one complete independently
   runnable, editable, resettable, and shareable TSX snapshot.
3. The final snapshot matches the documented 960 by 600 editor composition and
   supports selection, captured node dragging, empty-space pan, pointer-anchored
   clamped zoom, view reset, clipped presentation, a retained grid layer, typed
   selection filtering, and logical keyboard navigation/activation.
4. Prose correctly distinguishes local/workspace/root coordinates, immediate
   rendering from explicit retained layers, model state from pixels, decorative
   versus interactive geometry, and logical focus from semantic accessibility.
5. Tutorial snapshots are validated learning sources but do not appear as
   ordinary Examples, independent search results, or Automated Test Labs.
6. Chapter order produces validated, accessible previous/next navigation with
   no manually contradictory progression.
7. All snapshots pass public-import, source-shape, type, mount, paint, and
   idempotent-disposal checks; the interaction chapters and final flow have
   semantic browser evidence.
8. The landing and final-editor visuals have reviewed evidence, the public
   teaser is captured from the canonical final snapshot, and no baseline is
   rewritten merely to clear a failure.
9. Existing learning examples, test labs, public search, canonical routes,
   workbench reset/share behavior, and page lifecycle remain intact.
10. Proportional focused checks and the fresh aggregate trust gate pass in the
    documented environment, with results recorded without stale test totals.
