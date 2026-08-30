import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComp } from '../define-comp';
import type { CRCEventHandlers } from '../events/types';
import { getCRCInstance } from '../global-state';
import { crcEventListener } from '../hooks/crc-event-listener';
import { crcEventTarget } from '../hooks/crc-event-target';
import { componentTest } from '../test-utils/component-test';
import type { CompEl } from '../types';
import { horizontalLine } from './horizontal-line';
import { img } from './img';
import { layer } from './layer';
import { line } from './line';
import { path } from './path';
import { rect } from './rect';
import { svgPath } from './svg-path';
import { text } from './text';
import { verticalLine } from './vertical-line';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('built-in DOM-aligned event integration', () => {
  const builtIns: readonly {
    name: string;
    create: (handlers: CRCEventHandlers) => CompEl<any, any>;
  }[] = [
    {
      name: 'path',
      create: handlers => path({
        ...handlers,
        style: {
          d: rectanglePath(0, 0, 20, 20),
          fill: 'red',
        },
      }),
    },
    {
      name: 'rect',
      create: handlers => rect({
        ...handlers,
        style: { width: 20, height: 20, fill: 'red' },
      }),
    },
    {
      name: 'text',
      create: handlers => text({
        ...handlers,
        style: { text: 'target', fill: 'black' },
      }),
    },
    {
      name: 'img',
      create: handlers => img({
        ...handlers,
        style: {
          src: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
          width: 20,
          height: 20,
        },
      }),
    },
    {
      name: 'line',
      create: handlers => line({
        ...handlers,
        style: {
          coords: [[0, 0], [20, 20]],
          stroke: 'black',
          strokeWidth: 1,
          lineInteractionWidth: 8,
        },
      }),
    },
    {
      name: 'horizontalLine',
      create: handlers => horizontalLine({
        ...handlers,
        style: {
          y: 10,
          x2: 20,
          stroke: 'black',
          strokeWidth: 1,
          lineInteractionWidth: 8,
        },
      }),
    },
    {
      name: 'verticalLine',
      create: handlers => verticalLine({
        ...handlers,
        style: {
          x: 10,
          y2: 20,
          stroke: 'black',
          strokeWidth: 1,
          lineInteractionWidth: 8,
        },
      }),
    },
    {
      name: 'svgPath',
      create: handlers => svgPath({
        ...handlers,
        style: {
          d: 'M 0 0 L 20 20',
          stroke: 'black',
          strokeWidth: 1,
          lineInteractionWidth: 8,
        },
      }),
    },
  ];

  it.each(builtIns)(
    'registers one grouped pointer/touch/keyboard/focus/clipboard/drag target for $name',
    async ({ create }) => {
      const handlers: CRCEventHandlers = {
        onPointerDownCapture: () => undefined,
        onTouchStart: () => undefined,
        onKeyDownCapture: () => undefined,
        onFocus: () => undefined,
        onCopyCapture: () => undefined,
        onDragStart: () => undefined,
      };
      const canvas = await componentTest(create(handlers));
      const targets = Array.from(
        getCRCInstance(canvas.element).eventRoot.targets,
      );

      expect(targets).toHaveLength(1);
      expect(targets[0].handlers).toEqual({
        pointerdownCapture: handlers.onPointerDownCapture,
        touchstart: handlers.onTouchStart,
        keydownCapture: handlers.onKeyDownCapture,
        focus: handlers.onFocus,
        copyCapture: handlers.onCopyCapture,
        dragstart: handlers.onDragStart,
      });
    },
  );

  it('keeps a cursor-only built-in as one geometric target', async () => {
    const canvas = await componentTest(rect({
      style: {
        width: 20,
        height: 20,
        fill: 'red',
        cursor: 'pointer',
      },
    }));
    const targets = Array.from(
      getCRCInstance(canvas.element).eventRoot.targets,
    );

    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ cursor: 'pointer', handlers: {} });
  });

  it.each([
    { mode: 'non-forwarding', expectedTargets: 0 },
    { mode: 'forwarding', expectedTargets: 1 },
    { mode: 'explicit-hook', expectedTargets: 1 },
  ] as const)(
    'gives a $mode custom component only its explicit event participation',
    async ({ mode, expectedTargets }) => {
      const Silent = defineComp<CRCEventHandlers>((_props, _style, ctx) => {
        ctx.fillRect(0, 0, 20, 20);
      });
      const Forwarding = defineComp<CRCEventHandlers>(props => rect({
        ...props,
        style: { width: 20, height: 20, fill: 'red' },
      }));
      const ExplicitTarget = defineComp<CRCEventHandlers>(props => {
        crcEventTarget(props, {
          path: rectanglePath(0, 0, 20, 20),
          fill: true,
        });
      });
      const handlers: CRCEventHandlers = {
        onPointerDown: () => undefined,
      };
      const element = mode === 'non-forwarding' ? Silent(handlers) :
        mode === 'forwarding' ? Forwarding(handlers) :
        ExplicitTarget(handlers);
      const canvas = await componentTest(element);

      expect(getCRCInstance(canvas.element).eventRoot.targets.size)
        .toBe(expectedTargets);
    },
  );
});

describe('layer event ancestry', () => {
  it('captures above a layer, targets inside it, and bubbles back out', async () => {
    const trace: string[] = [];
    const Parent = defineComp(() => {
      crcEventListener({
        onClickCapture: () => trace.push('parent-capture'),
        onClick: () => trace.push('parent-bubble'),
      });
      return layer({
        render: rect({
          style: { width: 40, height: 40, fill: 'red' },
          onClick: () => trace.push('layer-target'),
        }),
      });
    });
    const canvas = await componentTest(Parent({}));

    await canvas.click({ position: { x: 20, y: 20 } });

    expect(trace).toEqual([
      'parent-capture',
      'layer-target',
      'parent-bubble',
    ]);
  });

  it('clears the parent-component bridge before child teardown', async () => {
    const drawImage = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      'drawImage',
    );
    const canvas = await componentTest(layer({
      render: rect({
        style: { width: 20, height: 20, fill: 'red' },
        onClick: () => undefined,
      }),
    }));
    const childCanvas = drawImage.mock.calls
      .map(call => call[0])
      .find(source => source instanceof OffscreenCanvas) as OffscreenCanvas;
    const child = getCRCInstance(childCanvas);
    let eventParentDuringChildTeardown: unknown = 'not-run';
    child.mainTeardowns.add(() => {
      eventParentDuringChildTeardown = child.eventParent;
    });

    expect(child.eventParent?.element.type.name).toBe('Layer');

    canvas.dispose();

    expect(eventParentDuringChildTeardown).toBeUndefined();
    expect(child.eventParent).toBeUndefined();
  });
});

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
