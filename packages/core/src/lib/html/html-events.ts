import { batch } from '../signals/graph.js';
import { PIBBL_EVENT_DEFINITIONS, type PibblEventDefinition } from '../events/event-definitions.js';
import { buildEventPath } from '../events/event-path.js';
import { createPibblEvent, finishEventDispatch, isPibblImmediatePropagationStopped, isPibblPropagationStopped } from '../events/event-facade.js';
import { invokePibblEventHandler } from '../events/propagation.js';
import { normalizeHandlers, type PibblEventListenerRegistration, type PibblEventNode, type PibblNormalizedHandlers } from '../events/registrations.js';
import type { PibblEvent, PibblEventHandlers, PibblEventType } from '../events/types.js';
import type { HtmlBoxEventHandlers, HtmlBoxSlot } from './types.js';

interface NativeDispatch {
  readonly original: Event;
  cleanup?: ReturnType<typeof setTimeout>;
  readonly event: PibblEvent;
  readonly path: readonly PibblEventNode[];
}

/** Candidate event state remains invisible until the shared geometry adoption. */
export interface HtmlNativeEventSnapshot {
  readonly handlers: PibblNormalizedHandlers;
  readonly path: readonly PibblEventNode[];
  readonly inverseWorld: DOMMatrix;
  readonly inverseProjection: DOMMatrix;
  readonly active: boolean;
}

/** Observes the real DOM path; never enters Canvas targeting/default actions. */
export class HtmlNativeEvents {
  readonly node: PibblEventListenerRegistration;
  private readonly listeners = new Map<PibblEventType, () => void>();
  private readonly dispatches = new WeakMap<Event, NativeDispatch>();
  private readonly pendingDispatches = new Set<NativeDispatch>();
  private current: HtmlNativeEventSnapshot | undefined;

  constructor(
    private readonly slot: HtmlBoxSlot,
    private readonly coordinateRoot: () => SVGSVGElement,
    private readonly relatedNode: (target: EventTarget | null) => PibblEventNode | null,
  ) {
    // Dedicated virtual listener: no Canvas hit geometry, subscriptions or capture.
    this.node = {
      kind: 'listener', owner: slot.owner, component: slot.component, slot: -1,
      suspendLayout: () => this.suspend(),
      publicTarget: {
        setPointerCapture: id => { if (!slot.disposed) slot.content?.setPointerCapture(id); },
        hasPointerCapture: id => !slot.disposed && Boolean(slot.content?.hasPointerCapture(id)),
        releasePointerCapture: id => { if (!slot.disposed) slot.content?.releasePointerCapture(id); },
      },
      handlers: {}, live: false,
      handlerTypesLow: 0, handlerTypesHigh: 0,
      requiredNativeTypesLow: 0, requiredNativeTypesHigh: 0,
      ownedNativeTypesLow: 0, ownedNativeTypesHigh: 0,
    };
  }

  prepare(handlers: HtmlBoxEventHandlers, world: DOMMatrix, projection: DOMMatrix, active: boolean): HtmlNativeEventSnapshot {
    const normalized = normalizeHandlers(handlers as PibblEventHandlers);
    const inverseWorld = world.inverse();
    const inverseProjection = projection.inverse();
    // Preserve ancestor handlers as well as geometry during fallible HTML callbacks.
    const path = buildEventPath(this.node).map(node => ({
      ...node,
      handlers: node === this.node ? normalized : node.handlers,
      live: node === this.node ? active : node.live,
    }));
    return {
      handlers: normalized, path, inverseWorld, inverseProjection,
      active: active && finite(inverseWorld) && finite(inverseProjection),
    };
  }

  /** Add candidates without withdrawing any listeners needed by the old snapshot. */
  prepareListeners(snapshot: HtmlNativeEventSnapshot): void {
    if (!snapshot.active) return;
    for (const definition of PIBBL_EVENT_DEFINITIONS) {
      if (!this.listeners.has(definition.type) && needsEvent(snapshot, definition.type)) this.listen(definition);
    }
  }

  adopt(snapshot: HtmlNativeEventSnapshot): void {
    this.current = snapshot;
    this.node.handlers = snapshot.handlers;
    this.node.live = snapshot.active;
  }

  suspend(): void { this.node.live = false; }

  dispose(): void {
    this.node.live = false;
    for (const release of this.listeners.values()) release();
    this.listeners.clear();
    for (const dispatch of this.pendingDispatches) this.releaseDispatch(dispatch);
    this.node.handlers = {};
    this.current = undefined;
  }

  private listen(definition: PibblEventDefinition): void {
    const host = this.slot.shell!;
    const capture = (original: Event) => batch(() => {
      const snapshot = this.current;
      if (!snapshot || !this.node.live || !this.slot.region.active || this.slot.disposed || !needsEvent(snapshot, definition.type)) return;
      // Native enter/leave traverse ancestors for each nested DOM target.
      if ((definition.type === 'mouseenter' || definition.type === 'mouseleave' ||
          definition.type === 'pointerenter' || definition.type === 'pointerleave') && original.target !== host) return;
      const coordinates = definition.coordinate ? this.coordinates(original, snapshot) : undefined;
      if (definition.coordinate && !coordinates) return;
      const path = snapshot.path;
      const event = createPibblEvent({
        type: definition.type, target: this.node, path, originalEvent: original,
        relatedTarget: this.relatedNode((original as FocusEvent).relatedTarget ?? null),
        nativeBubbles: original.bubbles,
        ...coordinates,
      });
      const dispatch: NativeDispatch = { event, path, original };
      const previous = this.dispatches.get(original);
      if (previous) this.releaseDispatch(previous);
      this.dispatches.set(original, dispatch);
      this.pendingDispatches.add(dispatch);
      // Native descendants may stop propagation before our bubble listener runs.
      // A microtask can run BETWEEN native listeners, so only a later task may
      // expire an abandoned dispatch. Normal bubbling releases synchronously.
      if (original.bubbles) dispatch.cleanup = setTimeout(() => this.releaseDispatch(dispatch), 0);
      for (let index = 0; index < path.length - 1; index++) {
        if (!this.node.live || this.slot.disposed || isPibblPropagationStopped(event)) break;
        invokePibblEventHandler(path[index], definition.type, true, 1, event);
      }
      if (this.node.live && !this.slot.disposed && !isPibblPropagationStopped(event)) invokePibblEventHandler(path[path.length - 1], definition.type, true, 2, event);
      // Focus/blur/enter/leave have no native bubble callback.
      if (!original.bubbles) {
        this.finish(definition.type, dispatch, false);
      }
    });
    const bubble = (original: Event) => batch(() => {
      const dispatch = this.dispatches.get(original);
      if (dispatch) this.finish(definition.type, dispatch, true);
    });
    host.addEventListener(definition.type, capture, { capture: true, passive: false });
    try {
      host.addEventListener(definition.type, bubble, { passive: false });
    } catch (error) {
      host.removeEventListener(definition.type, capture, true);
      throw error;
    }
    this.listeners.set(definition.type, () => {
      host.removeEventListener(definition.type, capture, true);
      host.removeEventListener(definition.type, bubble);
    });
  }

  private releaseDispatch(dispatch: NativeDispatch): void {
    if (!this.pendingDispatches.delete(dispatch)) return;
    if (dispatch.cleanup !== undefined) clearTimeout(dispatch.cleanup);
    if (this.dispatches.get(dispatch.original) === dispatch) this.dispatches.delete(dispatch.original);
    finishEventDispatch(dispatch.event);
  }

  private finish(type: PibblEventType, dispatch: NativeDispatch, bubbles: boolean): void {
    const { event, path } = dispatch;
    try {
      if (!this.node.live || this.slot.disposed || isPibblPropagationStopped(event)) return;
      if (!isPibblImmediatePropagationStopped(event)) invokePibblEventHandler(path[path.length - 1], type, false, 2, event);
      if (!bubbles) return;
      for (let index = path.length - 2; index >= 0; index--) {
        if (!this.node.live || this.slot.disposed || isPibblPropagationStopped(event)) break;
        invokePibblEventHandler(path[index], type, false, 3, event);
      }
    } finally { this.releaseDispatch(dispatch); }
  }

  private coordinates(event: Event, snapshot: HtmlNativeEventSnapshot): { x: number; y: number; localX: number; localY: number } | undefined {
    const source = 'changedTouches' in event ? (event as TouchEvent).changedTouches[0] : event as MouseEvent;
    if (!source || !Number.isFinite(source.clientX) || !Number.isFinite(source.clientY)) return;
    // This unpainted SVG at overlay (0,0) includes shared CSS affine transforms.
    const screen = this.coordinateRoot().getScreenCTM();
    if (!screen) return;
    const clientToOverlay = new DOMMatrix([screen.a, screen.b, screen.c, screen.d, screen.e, screen.f]).inverse();
    const overlay = clientToOverlay.transformPoint({ x: source.clientX, y: source.clientY });
    const root = snapshot.inverseProjection.transformPoint(overlay);
    const local = snapshot.inverseWorld.transformPoint(root);
    if (!Number.isFinite(root.x) || !Number.isFinite(root.y) || !Number.isFinite(local.x) || !Number.isFinite(local.y)) return;
    return { x: root.x, y: root.y, localX: local.x, localY: local.y };
  }
}

function finite(matrix: DOMMatrixReadOnly): boolean {
  return Number.isFinite(matrix.a) && Number.isFinite(matrix.b) && Number.isFinite(matrix.c) &&
    Number.isFinite(matrix.d) && Number.isFinite(matrix.e) && Number.isFinite(matrix.f);
}

function needsEvent(snapshot: HtmlNativeEventSnapshot, type: PibblEventType): boolean {
  for (const node of snapshot.path) {
    if (node.live && (node.handlers[type] || node.handlers[`${type}Capture`])) return true;
  }
  return false;
}
