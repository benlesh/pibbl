import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompRefs, CRCEventRoot, CRCInstance } from '../types';
import { buildEventPath } from './event-path';
import { dispatchEventPath } from './propagation';
import type {
  CRCEventListenerRegistration,
  CRCEventTargetRegistration,
  CRCNormalizedHandlers,
} from './registrations';
import type { CRCEvent, CRCEventTarget } from './types';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('event propagation', () => {
  it('dispatches capture, target, and bubble in DOM path order', () => {
    const fixture = createFixture();
    const trace: string[] = [];
    const root = fixture.listener(fixture.root, {
      clickCapture: event => trace.push(`root-capture:${event.eventPhase}`),
      click: event => trace.push(`root:${event.eventPhase}`),
    });
    const parent = fixture.listener(fixture.parent, {
      clickCapture: event => trace.push(`parent-capture:${event.eventPhase}`),
      click: event => trace.push(`parent:${event.eventPhase}`),
    });
    const target = fixture.target({
      clickCapture: event => trace.push(`target-capture:${event.eventPhase}`),
      click: event => trace.push(`target:${event.eventPhase}`),
    });

    const event = dispatchEventPath({
      type: 'click',
      target,
      originalEvent: clickEvent(),
      x: 13,
      y: 21,
    });

    expect(trace).toEqual([
      'root-capture:1',
      'parent-capture:1',
      'target-capture:2',
      'target:2',
      'parent:3',
      'root:3',
    ]);
    const path = buildEventPath(target);
    expect(path).toEqual([root, parent, target]);
    expect(Object.isFrozen(path)).toBe(true);
    expect(event.target).toBe(target.publicTarget);
  });

  it('surrounds a same-component target with listeners in source and inverse bubble order', () => {
    const fixture = createFixture();
    const trace: string[] = [];
    fixture.listener(fixture.targetComponent, {
      clickCapture: () => trace.push('first-capture'),
      click: () => trace.push('first-bubble'),
    });
    fixture.listener(fixture.targetComponent, {
      clickCapture: () => trace.push('second-capture'),
      click: () => trace.push('second-bubble'),
    });
    const target = fixture.target({
      clickCapture: () => trace.push('target-capture'),
      click: () => trace.push('target'),
    });

    dispatchEventPath({
      type: 'click',
      target,
      originalEvent: clickEvent(),
    });

    expect(trace).toEqual([
      'first-capture',
      'second-capture',
      'target-capture',
      'target',
      'second-bubble',
      'first-bubble',
    ]);
  });

  it('excludes listeners from another owner whose component IDs collide', () => {
    const eventRoot = createEventRoot();
    const fixture = createFixture(eventRoot);
    const collidingFixture = createFixture(eventRoot);
    const trace: string[] = [];
    const foreign = collidingFixture.listener(collidingFixture.parent, {
      clickCapture: () => trace.push('foreign-capture'),
      click: () => trace.push('foreign-bubble'),
    });
    const own = fixture.listener(fixture.parent, {
      clickCapture: () => trace.push('own-capture'),
      click: () => trace.push('own-bubble'),
    });
    const target = fixture.target({ click: () => trace.push('target') });

    const event = dispatchEventPath({
      type: 'click',
      target,
      originalEvent: clickEvent(),
    });

    expect(foreign.component.id).toBe(own.component.id);
    expect(foreign.component).not.toBe(own.component);
    expect(foreign.owner).not.toBe(own.owner);
    expect(trace).toEqual(['own-capture', 'target', 'own-bubble']);
    expect(event.composedPath()).toEqual([
      own.publicTarget,
      target.publicTarget,
    ]);
  });

  it('captures and targets focus without bubbling it', () => {
    const fixture = createFixture();
    const trace: string[] = [];
    fixture.listener(fixture.root, {
      focusCapture: event => trace.push(`root-capture:${event.eventPhase}`),
      focus: () => trace.push('root-bubble'),
    });
    fixture.listener(fixture.parent, {
      focusCapture: event => trace.push(`parent-capture:${event.eventPhase}`),
      focus: () => trace.push('parent-bubble'),
    });
    const target = fixture.target({
      focusCapture: event => trace.push(`target-capture:${event.eventPhase}`),
      focus: event => trace.push(`target:${event.eventPhase}`),
    });

    dispatchEventPath({
      type: 'focus',
      target,
      originalEvent: new FocusEvent('focus'),
    });

    expect(trace).toEqual([
      'root-capture:1',
      'parent-capture:1',
      'target-capture:2',
      'target:2',
    ]);
  });

  it('lets target handlers finish after stopPropagation but skips ancestors', () => {
    const fixture = createFixture();
    const trace: string[] = [];
    const originalEvent = clickEvent();
    const stopPropagation = vi.spyOn(originalEvent, 'stopPropagation');
    fixture.listener(fixture.parent, {
      click: () => trace.push('parent'),
    });
    const target = fixture.target({
      clickCapture: event => {
        trace.push('target-capture');
        event.stopPropagation();
      },
      click: () => trace.push('target'),
    });

    dispatchEventPath({ type: 'click', target, originalEvent });

    expect(trace).toEqual(['target-capture', 'target']);
    expect(stopPropagation).toHaveBeenCalledOnce();
  });

  it('stops remaining target handlers after stopImmediatePropagation', () => {
    const fixture = createFixture();
    const trace: string[] = [];
    const originalEvent = clickEvent();
    const stopImmediatePropagation = vi.spyOn(
      originalEvent,
      'stopImmediatePropagation',
    );
    fixture.listener(fixture.parent, {
      click: () => trace.push('parent'),
    });
    const target = fixture.target({
      clickCapture: event => {
        trace.push('target-capture');
        event.stopImmediatePropagation();
      },
      click: () => trace.push('target'),
    });

    dispatchEventPath({ type: 'click', target, originalEvent });

    expect(trace).toEqual(['target-capture']);
    expect(stopImmediatePropagation).toHaveBeenCalledOnce();
  });

  it('prevents a cancelable native default and ignores an uncancelable one', () => {
    const fixture = createFixture();
    const cancelable = clickEvent();
    const uncancelable = new MouseEvent('click', { cancelable: false });
    const cancelablePreventDefault = vi.spyOn(cancelable, 'preventDefault');
    const uncancelablePreventDefault = vi.spyOn(uncancelable, 'preventDefault');
    const seen: boolean[] = [];
    const target = fixture.target({
      click: event => {
        event.preventDefault();
        seen.push(event.defaultPrevented);
      },
    });

    const prevented = dispatchEventPath({
      type: 'click',
      target,
      originalEvent: cancelable,
    });
    const notPrevented = dispatchEventPath({
      type: 'click',
      target,
      originalEvent: uncancelable,
    });

    expect(seen).toEqual([true, false]);
    expect(prevented.cancelable).toBe(true);
    expect(notPrevented.cancelable).toBe(false);
    expect(prevented.defaultPrevented).toBe(true);
    expect(notPrevented.defaultPrevented).toBe(false);
    expect(cancelablePreventDefault).toHaveBeenCalledOnce();
    expect(uncancelablePreventDefault).not.toHaveBeenCalled();
  });

  it('keeps an explicitly dispatched non-cancelable logical type non-cancelable', () => {
    const fixture = createFixture();
    const originalEvent = new FocusEvent('focus', { cancelable: true });
    const preventDefault = vi.spyOn(originalEvent, 'preventDefault');
    let observed: { cancelable: boolean; defaultPrevented: boolean } | undefined;
    const target = fixture.target({
      focus: event => {
        event.preventDefault();
        observed = {
          cancelable: event.cancelable,
          defaultPrevented: event.defaultPrevented,
        };
      },
    });

    const event = dispatchEventPath({
      type: 'focus',
      target,
      originalEvent,
    });

    expect(observed).toEqual({ cancelable: false, defaultPrevented: false });
    expect(event).toMatchObject({
      cancelable: false,
      defaultPrevented: false,
    });
    expect(preventDefault).not.toHaveBeenCalled();
    expect(originalEvent.defaultPrevented).toBe(false);
  });

  it('projects an immutable opaque path, related target, source event, and mouse fields', () => {
    const fixture = createFixture();
    const root = fixture.listener(fixture.root, {});
    const parent = fixture.listener(fixture.parent, {});
    const related = fixture.target({}, fixture.parent);
    const sourceEvent = new KeyboardEvent('keydown', { key: 'Enter' });
    const originalEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 1,
      buttons: 4,
      clientX: 101,
      clientY: 202,
      ctrlKey: true,
      detail: 2,
      screenX: 303,
      screenY: 404,
      shiftKey: true,
    });
    let seen: CRCEvent | undefined;
    const target = fixture.target({
      click: event => {
        seen = event;
      },
    });

    const event = dispatchEventPath({
      type: 'click',
      target,
      relatedTarget: related,
      originalEvent,
      sourceEvent,
      x: 12,
      y: 34,
    });
    const path = event.composedPath();

    expect(seen).toBe(event);
    expect(path).toEqual([
      root.publicTarget,
      parent.publicTarget,
      target.publicTarget,
    ]);
    expect(Object.isFrozen(path)).toBe(true);
    expect(() => (path as CRCEventTarget[]).push(related.publicTarget)).toThrow();
    expect(event.relatedTarget).toBe(related.publicTarget);
    expect(event.sourceEvent).toBe(sourceEvent);
    expect(event).toMatchObject({
      type: 'click',
      bubbles: true,
      cancelable: true,
      originalEvent,
      x: 12,
      y: 34,
      clientX: 101,
      clientY: 202,
      screenX: 303,
      screenY: 404,
      button: 1,
      buttons: 4,
      ctrlKey: true,
      shiftKey: true,
      detail: 2,
    });
    expect(path).not.toContain(target.component);
    expect(path).not.toContain(target);
  });

  it('observes handler replacement before a later phase', () => {
    const fixture = createFixture();
    const trace: string[] = [];
    const parent = fixture.listener(fixture.parent, {
      click: () => trace.push('old-parent'),
    });
    fixture.listener(fixture.root, {
      clickCapture: () => {
        parent.handlers = handlers({
          click: () => trace.push('new-parent'),
        });
      },
    });
    const target = fixture.target({ click: () => trace.push('target') });

    dispatchEventPath({
      type: 'click',
      target,
      originalEvent: clickEvent(),
    });

    expect(trace).toEqual(['target', 'new-parent']);
  });

  it('skips a listener removed before its turn without suppressing the target', () => {
    const fixture = createFixture();
    const trace: string[] = [];
    const parent = fixture.listener(fixture.parent, {
      clickCapture: () => trace.push('removed-parent-capture'),
      click: () => trace.push('removed-parent-bubble'),
    });
    const target = fixture.target({
      clickCapture: () => trace.push('target-capture'),
      click: () => trace.push('target'),
    });
    const root = fixture.listener(fixture.root, {
      clickCapture: () => {
        trace.push('root-capture');
        parent.live = false;
      },
      click: () => trace.push('root-bubble'),
    });

    const event = dispatchEventPath({
      type: 'click',
      target,
      originalEvent: clickEvent(),
    });

    expect(trace).toEqual([
      'root-capture',
      'target-capture',
      'target',
      'root-bubble',
    ]);
    expect(event.composedPath()).toEqual([
      root.publicTarget,
      parent.publicTarget,
      target.publicTarget,
    ]);
  });

  it('skips a target removed before target phase while preserving ancestor bubble', () => {
    const fixture = createFixture();
    const trace: string[] = [];
    const parent = fixture.listener(fixture.parent, {
      clickCapture: () => {
        trace.push('parent-capture');
        target.live = false;
      },
      click: () => trace.push('parent-bubble'),
    });
    const target = fixture.target({
      clickCapture: () => trace.push('removed-target-capture'),
      click: () => trace.push('removed-target'),
    });

    const event = dispatchEventPath({
      type: 'click',
      target,
      originalEvent: clickEvent(),
    });

    expect(trace).toEqual(['parent-capture', 'parent-bubble']);
    expect(event.composedPath()).toEqual([
      parent.publicTarget,
      target.publicTarget,
    ]);
  });

  it('does not add a listener created after path snapshot', () => {
    const fixture = createFixture();
    const trace: string[] = [];
    fixture.listener(fixture.root, {
      clickCapture: () => {
        fixture.listener(fixture.parent, {
          clickCapture: () => trace.push('added-capture'),
          click: () => trace.push('added-bubble'),
        });
      },
    });
    const target = fixture.target({ click: () => trace.push('target') });

    dispatchEventPath({
      type: 'click',
      target,
      originalEvent: clickEvent(),
    });

    expect(trace).toEqual(['target']);
  });

  it('reports a thrown handler and continues with unrelated handlers', () => {
    const fixture = createFixture();
    const error = new Error('handler failed');
    const reportError = vi.spyOn(globalThis, 'reportError').mockImplementation(
      () => undefined,
    );
    const trace: string[] = [];
    fixture.listener(fixture.root, {
      clickCapture: () => {
        throw error;
      },
      click: () => trace.push('safe-root'),
    });
    const target = fixture.target({ click: () => trace.push('safe-target') });

    dispatchEventPath({
      type: 'click',
      target,
      originalEvent: clickEvent(),
    });

    expect(reportError).toHaveBeenCalledWith(error);
    expect(trace).toEqual(['safe-target', 'safe-root']);
  });
});

interface Fixture {
  readonly root: CompRefs<unknown>;
  readonly parent: CompRefs<unknown>;
  readonly targetComponent: CompRefs<unknown>;
  listener(
    component: CompRefs<unknown>,
    handlerMap: HandlerMap,
  ): CRCEventListenerRegistration;
  target(
    handlerMap: HandlerMap,
    component?: CompRefs<unknown>,
  ): CRCEventTargetRegistration;
}

type HandlerMap = Record<
  string,
  ((event: CRCEvent & Record<string, unknown>) => void) | undefined
>;

function createFixture(eventRoot = createEventRoot()): Fixture {
  const root = component('root');
  const parent = component('parent', root);
  const targetComponent = component('target', parent);
  const owner = { eventRoot } as CRCInstance;
  let slot = 0;

  return {
    root,
    parent,
    targetComponent,
    listener(componentRef, handlerMap) {
      const listener: CRCEventListenerRegistration = {
        kind: 'listener',
        owner,
        component: componentRef,
        slot: slot++,
        publicTarget: publicTarget(),
        handlers: handlers(handlerMap),
        live: true,
      };
      let listeners = eventRoot.listenersByComponent.get(componentRef.id);
      if (!listeners) {
        listeners = new Set();
        eventRoot.listenersByComponent.set(componentRef.id, listeners);
      }
      listeners.add(listener);
      return listener;
    },
    target(handlerMap, componentRef = targetComponent) {
      const target: CRCEventTargetRegistration = {
        kind: 'target',
        owner,
        component: componentRef,
        slot: slot++,
        publicTarget: publicTarget(),
        handlers: handlers(handlerMap),
        path: new Path2D(),
        fill: false,
        lineInteractionWidth: 0,
        transform: new DOMMatrix(),
        clippingStack: [],
        cursor: undefined,
        keyboardFocusable: undefined,
        keyboardNavigationBounds: undefined,
        live: true,
      };
      eventRoot.targets.add(target);
      return target;
    },
  };
}

function createEventRoot(): CRCEventRoot {
  return {
    listenersByComponent: new Map(),
    pointerCaptures: new Map(),
    targets: new Set(),
    observers: new Map(),
  } as unknown as CRCEventRoot;
}

function handlers(handlerMap: HandlerMap): CRCNormalizedHandlers {
  return handlerMap as CRCNormalizedHandlers;
}

function component(
  id: string,
  parent?: CompRefs<unknown>,
): CompRefs<unknown> {
  return { id, parent } as CompRefs<unknown>;
}

function publicTarget(): CRCEventTarget {
  const captures = new Set<number>();
  return {
    setPointerCapture(pointerId) {
      captures.add(pointerId);
    },
    hasPointerCapture(pointerId) {
      return captures.has(pointerId);
    },
    releasePointerCapture(pointerId) {
      captures.delete(pointerId);
    },
  };
}

function clickEvent(): MouseEvent {
  return new MouseEvent('click', { bubbles: true, cancelable: true });
}
