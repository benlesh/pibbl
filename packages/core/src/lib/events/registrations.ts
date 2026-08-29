import { CRC_EVENT_DEFINITIONS } from './event-definitions.js';
import type {
  CRCEventHandler,
  CRCEventHandlers,
  CRCEventTarget,
  CRCEventTargetOptions,
  CRCEventType,
} from './types.js';
import { GLOBAL_STATE } from '../global-state.js';
import type { LayoutBox } from '../layout/types.js';
import {
  getSurfaceSnapshot,
  toLogicalTransform,
} from '../surface/transform.js';
import type {
  CompRefs,
  CRCClippingStackEntry,
  CRCInstance,
  CRCRegionHandlers,
} from '../types.js';
import { requiredLegacyRegionTypes } from './legacy-native-listener-bridge.js';

type CRCNormalizedCaptureKey = `${CRCEventType}Capture`;

export type CRCNormalizedHandlers = Partial<{
  [K in CRCEventType]: CRCEventHandler<K>;
} & {
  [K in CRCEventType as `${K}Capture`]: CRCEventHandler<K>;
}>;

export interface CRCEventTargetRegistration {
  readonly kind: 'target';
  readonly owner: CRCInstance;
  readonly component: CompRefs<any>;
  readonly slot: number;
  readonly publicTarget: CRCEventTarget;
  handlers: CRCNormalizedHandlers;
  path: Path2D;
  fill: boolean;
  lineInteractionWidth: number;
  transform: DOMMatrix;
  clippingStack: readonly CRCClippingStackEntry[];
  cursor: string | undefined;
  keyboardFocusable: boolean | undefined;
  keyboardNavigationBounds: Readonly<LayoutBox> | undefined;
  live: boolean;
}

export interface CRCEventListenerRegistration {
  readonly kind: 'listener';
  readonly owner: CRCInstance;
  readonly component: CompRefs<any>;
  readonly slot: number;
  readonly publicTarget: CRCEventTarget;
  handlers: CRCNormalizedHandlers;
  live: boolean;
}

export type CRCEventNode =
  | CRCEventTargetRegistration
  | CRCEventListenerRegistration;

export interface CRCLegacyTargetAdapter {
  readonly handlers: CRCRegionHandlers;
  readonly path: Path2D | undefined;
}

const nativeReleases = new WeakMap<
  CRCEventTargetRegistration | CRCEventListenerRegistration,
  Map<CRCEventType, () => void>
>();
const legacyTargetAdapters = new WeakMap<
  CRCEventTargetRegistration,
  CRCLegacyTargetAdapter
>();

export function createTarget(
  owner: CRCInstance,
  component: CompRefs<any>,
  slot: number,
): CRCEventTargetRegistration {
  const target = {} as CRCEventTargetRegistration;
  const publicTarget = createPublicTarget(owner, () => target);
  Object.assign(target, {
    kind: 'target' as const,
    owner,
    component,
    slot,
    publicTarget,
    handlers: {},
    path: new Path2D(),
    fill: false,
    lineInteractionWidth: 0,
    transform: new DOMMatrix(),
    clippingStack: [],
    cursor: undefined,
    keyboardFocusable: undefined,
    keyboardNavigationBounds: undefined,
    live: false,
  });
  return target;
}

export function updateTarget(
  target: CRCEventTargetRegistration,
  handlers: CRCEventHandlers,
  options: CRCEventTargetOptions,
): void {
  const normalizedHandlers = normalizeHandlers(handlers);
  const types = handledTypes(normalizedHandlers);
  legacyTargetAdapters.delete(target);
  updateTargetRegistration(
    target,
    normalizedHandlers,
    options,
    typesWithCursor(types, options.cursor),
  );
}

/** @internal Temporary adapter for shipped mouse-region semantics. */
export function updateLegacyTarget(
  target: CRCEventTargetRegistration,
  handlers: CRCRegionHandlers,
  {
    path,
    fill = false,
    lineInteractionWidth = 0,
    cursor,
  }: {
    path?: Path2D;
    fill?: boolean;
    lineInteractionWidth?: number;
    cursor?: string;
  },
): void {
  configureLegacyTargetAdapter(target, handlers, path);
  updateTargetRegistration(
    target,
    normalizeLegacyHandlers(handlers),
    {
      path: path ?? target.path,
      fill,
      lineInteractionWidth,
      cursor,
    },
    requiredLegacyRegionTypes(handlers, Boolean(cursor)),
  );
  if (target.live) target.owner.regions.add(target);
}

/** @internal Used by the temporary dispatcher and its direct unit harness. */
function configureLegacyTargetAdapter(
  target: CRCEventTargetRegistration,
  handlers: CRCRegionHandlers,
  path: Path2D | undefined,
): void {
  legacyTargetAdapters.set(target, { handlers, path });
}

/** @internal Removed with the legacy dispatcher migration. */
export function getLegacyTargetAdapter(
  target: CRCEventTargetRegistration,
): CRCLegacyTargetAdapter | undefined {
  return legacyTargetAdapters.get(target);
}

function updateTargetRegistration(
  target: CRCEventTargetRegistration,
  normalizedHandlers: CRCNormalizedHandlers,
  options: CRCEventTargetOptions,
  nativeTypes: ReadonlySet<CRCEventType>,
): void {
  const types = handledTypes(normalizedHandlers);

  if (target.live) {
    // Remove while the previous handler map is still current so ownership
    // diagnostics and mutation observers attribute the release correctly.
    target.owner.paintEntries.delete(target);
    target.owner.eventRoot.targets.delete(target);
  }

  target.handlers = normalizedHandlers;
  target.path = options.path;
  target.fill = options.fill ?? false;
  target.lineInteractionWidth = options.lineInteractionWidth ?? 0;
  if (GLOBAL_STATE.renderContext) {
    target.transform = toLogicalTransform(
      getSurfaceSnapshot(target.owner),
      GLOBAL_STATE.renderContext.getTransform(),
    );
    target.clippingStack = Array.from(GLOBAL_STATE.clippingStack);
  }
  target.cursor = options.cursor;
  target.keyboardFocusable = options.keyboardFocusable;
  target.keyboardNavigationBounds = options.keyboardNavigationBounds;

  if (
    types.size === 0 &&
    !target.cursor &&
    target.keyboardFocusable !== true
  ) {
    if (target.live) {
      target.owner.eventRoot.focusPolicy?.removeTarget?.(target);
    }
    target.live = false;
    releasePointerCaptures(target);
    releaseNativeOwnership(target);
    return;
  }

  target.live = true;
  target.owner.paintEntries.add(target);
  target.owner.eventRoot.targets.add(target);
  updateNativeOwnership(target, nativeTypes);
  target.owner.eventRoot.focusPolicy?.observeTarget?.(target);
}

export function releaseTarget(target: CRCEventTargetRegistration): void {
  if (target.live) {
    target.owner.paintEntries.delete(target);
    target.owner.eventRoot.targets.delete(target);
    target.owner.eventRoot.focusPolicy?.removeTarget?.(target);
  }
  target.live = false;
  releasePointerCaptures(target);
  releaseNativeOwnership(target);
  legacyTargetAdapters.delete(target);
}

export function createListener(
  owner: CRCInstance,
  component: CompRefs<any>,
  slot: number,
): CRCEventListenerRegistration {
  const listener = {} as CRCEventListenerRegistration;
  const publicTarget = createPublicTarget(owner, () => listener);
  Object.assign(listener, {
    kind: 'listener',
    owner,
    component,
    slot,
    publicTarget,
    handlers: {},
    live: false,
  });
  return listener;
}

export function updateListener(
  listener: CRCEventListenerRegistration,
  handlers: CRCEventHandlers,
): void {
  const normalizedHandlers = normalizeHandlers(handlers);
  const types = handledTypes(normalizedHandlers);
  let registrations = listener.owner.eventRoot.listenersByComponent.get(
    listener.component.id,
  );
  if (listener.live) {
    // Keep the registration stable while refreshing its current source-order
    // position and preserving the previous handler map for release observers.
    registrations?.delete(listener);
  }
  listener.handlers = normalizedHandlers;

  if (types.size === 0) {
    if (registrations?.size === 0) {
      listener.owner.eventRoot.listenersByComponent.delete(listener.component.id);
    }
    listener.live = false;
    releasePointerCaptures(listener);
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
  updateNativeOwnership(listener, types);
}

export function releaseListener(listener: CRCEventListenerRegistration): void {
  if (listener.live) {
    const registrations = listener.owner.eventRoot.listenersByComponent.get(
      listener.component.id,
    );
    registrations?.delete(listener);
    if (registrations?.size === 0) {
      listener.owner.eventRoot.listenersByComponent.delete(listener.component.id);
    }
  }
  listener.live = false;
  releasePointerCaptures(listener);
  releaseNativeOwnership(listener);
}

export function normalizeHandlers(
  handlers: CRCEventHandlers,
): CRCNormalizedHandlers {
  const normalized: CRCNormalizedHandlers = {};
  for (const definition of CRC_EVENT_DEFINITIONS) {
    const bubble = handlers[definition.prop];
    const capture = handlers[definition.captureProp];
    if (bubble) {
      Object.assign(normalized, { [definition.type]: bubble });
    }
    if (capture) {
      Object.assign(normalized, {
        [`${definition.type}Capture`]: capture,
      });
    }
  }
  return normalized;
}

function normalizeLegacyHandlers(
  handlers: CRCRegionHandlers,
): CRCNormalizedHandlers {
  const normalized: CRCNormalizedHandlers = {};
  for (const [type, handler] of Object.entries(handlers)) {
    if (handler) {
      Object.assign(normalized, { [type]: handler });
    }
  }
  return normalized;
}

function handledTypes(handlers: CRCNormalizedHandlers): Set<CRCEventType> {
  const types = new Set<CRCEventType>();
  for (const definition of CRC_EVENT_DEFINITIONS) {
    if (
      handlers[definition.type] ||
      handlers[`${definition.type}Capture` as CRCNormalizedCaptureKey]
    ) {
      types.add(definition.type);
    }
  }
  return types;
}

function typesWithCursor(
  types: ReadonlySet<CRCEventType>,
  cursor: string | undefined,
): ReadonlySet<CRCEventType> {
  if (!cursor) return types;
  return new Set<CRCEventType>([...types, 'mousemove', 'mouseout']);
}

function updateNativeOwnership(
  registration: CRCEventTargetRegistration | CRCEventListenerRegistration,
  types: ReadonlySet<CRCEventType>,
): void {
  let releases = nativeReleases.get(registration);
  if (!releases) {
    releases = new Map();
    nativeReleases.set(registration, releases);
  }

  for (const [type, release] of releases) {
    if (!types.has(type)) {
      release();
      releases.delete(type);
    }
  }

  const hub = registration.owner.eventRoot.nativeListeners;
  if (!hub) return;
  for (const type of types) {
    if (!releases.has(type)) {
      releases.set(type, hub.acquire(type));
    }
  }
}

function releaseNativeOwnership(
  registration: CRCEventTargetRegistration | CRCEventListenerRegistration,
): void {
  const releases = nativeReleases.get(registration);
  if (!releases) return;
  nativeReleases.delete(registration);
  for (const release of releases.values()) {
    release();
  }
  releases.clear();
}

function createPublicTarget(
  owner: CRCInstance,
  getRegistration: () => CRCEventNode,
): CRCEventTarget {
  return {
    setPointerCapture(pointerId) {
      const registration = getRegistration();
      if (registration.live) {
        owner.eventRoot.pointerCaptures.set(pointerId, registration);
      }
    },
    hasPointerCapture(pointerId) {
      return owner.eventRoot.pointerCaptures.get(pointerId) === getRegistration();
    },
    releasePointerCapture(pointerId) {
      if (owner.eventRoot.pointerCaptures.get(pointerId) === getRegistration()) {
        owner.eventRoot.pointerCaptures.delete(pointerId);
      }
    },
  };
}

function releasePointerCaptures(registration: CRCEventNode): void {
  for (const [pointerId, captured] of registration.owner.eventRoot.pointerCaptures) {
    if (captured === registration) {
      registration.owner.eventRoot.pointerCaptures.delete(pointerId);
    }
  }
}
