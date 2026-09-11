import {
  Absolute,
  Group,
  Rectangle,
  crc,
  crcPlayback,
  createElement,
  definePrimitive,
  signal,
  track,
  tween,
  type CRCController,
  type CRCNode,
  type CRCPlayback,
  type RenderingContext2D,
  type SystemStyle,
} from '@crc/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearSharedState,
  getCRCInstance,
  GLOBAL_STATE,
} from '../global-state.js';
import { crcEventTarget } from '../hooks/crc-event-target.js';
import { focusManaged } from '../focus/policy-test-support.js';
import { executeRender } from '../execute-render.js';
import { mountCRC } from '../mount-crc.js';
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from '../scheduler/testing.js';
import type { RenderTargetSnapshot } from '../render-target.js';
import { FilterSurfacePool } from './filter-surface-pool.js';
import { renderFilterBoundary } from './render-filter-boundary.js';

const controllers = new Set<CRCController>();

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  clearSharedState();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('filter integration', () => {
  it('composites three nested boundaries inside-out with one traversal', async () => {
    const executions: string[] = [];
    const Counted = ({ label, children }: { label: string; children: CRCNode }) => {
      executions.push(label);
      return children;
    };
    const filterAssignments = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'filter',
      'set',
    );
    const appliedDrawFilters: string[] = [];
    const nativeOffscreenDrawImage =
      OffscreenCanvasRenderingContext2D.prototype.drawImage;
    const offscreenDraws = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'drawImage',
    ).mockImplementation(function(
      this: OffscreenCanvasRenderingContext2D,
      ...args: Parameters<OffscreenCanvasRenderingContext2D['drawImage']>
    ) {
      appliedDrawFilters.push(this.filter);
      return nativeOffscreenDrawImage.apply(this, args);
    });
    const parentDraws = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      'drawImage',
    );
    const rectanglePaths = vi.spyOn(Path2D.prototype, 'rect');

    const canvas = await renderScene(createElement(Counted, {
      label: 'outer',
      children: createElement(Group, {
        style: { filter: { type: 'blur', radius: 4 } },
        children: createElement(Counted, {
          label: 'middle',
          children: createElement(Group, {
            style: {
              filter: {
                type: 'dropShadow',
                offsetX: 6,
                offsetY: 3,
                blurRadius: 2,
                color: 'black',
              },
            },
            children: createElement(Counted, {
              label: 'inner',
              children: createElement(Rectangle, {
                style: {
                  x: 20,
                  y: 20,
                  width: 30,
                  height: 30,
                  fill: 'red',
                  filter: { type: 'grayscale', amount: 1 },
                },
              }),
            }),
          }),
        }),
      }),
    }), 96, 80);

    const validationAssignments = filterAssignments.mock.calls
      .map(([value]) => value)
      .filter(value => value !== 'none');
    // Ruling 1 preflights each boundary before entering its subtree. The
    // drawImage sequence below is the observable filter-effect order.
    expect(validationAssignments).toEqual([
      'blur(4px)',
      'drop-shadow(6px 3px 2px black)',
      'grayscale(1)',
    ]);
    expect(executions).toEqual(['outer', 'middle', 'inner']);
    expect(rectanglePaths).toHaveBeenCalledOnce();
    expect(offscreenDraws).toHaveBeenCalledTimes(5);
    expect(parentDraws).toHaveBeenCalledOnce();
    expect(appliedDrawFilters).toEqual([
      'grayscale(1)',
      'none',
      'drop-shadow(6px 3px 2px black)',
      'none',
      'blur(4px)',
    ]);
    expect(offscreenDraws.mock.invocationCallOrder[4])
      .toBeLessThan(parentDraws.mock.invocationCallOrder[0]!);
    expect(getCRCInstance(canvas).filterSurfacePool.snapshot()).toMatchObject({
      surfaceSlots: 6,
      activePairs: 0,
      peakActivePairs: 3,
      pairCheckouts: 3,
      pairReturns: 3,
    });
    const subject = pixel(canvas, 35, 35);
    expect(Math.max(subject[0]!, subject[1]!, subject[2]!) -
      Math.min(subject[0]!, subject[1]!, subject[2]!)).toBeLessThanOrEqual(2);
    expect(subject[3]).toBeGreaterThan(220);
    expect(pixel(canvas, 56, 40)[3]).toBeGreaterThan(0);
  });

  it('uses one native chain and one pair while preserving list order', async () => {
    const filterAssignments = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'filter',
      'set',
    );
    const first = await renderScene(filteredRectangle([
      { type: 'grayscale', amount: 1 },
      {
        type: 'dropShadow',
        offsetX: 24,
        offsetY: 0,
        blurRadius: 0,
        color: 'blue',
      },
      { type: 'blur', radius: 1 },
    ]), 80, 40);

    expect(filterAssignments.mock.calls
      .map(([value]) => value)
      .filter(value => value !== 'none'))
      .toEqual([
        'grayscale(1) drop-shadow(24px 0px 0px blue) blur(1px)',
      ]);
    expect(getCRCInstance(first).filterSurfacePool.snapshot()).toMatchObject({
      surfaceSlots: 2,
      peakActivePairs: 1,
      pairCheckouts: 1,
      pairReturns: 1,
    });

    filterAssignments.mockClear();
    const swapped = await renderScene(filteredRectangle([
      {
        type: 'dropShadow',
        offsetX: 24,
        offsetY: 0,
        blurRadius: 0,
        color: 'blue',
      },
      { type: 'grayscale', amount: 1 },
      { type: 'blur', radius: 1 },
    ]), 80, 40);

    expect(filterAssignments.mock.calls
      .map(([value]) => value)
      .filter(value => value !== 'none'))
      .toEqual([
        'drop-shadow(24px 0px 0px blue) grayscale(1) blur(1px)',
      ]);
    expect(pixel(first, 48, 20)[2]).toBeGreaterThan(180);
    const swappedShadow = pixel(swapped, 48, 20);
    expect(Math.max(swappedShadow[0]!, swappedShadow[1]!, swappedShadow[2]!) -
      Math.min(swappedShadow[0]!, swappedShadow[1]!, swappedShadow[2]!))
      .toBeLessThanOrEqual(2);
  });

  it('renders a contrast-color drop shadow accepted by the native filter parser', async () => {
    const canvas = await renderScene(createElement(Rectangle, {
      style: {
        x: 2,
        y: 2,
        width: 4,
        height: 4,
        fill: 'red',
        filter: {
          type: 'dropShadow',
          offsetX: 8,
          offsetY: 0,
          color: 'contrast-color(red)',
        },
      },
    }), 18, 10);

    expect(pixel(canvas, 3, 3)).toEqual([255, 0, 0, 255]);
    expect(pixel(canvas, 11, 3)).toEqual([0, 0, 0, 255]);
  });

  it('retains off-viewport source influence at both output edges', async () => {
    const canvas = await renderScene(createElement(Group, {
      children: [
        createElement(Rectangle, {
          style: {
            x: -5,
            y: 8,
            width: 3,
            height: 16,
            fill: 'red',
            filter: { type: 'blur', radius: 3 },
          },
        }),
        createElement(Rectangle, {
          style: {
            x: 42,
            y: 8,
            width: 4,
            height: 16,
            fill: 'red',
            filter: {
              type: 'dropShadow',
              offsetX: -6,
              offsetY: 0,
              color: 'blue',
            },
          },
        }),
      ],
    }), 40, 32);

    expect(pixel(canvas, 0, 16)[3]).toBeGreaterThan(0);
    expect(pixel(canvas, 39, 16)[2]).toBeGreaterThan(180);
  });

  it('retains filter influence in contain letterbox pixels outside the nominal viewport', async () => {
    const checkouts = vi.spyOn(FilterSurfacePool.prototype, 'checkoutPair');
    const canvas = await renderFixedScene(
      createElement(Rectangle, {
        style: {
          x: 10,
          y: 0,
          width: 10,
          height: 5,
          fill: 'red',
          filter: {
            type: 'dropShadow',
            offsetX: 0,
            offsetY: -10,
            color: 'blue',
          },
        },
      }),
      { logicalWidth: 40, logicalHeight: 20, displayWidth: 40, displayHeight: 40, fit: 'contain' },
    );

    expect(checkouts).toHaveBeenCalledOnce();
    expect(checkouts.mock.calls[0]![0]).toMatchObject({
      output: {
        logicalBounds: { x: 0, y: -10, width: 40, height: 40 },
        backingWidth: 40,
        backingHeight: 40,
      },
      source: {
        logicalBounds: { x: 0, y: -10, width: 40, height: 50 },
        backingWidth: 40,
        backingHeight: 50,
      },
      density: 1,
    });
    expect(pixel(canvas, 15, 0)).toEqual([0, 0, 255, 255]);
    expect(pixel(canvas, 15, 4)).toEqual([0, 0, 255, 255]);
    expect(pixel(canvas, 15, 10)).toEqual([255, 0, 0, 255]);
  });

  it('uses the centered bitmap-visible rectangle for none', async () => {
    const checkouts = vi.spyOn(FilterSurfacePool.prototype, 'checkoutPair');
    const canvas = await renderFixedScene(
      createElement(Group, {
        style: { filter: { type: 'opacity', amount: 1 } },
        children: [
          createElement(Rectangle, {
            style: { x: -10, y: -10, width: 3, height: 3, fill: 'red' },
          }),
          createElement(Rectangle, {
            style: { x: 27, y: 17, width: 3, height: 3, fill: 'blue' },
          }),
        ],
      }),
      { logicalWidth: 20, logicalHeight: 10, displayWidth: 40, displayHeight: 30, fit: 'none' },
    );

    expect(checkouts.mock.calls[0]![0]).toMatchObject({
      output: {
        logicalBounds: { x: -10, y: -10, width: 40, height: 30 },
        backingWidth: 40,
        backingHeight: 30,
      },
      source: {
        logicalBounds: { x: -10, y: -10, width: 40, height: 30 },
        backingWidth: 40,
        backingHeight: 30,
      },
      density: 1,
    });
    expect(pixel(canvas, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixel(canvas, 39, 29)).toEqual([0, 0, 255, 255]);
  });

  it('uses the centered bitmap-visible rectangle for scale-down', async () => {
    const checkouts = vi.spyOn(FilterSurfacePool.prototype, 'checkoutPair');
    const canvas = await renderFixedScene(
      createElement(Group, {
        style: { filter: { type: 'opacity', amount: 1 } },
        children: [
          createElement(Rectangle, {
            style: { x: 0, y: -30, width: 4, height: 2, fill: 'red' },
          }),
          createElement(Rectangle, {
            style: { x: 0, y: 48, width: 4, height: 2, fill: 'blue' },
          }),
        ],
      }),
      { logicalWidth: 80, logicalHeight: 20, displayWidth: 40, displayHeight: 40, fit: 'scale-down' },
    );

    expect(checkouts.mock.calls[0]![0]).toMatchObject({
      output: {
        logicalBounds: { x: 0, y: -30, width: 80, height: 80 },
        backingWidth: 40,
        backingHeight: 40,
      },
      source: {
        logicalBounds: { x: 0, y: -30, width: 80, height: 80 },
        backingWidth: 40,
        backingHeight: 40,
      },
      density: 0.5,
    });
    expect(pixel(canvas, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixel(canvas, 0, 39)).toEqual([0, 0, 255, 255]);
  });

  it('clips cover capture and allocation to the bitmap-visible logical region', async () => {
    const checkouts = vi.spyOn(FilterSurfacePool.prototype, 'checkoutPair');
    const canvas = await renderFixedScene(
      createElement(Group, {
        style: { filter: { type: 'opacity', amount: 1 } },
        children: [
          createElement(Rectangle, {
            style: { x: 10, y: 0, width: 1, height: 20, fill: 'red' },
          }),
          createElement(Rectangle, {
            style: { x: 29, y: 0, width: 1, height: 20, fill: 'blue' },
          }),
        ],
      }),
      { logicalWidth: 40, logicalHeight: 20, displayWidth: 40, displayHeight: 40, fit: 'cover' },
    );

    expect(checkouts.mock.calls[0]![0]).toMatchObject({
      output: {
        logicalBounds: { x: 10, y: 0, width: 20, height: 20 },
        backingWidth: 40,
        backingHeight: 40,
      },
      source: {
        logicalBounds: { x: 10, y: 0, width: 20, height: 20 },
        backingWidth: 40,
        backingHeight: 40,
      },
      density: 2,
    });
    expect(pixel(canvas, 0, 20)).toEqual([255, 0, 0, 255]);
    expect(pixel(canvas, 39, 20)).toEqual([0, 0, 255, 255]);
  });

  it('uses root density exactly once for upright kernels before affine presentation', async () => {
    const sourceTransforms: DOMMatrix[] = [];
    const finalTransforms: DOMMatrix[] = [];
    const filterAssignments = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'filter',
      'set',
    );
    const nativeDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(function(
        this: CanvasRenderingContext2D,
        ...args: Parameters<CanvasRenderingContext2D['drawImage']>
      ) {
        finalTransforms.push(this.getTransform());
        return nativeDrawImage.apply(this, args);
      });
    const Probe = definePrimitive<{}>((_props, _style, context) => {
      sourceTransforms.push(context.getTransform());
      context.fillRect(2, 2, 4, 4);
    });

    await renderScene(createElement(Group, {
      style: {
        scaleX: 2,
        scaleY: 3,
        rotationDegrees: 90,
        translateX: 20,
        filter: { type: 'blur', radius: 1 },
      },
      children: createElement(Probe, {}),
    }), 100, 80, 2);

    expect(sourceTransforms).toHaveLength(1);
    expect(sourceTransforms[0]).toEqual(expect.objectContaining({
      a: 6,
      b: 0,
      c: 0,
      d: 6,
    }));
    expect(filterAssignments.mock.calls
      .map(([value]) => value)
      .filter(value => value !== 'none'))
      .toEqual(['blur(6px)']);
    expect(finalTransforms).toHaveLength(1);
    expect(Math.abs(finalTransforms[0]!.a)).toBeLessThan(1e-12);
    expect(Math.abs(finalTransforms[0]!.b)).toBeCloseTo(6, 12);
    expect(Math.abs(finalTransforms[0]!.c)).toBeCloseTo(4, 12);
    expect(Math.abs(finalTransforms[0]!.d)).toBeLessThan(1e-12);
  });

  it('executes a zero-scale filtered subtree once on a discard target', async () => {
    let executions = 0;
    const observations: Array<{
      canvas: RenderingContext2D['canvas'];
      transform: DOMMatrix;
      filter: string;
    }> = [];
    const onClick = vi.fn();
    const Probe = definePrimitive<{}>((_props, _style, context) => {
      executions += 1;
      observations.push({
        canvas: context.canvas,
        transform: context.getTransform(),
        filter: context.filter,
      });
      const path = new Path2D();
      path.rect(0, 0, 10, 10);
      crcEventTarget({ onClick }, { path, fill: true });
      context.fillRect(0, 0, 10, 10);
    });
    const parentDraw = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      'drawImage',
    );
    const canvas = await renderScene(createElement(Group, {
      style: {
        scaleX: 0,
        filter: { type: 'blur', radius: 2 },
      },
      children: createElement(Probe, {}),
    }), 40, 30);

    expect(executions).toBe(1);
    expect(observations).toHaveLength(1);
    expect(observations[0]!.canvas).toBeInstanceOf(OffscreenCanvas);
    expect(observations[0]!.canvas).not.toBe(canvas);
    expect(observations[0]!.transform).toEqual(new DOMMatrix());
    expect(observations[0]!.filter).toBe('none');
    expect(parentDraw).not.toHaveBeenCalled();
    dispatchClick(canvas, 2, 2);
    expect(onClick).not.toHaveBeenCalled();
    expect(getCRCInstance(canvas).eventRoot.targets.size).toBe(1);
    expect(getCRCInstance(canvas).filterSurfacePool.snapshot()).toMatchObject({
      surfaceSlots: 0,
      activePairs: 0,
      pairCheckouts: 0,
      pairReturns: 0,
    });
  });

  it('rejects a zero-scale concrete native color before the discard callback', () => {
    const callback = vi.fn();
    const frames = controlFrames();
    const baseline = temporaryGlobalSnapshot();
    const canvas = mountScheduled(createElement(Group, {
      style: {
        scaleX: 0,
        filter: {
          type: 'dropShadow',
          offsetX: 2,
          offsetY: 2,
          color: 'not-a-color',
        },
      },
      children: createElement(filteredCallbackProbe(callback), {}),
    }));

    expect(() => frames.runNext())
      .toThrow(/Group.*filter\.color.*native Canvas filter/i);
    expectFailureBaseline(canvas, baseline, callback, 0, {
      surfaceSlots: 0,
      pairCheckouts: 0,
      pairReturns: 0,
    });
  });

  it('rejects a zero-scale contextual color before allocating a discard target', () => {
    const callback = vi.fn();
    const Probe = filteredCallbackProbe(callback);
    const frames = controlFrames();
    const baseline = temporaryGlobalSnapshot();
    const offscreenConstructor = vi.spyOn(globalThis, 'OffscreenCanvas');
    const canvas = mountScheduled(createElement(Group, {
      style: {
        scaleX: 0,
        filter: {
          type: 'dropShadow',
          offsetX: 2,
          offsetY: 2,
          color: 'currentColor',
        },
      },
      children: createElement(Probe, {}),
    }));

    expect(() => frames.runNext()).toThrow(/Group.*filter\.color.*contextual/i);
    expect(offscreenConstructor).not.toHaveBeenCalled();
    expectFailureBaseline(canvas, baseline, callback, 0, {
      surfaceSlots: 0,
      pairCheckouts: 0,
      pairReturns: 0,
    });
  });

  it('rejects zero-scale rendering when the native filter accessor is missing', () => {
    const callback = vi.fn();
    const frames = controlFrames();
    const baseline = temporaryGlobalSnapshot();
    const prototype = OffscreenCanvasRenderingContext2D.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'filter')!;
    expect(Reflect.deleteProperty(prototype, 'filter')).toBe(true);
    const canvas = mountScheduled(createElement(Group, {
      style: { scaleX: 0, filter: { type: 'blur', radius: 1 } },
      children: createElement(filteredCallbackProbe(callback), {}),
    }));

    try {
      expect(() => frames.runNext())
        .toThrow(/Group.*native Canvas filter support/i);
      expectFailureBaseline(canvas, baseline, callback, 0, {
        surfaceSlots: 0,
        pairCheckouts: 0,
        pairReturns: 0,
      });
    } finally {
      Object.defineProperty(prototype, 'filter', descriptor);
    }
  });

  it('classifies a silently rejected zero-scale candidate as chain rejection', () => {
    const callback = vi.fn();
    const frames = controlFrames();
    const baseline = temporaryGlobalSnapshot();
    const prototype = OffscreenCanvasRenderingContext2D.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'filter')!;
    let assigned = 'none';
    const assignments: string[] = [];
    Object.defineProperty(prototype, 'filter', {
      configurable: true,
      enumerable: descriptor.enumerable,
      get() {
        return assigned;
      },
      set(value: string) {
        assignments.push(value);
        assigned = value === 'none' ? value : 'none';
      },
    });
    const canvas = mountScheduled(createElement(Group, {
      style: { scaleX: 0, filter: { type: 'blur', radius: 1 } },
      children: createElement(filteredCallbackProbe(callback), {}),
    }));

    try {
      expect(() => frames.runNext())
        .toThrow(/Group.*complete native Canvas filter chain is unsupported/i);
      expect(assignments).toEqual(['none', 'blur(1px)']);
      expectFailureBaseline(canvas, baseline, callback, 0, {
        surfaceSlots: 0,
        pairCheckouts: 0,
        pairReturns: 0,
      });
    } finally {
      Object.defineProperty(prototype, 'filter', descriptor);
    }
  });

  it('fails before a discard callback when the accepted chain cannot reset to none', () => {
    const callback = vi.fn();
    const frames = controlFrames();
    const prototype = OffscreenCanvasRenderingContext2D.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'filter')!;
    let assigned = 'none';
    Object.defineProperty(prototype, 'filter', {
      configurable: true,
      enumerable: descriptor.enumerable,
      get() {
        return assigned;
      },
      set(value: string) {
        if (assigned === 'none' || value !== 'none') assigned = value;
      },
    });
    const canvas = mountScheduled(createElement(Group, {
      style: { scaleX: 0, filter: { type: 'blur', radius: 1 } },
      children: createElement(filteredCallbackProbe(callback), {}),
    }));

    try {
      expect(() => frames.runNext())
        .toThrow(/Group.*native Canvas filter state could not reset to none/i);
      expect(callback).not.toHaveBeenCalled();
      expect(getCRCInstance(canvas).filterSurfacePool.snapshot())
        .toMatchObject({ activePairs: 0, pairCheckouts: 0, pairReturns: 0 });
    } finally {
      Object.defineProperty(prototype, 'filter', descriptor);
    }
  });

  it('rejects stale non-none discard state before assigning the candidate chain', () => {
    const callback = vi.fn();
    const frames = controlFrames();
    const baseline = temporaryGlobalSnapshot();
    const prototype = OffscreenCanvasRenderingContext2D.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'filter')!;
    const assignments: string[] = [];
    Object.defineProperty(prototype, 'filter', {
      configurable: true,
      enumerable: descriptor.enumerable,
      get() {
        return 'blur(9px)';
      },
      set(value: string) {
        assignments.push(value);
      },
    });
    const offscreenDraw = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'drawImage',
    );
    const parentDraw = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      'drawImage',
    );
    const canvas = mountScheduled(createElement(Group, {
      style: { scaleX: 0, filter: { type: 'grayscale', amount: 1 } },
      children: createElement(filteredCallbackProbe(callback), {}),
    }));

    try {
      expect(() => frames.runNext())
        .toThrow(/Group.*native Canvas filter state could not reset to none/i);
      expect(assignments).toEqual(['none']);
      expect(callback).not.toHaveBeenCalled();
      expect(offscreenDraw).not.toHaveBeenCalled();
      expect(parentDraw).not.toHaveBeenCalled();
      expectFailureBaseline(canvas, baseline, callback, 0, {
        surfaceSlots: 0,
        pairCheckouts: 0,
        pairReturns: 0,
      });
    } finally {
      Object.defineProperty(prototype, 'filter', descriptor);
    }
  });

  it('applies parent alpha, compositing, native filter, and shadow once to the completed boundary', async () => {
    const sourceStates: Array<ReturnType<typeof canvasState>> = [];
    const compositeStates: Array<ReturnType<typeof canvasState>> = [];
    const nativeDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(function(
        this: CanvasRenderingContext2D,
        ...args: Parameters<CanvasRenderingContext2D['drawImage']>
      ) {
        compositeStates.push(canvasState(this));
        return nativeDrawImage.apply(this, args);
      });
    const ParentState = definePrimitive<{ children: CRCNode }>(
      (props, _style, context) => {
        context.globalAlpha = 0.5;
        context.globalCompositeOperation = 'xor';
        context.filter = 'invert(1)';
        context.shadowBlur = 3;
        context.shadowColor = 'blue';
        context.shadowOffsetX = 5;
        context.shadowOffsetY = 2;
        return props.children;
      },
    );
    const FilteredProbe = definePrimitive<{}, SystemStyle>(
      (_props, _style, context) => {
        sourceStates.push(canvasState(context));
        context.fillStyle = 'red';
        context.fillRect(4, 4, 12, 12);
      },
    );

    await renderScene(createElement(ParentState, {
      children: createElement(FilteredProbe, {
        style: { filter: { type: 'opacity', amount: 1 } },
      }),
    }), 32, 24);

    expect(sourceStates).toEqual([{
      alpha: 1,
      composite: 'source-over',
      filter: 'none',
      shadowBlur: 0,
      shadowColor: 'rgba(0, 0, 0, 0)',
      shadowOffsetX: 0,
      shadowOffsetY: 0,
    }]);
    expect(compositeStates).toEqual([{
      alpha: 0.5,
      composite: 'xor',
      filter: 'invert(1)',
      shadowBlur: 3,
      shadowColor: '#0000ff',
      shadowOffsetX: 5,
      shadowOffsetY: 2,
    }]);
  });

  it('contains distinct descendant composite, native filter, and shadow effects inside capture', async () => {
    const finalStates: Array<ReturnType<typeof canvasState>> = [];
    const siblingStates: Array<ReturnType<typeof canvasState>> = [];
    const nativeDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(function(
        this: CanvasRenderingContext2D,
        ...args: Parameters<CanvasRenderingContext2D['drawImage']>
      ) {
        finalStates.push(canvasState(this));
        return nativeDrawImage.apply(this, args);
      });
    const StatefulChild = definePrimitive<{}>((_props, _style, context) => {
      context.fillStyle = 'red';
      context.fillRect(2, 2, 8, 8);
      context.globalCompositeOperation = 'destination-out';
      context.fillRect(4, 4, 3, 3);
      context.globalCompositeOperation = 'source-over';
      context.filter = 'invert(1)';
      context.fillStyle = 'red';
      context.fillRect(14, 2, 8, 8);
      context.filter = 'none';
      context.shadowColor = 'blue';
      context.shadowOffsetX = 10;
      context.fillStyle = 'red';
      context.fillRect(28, 2, 4, 6);
    });
    const Sibling = definePrimitive<{}>((_props, _style, context) => {
      siblingStates.push(canvasState(context));
      context.fillStyle = 'green';
      context.fillRect(42, 2, 8, 6);
    });
    const ParentClip = definePrimitive<{ children: CRCNode }>(
      (props, _style, context) => {
        const clip = new Path2D();
        clip.rect(0, 0, 44, 16);
        context.clip(clip);
        return props.children;
      },
    );
    const canvas = await renderScene(createElement(ParentClip, {
      children: [
        createElement(Group, {
          style: { filter: { type: 'opacity', amount: 1 } },
          children: createElement(StatefulChild, {}),
        }),
        createElement(Sibling, {}),
      ],
    }), 52, 18);

    expect(finalStates).toEqual([{
      alpha: 1,
      composite: 'source-over',
      filter: 'none',
      shadowBlur: 0,
      shadowColor: 'rgba(0, 0, 0, 0)',
      shadowOffsetX: 0,
      shadowOffsetY: 0,
    }]);
    expect(siblingStates).toEqual(finalStates);
    expect(pixel(canvas, 5, 5)).toEqual([0, 0, 0, 0]);
    expect(pixel(canvas, 16, 5)).toEqual([0, 255, 255, 255]);
    expect(pixel(canvas, 29, 4)).toEqual([255, 0, 0, 255]);
    expect(pixel(canvas, 39, 4)).toEqual([0, 0, 255, 255]);
    expect(pixel(canvas, 43, 4)).toEqual([0, 128, 0, 255]);
    expect(pixel(canvas, 47, 4)).toEqual([0, 0, 0, 0]);
  });

  it('does not transfer an implicit path but preserves self-contained Path2D drawing', async () => {
    const ParentPath = definePrimitive<{ children: CRCNode }>(
      (props, _style, context) => {
        context.beginPath();
        context.rect(2, 2, 8, 8);
        return props.children;
      },
    );
    const FilteredDraw = definePrimitive<{}, SystemStyle>(
      (_props, _style, context) => {
        context.strokeStyle = 'red';
        context.lineWidth = 4;
        context.stroke();
        const path = new Path2D();
        path.rect(16, 2, 8, 8);
        context.fillStyle = 'blue';
        context.fill(path);
      },
    );
    const canvas = await renderScene(createElement(ParentPath, {
      children: createElement(FilteredDraw, {
        style: { filter: { type: 'opacity', amount: 1 } },
      }),
    }), 32, 16);

    expect(pixel(canvas, 2, 5)).toEqual([0, 0, 0, 0]);
    expect(pixel(canvas, 20, 5)).toEqual([0, 0, 255, 255]);
  });

  it('captures upright after Absolute placement and clips completed overflow', async () => {
    const sourceTransforms: DOMMatrix[] = [];
    const Probe = definePrimitive<{}>((_props, _style, context) => {
      sourceTransforms.push(context.getTransform());
      context.fillStyle = 'red';
      context.fillRect(0, 0, 20, 20);
    });
    const canvas = await renderScene(createElement(Absolute, {
      style: { width: 60, height: 40, overflow: 'clip' },
      children: createElement(Group, {
        style: {
          left: 45,
          top: 10,
          width: 20,
          height: 20,
          filter: {
            type: 'dropShadow',
            offsetX: 15,
            offsetY: 0,
            color: 'blue',
          },
        },
        children: createElement(Probe, {}),
      }),
    }), 90, 50);

    expect(sourceTransforms).toHaveLength(1);
    expect(sourceTransforms[0]).toEqual(expect.objectContaining({
      a: 1,
      b: 0,
      c: 0,
      d: 1,
    }));
    expect(pixel(canvas, 50, 15)).toEqual([255, 0, 0, 255]);
    expect(pixel(canvas, 65, 15)).toEqual([0, 0, 0, 0]);
  });

  it('keeps filter pixels out of focus bounds and source-order focus candidates', async () => {
    const firstBounds = { x: 4, y: 5, width: 10, height: 11 };
    const secondBounds = { x: 24, y: 5, width: 10, height: 11 };
    const canvas = await renderScene(focusManaged(createElement(Group, {
      children: [
        createElement(Rectangle, {
          style: {
            x: 4,
            y: 5,
            width: 10,
            height: 11,
            fill: 'red',
            filter: { type: 'blur', radius: 8 },
          },
          keyboardNavigationBounds: firstBounds,
          onClick: () => undefined,
        }),
        createElement(Rectangle, {
          style: {
            x: 24,
            y: 5,
            width: 10,
            height: 11,
            fill: 'blue',
            filter: {
              type: 'dropShadow',
              offsetX: 20,
              offsetY: 0,
              color: 'black',
            },
          },
          keyboardNavigationBounds: secondBounds,
          onClick: () => undefined,
        }),
      ],
    })), 64, 32);
    const instance = getCRCInstance(canvas);
    const targets = Array.from(instance.eventRoot.targets);
    const policy = instance.eventRoot.focusPolicy as unknown as {
      readonly candidates: readonly { readonly target: unknown }[];
    };

    expect(targets.map(target => target.keyboardNavigationBounds))
      .toEqual([firstBounds, secondBounds]);
    expect(policy.candidates.map(candidate => candidate.target))
      .toEqual(targets);
  });

  it('animates filter numbers without changing hit or focus geometry', () => {
    const driver = new ManualSchedulerDriver();
    const restoreDriver = installSchedulerDriverForTest(driver);
    const radius = signal(2);
    const bounds = Object.freeze({ x: 20, y: 10, width: 10, height: 10 });
    const onClick = vi.fn();
    let playback!: CRCPlayback;
    const AnimatedFilter = (_props: {}): CRCNode => {
      playback = crcPlayback(
        track(radius, tween({ from: 2, to: 10, duration: 100 })),
      );
      return focusManaged(createElement(Rectangle, {
        style: {
          x: 20,
          y: 10,
          width: 10,
          height: 10,
          fill: 'red',
          filter: { type: 'blur', radius: radius.get() },
        },
        keyboardNavigationBounds: bounds,
        onClick,
      }));
    };
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 30;
    canvas.style.cssText = 'display:block;width:50px;height:30px';
    document.body.appendChild(canvas);
    const controller = crc(canvas, createElement(AnimatedFilter, {}), {
      pixelRatio: 1,
    });
    controllers.add(controller);
    const filterAssignments = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'filter',
      'set',
    );

    try {
      expect(driver.pendingHostFrames).toBe(1);
      driver.flush(-1);
      const baselineOutsideAlpha = pixel(canvas, 17, 15)[3]!;
      const baselineInteriorAlpha = pixel(canvas, 25, 15)[3]!;
      playback.play();
      expect(driver.pendingHostFrames).toBe(1);
      driver.flush(0);
      filterAssignments.mockClear();
      expect(driver.pendingHostFrames).toBe(1);

      driver.flush(50);

      expect(radius.get()).toBe(6);
      expect(filterAssignments.mock.calls
        .map(([value]) => value)
        .filter(value => value !== 'none'))
        .toEqual(['blur(6px)']);
      const instance = getCRCInstance(canvas);
      const targets = Array.from(instance.eventRoot.targets);
      const policy = instance.eventRoot.focusPolicy as unknown as {
        readonly candidates: readonly { readonly target: unknown }[];
      };
      expect(targets.map(target => target.keyboardNavigationBounds))
        .toEqual([bounds]);
      expect(policy.candidates.map(candidate => candidate.target))
        .toEqual(targets);

      const outsideAlpha = pixel(canvas, 17, 15)[3]!;
      const interiorAlpha = pixel(canvas, 25, 15)[3]!;
      // The outside sample is three pixels beyond the unfiltered geometry:
      // radius 2 -> 6 measured +19 outside and -151 inside in Chromium.
      // These directional margins reject a stale radius-2 composition while
      // leaving 9 and 51 alpha levels of rasterization tolerance respectively.
      expect(outsideAlpha).toBeGreaterThan(baselineOutsideAlpha + 10);
      expect(interiorAlpha).toBeLessThan(baselineInteriorAlpha - 100);
      expect(interiorAlpha).toBeGreaterThan(outsideAlpha);

      dispatchClick(canvas, 17, 15);
      expect(onClick).not.toHaveBeenCalled();
      dispatchClick(canvas, 22, 15);
      expect(onClick).toHaveBeenCalledOnce();
    } finally {
      filterAssignments.mockRestore();
      controller.dispose();
      controllers.delete(controller);
      restoreDriver();
    }
  });

  it('keeps filtered and direct targets in original source paint order', async () => {
    const filteredClick = vi.fn();
    const directClick = vi.fn();
    const scene = (filteredOnTop: boolean): CRCNode => createElement(Group, {
      children: filteredOnTop ? [
        clickableRectangle(directClick),
        clickableRectangle(filteredClick, true),
      ] : [
        clickableRectangle(filteredClick, true),
        clickableRectangle(directClick),
      ],
    });
    const canvas = await renderScene(scene(false), 32, 32);

    dispatchClick(canvas, 12, 12);
    expect(directClick).toHaveBeenCalledOnce();
    expect(filteredClick).not.toHaveBeenCalled();

    crc(canvas, scene(true));
    await nextFrame();
    dispatchClick(canvas, 12, 12);
    expect(filteredClick).toHaveBeenCalledOnce();
    expect(directClick).toHaveBeenCalledOnce();
  });

  it('keeps a caller OffscreenCanvas root upright with identity world geometry', () => {
    const root = new OffscreenCanvas(40, 30);
    const sourceTransforms: DOMMatrix[] = [];
    const Probe = definePrimitive<{}, SystemStyle>((_props, _style, context) => {
      sourceTransforms.push(context.getTransform());
      const path = new Path2D();
      path.rect(4, 5, 10, 11);
      crcEventTarget({ onClick: () => undefined }, { path, fill: true });
      context.fill(path);
    });
    const controller = mountCRC(root, createElement(Probe, {
      style: { filter: { type: 'blur', radius: 1 } },
    }));
    controllers.add(controller);

    executeRender(root, 1);

    const instance = getCRCInstance(root);
    const target = Array.from(instance.eventRoot.targets)[0]!;
    expect(sourceTransforms).toHaveLength(1);
    expect(sourceTransforms[0]).toEqual(expect.objectContaining({
      a: 1,
      b: 0,
      c: 0,
      d: 1,
    }));
    expect(target.transform).toEqual(new DOMMatrix());
    expect(root.getContext('2d')!.getTransform()).toEqual(new DOMMatrix());
  });

  it('distinguishes leaf style opacity from a combined group opacity filter', async () => {
    const leafOpacity = await renderScene(createElement(Group, {
      children: [
        createElement(Rectangle, {
          style: { x: 4, y: 4, width: 16, height: 16, fill: 'red', opacity: 0.5 },
        }),
        createElement(Rectangle, {
          style: { x: 4, y: 4, width: 16, height: 16, fill: 'red', opacity: 0.5 },
        }),
      ],
    }), 28, 24);
    const groupOpacity = await renderScene(createElement(Group, {
      style: { filter: { type: 'opacity', amount: 0.5 } },
      children: [
        createElement(Rectangle, {
          style: { x: 4, y: 4, width: 16, height: 16, fill: 'red' },
        }),
        createElement(Rectangle, {
          style: { x: 4, y: 4, width: 16, height: 16, fill: 'red' },
        }),
      ],
    }), 28, 24);

    const leafAlpha = pixel(leafOpacity, 10, 10)[3]!;
    const groupAlpha = pixel(groupOpacity, 10, 10)[3]!;
    expect(leafAlpha).toBeGreaterThanOrEqual(188);
    expect(leafAlpha).toBeLessThanOrEqual(194);
    expect(groupAlpha).toBeGreaterThanOrEqual(124);
    expect(groupAlpha).toBeLessThanOrEqual(132);
    expect(leafAlpha - groupAlpha).toBeGreaterThan(55);
  });
});

describe('filter failure recovery', () => {
  it('restores the exact active target, world, presentation, and clip stack before caller cleanup', () => {
    const root = new OffscreenCanvas(32, 24);
    const controller = mountCRC(root, undefined);
    controllers.add(controller);
    const instance = getCRCInstance(root);
    const context = root.getContext('2d')!;
    const target: RenderTargetSnapshot = {
      logicalBounds: Object.freeze({ x: 0, y: 0, width: 32, height: 24 }),
      backingWidth: 32,
      backingHeight: 24,
      renderTransform: new DOMMatrix(),
      inverseRenderTransform: new DOMMatrix(),
    };
    const world = new DOMMatrix().translate(7, 9);
    const parentClip = new Path2D();
    parentClip.rect(0, 0, 12, 12);
    context.clip(parentClip);
    const priorClipEntry = {
      path: parentClip,
      fillRule: 'nonzero' as const,
      transform: world,
    };
    const clippingStack = [priorClipEntry];
    const boundaryClip = new Path2D();
    boundaryClip.rect(2, 2, 6, 6);
    const presentationTransform = new DOMMatrix().translate(3, 4);
    context.globalAlpha = 0.625;
    context.globalCompositeOperation = 'xor';
    context.filter = 'contrast(0.5)';
    context.shadowColor = 'blue';
    context.shadowOffsetX = 2;
    const state = canvasState(context);
    const transform = context.getTransform();
    const baseline = temporaryGlobalSnapshot();
    GLOBAL_STATE.currentCRCInstance = instance;
    GLOBAL_STATE.renderContext = context;
    GLOBAL_STATE.renderTarget = target;
    GLOBAL_STATE.worldBaseTransform = world;
    GLOBAL_STATE.clippingStack = clippingStack;
    let insideContext: RenderingContext2D | undefined;
    let insideTarget: RenderTargetSnapshot | undefined;
    let insideWorld: DOMMatrix | undefined;
    let insideClipDepth = 0;

    try {
      expect(() => renderFilterBoundary({
        component: 'BoundaryProbe',
        filters: {
          values: Object.freeze([{ type: 'blur' as const, radius: 1 }]),
        },
        presentation: {
          transform: presentationTransform,
          clip: { path: boundaryClip, fillRule: 'nonzero' },
        },
      }, () => {
        insideContext = GLOBAL_STATE.renderContext;
        insideTarget = GLOBAL_STATE.renderTarget;
        insideWorld = GLOBAL_STATE.worldBaseTransform;
        insideClipDepth = GLOBAL_STATE.clippingStack.length;
        throw new Error('boundary-local failure');
      })).toThrowError('boundary-local failure');

      expect(insideContext).not.toBe(context);
      expect(insideContext?.canvas).toBeInstanceOf(OffscreenCanvas);
      expect(insideTarget).not.toBe(target);
      expect(insideWorld).not.toBe(world);
      expect(insideClipDepth).toBe(2);
      expect(GLOBAL_STATE.renderContext).toBe(context);
      expect(GLOBAL_STATE.renderTarget).toBe(target);
      expect(GLOBAL_STATE.worldBaseTransform).toBe(world);
      expect(GLOBAL_STATE.clippingStack).toBe(clippingStack);
      expect(GLOBAL_STATE.clippingStack).toEqual([priorClipEntry]);
      expect(context.getTransform()).toEqual(transform);
      expect(canvasState(context)).toEqual(state);
      expect(instance.filterSurfacePool.snapshot()).toMatchObject({
        activePairs: 0,
        pairCheckouts: 1,
        pairReturns: 1,
      });

      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
      context.filter = 'none';
      context.shadowColor = 'rgba(0, 0, 0, 0)';
      context.shadowOffsetX = 0;
      context.fillStyle = 'green';
      context.fillRect(0, 0, 32, 24);
      expect(offscreenPixel(root, 4, 4)).toEqual([0, 128, 0, 255]);
      expect(offscreenPixel(root, 20, 20)).toEqual([0, 0, 0, 0]);
    } finally {
      GLOBAL_STATE.currentCRCInstance = baseline.currentCRCInstance;
      GLOBAL_STATE.renderContext = baseline.renderContext;
      GLOBAL_STATE.renderTarget = baseline.renderTarget;
      GLOBAL_STATE.worldBaseTransform = baseline.worldBaseTransform;
      GLOBAL_STATE.clippingStack = baseline.clippingStack;
    }
  });

  it('fails before the callback when OffscreenCanvas is missing and recovers fresh', () => {
    const callback = vi.fn();
    const Probe = filteredCallbackProbe(callback);
    const frames = controlFrames();
    const baseline = temporaryGlobalSnapshot();
    vi.stubGlobal('OffscreenCanvas', undefined);
    const canvas = mountScheduled(createElement(Probe, {
      style: { filter: { type: 'blur', radius: 1 } },
    }));

    expect(() => frames.runNext()).toThrow(/Probe.*OffscreenCanvas support/i);
    expectFailureBaseline(canvas, baseline, callback, 0, {
      surfaceSlots: 0,
      pairCheckouts: 0,
      pairReturns: 0,
    });

    vi.unstubAllGlobals();
    expectFreshFilteredRecovery(frames);
  });

  it('wraps a throwing pooled OffscreenCanvas constructor and recovers the same instance', () => {
    const callback = vi.fn();
    const Probe = filteredCallbackProbe(callback);
    const frames = controlFrames();
    const baseline = temporaryGlobalSnapshot();
    const cause = new Error('host rejected pooled allocation');
    const root = createElement(Probe, {
      style: { filter: { type: 'blur', radius: 1 } },
    });
    function ThrowingOffscreenCanvas(): never {
      throw cause;
    }
    vi.stubGlobal('OffscreenCanvas', ThrowingOffscreenCanvas);
    const canvas = mountScheduled(root);
    const instance = getCRCInstance(canvas);

    const error = captureThrownError(() => frames.runNext());
    expect(error.message)
      .toMatch(/Probe.*filter\.sourceSurface.*could not allocate.*OffscreenCanvas/i);
    expect(error.cause).toBe(cause);
    expectFailureBaseline(canvas, baseline, callback, 0, {
      surfaceSlots: 0,
      createdSurfaceSlots: 0,
      activePairs: 0,
      peakActivePairs: 0,
      pairCheckouts: 0,
      pairReturns: 0,
    });

    vi.unstubAllGlobals();
    crc(canvas, root);
    expect(() => frames.runNext()).not.toThrow();
    expect(callback).toHaveBeenCalledOnce();
    expect(getCRCInstance(canvas)).toBe(instance);
    expect(instance.filterSurfacePool.snapshot()).toMatchObject({
      surfaceSlots: 2,
      activePairs: 0,
      pairCheckouts: 1,
      pairReturns: 1,
    });
  });

  it('wraps a throwing pooled 2D-context acquisition and recovers the same instance', () => {
    const callback = vi.fn();
    const Probe = filteredCallbackProbe(callback);
    const frames = controlFrames();
    const baseline = temporaryGlobalSnapshot();
    const cause = new Error('host rejected pooled 2D context');
    const root = createElement(Probe, {
      style: { filter: { type: 'blur', radius: 1 } },
    });
    const getContext = vi.spyOn(OffscreenCanvas.prototype, 'getContext')
      .mockImplementation(() => {
        throw cause;
      });
    const canvas = mountScheduled(root);
    const instance = getCRCInstance(canvas);

    const error = captureThrownError(() => frames.runNext());
    expect(error.message)
      .toMatch(/Probe.*filter\.sourceSurface.*could not acquire.*2D context/i);
    expect(error.cause).toBe(cause);
    expectFailureBaseline(canvas, baseline, callback, 0, {
      surfaceSlots: 0,
      createdSurfaceSlots: 0,
      activePairs: 0,
      peakActivePairs: 0,
      pairCheckouts: 0,
      pairReturns: 0,
    });

    getContext.mockRestore();
    crc(canvas, root);
    expect(() => frames.runNext()).not.toThrow();
    expect(callback).toHaveBeenCalledOnce();
    expect(getCRCInstance(canvas)).toBe(instance);
    expect(instance.filterSurfacePool.snapshot()).toMatchObject({
      surfaceSlots: 2,
      activePairs: 0,
      pairCheckouts: 1,
      pairReturns: 1,
    });
  });

  it('wraps a throwing discard OffscreenCanvas constructor and recovers the same instance', () => {
    const callback = vi.fn();
    const frames = controlFrames();
    const baseline = temporaryGlobalSnapshot();
    const cause = new Error('host rejected discard allocation');
    const root = singularFilteredProbe(callback);
    function ThrowingOffscreenCanvas(): never {
      throw cause;
    }
    vi.stubGlobal('OffscreenCanvas', ThrowingOffscreenCanvas);
    const canvas = mountScheduled(root);
    const instance = getCRCInstance(canvas);

    const error = captureThrownError(() => frames.runNext());
    expect(error.message)
      .toMatch(/Group.*property filter.*could not allocate.*discard OffscreenCanvas/i);
    expect(error.cause).toBe(cause);
    expectFailureBaseline(canvas, baseline, callback, 0, {
      surfaceSlots: 0,
      createdSurfaceSlots: 0,
      activePairs: 0,
      peakActivePairs: 0,
      pairCheckouts: 0,
      pairReturns: 0,
    });

    vi.unstubAllGlobals();
    crc(canvas, root);
    expect(() => frames.runNext()).not.toThrow();
    expect(callback).toHaveBeenCalledOnce();
    expect(getCRCInstance(canvas)).toBe(instance);
    expect(instance.filterSurfacePool.snapshot()).toMatchObject({
      surfaceSlots: 0,
      activePairs: 0,
      pairCheckouts: 0,
      pairReturns: 0,
    });
  });

  it('wraps a throwing discard 2D-context acquisition and recovers the same instance', () => {
    const callback = vi.fn();
    const frames = controlFrames();
    const baseline = temporaryGlobalSnapshot();
    const cause = new Error('host rejected discard 2D context');
    const root = singularFilteredProbe(callback);
    const getContext = vi.spyOn(OffscreenCanvas.prototype, 'getContext')
      .mockImplementation(() => {
        throw cause;
      });
    const canvas = mountScheduled(root);
    const instance = getCRCInstance(canvas);

    const error = captureThrownError(() => frames.runNext());
    expect(error.message)
      .toMatch(/Group.*property filter.*could not acquire.*discard.*2D context/i);
    expect(error.cause).toBe(cause);
    expectFailureBaseline(canvas, baseline, callback, 0, {
      surfaceSlots: 0,
      createdSurfaceSlots: 0,
      activePairs: 0,
      peakActivePairs: 0,
      pairCheckouts: 0,
      pairReturns: 0,
    });

    getContext.mockRestore();
    crc(canvas, root);
    expect(() => frames.runNext()).not.toThrow();
    expect(callback).toHaveBeenCalledOnce();
    expect(getCRCInstance(canvas)).toBe(instance);
    expect(instance.filterSurfacePool.snapshot()).toMatchObject({
      surfaceSlots: 0,
      activePairs: 0,
      pairCheckouts: 0,
      pairReturns: 0,
    });
  });

  it('recovers filtering on the same instance after a missing accessor without expando poisoning', () => {
    const callback = vi.fn();
    const PixelProbe = definePrimitive<{}, SystemStyle>(function PixelProbe(
      _props,
      _style,
      context,
    ) {
      callback();
      context.fillStyle = 'red';
      context.fillRect(1, 1, 5, 5);
    });
    const frames = controlFrames();
    const canvas = mountScheduled(createElement(PixelProbe, {
      style: { filter: { type: 'opacity', amount: 1 } },
    }));
    frames.runNext();
    expect(pixel(canvas, 2, 2)).toEqual([255, 0, 0, 255]);
    const instance = getCRCInstance(canvas);
    for (const context of idlePoolContexts(instance.filterSurfacePool)) {
      Object.defineProperty(context, 'filter', {
        configurable: true,
        writable: true,
        value: 'none',
      });
      expect(Object.hasOwn(context, 'filter')).toBe(true);
    }
    callback.mockClear();

    const prototype = OffscreenCanvasRenderingContext2D.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'filter')!;
    expect(Reflect.deleteProperty(prototype, 'filter')).toBe(true);
    crc(canvas, createElement(PixelProbe, {
      style: { filter: { type: 'blur', radius: 1 } },
    }));

    try {
      expect(() => frames.runNext())
        .toThrow(/PixelProbe.*native Canvas filter support/i);
      expect(callback).not.toHaveBeenCalled();
      expect(instance.filterSurfacePool.snapshot()).toMatchObject({
        activePairs: 0,
        pairCheckouts: 2,
        pairReturns: 2,
      });
      for (const context of idlePoolContexts(instance.filterSurfacePool)) {
        expect(Object.hasOwn(context, 'filter')).toBe(false);
      }
    } finally {
      Object.defineProperty(prototype, 'filter', descriptor);
    }

    crc(canvas, createElement(PixelProbe, {
      style: { filter: { type: 'grayscale', amount: 1 } },
    }));
    expect(() => frames.runNext()).not.toThrow();
    expect(callback).toHaveBeenCalledOnce();
    expect(getCRCInstance(canvas)).toBe(instance);
    const recovered = pixel(canvas, 2, 2);
    expect(Math.max(recovered[0]!, recovered[1]!, recovered[2]!) -
      Math.min(recovered[0]!, recovered[1]!, recovered[2]!))
      .toBeLessThanOrEqual(2);
    expect(recovered[0]).toBeGreaterThan(40);
    expect(recovered[0]).toBeLessThan(80);
  });

  it('rejects silently retained stale filter state and recovers the same pooled result context', () => {
    const callback = vi.fn();
    const PixelProbe = definePrimitive<{}, SystemStyle>(function PixelProbe(
      _props,
      _style,
      context,
    ) {
      callback();
      context.fillStyle = 'red';
      context.fillRect(1, 1, 5, 5);
    });
    const frames = controlFrames();
    const canvas = mountScheduled(createElement(PixelProbe, {
      style: { filter: { type: 'opacity', amount: 1 } },
    }));
    frames.runNext();
    const instance = getCRCInstance(canvas);
    const resultContext = idlePoolContexts(instance.filterSurfacePool)[1]!;
    const prototype = OffscreenCanvasRenderingContext2D.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'filter')!;
    resultContext.restore();
    descriptor.set!.call(resultContext, 'blur(9px)');
    resultContext.save();
    expect(descriptor.get!.call(resultContext)).toBe('blur(9px)');
    callback.mockClear();
    const offscreenDraw = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'drawImage',
    );
    const parentDraw = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      'drawImage',
    );
    const baseline = temporaryGlobalSnapshot();
    Object.defineProperty(prototype, 'filter', {
      configurable: true,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set() {
        // Silently retain the stale native state for every attempted write.
      },
    });
    crc(canvas, createElement(PixelProbe, {
      style: { filter: { type: 'grayscale', amount: 1 } },
    }));

    try {
      expect(() => frames.runNext())
        .toThrow(/PixelProbe.*native Canvas filter state could not reset to none/i);
      expect(callback).not.toHaveBeenCalled();
      expect(offscreenDraw).not.toHaveBeenCalled();
      expect(parentDraw).not.toHaveBeenCalled();
      expectFailureBaseline(canvas, baseline, callback, 0, {
        surfaceSlots: 2,
        pairCheckouts: 2,
        pairReturns: 2,
      });
    } finally {
      Object.defineProperty(prototype, 'filter', descriptor);
    }

    crc(canvas, createElement(PixelProbe, {
      style: { filter: { type: 'grayscale', amount: 1 } },
    }));
    expect(() => frames.runNext()).not.toThrow();
    expect(callback).toHaveBeenCalledOnce();
    expect(getCRCInstance(canvas)).toBe(instance);
    expect(idlePoolContexts(instance.filterSurfacePool)[1]).toBe(resultContext);
    const recovered = pixel(canvas, 2, 2);
    expect(Math.max(recovered[0]!, recovered[1]!, recovered[2]!) -
      Math.min(recovered[0]!, recovered[1]!, recovered[2]!))
      .toBeLessThanOrEqual(2);
    expect(recovered[0]).toBeGreaterThan(40);
    expect(recovered[0]).toBeLessThan(80);
  });

  it('wraps a throwing native filter getter before the callback', () => {
    const callback = vi.fn();
    const Probe = filteredCallbackProbe(callback);
    const frames = controlFrames();
    const prototype = OffscreenCanvasRenderingContext2D.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'filter')!;
    Object.defineProperty(prototype, 'filter', {
      configurable: true,
      enumerable: descriptor.enumerable,
      get() {
        throw new Error('hostile native filter getter');
      },
      set: descriptor.set,
    });
    const canvas = mountScheduled(createElement(Probe, {
      style: { filter: { type: 'blur', radius: 1 } },
    }));

    try {
      expect(() => frames.runNext())
        .toThrow(/Probe.*property filter.*native Canvas filter getter threw/i);
      expect(callback).not.toHaveBeenCalled();
      expect(getCRCInstance(canvas).filterSurfacePool.snapshot())
        .toMatchObject({ activePairs: 0, pairCheckouts: 1, pairReturns: 1 });
    } finally {
      Object.defineProperty(prototype, 'filter', descriptor);
    }
  });

  it('wraps a throwing native filter setter before the callback', () => {
    const callback = vi.fn();
    const Probe = filteredCallbackProbe(callback);
    const frames = controlFrames();
    const prototype = OffscreenCanvasRenderingContext2D.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'filter')!;
    Object.defineProperty(prototype, 'filter', {
      configurable: true,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set() {
        throw new Error('hostile native filter setter');
      },
    });
    const canvas = mountScheduled(createElement(Probe, {
      style: { filter: { type: 'blur', radius: 1 } },
    }));

    try {
      expect(() => frames.runNext())
        .toThrow(/Probe.*property filter.*native Canvas filter setter threw/i);
      expect(callback).not.toHaveBeenCalled();
      expect(getCRCInstance(canvas).filterSurfacePool.snapshot())
        .toMatchObject({ activePairs: 0, pairCheckouts: 1, pairReturns: 1 });
    } finally {
      Object.defineProperty(prototype, 'filter', descriptor);
    }
  });

  it('rejects a concrete native color before the callback and recovers fresh', () => {
    const callback = vi.fn();
    const Probe = filteredCallbackProbe(callback);
    const frames = controlFrames();
    const baseline = temporaryGlobalSnapshot();
    const canvas = mountScheduled(createElement(Probe, {
      style: {
        filter: {
          type: 'dropShadow',
          offsetX: 2,
          offsetY: 2,
          color: 'not-a-color',
        },
      },
    }));

    expect(() => frames.runNext()).toThrow(/Probe.*filter\.color.*native Canvas filter/i);
    expectFailureBaseline(canvas, baseline, callback, 0);
    expectFreshFilteredRecovery(frames);
  });

  it('rejects a contextual color before allocation or callback and recovers fresh', () => {
    const callback = vi.fn();
    const Probe = filteredCallbackProbe(callback);
    const frames = controlFrames();
    const baseline = temporaryGlobalSnapshot();
    const canvas = mountScheduled(createElement(Probe, {
      style: {
        filter: {
          type: 'dropShadow',
          offsetX: 2,
          offsetY: 2,
          color: 'currentColor',
        },
      },
    }));

    expect(() => frames.runNext()).toThrow(/Probe.*filter\.color.*contextual/i);
    expectFailureBaseline(canvas, baseline, callback, 0, {
      surfaceSlots: 0,
      pairCheckouts: 0,
      pairReturns: 0,
    });
    expectFreshFilteredRecovery(frames);
  });

  it('rolls back a source reservation when result-slot setup fails and recovers fresh', () => {
    const callback = vi.fn();
    const Probe = filteredCallbackProbe(callback);
    const frames = controlFrames();
    const baseline = temporaryGlobalSnapshot();
    const nativeGetContext = OffscreenCanvas.prototype.getContext;
    let acquisitions = 0;
    const getContext = vi.spyOn(OffscreenCanvas.prototype, 'getContext')
      .mockImplementation(function(this: OffscreenCanvas, ...args: unknown[]) {
        acquisitions += 1;
        if (acquisitions === 2) return null;
        return (nativeGetContext as Function).apply(this, args);
      } as typeof OffscreenCanvas.prototype.getContext);
    const canvas = mountScheduled(createElement(Probe, {
      style: { filter: { type: 'blur', radius: 1 } },
    }));

    expect(() => frames.runNext()).toThrow(/Probe.*result.*2D context/i);
    expectFailureBaseline(canvas, baseline, callback, 0, {
      surfaceSlots: 1,
      pairCheckouts: 0,
      pairReturns: 0,
    });

    getContext.mockRestore();
    expectFreshFilteredRecovery(frames);
  });

  it('returns the pair when the receiving primitive throws and recovers fresh', () => {
    const callback = vi.fn(() => {
      throw new Error('receiving primitive failed');
    });
    const Probe = filteredCallbackProbe(callback);
    const frames = controlFrames();
    const baseline = temporaryGlobalSnapshot();
    const canvas = mountScheduled(createElement(Probe, {
      style: { filter: { type: 'blur', radius: 1 } },
    }));

    expect(() => frames.runNext()).toThrowError('receiving primitive failed');
    expectFailureBaseline(canvas, baseline, callback, 1);
    expectFreshFilteredRecovery(frames);
  });

  it('scrubs source pattern references when a filtered boundary throws', () => {
    const patternSource = new OffscreenCanvas(2, 2);
    const callback = vi.fn((_props: {}, _style: {}, context: RenderingContext2D) => {
      const pattern = context.createPattern(patternSource, 'repeat')!;
      context.fillStyle = pattern;
      context.strokeStyle = pattern;
      throw new Error('pattern-bearing primitive failed');
    });
    const Probe = definePrimitive<{}, SystemStyle>(callback);
    const frames = controlFrames();
    const canvas = mountScheduled(createElement(Probe, {
      style: { filter: { type: 'blur', radius: 1 } },
    }));

    expect(() => frames.runNext())
      .toThrowError('pattern-bearing primitive failed');
    expect(callback).toHaveBeenCalledOnce();
    const pool = getCRCInstance(canvas).filterSurfacePool;
    expect(pool.snapshot()).toMatchObject({
      activePairs: 0,
      pairCheckouts: 1,
      pairReturns: 1,
    });
    for (const context of idlePoolContexts(pool)) {
      expect(context.fillStyle).toBe('#000000');
      expect(context.strokeStyle).toBe('#000000');
    }
  });

  it('preserves the original boundary failure when idle-state scrubbing also throws', () => {
    let scrubWrites = 0;
    const callback = vi.fn((_props: {}, _style: {}, context: RenderingContext2D) => {
      Object.defineProperty(context, 'fillStyle', {
        configurable: true,
        get: () => '#000000',
        set: () => {
          scrubWrites += 1;
          throw new Error('idle scrub failed');
        },
      });
      throw new Error('original render failure');
    });
    const Probe = definePrimitive<{}, SystemStyle>(callback);
    const frames = controlFrames();
    const canvas = mountScheduled(createElement(Probe, {
      style: { filter: { type: 'blur', radius: 1 } },
    }));

    expect(() => frames.runNext()).toThrowError('original render failure');
    expect(scrubWrites).toBe(1);
    expect(getCRCInstance(canvas).filterSurfacePool.snapshot()).toMatchObject({
      activePairs: 0,
      pairCheckouts: 1,
      pairReturns: 1,
    });
  });

  it('unwinds two filtered ancestors in strict LIFO target order when a descendant throws', () => {
    const outerCallback = vi.fn();
    const innerCallback = vi.fn();
    const descendantCallback = vi.fn(() => {
      throw new Error('filtered descendant failed');
    });
    const Descendant = definePrimitive<{}>(descendantCallback);
    const Outer = definePrimitive<{ children: CRCNode }, SystemStyle>(
      props => {
        outerCallback();
        return props.children;
      },
    );
    const Inner = definePrimitive<{ children: CRCNode }, SystemStyle>(
      props => {
        innerCallback();
        return props.children;
      },
    );
    const frames = controlFrames();
    const baseline = temporaryGlobalSnapshot();
    const canvas = mountScheduled(createElement(Outer, {
      style: { filter: { type: 'blur', radius: 1 } },
      children: createElement(Inner, {
        style: { filter: { type: 'grayscale', amount: 1 } },
        children: createElement(Descendant, {}),
      }),
    }));
    const instance = getCRCInstance(canvas);
    const rootContext = canvas.getContext('2d')!;
    const pool = instance.filterSurfacePool;
    const checkoutPair = pool.checkoutPair.bind(pool);
    const sources = new Map<number, RenderingContext2D>();
    const releases: Array<{
      depth: number;
      context: RenderingContext2D | undefined;
    }> = [];
    vi.spyOn(pool, 'checkoutPair').mockImplementation(windows => {
      const lease = checkoutPair(windows);
      const depth = pool.snapshot().activePairs;
      sources.set(depth, lease.source.context);
      return {
        ...lease,
        release(): void {
          releases.push({ depth, context: GLOBAL_STATE.renderContext });
          lease.release();
        },
      };
    });

    expect(() => frames.runNext()).toThrowError('filtered descendant failed');
    expectFailureBaseline(canvas, baseline, outerCallback, 1, {
      surfaceSlots: 4,
      peakActivePairs: 2,
      pairCheckouts: 2,
      pairReturns: 2,
    });
    expect(innerCallback).toHaveBeenCalledOnce();
    expect(descendantCallback).toHaveBeenCalledOnce();
    expect(releases).toEqual([
      { depth: 2, context: sources.get(1) },
      { depth: 1, context: rootContext },
    ]);
    expectFreshFilteredRecovery(frames);
  });

  it('returns the pair when the final drawImage throws and recovers fresh', () => {
    const callback = vi.fn();
    const Probe = filteredCallbackProbe(callback);
    const frames = controlFrames();
    const baseline = temporaryGlobalSnapshot();
    const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(() => {
        throw new Error('final composite failed');
      });
    const canvas = mountScheduled(createElement(Probe, {
      style: { filter: { type: 'blur', radius: 1 } },
    }));

    expect(() => frames.runNext()).toThrowError('final composite failed');
    expectFailureBaseline(canvas, baseline, callback, 1);

    drawImage.mockRestore();
    expectFreshFilteredRecovery(frames);
  });
});

function canvasState(context: RenderingContext2D) {
  return {
    alpha: context.globalAlpha,
    composite: context.globalCompositeOperation,
    filter: context.filter,
    shadowBlur: context.shadowBlur,
    shadowColor: context.shadowColor,
    shadowOffsetX: context.shadowOffsetX,
    shadowOffsetY: context.shadowOffsetY,
  };
}

function clickableRectangle(
  onClick: () => void,
  filtered = false,
): CRCNode {
  return createElement(Rectangle, {
    style: {
      x: 4,
      y: 4,
      width: 20,
      height: 20,
      fill: filtered ? 'red' : 'blue',
      filter: filtered ? { type: 'blur', radius: 2 } : undefined,
    },
    onClick,
  });
}

function filteredCallbackProbe(callback: () => void) {
  return definePrimitive<{}, SystemStyle>(function Probe(
    _props,
    _style,
    context,
  ) {
    callback();
    context.fillRect(1, 1, 4, 4);
  });
}

function singularFilteredProbe(callback: () => void): CRCNode {
  const Probe = filteredCallbackProbe(callback);
  return createElement(Group, {
    style: { scaleX: 0, filter: { type: 'blur', radius: 1 } },
    children: createElement(Probe, {}),
  });
}

function captureThrownError(callback: () => void): Error {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    return error as Error;
  }
  throw new Error('Expected the callback to throw.');
}

function controlFrames(): { runNext(timestamp?: number): void } {
  const frames: FrameRequestCallback[] = [];
  let frameId = 0;
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
    frames.push(callback);
    return ++frameId;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
  return {
    runNext(timestamp = frameId): void {
      const callback = frames.shift();
      if (!callback) throw new Error('No controlled render frame is pending.');
      callback(timestamp);
    },
  };
}

function mountScheduled(root: CRCNode): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 24;
  canvas.style.cssText = 'display:block;width:32px;height:24px';
  document.body.appendChild(canvas);
  controllers.add(crc(canvas, root, { pixelRatio: 1 }));
  return canvas;
}

function expectFreshFilteredRecovery(
  frames: ReturnType<typeof controlFrames>,
): void {
  const callback = vi.fn();
  const Probe = filteredCallbackProbe(callback);
  const canvas = mountScheduled(createElement(Probe, {
    style: { filter: { type: 'grayscale', amount: 1 } },
  }));
  expect(() => frames.runNext()).not.toThrow();
  expect(callback).toHaveBeenCalledOnce();
  expect(getCRCInstance(canvas).filterSurfacePool.snapshot()).toMatchObject({
    activePairs: 0,
    pairCheckouts: 1,
    pairReturns: 1,
  });
}

function temporaryGlobalSnapshot() {
  return {
    currentCRCInstance: GLOBAL_STATE.currentCRCInstance,
    componentRefs: GLOBAL_STATE.componentRefs,
    componentIsMounting: GLOBAL_STATE.componentIsMounting,
    componentHookIndex: GLOBAL_STATE.componentHookIndex,
    canvas: GLOBAL_STATE.canvas,
    renderContext: GLOBAL_STATE.renderContext,
    renderTarget: GLOBAL_STATE.renderTarget,
    worldBaseTransform: GLOBAL_STATE.worldBaseTransform,
    renderTransaction: GLOBAL_STATE.renderTransaction,
    primitiveReceiverToken: GLOBAL_STATE.primitiveReceiverToken,
    unseenIds: GLOBAL_STATE.unseenIds,
    seenIds: GLOBAL_STATE.seenIds,
    seenKeys: GLOBAL_STATE.seenKeys,
    clippingStack: GLOBAL_STATE.clippingStack,
    layoutStack: GLOBAL_STATE.layoutStack,
  };
}

function expectTemporaryGlobals(
  expected: ReturnType<typeof temporaryGlobalSnapshot>,
): void {
  const actual = temporaryGlobalSnapshot();
  for (const property of Object.keys(expected) as Array<keyof typeof expected>) {
    expect(actual[property], property).toBe(expected[property]);
  }
}

function expectFailureBaseline(
  canvas: HTMLCanvasElement,
  baseline: ReturnType<typeof temporaryGlobalSnapshot>,
  callback: ReturnType<typeof vi.fn>,
  expectedCalls: number,
  pool: Readonly<Record<string, number>> = {
    pairCheckouts: 1,
    pairReturns: 1,
  },
): void {
  expect(callback).toHaveBeenCalledTimes(expectedCalls);
  expect(getCRCInstance(canvas).filterSurfacePool.snapshot()).toMatchObject({
    activePairs: 0,
    ...pool,
  });
  expect(getCRCInstance(canvas).refs.size).toBe(0);
  expectTemporaryGlobals(baseline);
}

function filteredRectangle(
  filter: NonNullable<Parameters<typeof Rectangle>[0]['style']>['filter'],
): CRCNode {
  return createElement(Rectangle, {
    style: {
      x: 8,
      y: 8,
      width: 20,
      height: 24,
      fill: 'red',
      filter,
    },
  });
}

async function renderScene(
  root: CRCNode,
  width: number,
  height: number,
  pixelRatio = 1,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.cssText = `display:block;width:${width}px;height:${height}px`;
  document.body.appendChild(canvas);
  controllers.add(crc(canvas, root, { pixelRatio }));
  await nextFrame();
  return canvas;
}

async function renderFixedScene(
  root: CRCNode,
  options: {
    readonly logicalWidth: number;
    readonly logicalHeight: number;
    readonly displayWidth: number;
    readonly displayHeight: number;
    readonly fit: 'contain' | 'cover' | 'none' | 'scale-down';
  },
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = options.logicalWidth;
  canvas.height = options.logicalHeight;
  canvas.style.cssText =
    `display:block;width:${options.displayWidth}px;height:${options.displayHeight}px`;
  document.body.appendChild(canvas);
  controllers.add(crc(canvas, root, {
    viewport: {
      width: options.logicalWidth,
      height: options.logicalHeight,
    },
    fit: options.fit,
    pixelRatio: 1,
  }));
  await nextFrame();
  return canvas;
}

function dispatchClick(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) {
    canvas.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      button: 0,
      buttons: type === 'mousedown' ? 1 : 0,
      cancelable: true,
      clientX: bounds.left + x,
      clientY: bounds.top + y,
    }));
  }
}

function idlePoolContexts(
  pool: FilterSurfacePool,
): OffscreenCanvasRenderingContext2D[] {
  const slots = (pool as unknown as {
    readonly slots: ReadonlyArray<{
      readonly context: OffscreenCanvasRenderingContext2D;
    } | undefined>;
  }).slots;
  return slots.flatMap(slot => slot ? [slot.context] : []);
}

function pixel(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

function offscreenPixel(canvas: OffscreenCanvas, x: number, y: number): number[] {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
