import type { PibblHitTestOutput } from './paint-entry.js';
import type { isBackendEventTargetLive, useBackendEventTarget } from '../../internal.js';
import { PIBBL_EVENT_DEFINITIONS } from "./event-definitions.js";
import type {
  PibblEventHandler,
  PibblEventHandlers,
  PibblEventTarget,
  PibblEventTargetOptions,
  PibblEventType,
} from "./types.js";
import { GLOBAL_STATE } from "../global-state.js";
import { resolvePath } from '../geometry/resolve-path.js';
import type { PathGeometry } from '../geometry/path-geometry.js';
import type { LayoutBox } from "../layout/types.js";
import { getCurrentWorldTransform } from "../render-target.js";
import type {
  PibblComponentRefs,
  PibblInstance,
} from "../types.js";
import { PibblPaintEntryKind, type PibblPathPaintEntry } from "./paint-entry.js";
import {
  clearPointerCapturesForTarget,
  hasLogicalPointerCapture,
  releaseLogicalPointerCapture,
  setLogicalPointerCapture,
} from "./pointer-capture.js";

type PibblNormalizedCaptureKey = `${PibblEventType}Capture`;

export type PibblNormalizedHandlers = Partial<
  {
    [K in PibblEventType]: PibblEventHandler<K>;
  } & {
    [K in PibblEventType as `${K}Capture`]: PibblEventHandler<K>;
  }
>;

/**
 * Mount-owned event target registration and cleanup state.
 *
 * @see {@link PibblEventTarget}
 * @see {@link LayoutBox}
 * @see {@link PibblHitTestOutput}
 * @see {@link useBackendEventTarget}
 * @see {@link isBackendEventTargetLive}
 */
export interface PibblEventTargetRegistration {
  /** Selects the kind of geometry, material, or result. See {@link PibblEventTargetRegistration}. */
  readonly kind: "target";
  /** Mount or runtime resource owning this registration. See {@link PibblInstance}. */
  readonly owner: PibblInstance;
  /**
   * Component identity or diagnostic name associated with this value. See {@link PibblComponentRefs}
   * .
   */
  readonly component: PibblComponentRefs<any>;
  /** Mount-local hook or registration slot. See {@link PibblEventTargetRegistration}. */
  readonly slot: number;
  /** Logical target exposed to application event handlers. See {@link PibblEventTarget}. */
  readonly publicTarget: PibblEventTarget;
  /** Paint-ledger entry associated with this registration. See {@link PibblPathPaintEntry}. */
  paintEntry: PibblPathPaintEntry | undefined;
  /** Event handlers dispatched for this logical target. See {@link PibblNormalizedHandlers}. */
  handlers: PibblNormalizedHandlers;
  /** Logical event types currently present in `handlers`, split across two 32-bit words. */
  handlerTypesLow: number;
  /**
   * High event-mask bits identifying registered handler types. See
   * {@link PibblEventTargetRegistration}.
   */
  handlerTypesHigh: number;
  /** Native event dependency signature derived from the current handlers and cursor. */
  requiredNativeTypesLow: number;
  /**
   * High event-mask bits identifying required native listeners. See
   * {@link PibblEventTargetRegistration}.
   */
  requiredNativeTypesHigh: number;
  /** Last native signature reconciled with `nativeReleases`. */
  ownedNativeTypesLow: number;
  /**
   * High event-mask bits identifying native listeners owned by this registration. See
   * {@link PibblEventTargetRegistration}.
   */
  ownedNativeTypesHigh: number;
  /**
   * Cursor shown while this target owns pointer presentation. See
   * {@link PibblEventTargetRegistration}.
   */
  cursor: string | undefined;
  /** Whether the target may receive keyboard focus. See {@link PibblEventTargetRegistration}. */
  keyboardFocusable: boolean | undefined;
  /** Logical rectangle used for directional keyboard navigation. See {@link LayoutBox}. */
  keyboardNavigationBounds: Readonly<LayoutBox> | undefined;
  /** @internal Backend-projected points retained until root-space resolution. */
  keyboardNavigationPoints:
    | readonly Readonly<{
        /**
         * Horizontal coordinate or displacement in the containing coordinate system. See
         * {@link PibblEventTargetRegistration}.
         */
        x: number;
        /**
         * Vertical coordinate or displacement in the containing coordinate system. See
         * {@link PibblEventTargetRegistration}.
         */
        y: number;
      }>[]
    | undefined;
  /**
   * Whether this registration is currently attached to a live owner. See
   * {@link PibblEventTargetRegistration}.
   */
  live: boolean;
}

export interface PibblEventListenerRegistration {
  readonly kind: "listener";
  readonly owner: PibblInstance;
  readonly component: PibblComponentRefs<any>;
  readonly slot: number;
  readonly publicTarget: PibblEventTarget;
  handlers: PibblNormalizedHandlers;
  /** Logical event types currently present in `handlers`, split across two 32-bit words. */
  handlerTypesLow: number;
  handlerTypesHigh: number;
  /** Native event dependency signature derived from the current handlers. */
  requiredNativeTypesLow: number;
  requiredNativeTypesHigh: number;
  /** Last native signature reconciled with `nativeReleases`. */
  ownedNativeTypesLow: number;
  ownedNativeTypesHigh: number;
  live: boolean;
}

export type PibblEventNode =
  PibblEventTargetRegistration | PibblEventListenerRegistration;

// Masks make membership/diff checks cheap; this map retains the exact release
// closure returned by the shared hub for each bit that was actually acquired.
const nativeReleases = new WeakMap<
  PibblEventTargetRegistration | PibblEventListenerRegistration,
  Map<PibblEventType, () => void>
>();

export function createTarget(
  owner: PibblInstance,
  component: PibblComponentRefs<any>,
  slot: number,
): PibblEventTargetRegistration {
  const target = {} as PibblEventTargetRegistration;
  const publicTarget = createPublicTarget(() => target);
  Object.assign(target, {
    kind: "target" as const,
    owner,
    component,
    slot,
    publicTarget,
    paintEntry: undefined,
    handlers: {},
    handlerTypesLow: 0,
    handlerTypesHigh: 0,
    requiredNativeTypesLow: 0,
    requiredNativeTypesHigh: 0,
    ownedNativeTypesLow: 0,
    ownedNativeTypesHigh: 0,
    cursor: undefined,
    keyboardFocusable: undefined,
    keyboardNavigationBounds: undefined,
    keyboardNavigationPoints: undefined,
    live: false,
  });
  return target;
}

export function updateTarget(
  target: PibblEventTargetRegistration,
  handlers: PibblEventHandlers,
  options: PibblEventTargetOptions,
  participatesInPaint = false,
  preserveKeyboardNavigationGeometry = false,
): void {
  updateTargetRegistration(
    target,
    handlers,
    { ...options, path: resolvePath(options.path) },
    participatesInPaint,
    preserveKeyboardNavigationGeometry,
  );
  if (target.live) target.owner.regions.add(target);
}

export function updateCursorTarget(
  target: PibblEventTargetRegistration,
  {
    path,
    fill = false,
    lineInteractionWidth = 0,
    cursor,
  }: {
    path: Path2D | PathGeometry;
    fill?: boolean;
    lineInteractionWidth?: number;
    cursor?: string;
  },
): void {
  updateTargetRegistration(
    target,
    {},
    {
      path: resolvePath(path),
      fill,
      lineInteractionWidth,
      cursor,
    },
  );
  if (target.live) target.owner.regions.add(target);
}

function updateTargetRegistration(
  target: PibblEventTargetRegistration,
  handlers: PibblEventHandlers,
  options: Omit<PibblEventTargetOptions, 'path'> & { readonly path: Path2D },
  participatesInPaint = false,
  preserveKeyboardNavigationGeometry = false,
): void {
  if (target.live) {
    // Remove while the previous handler map is still current so ownership
    // diagnostics and mutation observers attribute the release correctly.
    if (target.paintEntry) target.owner.paintEntries.delete(target.paintEntry);
    target.owner.eventRoot.targets.delete(target);
  }

  refreshHandlers(target, handlers, Boolean(options.cursor));
  const paintEntry =
    target.paintEntry ??
    ({
      paintKind: PibblPaintEntryKind.Path,
    } as PibblPathPaintEntry);
  paintEntry.target = target;
  paintEntry.path = options.path;
  paintEntry.fill = options.fill ?? false;
  paintEntry.lineInteractionWidth = options.lineInteractionWidth ?? 0;
  if (GLOBAL_STATE.renderContext) {
    paintEntry.transform = getCurrentWorldTransform();
    paintEntry.clippingStack = Array.from(GLOBAL_STATE.clippingStack);
  } else {
    paintEntry.transform ??= new DOMMatrix();
    paintEntry.clippingStack ??= [];
  }
  target.cursor = options.cursor;
  target.keyboardFocusable = options.keyboardFocusable;
  if (!preserveKeyboardNavigationGeometry) {
    target.keyboardNavigationBounds = options.keyboardNavigationBounds;
    target.keyboardNavigationPoints = undefined;
  }

  if (
    !participatesInPaint &&
    target.handlerTypesLow === 0 &&
    target.handlerTypesHigh === 0 &&
    !target.cursor &&
    target.keyboardFocusable !== true
  ) {
    if (target.live) {
      target.owner.eventRoot.focusPolicy?.removeTarget(target);
      target.owner.eventRoot.onNodeRelease?.(target);
    }
    target.owner.regions.delete(target);
    target.paintEntry = undefined;
    target.live = false;
    clearPointerCapturesForTarget(target);
    releaseNativeOwnership(target);
    return;
  }

  target.live = true;
  target.paintEntry = paintEntry;
  target.owner.paintEntries.add(paintEntry);
  target.owner.eventRoot.targets.add(target);
  updateNativeOwnership(target);
  target.owner.eventRoot.focusPolicy?.observeTarget(target);
  target.owner.eventRoot.onTargetUpdate?.(target);
}

export function releaseTarget(target: PibblEventTargetRegistration): void {
  if (target.live) {
    if (target.paintEntry) target.owner.paintEntries.delete(target.paintEntry);
    target.owner.eventRoot.targets.delete(target);
    target.owner.eventRoot.focusPolicy?.removeTarget(target);
    target.owner.eventRoot.onNodeRelease?.(target);
  }
  target.owner.regions.delete(target);
  target.paintEntry = undefined;
  target.live = false;
  clearPointerCapturesForTarget(target);
  releaseNativeOwnership(target);
}

export function createListener(
  owner: PibblInstance,
  component: PibblComponentRefs<any>,
  slot: number,
): PibblEventListenerRegistration {
  const listener = {} as PibblEventListenerRegistration;
  const publicTarget = createPublicTarget(() => listener);
  Object.assign(listener, {
    kind: "listener",
    owner,
    component,
    slot,
    publicTarget,
    handlers: {},
    handlerTypesLow: 0,
    handlerTypesHigh: 0,
    requiredNativeTypesLow: 0,
    requiredNativeTypesHigh: 0,
    ownedNativeTypesLow: 0,
    ownedNativeTypesHigh: 0,
    live: false,
  });
  return listener;
}

export function updateListener(
  listener: PibblEventListenerRegistration,
  handlers: PibblEventHandlers,
): void {
  let registrations = listener.owner.eventRoot.listenersByComponent.get(
    listener.component.id,
  );
  if (listener.live) {
    // Keep the registration stable while refreshing its current source-order
    // position and preserving the previous handler map for release observers.
    registrations?.delete(listener);
  }
  refreshHandlers(listener, handlers, false);

  if (listener.handlerTypesLow === 0 && listener.handlerTypesHigh === 0) {
    if (registrations?.size === 0) {
      listener.owner.eventRoot.listenersByComponent.delete(
        listener.component.id,
      );
    }
    if (listener.live) listener.owner.eventRoot.onNodeRelease?.(listener);
    listener.live = false;
    clearPointerCapturesForTarget(listener);
    releaseNativeOwnership(listener);
    return;
  }

  if (!registrations) {
    registrations = new Set();
    listener.owner.eventRoot.listenersByComponent.set(
      listener.component.id,
      registrations,
    );
  }
  registrations.add(listener);
  listener.live = true;
  updateNativeOwnership(listener);
}

export function releaseListener(listener: PibblEventListenerRegistration): void {
  if (listener.live) {
    const registrations = listener.owner.eventRoot.listenersByComponent.get(
      listener.component.id,
    );
    registrations?.delete(listener);
    if (registrations?.size === 0) {
      listener.owner.eventRoot.listenersByComponent.delete(
        listener.component.id,
      );
    }
    listener.owner.eventRoot.onNodeRelease?.(listener);
  }
  listener.live = false;
  clearPointerCapturesForTarget(listener);
  releaseNativeOwnership(listener);
}

export function normalizeHandlers(
  handlers: PibblEventHandlers,
): PibblNormalizedHandlers {
  const state = createHandlerState();
  refreshHandlers(state, handlers, false);
  return state.handlers;
}

interface PibblHandlerState {
  handlers: PibblNormalizedHandlers;
  handlerTypesLow: number;
  handlerTypesHigh: number;
  requiredNativeTypesLow: number;
  requiredNativeTypesHigh: number;
}

interface PibblEventPropMetadata {
  readonly normalizedKey: PibblEventType | PibblNormalizedCaptureKey;
  readonly handlerTypesLow: number;
  readonly handlerTypesHigh: number;
  readonly requiredNativeTypesLow: number;
  readonly requiredNativeTypesHigh: number;
}

/**
 * Hot-path property lookup built once from the closed event vocabulary.
 *
 * Each definition owns one bit position. JavaScript bitwise operators use
 * signed 32-bit integers, but sign is irrelevant here: the words are opaque
 * bit sets compared and combined only with bitwise operations.
 */
const eventPropMetadata = Object.create(null) as Record<
  string,
  PibblEventPropMetadata | undefined
>;
const eventIndexByType = Object.create(null) as Record<
  string,
  number | undefined
>;

if (PIBBL_EVENT_DEFINITIONS.length > 64) {
  throw new Error("Pibbl event masks support at most 64 logical event types.");
}

for (let index = 0; index < PIBBL_EVENT_DEFINITIONS.length; index++) {
  eventIndexByType[PIBBL_EVENT_DEFINITIONS[index]!.type] = index;
}

for (let index = 0; index < PIBBL_EVENT_DEFINITIONS.length; index++) {
  const definition = PIBBL_EVENT_DEFINITIONS[index]!;
  const handlerTypesLow = index < 32 ? 1 << index : 0;
  const handlerTypesHigh = index < 32 ? 0 : 1 << (index - 32);
  // Expand logical-to-native prerequisites once. The render path only ORs
  // these precomputed words and never allocates dependency Sets.
  const nativeTypes = expandNativeTypesForMetadata(
    new Set([definition.type]),
    false,
  );
  let requiredNativeTypesLow = 0;
  let requiredNativeTypesHigh = 0;
  for (const type of nativeTypes) {
    const nativeIndex = eventIndexByType[type]!;
    if (nativeIndex < 32) {
      requiredNativeTypesLow |= 1 << nativeIndex;
    } else {
      requiredNativeTypesHigh |= 1 << (nativeIndex - 32);
    }
  }
  const bubble: PibblEventPropMetadata = Object.freeze({
    normalizedKey: definition.type,
    handlerTypesLow,
    handlerTypesHigh,
    requiredNativeTypesLow,
    requiredNativeTypesHigh,
  });
  const capture: PibblEventPropMetadata = Object.freeze({
    ...bubble,
    normalizedKey: `${definition.type}Capture` as PibblNormalizedCaptureKey,
  });
  eventPropMetadata[definition.prop] = bubble;
  eventPropMetadata[definition.captureProp] = capture;
}

// Cursor tracking has native movement/exit requirements even without a
// logical callback, so it receives the same precomputed representation.
const cursorNativeTypes = expandNativeTypesForMetadata(new Set(), true);
let cursorNativeTypesLow = 0;
let cursorNativeTypesHigh = 0;
for (const type of cursorNativeTypes) {
  const index = eventIndexByType[type]!;
  if (index < 32) {
    cursorNativeTypesLow |= 1 << index;
  } else {
    cursorNativeTypesHigh |= 1 << (index - 32);
  }
}

function createHandlerState(): PibblHandlerState {
  return {
    handlers: {},
    handlerTypesLow: 0,
    handlerTypesHigh: 0,
    requiredNativeTypesLow: 0,
    requiredNativeTypesHigh: 0,
  };
}

function refreshHandlers(
  state: PibblHandlerState,
  handlers: PibblEventHandlers,
  hasCursor: boolean,
): void {
  const normalized: PibblNormalizedHandlers = {};
  let handlerTypesLow = 0;
  let handlerTypesHigh = 0;
  let requiredNativeTypesLow = hasCursor ? cursorNativeTypesLow : 0;
  let requiredNativeTypesHigh = hasCursor ? cursorNativeTypesHigh : 0;
  // Iterate supplied props rather than probing every supported bubble and
  // capture name. Keep the normalized object fresh so dispatch always sees
  // the newest closures even when the type signature is unchanged.
  for (const prop in handlers) {
    const metadata = eventPropMetadata[prop];
    if (!metadata) continue;
    const handler = handlers[prop as keyof PibblEventHandlers];
    if (handler) {
      (normalized as Record<string, unknown>)[metadata.normalizedKey] = handler;
      handlerTypesLow |= metadata.handlerTypesLow;
      handlerTypesHigh |= metadata.handlerTypesHigh;
      requiredNativeTypesLow |= metadata.requiredNativeTypesLow;
      requiredNativeTypesHigh |= metadata.requiredNativeTypesHigh;
    }
  }
  state.handlers = normalized;
  state.handlerTypesLow = handlerTypesLow;
  state.handlerTypesHigh = handlerTypesHigh;
  state.requiredNativeTypesLow = requiredNativeTypesLow;
  state.requiredNativeTypesHigh = requiredNativeTypesHigh;
}

/**
 * Cold module-initialization helper. Do not call this from registration or
 * render code: its Sets deliberately trade startup simplicity for precomputed
 * allocation-free metadata in the hot path.
 */
function expandNativeTypesForMetadata(
  types: ReadonlySet<PibblEventType>,
  hasCursor: boolean,
): ReadonlySet<PibblEventType> {
  const nativeTypes = new Set(types);
  const hasPointerBoundary =
    types.has("pointerover") ||
    types.has("pointerenter") ||
    types.has("pointerout") ||
    types.has("pointerleave");
  if (hasPointerBoundary || types.has("pointermove")) {
    nativeTypes.delete("pointerenter");
    nativeTypes.delete("pointerleave");
    nativeTypes.add("pointermove");
    nativeTypes.add("pointerout");
    if (hasPointerBoundary) nativeTypes.add("pointerover");
  }
  if (
    hasCursor ||
    types.has("mouseover") ||
    types.has("mouseenter") ||
    types.has("mousemove") ||
    types.has("mouseout") ||
    types.has("mouseleave")
  ) {
    nativeTypes.delete("mouseover");
    nativeTypes.delete("mouseenter");
    nativeTypes.delete("mouseleave");
    nativeTypes.add("mousemove");
    nativeTypes.add("mouseout");
  }
  if (types.has("click") || types.has("dblclick") || types.has("auxclick")) {
    nativeTypes.add("mousedown");
    nativeTypes.add("mouseup");
  }
  if (types.has("dblclick")) nativeTypes.add("click");
  if (
    types.has("touchstart") ||
    types.has("touchmove") ||
    types.has("touchend") ||
    types.has("touchcancel")
  ) {
    nativeTypes.add("touchstart");
    nativeTypes.add("touchend");
    nativeTypes.add("touchcancel");
  }
  const hasDragBoundary = types.has("dragenter") || types.has("dragleave");
  if (hasDragBoundary) nativeTypes.add("dragenter");
  if (hasDragBoundary || types.has("dragover")) {
    nativeTypes.add("dragover");
    nativeTypes.add("dragleave");
    nativeTypes.add("drop");
    nativeTypes.add("dragend");
  }
  return nativeTypes;
}

function updateNativeOwnership(
  registration: PibblEventTargetRegistration | PibblEventListenerRegistration,
): void {
  const previousLow = registration.ownedNativeTypesLow;
  const previousHigh = registration.ownedNativeTypesHigh;
  const nextLow = registration.requiredNativeTypesLow;
  const nextHigh = registration.requiredNativeTypesHigh;
  // Callback values may change every render while their native requirements
  // remain identical. Two integer comparisons make that common case a no-op.
  if (previousLow === nextLow && previousHigh === nextHigh) return;

  let releases = nativeReleases.get(registration);
  if (!releases) {
    releases = new Map();
    nativeReleases.set(registration, releases);
  }

  // A & ~B is the set difference A − B. Release all removals before
  // acquiring additions so hub reference counts always describe this target's
  // current requirement transition.
  forEachChangedType(
    previousLow & ~nextLow,
    previousHigh & ~nextHigh,
    (type) => {
      releases.get(type)?.();
      releases.delete(type);
    },
  );

  const hub = registration.owner.eventRoot.nativeListeners;
  if (hub) {
    // B & ~A is B − A: only newly required native types are acquired.
    forEachChangedType(
      nextLow & ~previousLow,
      nextHigh & ~previousHigh,
      (type) => {
        if (!releases.has(type)) releases.set(type, hub.acquire(type));
      },
    );
  }
  registration.ownedNativeTypesLow = nextLow;
  registration.ownedNativeTypesHigh = nextHigh;
}

function releaseNativeOwnership(
  registration: PibblEventTargetRegistration | PibblEventListenerRegistration,
): void {
  // Zero first so a stable hook slot revived after release cannot mistake its
  // old signature for live ownership and skip reacquisition.
  registration.ownedNativeTypesLow = 0;
  registration.ownedNativeTypesHigh = 0;
  const releases = nativeReleases.get(registration);
  if (!releases) return;
  nativeReleases.delete(registration);
  for (const release of releases.values()) {
    release();
  }
  releases.clear();
}

function forEachChangedType(
  low: number,
  high: number,
  visit: (type: PibblEventType) => void,
): void {
  // `word & -word` isolates the least-significant set bit. `word & (word - 1)`
  // clears it, so this loop is O(number of changed types), not O(52 events).
  // Math.clz32 converts the isolated bit to its definition index; the high
  // word starts at definition 32.
  while (low !== 0) {
    const bit = low & -low;
    visit(PIBBL_EVENT_DEFINITIONS[31 - Math.clz32(bit)]!.type);
    low &= low - 1;
  }
  while (high !== 0) {
    const bit = high & -high;
    visit(PIBBL_EVENT_DEFINITIONS[32 + 31 - Math.clz32(bit)]!.type);
    high &= high - 1;
  }
}

function createPublicTarget(
  getRegistration: () => PibblEventNode,
): PibblEventTarget {
  return {
    setPointerCapture(pointerId) {
      setLogicalPointerCapture(getRegistration(), pointerId);
    },
    hasPointerCapture(pointerId) {
      return hasLogicalPointerCapture(getRegistration(), pointerId);
    },
    releasePointerCapture(pointerId) {
      releaseLogicalPointerCapture(getRegistration(), pointerId);
    },
  };
}
