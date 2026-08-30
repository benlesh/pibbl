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
import { crcRef } from '../hooks/crc-ref';
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
  readonly isDestroyed: boolean;
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

  it.each([
    ['old-before-new', false],
    ['new-before-old', true],
  ] as const)('reconciles a sole replacement manager after unseen refs (%s)', (
    _label,
    reverseSlots,
  ) => {
    const OldHost = defineComp(() => withFocusManagement(Target({
      label: 'old',
      handlers: { onClick: clickHandler },
    })));
    const NewHost = defineComp(() => withFocusManagement(Target({
      label: 'new',
      handlers: { onClick: clickHandler },
    })));
    const Root = defineComp(({ replacement }: { replacement: boolean }) => {
      const oldSlot = replacement ? undefined : OldHost({ key: 'old-host' });
      const newSlot = replacement ? NewHost({ key: 'new-host' }) : undefined;
      return reverseSlots ? [newSlot, oldSlot] : [oldSlot, newSlot];
    });
    const mounted = mountAndRender(Root({ replacement: false }));
    const oldManager = mounted.manager;

    expect(() => executeRender(
      mounted.canvas,
      2,
      Root({ replacement: true }),
    )).not.toThrow();

    const newManager = getCRCInstance(mounted.canvas).eventRoot.focusPolicy as
      ObservedFocusManager;
    expect(newManager).not.toBe(oldManager);
    expect(candidateLabels(newManager)).toEqual(['new']);
  });

  it.each([
    ['old enhancer exits before the new one enters', false],
    ['new enhancer enters before the old one exits', true],
  ] as const)('reconciles a live sole-boundary move when %s', (
    _label,
    reverse,
  ) => {
    const Host = defineComp(({
      label,
      managed,
    }: {
      label: string;
      managed: boolean;
    }) => {
      const target = Target({ label, handlers: { onClick: clickHandler } });
      return managed ? withFocusManagement(target) : target;
    });
    const Root = defineComp(({ second }: { second: boolean }) => {
      const first = Host({ key: 'first', label: 'first', managed: !second });
      const next = Host({ key: 'second', label: 'second', managed: second });
      return reverse ? [next, first] : [first, next];
    });
    const mounted = mountAndRender(Root({ second: false }));
    const prior = mounted.manager;

    executeRender(mounted.canvas, 2, Root({ second: true }));

    const replacement = getCRCInstance(mounted.canvas).eventRoot.focusPolicy as
      ObservedFocusManager;
    expect(replacement).not.toBe(prior);
    expect(candidateLabels(replacement)).toEqual(['second']);
  });

  it('reconciles a keyed sole manager after reparenting its enhanced element', () => {
    const Left = defineComp(({ child }: { child: CompEl<any, any> }) => child);
    const Right = defineComp(({ child }: { child: CompEl<any, any> }) => child);
    const Root = defineComp(({ right }: { right: boolean }) => {
      const boundary = withFocusManagement(Target({
        key: 'stable-boundary',
        label: 'stable',
        handlers: { onClick: clickHandler },
      }));
      return right ? Right({ child: boundary }) : Left({ child: boundary });
    });
    const mounted = mountAndRender(Root({ right: false }));
    const prior = mounted.manager;

    executeRender(mounted.canvas, 2, Root({ right: true }));

    const replacement = getCRCInstance(mounted.canvas).eventRoot.focusPolicy as
      ObservedFocusManager;
    expect(replacement).not.toBe(prior);
    expect(candidateLabels(replacement)).toEqual(['stable']);
  });

  it('tears down every manager after a failed replacement and remounts fresh', () => {
    const Throwing = defineComp(() => {
      throw new Error('expected replacement failure');
    });
    const OldHost = defineComp(() => withFocusManagement(Target({
      label: 'old',
      handlers: { onClick: clickHandler },
    })));
    const NewHost = defineComp(() => withFocusManagement(defineComp(() => [
      Target({ label: 'new', handlers: { onClick: clickHandler } }),
      Throwing({}),
    ])({})));
    const Root = defineComp(({ replacement }: { replacement: boolean }) =>
      replacement ? NewHost({ key: 'new' }) : OldHost({ key: 'old' })
    );
    const mounted = mountAndRender(Root({ replacement: false }));
    const prior = mounted.manager;

    expect(() => executeRender(
      mounted.canvas,
      2,
      Root({ replacement: true }),
    )).toThrowError('expected replacement failure');

    expect(getCRCInstance(mounted.canvas).eventRoot.focusPolicy).toBeUndefined();
    expect(prior.isDestroyed).toBe(true);
    expect(prior.candidates).toEqual([]);

    executeRender(mounted.canvas, 3, Root({ replacement: false }));
    const recovered = getCRCInstance(mounted.canvas).eventRoot.focusPolicy as
      ObservedFocusManager;
    expect(recovered).not.toBe(prior);
    expect(candidateLabels(recovered)).toEqual(['old']);

    const eventRoot = getCRCInstance(mounted.canvas).eventRoot;
    mounted.controller.dispose();
    activeControllers.delete(mounted.controller);
    expect(eventRoot.focusPolicy).toBeUndefined();
  });

  it.each([
    ['cached layer before outer manager', false, false],
    ['outer manager before cached layer', true, false],
    ['nested cached layer before outer manager', false, true],
  ] as const)('replays a retained inner manager claim: %s', (
    _label,
    outerFirst,
    nested,
  ) => {
    let innerRenders = 0;
    const Inner = defineComp(() => {
      innerRenders++;
      return Target({
        label: 'inner',
        handlers: { onClick: clickHandler },
      });
    });
    const innerBoundary = () => withFocusManagement(Inner({}));
    const cachedRender = () => nested ? layer({
      style: { width: 30, height: 30 },
      render: innerBoundary(),
    }) : innerBoundary();
    const Root = defineComp(({ outer }: { outer: boolean }) => {
      const cached = layer({
        key: 'cached',
        style: { width: 40, height: 40 },
        render: cachedRender(),
      });
      const nextOuter = outer ? withFocusManagement(Target({
        key: 'outer',
        label: 'outer',
        handlers: { onClick: clickHandler },
      })) : undefined;
      return outerFirst ? [nextOuter, cached] : [cached, nextOuter];
    });
    const mounted = mountAndRender(Root({ outer: false }));
    const eventRoot = getCRCInstance(mounted.canvas).eventRoot;
    const priorInner = mounted.manager;
    expect(candidateLabels(priorInner)).toEqual(['inner']);
    expect(innerRenders).toBe(1);

    expect(() => executeRender(
      mounted.canvas,
      2,
      Root({ outer: true }),
    )).toThrowError(
      /withFocusManagement.*one.*root|one.*focus manager.*root/i,
    );

    expect(innerRenders).toBe(1);
    expect(eventRoot.focusPolicy).toBeUndefined();
    expect(priorInner.isDestroyed).toBe(true);
    expect(priorInner.candidates).toEqual([]);

    executeRender(mounted.canvas, 3, Root({ outer: false }));
    const recoveredInner = eventRoot.focusPolicy as ObservedFocusManager;
    expect(recoveredInner).toBeDefined();
    expect(recoveredInner).not.toBe(priorInner);
    expect(candidateLabels(recoveredInner)).toEqual(['inner']);
    expect(innerRenders).toBe(2);

    mounted.controller.dispose();
    activeControllers.delete(mounted.controller);
    expect(eventRoot.focusPolicy).toBeUndefined();
  });

  it('reports an ineligible focused target as unfocused during that render', () => {
    const snapshots: CRCEventTargetSnapshot[] = [];
    const Root = defineComp(({ eligible }: { eligible: boolean }) => {
      snapshots.push(crcEventTarget(
        eligible ? { onClick: clickHandler } : {},
        {
          path: rectanglePath(0, 0, 10, 10),
          keyboardFocusable: eligible,
        },
      ));
    });
    const mounted = mountAndRender(withFocusManagement(Root({ eligible: true })));
    const target = mounted.manager.candidates[0].target;
    mounted.manager.setFocusState(target, true);

    executeRender(
      mounted.canvas,
      2,
      withFocusManagement(Root({ eligible: false })),
    );

    expect(snapshots.at(-1)).toEqual({
      isFocused: false,
      isFocusVisible: false,
    });
    expect(mounted.manager.resolveKeyboardTarget()).toBeUndefined();
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
    let renders = 0;
    const hookValues: object[] = [];
    const Inner = defineComp(() => {
      renders++;
      hookValues.push(crcRef({}).current!);
      return Target({
        label: 'inside-layer',
        handlers: { onClick: clickHandler },
      });
    });
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
    expect(renders).toBe(1);

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
    expect(renders).toBe(1);
    expect(hookValues).toHaveLength(1);
  });

  it('replays a cached nested directional boundary without enrolling it in the outer direct set', () => {
    let renders = 0;
    const Inner = defineComp(() => {
      renders++;
      return Target({
        label: 'inner',
        handlers: { onClick: clickHandler },
      });
    });
    const Host = defineComp(({ generation: _generation }: { generation: number }) => [
      Target({ key: 'before', label: 'before', handlers: { onClick: clickHandler } }),
      layer({
        key: 'layer',
        style: { width: 40, height: 40 },
        render: withKeyboardNavigation(Inner({}), { mode: 'directional' }),
      }),
      Target({ key: 'after', label: 'after', handlers: { onClick: clickHandler } }),
    ]);
    const element = (generation: number) => withFocusManagement(
      withKeyboardNavigation(Host({ generation }), { mode: 'directional' }),
    );
    const mounted = mountAndRender(element(1));
    const innerBoundary = mounted.manager.candidates[1].directionalBoundary!;
    const outerBoundary = mounted.manager.candidates[0].directionalBoundary!;

    executeRender(mounted.canvas, 2, element(2));

    expect(candidateLabels(mounted.manager)).toEqual(['before', 'inner', 'after']);
    expect(renders).toBe(1);
    expect(innerBoundary.candidates.map(candidateLabel)).toEqual(['inner']);
    expect(outerBoundary.candidates.map(candidateLabel)).toEqual(['before', 'after']);
  });

  it('uses the current layer bridge for an inner manager on first render and cached movement', () => {
    let renders = 0;
    const Inner = defineComp(() => {
      renders++;
      return Target({
        label: 'inside',
        handlers: { onClick: clickHandler },
        options: {
          keyboardNavigationBounds: { x: 2, y: 3, width: 4, height: 5 },
        },
      });
    });
    const Root = defineComp(({ x }: { x: number }) => g({
      style: { translateX: x, translateY: 10 },
      children: [layer({
        style: { width: 40, height: 40 },
        render: withFocusManagement(
          withKeyboardNavigation(Inner({}), { mode: 'directional' }),
        ),
      })],
    }));
    const mounted = mountAndRender(Root({ x: 20 }));

    expect(mounted.manager.candidates[0].rootBounds).toEqual({
      x: 22,
      y: 13,
      width: 4,
      height: 5,
    });
    expect(mounted.manager.candidates[0].directionalBoundary).toBeDefined();

    executeRender(mounted.canvas, 2, Root({ x: 50 }));

    expect(renders).toBe(1);
    expect(mounted.manager.candidates[0].rootBounds).toEqual({
      x: 52,
      y: 13,
      width: 4,
      height: 5,
    });
  });

  it.each([
    ['focus outside', (element: CompEl<any, any>) => withFocusManagement(
      withKeyboardNavigation(element, { mode: 'directional' }),
    )],
    ['directional outside', (element: CompEl<any, any>) => withKeyboardNavigation(
      withFocusManagement(element),
      { mode: 'directional' },
    )],
  ] as const)('composes both built-in enhancers on one exact element: %s', (
    _label,
    enhance,
  ) => {
    const element = Target({ label: 'same', handlers: { onClick: clickHandler } });
    const enhanced = enhance(element);
    const mounted = mountAndRender(enhanced);

    expect(enhanced.type).toBe(element.type);
    expect(enhanced.key).toBe(element.key);
    expect(mounted.manager.candidates).toHaveLength(1);
    expect(mounted.manager.candidates[0].directionalBoundary).toBeDefined();
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
