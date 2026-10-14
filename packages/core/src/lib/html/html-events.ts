import { batch } from '../signals/graph.js';
import { CRC_EVENT_DEFINITIONS, type CRCEventDefinition } from '../events/event-definitions.js';
import { buildEventPath } from '../events/event-path.js';
import { createCRCEvent, isCRCImmediatePropagationStopped, isCRCPropagationStopped } from '../events/event-facade.js';
import { invokeCRCEventHandler } from '../events/propagation.js';
import { normalizeHandlers, type CRCEventListenerRegistration, type CRCEventNode } from '../events/registrations.js';
import type { CRCEvent, CRCEventHandlers, CRCEventType } from '../events/types.js';
import type { HtmlBoxEventHandlers, HtmlBoxSlot } from './types.js';

interface NativeDispatch {
  readonly event: CRCEvent;
  readonly path: readonly CRCEventNode[];
}

/** Observes the real DOM path; never enters Canvas targeting/default actions. */
export class HtmlNativeEvents {
  readonly node: CRCEventListenerRegistration;
  private readonly listeners = new Map<CRCEventType, () => void>();
  private readonly dispatches = new WeakMap<Event, NativeDispatch>();
  private inverseWorld = new DOMMatrix();
  private inverseProjection = new DOMMatrix();

  constructor(
    private readonly slot: HtmlBoxSlot,
    private readonly coordinateRoot: SVGSVGElement,
    private readonly relatedNode: (target: EventTarget | null) => CRCEventNode | null,
  ) {
    // Dedicated virtual listener: no Canvas hit geometry, subscriptions or capture.
    this.node = {
      kind: 'listener', owner: slot.owner, component: slot.component, slot: -1,
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

  publish(handlers: HtmlBoxEventHandlers, world: DOMMatrix, projection: DOMMatrix): void {
    this.node.handlers = normalizeHandlers(handlers as CRCEventHandlers);
    this.node.live = this.slot.region.active;
    if (!this.node.live) return;
    this.inverseWorld = world.inverse();
    this.inverseProjection = projection.inverse();
    if (![this.inverseWorld.a, this.inverseWorld.b, this.inverseWorld.c, this.inverseWorld.d,
      this.inverseWorld.e, this.inverseWorld.f, this.inverseProjection.a, this.inverseProjection.b,
      this.inverseProjection.c, this.inverseProjection.d, this.inverseProjection.e, this.inverseProjection.f].every(Number.isFinite)) {
      this.node.live = false;
      return;
    }
    const path = buildEventPath(this.node);
    for (const definition of CRC_EVENT_DEFINITIONS) {
      const needed = path.some(node => node.live &&
        (node.handlers[definition.type] || node.handlers[`${definition.type}Capture`]));
      if (needed && !this.listeners.has(definition.type)) this.listen(definition);
      else if (!needed) { this.listeners.get(definition.type)?.(); this.listeners.delete(definition.type); }
    }
  }

  suspend(): void { this.node.live = false; }

  dispose(): void {
    this.node.live = false;
    for (const release of this.listeners.values()) release();
    this.listeners.clear();
    this.node.handlers = {};
  }

  private listen(definition: CRCEventDefinition): void {
    const host = this.slot.shell!;
    const capture = (original: Event) => batch(() => {
      if (!this.node.live || !this.slot.region.active || this.slot.disposed) return;
      // Native enter/leave also traverse ancestors for each nested DOM target.
      // Observe only the one event whose boundary is this host.
      if ((definition.type === 'mouseenter' || definition.type === 'mouseleave' ||
          definition.type === 'pointerenter' || definition.type === 'pointerleave') && original.target !== host) return;
      const coordinates = definition.coordinate ? this.coordinates(original) : {};
      if (!coordinates) return;
      const path = buildEventPath(this.node);
      const event = createCRCEvent({
        type: definition.type, target: this.node, path, originalEvent: original,
        relatedTarget: this.relatedNode((original as FocusEvent).relatedTarget ?? null),
        nativeBubbles: original.bubbles,
        ...coordinates,
      });
      const dispatch = { event, path };
      this.dispatches.set(original, dispatch);
      for (const ancestor of path.slice(0, -1)) {
        if (isCRCPropagationStopped(event)) break;
        invokeCRCEventHandler(ancestor, definition.type, true, 1, event);
      }
      if (!isCRCPropagationStopped(event)) invokeCRCEventHandler(this.node, definition.type, true, 2, event);
      // There is no DOM bubble callback for focus/blur/enter/leave. Deliver the
      // host's ordinary handler here, with no CRC ancestor bubble phase.
      if (!original.bubbles) {
        this.dispatches.delete(original);
        this.finish(definition.type, dispatch, false);
      }
    });
    const bubble = (original: Event) => batch(() => {
      const dispatch = this.dispatches.get(original);
      this.dispatches.delete(original);
      if (dispatch) this.finish(definition.type, dispatch, true);
    });
    host.addEventListener(definition.type, capture, { capture: true, passive: false });
    host.addEventListener(definition.type, bubble, { passive: false });
    this.listeners.set(definition.type, () => {
      host.removeEventListener(definition.type, capture, true);
      host.removeEventListener(definition.type, bubble);
    });
  }

  private finish(type: CRCEventType, { event, path }: NativeDispatch, bubbles: boolean): void {
    if (!this.node.live || this.slot.disposed || isCRCPropagationStopped(event)) return;
    if (!isCRCImmediatePropagationStopped(event)) invokeCRCEventHandler(this.node, type, false, 2, event);
    if (!bubbles) return;
    for (let index = path.length - 2; index >= 0; index--) {
      if (isCRCPropagationStopped(event)) break;
      invokeCRCEventHandler(path[index], type, false, 3, event);
    }
  }

  private coordinates(event: Event): { x: number; y: number; localX: number; localY: number } | undefined {
    const source = 'changedTouches' in event ? (event as TouchEvent).changedTouches[0] : event as MouseEvent;
    if (!source || !Number.isFinite(source.clientX) || !Number.isFinite(source.clientY)) return;
    // This unpainted SVG has no viewBox, and is explicitly located at overlay
    // (0,0). Its screen CTM includes page scroll and shared CSS affine transforms.
    const screen = this.coordinateRoot.getScreenCTM();
    if (!screen) return;
    const clientToOverlay = new DOMMatrix([screen.a, screen.b, screen.c, screen.d, screen.e, screen.f]).inverse();
    const overlay = clientToOverlay.transformPoint({ x: source.clientX, y: source.clientY });
    const root = this.inverseProjection.transformPoint(overlay);
    const local = this.inverseWorld.transformPoint(root);
    if (![root.x, root.y, local.x, local.y].every(Number.isFinite)) return;
    return { x: root.x, y: root.y, localX: local.x, localY: local.y };
  }
}
