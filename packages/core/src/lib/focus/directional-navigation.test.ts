import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComp } from '../define-comp';
import type { CRCEventTargetRegistration } from '../events/registrations';
import type { CRCEventHandlers } from '../events/types';
import { executeRender } from '../execute-render';
import { clearSharedState, getCRCInstance } from '../global-state';
import { crcEventTarget } from '../hooks/crc-event-target';
import type { LayoutBox } from '../layout/types';
import { mountCRC } from '../mount-crc';
import type { CompEl, CRCController } from '../types';
import {
  findDirectionalCandidate,
  scoreDirectionalCandidate,
  type CRCDirection,
} from './directional-navigation';
import type { CRCFocusManager } from './focus-manager';
import type { CRCFocusCandidate } from './types';
import { withFocusManagement } from './with-focus-management';
import { withKeyboardNavigation } from './with-keyboard-navigation';

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

describe('directional candidate scoring', () => {
  it('uses the exact beam, forward-edge, perpendicular-center, and source tuple', () => {
    const current = candidate(0, { x: 10, y: 10, width: 10, height: 10 });
    const beam = candidate(7, { x: 25, y: 12, width: 10, height: 4 });
    const offAxis = candidate(8, { x: 25, y: 30, width: 10, height: 10 });

    expect(scoreDirectionalCandidate(current, beam, 'right'))
      .toEqual([0, 5, 1, 7]);
    expect(scoreDirectionalCandidate(current, offAxis, 'right'))
      .toEqual([1, 5, 20, 8]);
  });

  it('navigates a regular grid, vertical list, and horizontal toolbar', () => {
    const current = candidate(4, { x: 20, y: 20, width: 10, height: 10 });
    const choices = [
      candidate(0, { x: 0, y: 20, width: 10, height: 10 }),
      candidate(1, { x: 40, y: 20, width: 10, height: 10 }),
      candidate(2, { x: 20, y: 0, width: 10, height: 10 }),
      candidate(3, { x: 20, y: 40, width: 10, height: 10 }),
    ];
    const expected = [choices[0], choices[1], choices[2], choices[3]];

    for (const [index, direction] of (
      ['left', 'right', 'up', 'down'] as const
    ).entries()) {
      expect(findDirectionalCandidate(current, choices, direction))
        .toBe(expected[index]);
    }
  });

  it('prefers an overlapping beam for uneven cards before a closer diagonal', () => {
    const current = candidate(0, { x: 0, y: 0, width: 20, height: 40 });
    const closeDiagonal = candidate(1, { x: 21, y: 50, width: 40, height: 10 });
    const distantBeam = candidate(2, { x: 100, y: 15, width: 10, height: 10 });

    expect(findDirectionalCandidate(
      current,
      [closeDiagonal, distantBeam],
      'right',
    )).toBe(distantBeam);
  });

  it('falls back off axis and ranks diagonal candidates by edge then perpendicular distance', () => {
    const current = candidate(0, { x: 10, y: 10, width: 10, height: 10 });
    const fartherEdge = candidate(1, { x: 40, y: 35, width: 10, height: 10 });
    const nearerEdge = candidate(2, { x: 25, y: 50, width: 10, height: 10 });
    const sameEdgeNearerCenter = candidate(3, { x: 25, y: 30, width: 10, height: 10 });

    expect(findDirectionalCandidate(
      current,
      [fartherEdge, nearerEdge, sameEdgeNearerCenter],
      'right',
    )).toBe(sameEdgeNearerCenter);
  });

  it('allows overlapping forward rectangles but excludes centers outside the half-plane', () => {
    const current = candidate(0, { x: 0, y: 0, width: 20, height: 20 });
    const overlappingForward = candidate(1, { x: 10, y: 5, width: 20, height: 10 });
    const extendsRightButCenterIsLeft = candidate(2, {
      x: -20,
      y: 5,
      width: 40,
      height: 10,
    });
    const sameCenter = candidate(3, { x: 5, y: 5, width: 10, height: 10 });

    expect(scoreDirectionalCandidate(current, overlappingForward, 'right'))
      .toEqual([0, 0, 0, 1]);
    expect(scoreDirectionalCandidate(
      current,
      extendsRightButCenterIsLeft,
      'right',
    )).toBeUndefined();
    expect(scoreDirectionalCandidate(current, sameCenter, 'right'))
      .toBeUndefined();
  });

  it('normalizes negative and zero rectangles and discards missing or non-finite bounds', () => {
    const current = candidate(0, { x: 20, y: 20, width: -10, height: -10 });
    const zeroWidth = candidate(1, { x: 30, y: 20, width: 0, height: -10 });
    const missing = candidate(2, undefined);
    const infinite = candidate(3, {
      x: Number.POSITIVE_INFINITY,
      y: 0,
      width: 10,
      height: 10,
    });

    expect(scoreDirectionalCandidate(current, zeroWidth, 'right'))
      .toEqual([0, 10, 0, 1]);
    expect(findDirectionalCandidate(
      current,
      [missing, infinite, zeroWidth],
      'right',
    )).toBe(zeroWidth);
    expect(findDirectionalCandidate(missing, [zeroWidth], 'right'))
      .toBeUndefined();
  });

  it('keeps fractional geometry unrounded and breaks exact geometry ties by source index', () => {
    const current = candidate(10, { x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
    const later = candidate(9, { x: 0.6, y: 0.2, width: 0.1, height: 0.4 });
    const earlier = candidate(2, { x: 0.6, y: 0.2, width: 0.1, height: 0.4 });

    expect(scoreDirectionalCandidate(current, earlier, 'right'))
      .toEqual([0, 0.19999999999999996, 0, 2]);
    expect(findDirectionalCandidate(current, [later, earlier], 'right'))
      .toBe(earlier);
  });
});

describe('directional keyboard defaults', () => {
  it('runs after propagation, follows transformed root bounds, and transitions through focus events', () => {
    const trace: string[] = [];
    const Root = defineComp(() => withKeyboardNavigation(
      Scene({
        definitions: [
          {
            label: 'current',
            x: 50,
            y: 50,
            handlers: focusTrace('current', trace, {
              onKeyDown: () => trace.push('keydown:current'),
            }),
          },
          {
            label: 'down',
            x: 50,
            y: 100,
            handlers: focusTrace('down', trace),
          },
          {
            label: 'right',
            x: 100,
            y: 50,
            handlers: focusTrace('right', trace),
          },
        ],
      }),
      { mode: 'directional' },
    ));
    const mounted = mountAndRender(withFocusManagement(Root({})));
    mounted.canvas.focus({ preventScroll: true });
    trace.length = 0;

    const event = arrowEvent('ArrowRight');
    expect(mounted.canvas.dispatchEvent(event)).toBe(false);

    expect(event.defaultPrevented).toBe(true);
    expect(focusedLabel(mounted.manager)).toBe('right');
    expect(mounted.manager.logicalFocusVisible).toBe(true);
    expect(trace).toEqual([
      'keydown:current',
      'focusout:current',
      'blur:current',
      'focusin:right',
      'focus:right',
    ]);
  });

  it('scores only direct members of the focused target boundary', () => {
    const Inner = defineComp(() => Scene({
      definitions: [
        { label: 'current', x: 0, y: 0 },
        { label: 'direct-far', x: 100, y: 0 },
      ],
    }));
    const Root = defineComp(() => [
      withKeyboardNavigation(Inner({}), { mode: 'directional' }),
      Target({ label: 'outside-close', x: 20, y: 0 }),
    ]);
    const mounted = mountAndRender(withFocusManagement(Root({})));
    mounted.canvas.focus({ preventScroll: true });

    const event = arrowEvent('ArrowRight');
    mounted.canvas.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(focusedLabel(mounted.manager)).toBe('direct-far');
  });

  it('does nothing when propagation prevents the arrow or no winner exists', () => {
    const Root = defineComp(() => withKeyboardNavigation(Scene({
      definitions: [
        {
          label: 'left',
          x: 0,
          y: 0,
          handlers: {
            onKeyDown: event => {
              if (event.key === 'ArrowRight') event.preventDefault();
            },
          },
        },
        { label: 'right', x: 50, y: 0 },
      ],
    }), { mode: 'directional' }));
    const mounted = mountAndRender(withFocusManagement(Root({})));
    mounted.canvas.focus({ preventScroll: true });

    const prevented = arrowEvent('ArrowRight');
    mounted.canvas.dispatchEvent(prevented);
    expect(prevented.defaultPrevented).toBe(true);
    expect(focusedLabel(mounted.manager)).toBe('left');

    mounted.manager.setFocusState(mounted.manager.candidates[1].target, true);
    const noWinner = arrowEvent('ArrowRight');
    expect(mounted.canvas.dispatchEvent(noWinner)).toBe(true);
    expect(noWinner.defaultPrevented).toBe(false);
    expect(focusedLabel(mounted.manager)).toBe('right');
  });

  it('leaves a focused Tab-only target unchanged', () => {
    const Root = defineComp(() => withKeyboardNavigation(Scene({
      definitions: [
        { label: 'missing', bounds: null, x: 0, y: 0 },
        { label: 'right', x: 50, y: 0 },
      ],
    }), { mode: 'directional' }));
    const mounted = mountAndRender(withFocusManagement(Root({})));
    mounted.canvas.focus({ preventScroll: true });

    const event = arrowEvent('ArrowRight');
    mounted.canvas.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(focusedLabel(mounted.manager)).toBe('missing');
  });
});

interface TargetDefinition {
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly bounds?: Readonly<LayoutBox> | null;
  readonly handlers?: CRCEventHandlers;
}

const Target = defineComp<TargetDefinition>(({
  x,
  y,
  bounds = { x: 0, y: 0, width: 10, height: 10 },
  handlers = { onClick: noop },
}, _style, context) => {
  context.translate(x, y);
  crcEventTarget(handlers, {
    path: rectanglePath(0, 0, 10, 10),
    keyboardFocusable: true,
    keyboardNavigationBounds: bounds ?? undefined,
  });
});

const Scene = defineComp<{
  readonly definitions: readonly TargetDefinition[];
}>(({ definitions }) => definitions.map(definition => Target({
  key: definition.label,
  ...definition,
})));

function candidate(
  sourceIndex: number,
  rootBounds: Readonly<LayoutBox> | undefined,
): CRCFocusCandidate {
  return {
    target: {} as CRCEventTargetRegistration,
    sourceIndex,
    directionalBoundary: undefined,
    rootBounds,
  };
}

function focusTrace(
  label: string,
  trace: string[],
  handlers: CRCEventHandlers = {},
): CRCEventHandlers {
  return {
    onClick: noop,
    onFocusOut: () => trace.push(`focusout:${label}`),
    onBlur: () => trace.push(`blur:${label}`),
    onFocusIn: () => trace.push(`focusin:${label}`),
    onFocus: () => trace.push(`focus:${label}`),
    ...handlers,
  };
}

function mountAndRender(
  element: CompEl<any, any>,
): {
  readonly canvas: HTMLCanvasElement;
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
  return { canvas, manager };
}

function focusedLabel(manager: CRCFocusManager): string | undefined {
  const target = manager.resolveKeyboardTarget();
  return target ?
    (target.component.element.props as { label: string }).label :
    undefined;
}

function arrowEvent(key: `Arrow${Capitalize<CRCDirection>}`): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    code: key,
    bubbles: true,
    cancelable: true,
  });
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
