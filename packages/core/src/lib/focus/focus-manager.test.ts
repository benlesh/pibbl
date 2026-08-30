import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { g } from '../components/g';
import { horizontalLine } from '../components/horizontal-line';
import { img } from '../components/img';
import { layer } from '../components/layer';
import { line } from '../components/line';
import { path } from '../components/path';
import { rect } from '../components/rect';
import { svgPath } from '../components/svg-path';
import { text } from '../components/text';
import { verticalLine } from '../components/vertical-line';
import { defineComp } from '../define-comp';
import type { CRCEventTargetRegistration } from '../events/registrations';
import type {
  CRCEventHandlers,
  CRCEventTargetOptions,
  CRCEventTargetSnapshot,
} from '../events/types';
import { executeRender } from '../execute-render';
import { clearSharedState, getCRCInstance } from '../global-state';
import { crcEventListener } from '../hooks/crc-event-listener';
import { crcEventTarget } from '../hooks/crc-event-target';
import type { LayoutBox } from '../layout/types';
import { mountCRC } from '../mount-crc';
import type { CompEl, CRCController, CRCFocusPolicyBridge } from '../types';
import { withFocusManagement } from './with-focus-management';
import { withKeyboardNavigation } from './with-keyboard-navigation';

interface ObservedCandidate {
  readonly target: CRCEventTargetRegistration;
  readonly sourceIndex: number;
  readonly directionalBoundary: ObservedDirectionalBoundary | undefined;
  readonly rootBounds: Readonly<LayoutBox> | undefined;
}

interface ObservedDirectionalBoundary {
  readonly candidates: readonly ObservedCandidate[];
}

interface ObservedFocusManager extends CRCFocusPolicyBridge {
  readonly candidates: readonly ObservedCandidate[];
  setFocusState(
    target: CRCEventTargetRegistration | undefined,
    focusVisible: boolean,
  ): void;
}

const activeControllers = new Set<CRCController>();
const clickHandler = () => undefined;

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

describe('focus candidate enrollment', () => {
  it('enrolls only automatic keyboard handlers unless an explicit boolean overrides them', () => {
    const definitions: readonly TargetDefinition[] = [
      { label: 'click', handlers: { onClick: clickHandler } },
      { label: 'keydown', handlers: { onKeyDown: clickHandler } },
      { label: 'keyup', handlers: { onKeyUp: clickHandler } },
      { label: 'hover', handlers: { onMouseOver: clickHandler } },
      { label: 'move', handlers: { onPointerMove: clickHandler } },
      { label: 'wheel', handlers: { onWheel: clickHandler } },
      { label: 'cursor', handlers: {}, options: { cursor: 'pointer' } },
      { label: 'drag-over', handlers: { onDragOver: clickHandler } },
      { label: 'focus', handlers: { onFocus: clickHandler } },
      { label: 'capture-only', handlers: { onClickCapture: clickHandler } },
      { label: 'pointer-capture-only', handlers: { onGotPointerCapture: clickHandler } },
      {
        label: 'explicit-true',
        handlers: { onMouseMove: clickHandler },
        options: { keyboardFocusable: true },
      },
      {
        label: 'explicit-empty-true',
        handlers: {},
        options: { keyboardFocusable: true },
      },
      {
        label: 'explicit-false',
        handlers: { onClick: clickHandler },
        options: { keyboardFocusable: false },
      },
    ];
    const Listener = defineComp(() => {
      crcEventListener({ onClick: clickHandler, onKeyDown: clickHandler });
    });
    const Root = defineComp(() => [
      ...definitions.map(definition => Target({
        key: definition.label,
        ...definition,
      })),
      Listener({}),
    ]);
    const { manager } = mountAndRender(withFocusManagement(Root({})));

    expect(candidateLabels(manager)).toEqual([
      'click',
      'keydown',
      'keyup',
      'explicit-true',
      'explicit-empty-true',
    ]);
    expect(manager.candidates.map(candidate => candidate.sourceIndex))
      .toEqual([0, 1, 2, 3, 4]);
  });

  it('keeps no focus manager, candidates, DOM mutation, or imperative snapshot API without the enhancer', () => {
    const snapshots: CRCEventTargetSnapshot[] = [];
    const Root = defineComp(() => {
      snapshots.push(crcEventTarget(
        { onClick: clickHandler },
        { path: rectanglePath(0, 0, 10, 10) },
      ));
    });
    const { canvas } = mountAndRender(Root({}), false);

    expect(getCRCInstance(canvas).eventRoot.focusPolicy).toBeUndefined();
    expect(snapshots).toEqual([{ isFocused: false, isFocusVisible: false }]);
    expect('focus' in snapshots[0]).toBe(false);
    expect(canvas.hasAttribute('tabindex')).toBe(false);
  });

  it('installs the complete structural bridge and reports manager-backed render snapshots', () => {
    const snapshots: CRCEventTargetSnapshot[] = [];
    const Root = defineComp(() => {
      snapshots.push(crcEventTarget(
        { onClick: clickHandler },
        { path: rectanglePath(0, 0, 10, 10) },
      ));
    });
    const mounted = mountAndRender(withFocusManagement(Root({})));
    const { manager } = mounted;

    expect(manager).toMatchObject({
      observeTarget: expect.any(Function),
      removeTarget: expect.any(Function),
      snapshot: expect.any(Function),
      resolveKeyboardTarget: expect.any(Function),
      afterDispatch: expect.any(Function),
    });
    expect(snapshots).toEqual([{ isFocused: false, isFocusVisible: false }]);

    const target = manager.candidates[0].target;
    manager.setFocusState(target, true);
    executeRender(mounted.canvas, 2, withFocusManagement(Root({})));

    expect(manager.resolveKeyboardTarget()).toBe(target);
    expect(snapshots.at(-1)).toEqual({
      isFocused: true,
      isFocusVisible: true,
    });
    expect('focus' in snapshots.at(-1)!).toBe(false);
  });
});

describe('candidate identity and atomic render collection', () => {
  it('preserves exact registrations across ordinary rerenders and keyed source-order changes', () => {
    const Root = defineComp(({ labels }: { labels: readonly string[] }) =>
      labels.map(label => Target({
        key: label,
        label,
        handlers: { onClick: clickHandler },
      }))
    );
    const mounted = mountAndRender(withFocusManagement(Root({ labels: ['a', 'b'] })));
    const firstTargets = new Map(
      mounted.manager.candidates.map(candidate => [
        candidateLabel(candidate),
        candidate.target,
      ]),
    );

    executeRender(
      mounted.canvas,
      2,
      withFocusManagement(Root({ labels: ['a', 'b'] })),
    );
    expect(candidateLabels(mounted.manager)).toEqual(['a', 'b']);
    expect(mounted.manager.candidates[0].target).toBe(firstTargets.get('a'));
    expect(mounted.manager.candidates[1].target).toBe(firstTargets.get('b'));

    executeRender(
      mounted.canvas,
      3,
      withFocusManagement(Root({ labels: ['b', 'a'] })),
    );
    expect(candidateLabels(mounted.manager)).toEqual(['b', 'a']);
    expect(mounted.manager.candidates[0].target).toBe(firstTargets.get('b'));
    expect(mounted.manager.candidates[1].target).toBe(firstTargets.get('a'));
  });

  it('uses exact remounted registrations after reparenting and clears removed focus silently', () => {
    const Wrapper = defineComp(({ child }: { child: CompEl<any, any> }) => child);
    const Root = defineComp(({
      reparented,
      visible,
    }: {
      reparented: boolean;
      visible: boolean;
    }) => {
      if (!visible) return;
      const target = Target({
        key: 'stable',
        label: 'stable',
        handlers: { onClick: clickHandler },
      });
      return reparented ? Wrapper({ child: target }) : target;
    });
    const mounted = mountAndRender(withFocusManagement(Root({
      reparented: false,
      visible: true,
    })));
    const original = mounted.manager.candidates[0].target;
    mounted.manager.setFocusState(original, true);

    executeRender(mounted.canvas, 2, withFocusManagement(Root({
      reparented: true,
      visible: true,
    })));
    const reparented = mounted.manager.candidates[0].target;
    expect(reparented).not.toBe(original);
    expect(mounted.manager.resolveKeyboardTarget()).toBeUndefined();
    expect(mounted.manager.snapshot(original)).toEqual({
      isFocused: false,
      isFocusVisible: false,
    });

    mounted.manager.setFocusState(reparented, true);
    expect(() => executeRender(mounted.canvas, 3, withFocusManagement(Root({
      reparented: true,
      visible: false,
    })))).not.toThrow();
    expect(mounted.manager.candidates).toEqual([]);
    expect(mounted.manager.resolveKeyboardTarget()).toBeUndefined();
  });

  it('never exposes a partially collected failed render', () => {
    const Throwing = defineComp(() => {
      throw new Error('expected focus render failure');
    });
    const Root = defineComp(({ fail }: { fail: boolean }) => [
      Target({
        key: fail ? 'partial' : 'committed',
        label: fail ? 'partial' : 'committed',
        handlers: { onClick: clickHandler },
      }),
      fail ? Throwing({}) : undefined,
    ]);
    const mounted = mountAndRender(withFocusManagement(Root({ fail: false })));
    const manager = mounted.manager;
    const committedTarget = manager.candidates[0].target;
    manager.setFocusState(committedTarget, true);

    expect(() => executeRender(
      mounted.canvas,
      2,
      withFocusManagement(Root({ fail: true })),
    )).toThrowError('expected focus render failure');

    expect(candidateLabels(manager)).not.toContain('partial');
    expect(manager.resolveKeyboardTarget()).toBeUndefined();
    expect(getCRCInstance(mounted.canvas).eventRoot.focusPolicy).toBeUndefined();
  });

  it('rejects a second manager on one event root with a targeted error', () => {
    const Root = defineComp(() => [
      withFocusManagement(Target({
        label: 'first',
        handlers: { onClick: clickHandler },
      })),
      withFocusManagement(Target({
        label: 'second',
        handlers: { onClick: clickHandler },
      })),
    ]);
    const canvas = createCanvas();
    const controller = mountCRC(canvas, Root({}));
    activeControllers.add(controller);

    expect(() => executeRender(canvas, 1)).toThrowError(
      /withFocusManagement.*one.*root|one.*focus manager.*root/i,
    );
  });
});

describe('directional boundaries and root-logical bounds', () => {
  it('requires a focus manager and records the nearest active directional boundary', () => {
    const BoundaryHost = defineComp(() => [
      Target({ key: 'inside-a', label: 'inside-a', handlers: { onClick: clickHandler } }),
      Target({ key: 'inside-b', label: 'inside-b', handlers: { onClick: clickHandler } }),
    ]);
    const WithoutManager = withKeyboardNavigation(
      BoundaryHost({}),
      { mode: 'directional' },
    );
    const canvas = createCanvas();
    const controller = mountCRC(canvas, WithoutManager);
    activeControllers.add(controller);
    expect(() => executeRender(canvas, 1)).toThrowError(
      /withKeyboardNavigation.*focus manager|withFocusManagement.*required/i,
    );

    controller.dispose();
    activeControllers.delete(controller);
    const Root = defineComp(() => [
      Target({ key: 'outside', label: 'outside', handlers: { onClick: clickHandler } }),
      withKeyboardNavigation(BoundaryHost({}), { mode: 'directional' }),
    ]);
    const mounted = mountAndRender(withFocusManagement(Root({})));
    const [outside, insideA, insideB] = mounted.manager.candidates;

    expect(outside.directionalBoundary).toBeUndefined();
    expect(insideA.directionalBoundary).toBeDefined();
    expect(insideB.directionalBoundary).toBe(insideA.directionalBoundary);
    expect(insideA.directionalBoundary?.candidates).toEqual([insideA, insideB]);
  });

  it('transforms all four local bounds corners into one root-logical AABB', () => {
    const BoundsTarget = defineComp((_props: {}, _style, ctx) => {
      ctx.transform(0, 2, -3, 0, 100, 50);
      crcEventTarget(
        { onClick: clickHandler },
        {
          path: rectanglePath(1, 2, 4, 5),
          keyboardNavigationBounds: { x: 1, y: 2, width: 4, height: 5 },
        },
      );
    });
    const { manager } = mountAndRender(withFocusManagement(BoundsTarget({})));

    expect(manager.candidates[0].rootBounds).toEqual({
      x: 79,
      y: 52,
      width: 15,
      height: 8,
    });
  });

  it('composes offscreen layer bridges into root-logical bounds', () => {
    const Inner = defineComp(() => {
      crcEventTarget(
        { onClick: clickHandler },
        {
          path: rectanglePath(2, 3, 4, 5),
          keyboardNavigationBounds: { x: 2, y: 3, width: 4, height: 5 },
        },
      );
    });
    const Root = defineComp(() => g({
      style: { translateX: 40, translateY: 30 },
      children: [layer({
        style: { width: 100, height: 80 },
        render: Inner({}),
      })],
    }));
    const { manager } = mountAndRender(withFocusManagement(Root({})));

    expect(manager.candidates[0].rootBounds).toEqual({
      x: 42,
      y: 33,
      width: 4,
      height: 5,
    });
  });

  it('replays unchanged offscreen subtrees in source order on an ordinary parent rerender', () => {
    const Inner = defineComp(() => Target({
      label: 'inside-layer',
      handlers: { onClick: clickHandler },
    }));
    const Root = defineComp(({ generation: _generation }: { generation: number }) => [
      Target({
        key: 'before',
        label: 'before',
        handlers: { onClick: clickHandler },
      }),
      layer({
        key: 'layer',
        style: { width: 100, height: 80 },
        render: withKeyboardNavigation(Inner({}), { mode: 'directional' }),
      }),
      Target({
        key: 'after',
        label: 'after',
        handlers: { onClick: clickHandler },
      }),
    ]);
    const mounted = mountAndRender(withFocusManagement(Root({ generation: 1 })));
    const inside = mounted.manager.candidates[1];

    executeRender(
      mounted.canvas,
      2,
      withFocusManagement(Root({ generation: 2 })),
    );

    expect(candidateLabels(mounted.manager)).toEqual([
      'before',
      'inside-layer',
      'after',
    ]);
    expect(mounted.manager.candidates[1].target).toBe(inside.target);
    expect(mounted.manager.candidates[1].directionalBoundary)
      .toBe(inside.directionalBoundary);
  });

  it('supplies known built-in rectangles and leaves arbitrary paths Tab-only without caller bounds', () => {
    const measureText = vi
      .spyOn(CanvasRenderingContext2D.prototype, 'measureText')
      .mockImplementation(value => ({
        width: value.length * 10,
        actualBoundingBoxAscent: 8,
        actualBoundingBoxDescent: 2,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: value.length * 10,
      }) as TextMetrics);
    const arbitrary = new Path2D('M 0 0 L 20 20');
    const Root = defineComp(() => [
      rect({
        key: 'rect',
        onClick: clickHandler,
        style: { x: 10, y: 20, width: 30, height: 40 },
      }),
      img({
        key: 'img',
        onClick: clickHandler,
        style: { src: '', x: 2, y: 3, width: 20, height: 10 },
      }),
      text({
        key: 'text',
        onClick: clickHandler,
        style: { text: 'abc', x: 10, y: 20 },
      }),
      line({
        key: 'line',
        onClick: clickHandler,
        style: {
          coords: [[0, 5], [20, 15]],
          lineInteractionWidth: 10,
        },
      }),
      horizontalLine({
        key: 'horizontal',
        onClick: clickHandler,
        style: { y: 10, x1: 5, x2: 25, lineInteractionWidth: 4 },
      }),
      verticalLine({
        key: 'vertical',
        onClick: clickHandler,
        style: { x: 10, y1: 5, y2: 25, lineInteractionWidth: 4 },
      }),
      path({
        key: 'path-missing',
        onClick: clickHandler,
        style: { d: arbitrary },
      }),
      path({
        key: 'path-supplied',
        onClick: clickHandler,
        keyboardNavigationBounds: { x: 7, y: 8, width: 9, height: 10 },
        style: { d: arbitrary },
      }),
      svgPath({
        key: 'svg-missing',
        onClick: clickHandler,
        style: { d: 'M 0 0 L 20 20' },
      }),
    ]);
    const { manager } = mountAndRender(withFocusManagement(Root({})));

    expect(manager.candidates.map(candidate => candidate.rootBounds)).toEqual([
      { x: 10, y: 20, width: 30, height: 40 },
      { x: 2, y: 3, width: 20, height: 10 },
      { x: 10, y: 12, width: 30, height: 10 },
      { x: -5, y: 0, width: 30, height: 20 },
      { x: 3, y: 8, width: 24, height: 4 },
      { x: 8, y: 3, width: 4, height: 24 },
      undefined,
      { x: 7, y: 8, width: 9, height: 10 },
      undefined,
    ]);
    measureText.mockRestore();
  });
});

interface TargetDefinition {
  readonly label: string;
  readonly handlers: CRCEventHandlers;
  readonly options?: Omit<CRCEventTargetOptions, 'path'>;
}

const Target = defineComp<TargetDefinition>(({
  handlers,
  options,
}) => {
  crcEventTarget(handlers, {
    path: rectanglePath(0, 0, 10, 10),
    ...options,
  });
});

function mountAndRender(
  element: CompEl<any, any>,
  expectManager = true,
): {
  canvas: HTMLCanvasElement;
  controller: CRCController;
  manager: ObservedFocusManager;
} {
  const canvas = createCanvas();
  const controller = mountCRC(canvas, element);
  activeControllers.add(controller);
  executeRender(canvas, 1);
  const policy = getCRCInstance(canvas).eventRoot.focusPolicy;
  if (expectManager && !policy) throw new Error('Expected a focus manager');
  return {
    canvas,
    controller,
    manager: policy as ObservedFocusManager,
  };
}

function candidateLabels(manager: ObservedFocusManager): string[] {
  return manager.candidates.map(candidateLabel);
}

function candidateLabel(candidate: ObservedCandidate): string {
  return (candidate.target.component.element.props as { label: string }).label;
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 200;
  document.body.appendChild(canvas);
  return canvas;
}

function rectanglePath(
  x: number,
  y: number,
  width: number,
  height: number,
): Path2D {
  const value = new Path2D();
  value.rect(x, y, width, height);
  return value;
}
