# User Events and Focus Learning Examples Implementation Plan

> **Historical status: IMPLEMENTED PLAN.** Agent instructions and unchecked-looking task syntax below are preserved as dated evidence, not active work.

> **For agentic workers:** Implement the independent lesson families in parallel. Per the user's explicit workflow, do not run tests, builds, lint, formatting, or other verification until every lesson and all shared catalog/documentation integration are coded.

**Goal:** Make every public user-event, focus-management, keyboard-activation, and directional-navigation capability added in the 2026-08-28 work discoverable through the Pibbl Studio's documentation-backed learning examples.

**Architecture:** Keep the existing Studio contract: each lesson is a self-contained `packages/scenarios/src/learning/**/<slug>.example.ts` module whose default export mounts a public-API-only scene, while `learning-catalog.ts` supplies the rendered documentation. Group individual DOM handler names into coherent lessons so the catalog stays teachable while every supported name appears in lesson code or metadata. Shared section types, catalog registration, indexes, and stale mouse-only copy are integrated only after all independent lesson files exist.

**Tech Stack:** TypeScript, `@pibbl/core`, the existing `@pibbl/scenarios` learning catalog, Vite Studio.

**Specs:**

- `docs/design/user-events-contract.md`
- `docs/design/focus-and-keyboard-navigation-contract.md`
- `docs/design/canvas-accessibility-guidance.md`
- `docs/superpowers/specs/2026-08-28-dom-aligned-user-events-design.md`
- `docs/superpowers/specs/2026-08-28-focus-and-keyboard-navigation-design.md`

## Global Constraints

- Import every public capability from `@pibbl/core`; no deep imports.
- Use only public browser events and public Pibbl APIs in learning examples.
- Do not create persistent semantic descendants or imply that logical Canvas focus supplies screen-reader semantics.
- Each example must export `default function mount(canvas: HTMLCanvasElement): PibblController`.
- Each lesson must have a genuine interaction prompt and visible state or trace; avoid static API galleries.
- Preserve the existing public runtime and event contracts; this work adds examples and corrects documentation, not behavior.
- Do not run verification until every coding task below is complete.

---

### Task 1: Pointer, touch, wheel, and mouse-completion lessons

**Files:**

- Create: `packages/scenarios/src/learning/user-events/pointer-events.example.ts`
- Create: `packages/scenarios/src/learning/user-events/pointer-capture.example.ts`
- Create: `packages/scenarios/src/learning/user-events/touch-events.example.ts`
- Create: `packages/scenarios/src/learning/user-events/wheel.example.ts`
- Create: `packages/scenarios/src/learning/user-events/mouse-boundaries-and-auxiliary-click.example.ts`

**Coverage:**

- `onPointerOver`, `onPointerEnter`, `onPointerDown`, `onPointerMove`, `onPointerRawUpdate`, `onPointerUp`, `onPointerCancel`, `onPointerOut`, and `onPointerLeave` plus mouse/pen/touch pointer fields.
- `setPointerCapture`, `hasPointerCapture`, `releasePointerCapture`, `onGotPointerCapture`, and `onLostPointerCapture`.
- `onTouchStart`, `onTouchMove`, `onTouchEnd`, and `onTouchCancel`, including retained touch ownership and touch-list fields.
- `onWheel`, logical coordinates, delta fields, and cancellation.
- `onMouseEnter`, `onMouseLeave`, and `onAuxClick`; the pre-existing learning lessons continue to cover click, double-click, context menu, over/out, down/up, and move.

- [x] Create all five public-API lesson modules with visible event traces.
- [x] Return a file manifest and coverage notes without running verification.

### Task 2: Event routing, custom targets, and drag/drop lessons

**Files:**

- Create: `packages/scenarios/src/learning/user-events/propagation-and-cancellation.example.ts`
- Create: `packages/scenarios/src/learning/user-events/custom-event-targets.example.ts`
- Create: `packages/scenarios/src/learning/user-events/drag-and-drop.example.ts`

**Coverage:**

- Direct props and `Capture` props, capture/target/bubble phase ordering, `target`, `currentTarget`, `relatedTarget`, `eventPhase`, `composedPath()`, `preventDefault()`, `stopPropagation()`, and `stopImmediatePropagation()`.
- `useEventListener` as a pathless logical ancestor and `useEventTarget` as one explicit custom `Path2D` target with fill/stroke hit options and cursor ownership.
- `onDragStart`, `onDrag`, `onDragEnd`, `onDragEnter`, `onDragLeave`, `onDragOver`, and `onDrop`, including `dataTransfer`, logical coordinates, and required drag-over cancellation.

- [x] Create all three public-API lesson modules with visible routing or drag state.
- [x] Return a file manifest and coverage notes without running verification.

### Task 3: Focus, keyboard, directional, editing, and clipboard lessons

**Files:**

- Create: `packages/scenarios/src/learning/keyboard-focus/focus-management.example.ts`
- Create: `packages/scenarios/src/learning/keyboard-focus/keyboard-events-and-activation.example.ts`
- Create: `packages/scenarios/src/learning/keyboard-focus/directional-navigation.example.ts`
- Create: `packages/scenarios/src/learning/keyboard-focus/nested-directional-navigation.example.ts`
- Create: `packages/scenarios/src/learning/keyboard-focus/editing-composition-and-clipboard.example.ts`

**Coverage:**

- `withFocusManagement`, automatic enrollment through click/key handlers, explicit `keyboardFocusable: true` and `false`, pointer focus, Tab/Shift+Tab traversal, and DOM entry/exit.
- `onFocus`, `onBlur`, `onFocusIn`, `onFocusOut`, capture/bubble distinctions, `relatedTarget`, `isFocused`, and `isFocusVisible`.
- `onKeyDown`, `onKeyUp`, keyboard fields, default prevention, Enter activation, Space activation, and `sourceEvent`.
- `withKeyboardNavigation`, `keyboardNavigationBounds`, arrows, row-major source-order Tab traversal, non-wrapping edges, nearest nested boundary containment, and a form-like cell that consumes arrows with `preventDefault()`.
- `onBeforeInput`, `onInput`, `onChange`, `onCompositionStart`, `onCompositionUpdate`, `onCompositionEnd`, `onSelect`, `onSelectionChange`, `onCopy`, `onCut`, and `onPaste`, with explicit copy that a plain Canvas is transport rather than an editable semantic control.

- [x] Create all five public-API lesson modules with visible focus, activation, navigation, or event traces.
- [x] Return a file manifest and coverage notes without running verification.

### Task 4: Shared Studio documentation and catalog integration

**Files:**

- Modify: `packages/scenarios/src/learning-types.ts`
- Modify: `packages/scenarios/src/learning-catalog.ts`
- Modify: `docs/scenario-index.md`
- Modify: `README.md`
- Modify as needed: existing mouse-event lesson metadata whose copy still says Pibbl is mouse-only or omits logical related targets/propagation.

**Interfaces:**

- Add `user-events` and `keyboard-focus` learning sections.
- Register all thirteen new lesson modules with unique slugs, orders, API-name coverage, exactly two objectives, interaction/code prompts, accurate API notes, and related-example links.
- Keep the Studio's current metadata-rendered documentation model; do not add a second documentation framework.

- [x] Integrate the complete lesson catalog after Tasks 1-3 finish.
- [x] Audit every public event type and both focus enhancers against catalog API tags and lesson source.
- [x] Correct stale public copy and add learning-example guidance to the implemented contracts.
- [x] Finish all coding before beginning Task 5.

### Task 5: Deferred verification after all coding

**Order:**

1. Catalog and source-path consistency.
2. Scenario and playground type checking.
3. Formatting and lint checks, applying mechanical formatting only after the first diagnostic pass.
4. Scenario/package and Studio builds.
5. Focused browser interaction checks for each new family.
6. Packed public-consumer checks.
7. Full `corepack pnpm@11.21.0 trust` aggregate gate on Node 24.15 or newer.

- [x] Run each verification layer only after Tasks 1-4 are complete.
- [x] Fix failures by family and rerun the affected layer before advancing.
- [x] Run the full aggregate gate and report fresh counts/output.
