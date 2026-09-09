import {
  Absolute,
  Group,
  Rectangle,
  crc,
  createElement,
  definePrimitive,
  type CRCController,
  type CRCNode,
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
    }> = [];
    const onClick = vi.fn();
    const Probe = definePrimitive<{}>((_props, _style, context) => {
      executions += 1;
      observations.push({
        canvas: context.canvas,
        transform: context.getTransform(),
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

  it('contains descendant alpha and compositing changes inside the captured source', async () => {
    const finalStates: Array<ReturnType<typeof canvasState>> = [];
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
      context.globalAlpha = 0.5;
      context.globalCompositeOperation = 'copy';
      context.filter = 'invert(1)';
      context.shadowColor = 'red';
      context.shadowOffsetX = 10;
      context.fillStyle = 'blue';
      context.fillRect(4, 4, 12, 12);
    });
    const canvas = await renderScene(createElement(Group, {
      style: { filter: { type: 'opacity', amount: 1 } },
      children: createElement(StatefulChild, {}),
    }), 40, 24);

    expect(finalStates).toEqual([{
      alpha: 1,
      composite: 'source-over',
      filter: 'none',
      shadowBlur: 0,
      shadowColor: 'rgba(0, 0, 0, 0)',
      shadowOffsetX: 0,
      shadowOffsetY: 0,
    }]);
    expect(pixel(canvas, 8, 8)[3]).toBeGreaterThanOrEqual(120);
    expect(pixel(canvas, 8, 8)[3]).toBeLessThanOrEqual(136);
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

  it('fails before the callback when the 2D filter property is missing and recovers fresh', () => {
    const callback = vi.fn();
    const Probe = filteredCallbackProbe(callback);
    const frames = controlFrames();
    const baseline = temporaryGlobalSnapshot();
    const prototype = OffscreenCanvasRenderingContext2D.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'filter')!;
    expect(Reflect.deleteProperty(prototype, 'filter')).toBe(true);
    const canvas = mountScheduled(createElement(Probe, {
      style: { filter: { type: 'blur', radius: 1 } },
    }));

    try {
      expect(() => frames.runNext()).toThrow(/Probe.*native Canvas filter support/i);
      expectFailureBaseline(canvas, baseline, callback, 0);
    } finally {
      Object.defineProperty(prototype, 'filter', descriptor);
    }
    expectFreshFilteredRecovery(frames);
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

  it('returns the pair when a filtered descendant throws and recovers fresh', () => {
    const parentCallback = vi.fn();
    const descendantCallback = vi.fn(() => {
      throw new Error('filtered descendant failed');
    });
    const Descendant = definePrimitive<{}>(descendantCallback);
    const Parent = definePrimitive<{ children: CRCNode }, SystemStyle>(
      props => {
        parentCallback();
        return props.children;
      },
    );
    const frames = controlFrames();
    const baseline = temporaryGlobalSnapshot();
    const canvas = mountScheduled(createElement(Parent, {
      style: { filter: { type: 'blur', radius: 1 } },
      children: createElement(Descendant, {}),
    }));

    expect(() => frames.runNext()).toThrowError('filtered descendant failed');
    expectFailureBaseline(canvas, baseline, parentCallback, 1);
    expect(descendantCallback).toHaveBeenCalledOnce();
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

function pixel(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
