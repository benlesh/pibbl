import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CRCEventHandlers } from '../events/types';
import { executeRender } from '../execute-render';
import { clearSharedState, getCRCInstance } from '../global-state';
import { useEventTarget } from '../hooks/use-event-target';
import { mountCRC } from '../mount-crc';
import type { CRCElement, CRCController } from '../types';
import type { CRCDirection } from './directional-navigation';
import type { CRCFocusManager } from './focus-manager';
import type { CRCDirectionalBoundary, CRCFocusCandidate } from './types';
import { focusManaged } from './policy-test-support';
import { directionalPolicy } from './policy-test-support';
import { createElement } from '../element/create-element';
import { definePrimitive } from '../define-primitive';

const activeControllers = new Set<CRCController>();
const noop = () => undefined;

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  for (const controller of activeControllers) controller.dispose();
  activeControllers.clear();
  clearSharedState();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('nested directional navigation', () => {
  it('gives arrows to the nearest boundary, contains its edge, and keeps one global Tab order', () => {
    const formKeys: string[] = [];
    const Inner = (_props: {}) => [
      createElement(Target, { key: 'inner-left', label: 'inner-left', x: 40, y: 0 }),
      createElement(Target, {
        key: 'form',
        label: 'form',
        x: 60,
        y: 0,
        handlers: {
          onClick: noop,
          onKeyDown: event => {
            formKeys.push(event.key);
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault();
            }
          },
        },
      }),
      createElement(Target, { key: 'inner-right', label: 'inner-right', x: 80, y: 0 }),
    ];
    const Outer = (_props: {}) => directionalPolicy(
      createElement((_props: {}) => [
        createElement(Target, { key: 'outer-left', label: 'outer-left', x: 0, y: 0 }),
        directionalPolicy(createElement(Inner, { key: 'inner' }), { mode: 'directional' }),
        createElement(Target, { key: 'outer-right', label: 'outer-right', x: 120, y: 0 }),
      ], {}),
      { mode: 'directional' },
    );
    const mounted = mountAndRender(focusManaged(createElement(Outer, {})));
    mounted.canvas.focus({ preventScroll: true });

    const [outerLeft, innerLeft, form, innerRight, outerRight] =
      mounted.manager.candidates;
    const outerBoundary = outerLeft.directionalBoundary!;
    const innerBoundary = innerLeft.directionalBoundary!;
    expect(outerBoundary).not.toBe(innerBoundary);
    expect(labels(outerBoundary.candidates)).toEqual([
      'outer-left',
      'outer-right',
    ]);
    expect(labels(innerBoundary.candidates)).toEqual([
      'inner-left',
      'form',
      'inner-right',
    ]);

    dispatchArrow(mounted.canvas, 'right');
    expect(focusedLabel(mounted.manager)).toBe('outer-right');

    mounted.manager.setFocusState(innerLeft.target, true);
    dispatchArrow(mounted.canvas, 'right');
    expect(focusedLabel(mounted.manager)).toBe('form');

    const formArrow = dispatchArrow(mounted.canvas, 'right');
    expect(formArrow.defaultPrevented).toBe(true);
    expect(formKeys).toEqual(['ArrowRight']);
    expect(focusedLabel(mounted.manager)).toBe('form');

    mounted.manager.setFocusState(innerRight.target, true);
    const edge = dispatchArrow(mounted.canvas, 'right');
    expect(edge.defaultPrevented).toBe(false);
    expect(focusedLabel(mounted.manager)).toBe('inner-right');

    const tab = dispatchTab(mounted.canvas, false);
    expect(tab.defaultPrevented).toBe(true);
    expect(focusedLabel(mounted.manager)).toBe('outer-right');
    const reverseTab = dispatchTab(mounted.canvas, true);
    expect(reverseTab.defaultPrevented).toBe(true);
    expect(focusedLabel(mounted.manager)).toBe('inner-right');

    expect(mounted.manager.candidates.map(candidate => candidate.target)).toEqual([
      outerLeft.target,
      innerLeft.target,
      form.target,
      innerRight.target,
      outerRight.target,
    ]);
  });

  it('atomically refreshes direct membership when a nested boundary is removed, restored, and reordered without remounting targets', () => {
    const Inner = ({ order }: { order: readonly string[] }) =>
      order.map((label, index) => createElement(Target, {
        key: label,
        label,
        x: 30 + index * 20,
        y: 0,
      }));
    const OuterHost = ({ children }: {
      children: CRCElement<any>[];
    }) => children;
    const Root = ({
      nested,
      order,
    }: {
      nested: boolean;
      order: readonly string[];
    }) => {
      const inner = createElement(Inner, { key: 'stable-inner', order });
      return directionalPolicy(
        createElement(OuterHost, { children: [
          createElement(Target, { key: 'before', label: 'before', x: 0, y: 0 }),
          nested ? directionalPolicy(inner, { mode: 'directional' }) : inner,
          createElement(Target, { key: 'after', label: 'after', x: 100, y: 0 }),
        ] }),
        { mode: 'directional' },
      );
    };
    const element = (nested: boolean, order: readonly string[]) =>
      focusManaged(createElement(Root, { nested, order }));
    const mounted = mountAndRender(element(true, ['a', 'b']));
    const initialTargets = new Map(
      mounted.manager.candidates.map(candidate => [
        candidateLabel(candidate),
        candidate.target,
      ]),
    );
    const firstInnerBoundary = mounted.manager.candidates[1].directionalBoundary!;
    const outerBoundary = mounted.manager.candidates[0].directionalBoundary!;

    executeRender(mounted.canvas, 2, element(false, ['b', 'a']));

    expect(labels(firstInnerBoundary.candidates)).toEqual([]);
    expect(labels(outerBoundary.candidates)).toEqual(['before', 'b', 'a', 'after']);
    expect(mounted.manager.candidates.map(candidateLabel)).toEqual([
      'before',
      'b',
      'a',
      'after',
    ]);
    expect(mounted.manager.candidates[1].target).toBe(initialTargets.get('b'));
    expect(mounted.manager.candidates[2].target).toBe(initialTargets.get('a'));

    executeRender(mounted.canvas, 3, element(true, ['a', 'b']));

    const restoredInnerBoundary = mounted.manager.candidates[1].directionalBoundary!;
    expect(restoredInnerBoundary).not.toBe(firstInnerBoundary);
    expect(labels(outerBoundary.candidates)).toEqual(['before', 'after']);
    expect(labels(restoredInnerBoundary.candidates)).toEqual(['a', 'b']);
    expect(mounted.manager.candidates[1].target).toBe(initialTargets.get('a'));
    expect(mounted.manager.candidates[2].target).toBe(initialTargets.get('b'));
  });

  it('keeps last successful direct lists during a partial failure and clears them only with manager teardown', () => {
    let capturedDuringFailure:
      { readonly outer: string[]; readonly inner: string[] } | undefined;
    let committedOuter: CRCDirectionalBoundary | undefined;
    let committedInner: CRCDirectionalBoundary | undefined;
    const Throwing = (_props: {}) => {
      capturedDuringFailure = {
        outer: labels(committedOuter?.candidates ?? []),
        inner: labels(committedInner?.candidates ?? []),
      };
      throw new Error('expected nested render failure');
    };
    const Inner = ({ partial }: { partial: boolean }) => [
      createElement(Target, { key: 'inner-a', label: partial ? 'partial-a' : 'inner-a', x: 30, y: 0 }),
      createElement(Target, { key: 'inner-b', label: 'inner-b', x: 50, y: 0 }),
      partial ? createElement(Throwing, {}) : undefined,
    ];
    const Root = ({ partial }: { partial: boolean }) =>
      directionalPolicy(createElement((_props: {}) => [
        createElement(Target, { key: 'outer-a', label: 'outer-a', x: 0, y: 0 }),
        directionalPolicy(createElement(Inner, { key: 'inner', partial }), {
          mode: 'directional',
        }),
        createElement(Target, { key: 'outer-b', label: 'outer-b', x: 100, y: 0 }),
      ], {}), { mode: 'directional' });
    const element = (partial: boolean) => focusManaged(createElement(Root, { partial }));
    const mounted = mountAndRender(element(false));
    const manager = mounted.manager;
    committedOuter = manager.candidates[0].directionalBoundary!;
    committedInner = manager.candidates[1].directionalBoundary!;

    expect(() => executeRender(mounted.canvas, 2, element(true)))
      .toThrowError('expected nested render failure');

    expect(capturedDuringFailure).toEqual({
      outer: ['outer-a', 'outer-b'],
      inner: ['inner-a', 'inner-b'],
    });
    expect(manager.isDestroyed).toBe(true);
    expect(committedOuter.candidates).toEqual([]);
    expect(committedInner.candidates).toEqual([]);

    executeRender(mounted.canvas, 3, element(false));
    const replacement = getCRCInstance(mounted.canvas).eventRoot.focusPolicy as
      CRCFocusManager;
    expect(replacement).not.toBe(manager);
    expect(labels(replacement.candidates[0].directionalBoundary!.candidates))
      .toEqual(['outer-a', 'outer-b']);
    expect(labels(replacement.candidates[1].directionalBoundary!.candidates))
      .toEqual(['inner-a', 'inner-b']);
  });
});

interface TargetProps {
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly handlers?: CRCEventHandlers;
}

const Target = definePrimitive<TargetProps>(({
  x,
  y,
  handlers = { onClick: noop },
}, _style, context) => {
  context.translate(x, y);
  useEventTarget(handlers, {
    path: rectanglePath(0, 0, 10, 10),
    keyboardFocusable: true,
    keyboardNavigationBounds: { x: 0, y: 0, width: 10, height: 10 },
  });
});

function mountAndRender(element: CRCElement<any>): {
  readonly canvas: HTMLCanvasElement;
  readonly controller: CRCController;
  readonly manager: CRCFocusManager;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 200;
  document.body.appendChild(canvas);
  const controller = mountCRC(canvas, element);
  activeControllers.add(controller);
  executeRender(canvas, 1);
  const manager = getCRCInstance(canvas).eventRoot.focusPolicy as
    CRCFocusManager | undefined;
  if (!manager) throw new Error('Expected a focus manager.');
  return { canvas, controller, manager };
}

function labels(candidates: readonly CRCFocusCandidate[]): string[] {
  return candidates.map(candidateLabel);
}

function candidateLabel(candidate: CRCFocusCandidate): string {
  return (candidate.target.component.element.props as { label: string }).label;
}

function focusedLabel(manager: CRCFocusManager): string | undefined {
  const target = manager.resolveKeyboardTarget();
  return target ?
    (target.component.element.props as { label: string }).label :
    undefined;
}

function dispatchArrow(
  canvas: HTMLCanvasElement,
  direction: CRCDirection,
): KeyboardEvent {
  const key = `Arrow${direction[0].toUpperCase()}${direction.slice(1)}`;
  const event = new KeyboardEvent('keydown', {
    key,
    code: key,
    bubbles: true,
    cancelable: true,
  });
  canvas.dispatchEvent(event);
  return event;
}

function dispatchTab(canvas: HTMLCanvasElement, shiftKey: boolean): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    code: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  canvas.dispatchEvent(event);
  return event;
}

function rectanglePath(
  x: number,
  y: number,
  width: number,
  height: number,
): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}
