import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from '../element/create-element';
import type { CRCEventHandlers } from '../events/types';
import { getCRCInstance } from '../global-state';
import { crcEventListener } from '../hooks/crc-event-listener';
import { crcEventTarget } from '../hooks/crc-event-target';
import { componentTest } from '../test-utils/component-test';
import type { CRCElement } from '../types';
import { HorizontalLine } from './horizontal-line';
import { Image } from './img';
import { Layer } from './layer';
import { Line } from './line';
import { Path } from './path';
import { Rectangle } from './rect';
import { SvgPath } from './svg-path';
import { Text } from './text';
import { VerticalLine } from './vertical-line';
import { definePrimitive } from '../define-primitive';
import type { RenderingContext2D } from '../types';
import { Group } from './g';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('built-in DOM-aligned event integration', () => {
  const builtIns: readonly {
    name: string;
    create: (handlers: CRCEventHandlers) => CRCElement<any>;
  }[] = [
    {
      name: 'path',
      create: handlers => createElement(Path, {
        ...handlers,
        style: {
          d: rectanglePath(0, 0, 20, 20),
          fill: 'red',
        },
      }),
    },
    {
      name: 'rect',
      create: handlers => createElement(Rectangle, {
        ...handlers,
        style: { width: 20, height: 20, fill: 'red' },
      }),
    },
    {
      name: 'text',
      create: handlers => createElement(Text, {
        ...handlers,
        style: { fill: 'black' },
      }, 'target'),
    },
    {
      name: 'img',
      create: handlers => createElement(Image, {
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
      create: handlers => createElement(Line, {
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
      create: handlers => createElement(HorizontalLine, {
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
      create: handlers => createElement(VerticalLine, {
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
      create: handlers => createElement(SvgPath, {
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
    const canvas = await componentTest(createElement(Rectangle, {
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
      const Silent = definePrimitive<CRCEventHandlers>((_props, _style, ctx) => {
        ctx.fillRect(0, 0, 20, 20);
      });
      const Forwarding = (props: CRCEventHandlers) => createElement(Rectangle, {
        ...props,
        style: { width: 20, height: 20, fill: 'red' },
      });
      const ExplicitTarget = (props: CRCEventHandlers) => {
        crcEventTarget(props, {
          path: rectanglePath(0, 0, 20, 20),
          fill: true,
        });
      };
      const handlers: CRCEventHandlers = {
        onPointerDown: () => undefined,
      };
      const element = mode === 'non-forwarding' ? createElement(Silent, handlers) :
        mode === 'forwarding' ? createElement(Forwarding, handlers) :
        createElement(ExplicitTarget, handlers);
      const canvas = await componentTest(element);

      expect(getCRCInstance(canvas.element).eventRoot.targets.size)
        .toBe(expectedTargets);
    },
  );
});

describe('filtered Group event integration', () => {
  it('keeps source paint upright while registering and targeting original transformed geometry', async () => {
    const observedContexts: Array<{
      canvas: RenderingContext2D['canvas'];
      transform: DOMMatrix;
    }> = [];
    const onClick = vi.fn();
    const path = rectanglePath(0, 0, 20, 20);
    const Probe = definePrimitive<{}>((_props, _style, context) => {
      observedContexts.push({
        canvas: context.canvas,
        transform: context.getTransform(),
      });
      crcEventTarget({ onClick }, { path, fill: true });
      context.fillStyle = 'red';
      context.fill(path);
    });
    const style = {
      scaleX: 1.5,
      scaleY: 0.75,
      rotationDegrees: 30,
      translateX: 60,
      translateY: 20,
      filter: {
        type: 'dropShadow' as const,
        offsetX: 35,
        offsetY: 0,
        color: 'black',
      },
    };
    const expectedWorld = new DOMMatrix()
      .scale(style.scaleX, style.scaleY)
      .rotate(style.rotationDegrees)
      .translate(style.translateX, style.translateY);
    const canvas = await componentTest(createElement(Group, {
      style,
      children: createElement(Probe, {}),
    }), { width: 180, height: 100 });
    const target = Array.from(
      getCRCInstance(canvas.element).eventRoot.targets,
    )[0]!;

    expect(observedContexts).toHaveLength(1);
    expect(observedContexts[0]!.canvas).toBeInstanceOf(OffscreenCanvas);
    expect(observedContexts[0]!.transform.b).toBe(0);
    expect(observedContexts[0]!.transform.c).toBe(0);
    expect(matrixValues(target.paintEntry!.transform))
      .toEqual(matrixValues(expectedWorld));

    const originalCenter = expectedWorld.transformPoint(new DOMPoint(10, 10));
    const shadowCenter = expectedWorld.transformPoint(new DOMPoint(45, 10));
    await canvas.click({ position: originalCenter });
    await canvas.click({ position: shadowCenter });
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('layer event ancestry', () => {
  it('captures above a layer, targets inside it, and bubbles back out', async () => {
    const trace: string[] = [];
    const Parent = (_props: {}) => {
      crcEventListener({
        onClickCapture: () => trace.push('parent-capture'),
        onClick: () => trace.push('parent-bubble'),
      });
      return createElement(Layer, {
        children: createElement(Rectangle, {
          style: { width: 40, height: 40, fill: 'red' },
          onClick: () => trace.push('layer-target'),
        }),
      });
    };
    const canvas = await componentTest(createElement(Parent, {}));

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
    const Host = (_props: {}) => createElement(Layer, {
      children: createElement(Rectangle, {
        style: { width: 20, height: 20, fill: 'red' },
        onClick: () => undefined,
      }),
    });
    const canvas = await componentTest(createElement(Host, {}));
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

function matrixValues(matrix: DOMMatrixReadOnly): number[] {
  return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
}
