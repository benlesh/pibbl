import { peekNativeFilterPool } from './render-filter-boundary';
import { dropShadow, grayscale, hueRotate, opacity, brightness } from '@crc/core/filters';
import {
  Group,
  Image,
  Path,
  Rectangle,
  Text,
  crc,
  createElement,
  definePrimitive,
  type CRCController,
  type CRCNode,
  type RenderingContext2D,
  type SystemStyle,
} from '@crc/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSharedState, getCRCInstance } from '../global-state.js';
import { assertNativeCanvasFilter } from '../../filters/native-canvas-filter.js';

const controllers = new Set<CRCController>();

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  clearSharedState();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('filter rendering', () => {
  it('derives one drop shadow from a Path fill-and-stroke silhouette', async () => {
    const d = new Path2D();
    d.rect(10, 10, 20, 20);

    const canvas = await renderScene(createElement(Path, {
      style: {
        d,
        fill: 'red',
        stroke: 'blue',
        strokeWidth: 4,
        filter: dropShadow({ offsetX: 12, offsetY: 0, color: 'black' }),
      },
    }), 64, 48);

    expect(pixel(canvas, 38, 20)).toEqual([0, 0, 0, 255]);
    expect(pixel(canvas, 20, 20)).toEqual([255, 0, 0, 255]);
  });

  it('shadows Path fill and stroke once instead of stacking their alpha', async () => {
    const d = new Path2D();
    d.rect(10, 10, 20, 20);
    const shadow = dropShadow({
      offsetX: 40,
      offsetY: 0,
      color: 'rgb(0 0 0 / 50%)',
    });

    const combined = await renderScene(createElement(Path, {
      style: {
        d,
        fill: 'red',
        stroke: 'blue',
        strokeWidth: 8,
        filter: shadow,
      },
    }), 90, 50);
    const separate = await renderScene(createElement(Group, {
      children: [
        createElement(Path, {
          style: { d, fill: 'red', filter: shadow },
        }),
        createElement(Path, {
          style: { d, stroke: 'blue', strokeWidth: 8, filter: shadow },
        }),
      ],
    }), 90, 50);

    const combinedAlpha = pixel(combined, 52, 20)[3]!;
    const separateAlpha = pixel(separate, 52, 20)[3]!;
    expect(combinedAlpha).toBeGreaterThanOrEqual(120);
    expect(combinedAlpha).toBeLessThanOrEqual(136);
    expect(separateAlpha).toBeGreaterThanOrEqual(180);
    expect(separateAlpha).toBeLessThanOrEqual(200);
    expect(separateAlpha - combinedAlpha).toBeGreaterThan(40);
  });

  it('captures overlapping Group children as one combined silhouette', async () => {
    const canvas = await renderScene(createElement(Group, {
      style: {
        filter: dropShadow({ offsetX: 12, offsetY: 0, color: 'black' }),
      },
      children: [
        createElement(Rectangle, {
          style: { left: 10, top: 10, width: 30, height: 30, fill: 'red' },
        }),
        createElement(Rectangle, {
          style: { left: 30, top: 10, width: 30, height: 30, fill: 'blue' },
        }),
      ],
    }), 80, 60);

    expect(pixel(canvas, 20, 20)).toEqual([255, 0, 0, 255]);
    expect(pixel(canvas, 40, 20)).toEqual([0, 0, 255, 255]);
    expect(pixel(canvas, 66, 20)).toEqual([0, 0, 0, 255]);
  });

  it('shadows overlapping Group children once instead of stacking their alpha', async () => {
    const shadow = dropShadow({
      offsetX: 40,
      offsetY: 0,
      color: 'rgb(0 0 0 / 50%)',
    });
    const children = [
      createElement(Rectangle, {
        style: { left: 10, top: 10, width: 30, height: 30, fill: 'red' },
      }),
      createElement(Rectangle, {
        style: { left: 30, top: 10, width: 30, height: 30, fill: 'blue' },
      }),
    ];

    const combined = await renderScene(createElement(Group, {
      style: { filter: shadow },
      children,
    }), 100, 60);
    const separate = await renderScene(createElement(Group, {
      children: [
        createElement(Rectangle, {
          ...children[0]!.props,
          style: { ...children[0]!.props.style, filter: shadow },
        }),
        createElement(Rectangle, {
          ...children[1]!.props,
          style: { ...children[1]!.props.style, filter: shadow },
        }),
      ],
    }), 100, 60);

    const combinedAlpha = pixel(combined, 75, 20)[3]!;
    const separateAlpha = pixel(separate, 75, 20)[3]!;
    expect(combinedAlpha).toBeGreaterThanOrEqual(120);
    expect(combinedAlpha).toBeLessThanOrEqual(136);
    expect(separateAlpha).toBeGreaterThanOrEqual(180);
    expect(separateAlpha).toBeLessThanOrEqual(200);
    expect(separateAlpha - combinedAlpha).toBeGreaterThan(40);
  });

  it('keeps an empty filter list on the direct path without scratch surfaces', async () => {
    const contexts: RenderingContext2D[] = [];
    const DirectProbe = definePrimitive<{}, SystemStyle>((_props, _style, context) => {
      contexts.push(context);
      context.fillStyle = 'green';
      context.fillRect(1, 1, 4, 4);
    });

    const canvas = await renderScene(createElement(DirectProbe, {
      style: { filter: [] },
    }), 16, 16);

    expect(contexts).toHaveLength(1);
    expect(contexts[0]!.canvas).toBe(canvas);
    expect(peekNativeFilterPool(getCRCInstance(canvas))).toBeUndefined();
    expect(pixel(canvas, 2, 2)).toEqual([0, 128, 0, 255]);
  });

  it('assigns one ordered native chain and performs exactly two bitmap composites', async () => {
    const filterAssignments = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'filter',
      'set',
    );
    const sourceDraws = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'drawImage',
    );
    const parentDraws = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      'drawImage',
    );

    const canvas = await renderScene(createElement(Rectangle, {
      style: {
        left: 4,
        top: 4,
        width: 12,
        height: 12,
        fill: 'red',
        filter: [
          grayscale({ amount: 0.5 }),
          dropShadow({ offsetX: 3, offsetY: -2, color: 'black' }),
          hueRotate({ degrees: 45 }),
        ],
      },
    }), 32, 32);

    const nonDefaultAssignments = filterAssignments.mock.calls
      .map(([value]) => value)
      .filter(value => value !== 'none');
    expect(nonDefaultAssignments).toEqual([
      'grayscale(0.5) drop-shadow(3px -2px 0px black) hue-rotate(45deg)',
    ]);
    expect(sourceDraws).toHaveBeenCalledTimes(1);
    expect(sourceDraws.mock.calls[0]![0]).toBeInstanceOf(OffscreenCanvas);
    expect(sourceDraws.mock.calls[0]!.slice(1)).toEqual([-3, 0]);
    expect((sourceDraws.mock.instances[0] as OffscreenCanvasRenderingContext2D)
      .getTransform()).toEqual(new DOMMatrix());
    expect(parentDraws).toHaveBeenCalledTimes(1);
    expect(parentDraws.mock.calls[0]![0]).toBeInstanceOf(OffscreenCanvas);
    expect(parentDraws.mock.calls[0]!.slice(1)).toEqual([
      0, 0, 32, 32, -4, -4, 32, 32,
    ]);
    expect(pixel(canvas, 8, 8)[3]).toBe(255);
  });

  it('executes a filtered primitive and each returned child exactly once', async () => {
    const executions: string[] = [];
    const ChildProbe = definePrimitive<{ label: string }>((props, _style, context) => {
      executions.push(props.label);
      context.fillRect(1, 1, 2, 2);
    });
    const ParentProbe = definePrimitive<{ children: CRCNode }>((props) => {
      executions.push('parent');
      return props.children;
    });

    await renderScene(createElement(ParentProbe, {
      style: { filter: opacity({ amount: 0.75 }) },
      children: [
        createElement(ChildProbe, { label: 'first' }),
        createElement(ChildProbe, { label: 'second' }),
      ],
    }), 16, 16);

    expect(executions).toEqual(['parent', 'first', 'second']);
  });

  it('gives a filtered custom primitive an upright local OffscreenCanvas context', async () => {
    const observations: Array<{
      canvas: RenderingContext2D['canvas'];
      transform: DOMMatrix;
    }> = [];
    const Probe = definePrimitive<{}, SystemStyle>((_props, _style, context) => {
      observations.push({
        canvas: context.canvas,
        transform: context.getTransform(),
      });
      context.fillRect(2, 2, 4, 4);
    });

    await renderScene(createElement(Probe, {
      style: { filter: grayscale({ amount: 1 }) },
    }), 24, 16);

    expect(observations).toHaveLength(1);
    expect(observations[0]!.canvas).toBeInstanceOf(OffscreenCanvas);
    expect(observations[0]!.transform).toEqual(new DOMMatrix());
  });

  it('renders filtered Rectangle, Text, and Image content without pixel readback', async () => {
    const htmlGetImageData = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      'getImageData',
    );
    const htmlPutImageData = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      'putImageData',
    );
    const offscreenGetImageData = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'getImageData',
    );
    const offscreenPutImageData = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'putImageData',
    );
    const transferToImageBitmap = vi.spyOn(
      OffscreenCanvas.prototype,
      'transferToImageBitmap',
    );

    await renderScene(createElement(Group, {
      style: { filter: grayscale({ amount: 1 }) },
      children: [
        createElement(Rectangle, {
          style: { left: 2, top: 2, width: 8, height: 8, fill: 'red' },
        }),
        createElement(Text, {
          style: { left: 12, top: 2, fill: 'blue', font: '10px sans-serif' },
          children: 'filter',
        }),
        createElement(Image, {
          style: {
            src: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
            left: 2,
            top: 12,
            width: 8,
            height: 8,
            stroke: 'purple',
            strokeWidth: 1,
          },
        }),
      ],
    }), 64, 32);

    expect(htmlGetImageData).not.toHaveBeenCalled();
    expect(htmlPutImageData).not.toHaveBeenCalled();
    expect(offscreenGetImageData).not.toHaveBeenCalled();
    expect(offscreenPutImageData).not.toHaveBeenCalled();
    expect(transferToImageBitmap).not.toHaveBeenCalled();
  });

  it('rejects an invalid native drop-shadow color before source copy or callback', () => {
    const callback = vi.fn();
    const Probe = definePrimitive<{}, SystemStyle>(function renderProbe() {
      callback();
    });
    const lineWidthAssignments = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'lineWidth',
      'set',
    );
    const filterAssignments = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'filter',
      'set',
    );
    const canvas = createCanvas(32, 24);
    canvas.getContext('2d')!.lineWidth = 7;
    const runFrame = scheduleScene(canvas, createElement(Probe, {
      style: {
        filter: [
          grayscale({ amount: 1 }),
          dropShadow({ offsetX: 1, offsetY: 1, color: 'red' }),
          dropShadow({ offsetX: 2, offsetY: 2, color: 'not-a-color' }),
        ],
      },
    }));

    expect(runFrame).toThrow(/Probe.*filter\[2\]\.color.*native Canvas filter/);
    expect(callback).not.toHaveBeenCalled();
    expect(lineWidthAssignments.mock.calls.map(([value]) => value))
      .not.toContain(7);
    expect(filterAssignments.mock.calls.map(([value]) => value).filter(
      value => value !== 'none',
    )).toEqual([
      'grayscale(1) drop-shadow(1px 1px 0px red) drop-shadow(2px 2px 0px not-a-color)',
      'drop-shadow(1px 1px 0px red)',
      'drop-shadow(2px 2px 0px not-a-color)',
    ]);
    expect(peekNativeFilterPool(getCRCInstance(canvas))!.snapshot()).toMatchObject({
      activePairs: 0,
      pairCheckouts: 1,
      pairReturns: 1,
    });
  });

  it('reports a singular invalid color after full-chain-first native parsing', () => {
    const color = 'not-a-color';
    const callback = vi.fn();
    const Probe = definePrimitive<{}, SystemStyle>(function renderProbe() {
      callback();
    });
    const filterAssignments = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'filter',
      'set',
    );
    const canvas = createCanvas(32, 24);
    const runFrame = scheduleScene(canvas, createElement(Probe, {
      style: {
        filter: dropShadow({ offsetX: 2, offsetY: 2, color }),
      },
    }));

    expect(runFrame).toThrow(/Probe.*property filter\.color .*native Canvas filter/);
    expect(callback).not.toHaveBeenCalled();
    expect(filterAssignments.mock.calls.map(([value]) => value).filter(
      value => value !== 'none',
    )).toEqual([
      'drop-shadow(2px 2px 0px not-a-color)',
      'drop-shadow(2px 2px 0px not-a-color)',
    ]);
    expect(peekNativeFilterPool(getCRCInstance(canvas))!.snapshot()).toMatchObject({
      activePairs: 0,
      pairCheckouts: 1,
      pairReturns: 1,
    });
  });

  it.each([
    ['red) blur(100px', 'a filter-function injection'],
    ['red)', 'a truncated delimiter'],
  ])('rejects %s as %s before allocation', (color) => {
    const callback = vi.fn();
    const Probe = definePrimitive<{}, SystemStyle>(function renderProbe() {
      callback();
    });
    const filterAssignments = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'filter',
      'set',
    );
    const canvas = createCanvas(32, 24);
    const runFrame = scheduleScene(canvas, createElement(Probe, {
      style: {
        filter: dropShadow({ offsetX: 2, offsetY: 2, color }),
      },
    }));

    expect(runFrame).toThrow(/Probe.*property filter\.color .*balanced.*boundary/i);
    expect(callback).not.toHaveBeenCalled();
    expect(filterAssignments).not.toHaveBeenCalled();
    expect(peekNativeFilterPool(getCRCInstance(canvas))).toBeUndefined();
  });

  it.each([
    'currentColor',
    'var(--shadow)',
    'color-mix(in srgb, currentColor, red)',
    'rgb(from currentColor r g b)',
    'CanvasText',
    'Mark',
    'color-mix(in srgb, CanvasText, red)',
    'rgb(from Mark r g b)',
    'curr\\65 ntColor',
    'Canvas\\54 ext',
    'M\\61 rk',
    'light-dark(red, blue)',
    'color-mix(in srgb, light-dark(red, blue), black)',
    'l\\69 ght-dark(red, blue)',
    'env(--shadow, red)',
    'attr(data-shadow type(<color>), red)',
    'inherit(--shadow, red)',
    'if(style(--dark): white; else: black)',
    '-webkit-link',
    '-WEBKIT-LINK',
    '-webkit-activelink',
    '-WebKit-ActiveLink',
    '-\\77 ebkit-link',
    '-webkit-active\\6c ink',
    'color-mix(in srgb, -webkit-link, red)',
  ])(
    'rejects contextual color %s before the primitive callback',
    color => {
      const callback = vi.fn();
      const Probe = definePrimitive<{}, SystemStyle>(function renderProbe() {
        callback();
      });
      const filterAssignments = vi.spyOn(
        OffscreenCanvasRenderingContext2D.prototype,
        'filter',
        'set',
      );
      const canvas = createCanvas(32, 24);
      const runFrame = scheduleScene(canvas, createElement(Probe, {
        style: {
          filter: dropShadow({ offsetX: 2, offsetY: 2, color }),
        },
      }));

      expect(runFrame)
        .toThrow(/Probe.*property filter\.color .*contextual/);
      expect(callback).not.toHaveBeenCalled();
      expect(filterAssignments).not.toHaveBeenCalled();
      expect(peekNativeFilterPool(getCRCInstance(canvas))).toBeUndefined();
    },
  );

  it('reports an indexed nested vendor color before allocation or native assignment', () => {
    const callback = vi.fn();
    const Probe = definePrimitive<{}, SystemStyle>(function renderProbe() {
      callback();
    });
    const filterAssignments = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'filter',
      'set',
    );
    const canvas = createCanvas(32, 24);
    const runFrame = scheduleScene(canvas, createElement(Probe, {
      style: {
        filter: [
          grayscale({ amount: 1 }),
          dropShadow({ offsetX: 2, offsetY: 2, color: 'color-mix(in srgb, red, -webkit-active\\6c ink)' }),
        ],
      },
    }));

    expect(runFrame)
      .toThrow(/Probe.*property filter\[1\]\.color .*contextual/);
    expect(callback).not.toHaveBeenCalled();
    expect(filterAssignments).not.toHaveBeenCalled();
    expect(peekNativeFilterPool(getCRCInstance(canvas))).toBeUndefined();
  });

  it.each([
    'red',
    '#1234',
    'rgb(1 2 3 / 50%)',
    'hsl(120 50% 50%)',
    'hwb(120 10% 20%)',
    'lab(50% 20 30)',
    'lch(50% 20 30)',
    'oklab(50% .1 .1)',
    'oklch(50% .1 30)',
    'color(display-p3 1 0 0)',
    'color-mix(in srgb, red, blue)',
    'rgb(from red r g b)',
    'contrast-color(red)',
  ])('accepts concrete color %s', color => {
    const callback = vi.fn();
    const Probe = definePrimitive<{}, SystemStyle>(function renderProbe() {
      callback();
    });
    const canvas = createCanvas(32, 24);
    const runFrame = scheduleScene(canvas, createElement(Probe, {
      style: {
        filter: dropShadow({ offsetX: 2, offsetY: 2, color }),
      },
    }));

    expect(runFrame).not.toThrow();
    expect(callback).toHaveBeenCalledOnce();
  });

  it('parses a successful multi-shadow list only through one complete native filter assignment', () => {
    const callback = vi.fn();
    const Probe = definePrimitive<{}, SystemStyle>(function renderProbe() {
      callback();
    });
    const filterAssignments = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'filter',
      'set',
    );
    const fillAssignments = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'fillStyle',
      'set',
    );
    const canvas = createCanvas(32, 24);
    const runFrame = scheduleScene(canvas, createElement(Probe, {
      style: {
        filter: [
          dropShadow({ offsetX: 1, offsetY: 1, color: 'red' }),
          brightness({ amount: 1 }),
          dropShadow({ offsetX: 2, offsetY: 2, color: 'blue' }),
        ],
      },
    }));

    expect(runFrame).not.toThrow();
    expect(callback).toHaveBeenCalledOnce();
    expect(filterAssignments.mock.calls.map(([value]) => value).filter(
      value => value !== 'none',
    )).toEqual([
      'drop-shadow(1px 1px 0px red) brightness(1) drop-shadow(2px 2px 0px blue)',
    ]);
    expect(fillAssignments.mock.calls.map(([value]) => value))
      .not.toContain('red');
    expect(fillAssignments.mock.calls.map(([value]) => value))
      .not.toContain('blue');
  });

  it('reports rejection of an otherwise unsupported complete native chain', () => {
    const context = new OffscreenCanvas(8, 8).getContext('2d')!;

    expect(() => assertNativeCanvasFilter(
      context,
      'blur(1px) unsupported-filter(1)',
      'Probe',
    )).toThrow(/Probe.*property filter .*complete native Canvas filter chain is unsupported/);
  });
});

async function renderScene(
  root: CRCNode,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const canvas = createCanvas(width, height);
  controllers.add(crc(canvas, root, { pixelRatio: 1 }));
  await nextFrame();
  return canvas;
}

function scheduleScene(
  canvas: HTMLCanvasElement,
  root: CRCNode,
): () => void {
  let scheduled: FrameRequestCallback | undefined;
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
    scheduled = callback;
    return 1;
  });
  controllers.add(crc(canvas, root, { pixelRatio: 1 }));
  if (!scheduled) throw new Error('CRC did not schedule a render frame.');
  return () => scheduled!(0);
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  document.body.appendChild(canvas);
  return canvas;
}

function pixel(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
): number[] {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
