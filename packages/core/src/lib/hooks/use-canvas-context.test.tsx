import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crc } from '../crc.js';
import { definePrimitive } from '../define-primitive.js';
import { createCRCElement } from '../element/create-element.js';
import { clearSharedState, getCRCInstance } from '../global-state.js';
import { measureElement } from '../layout/measure.js';
import type { CanvasMeasurementService } from '../types.js';
import { useCanvasContext } from './use-canvas-context.js';
import { useRef } from './use-ref.js';
import { useState, type StateUpdater } from './use-state.js';

const CONTEXT_ERROR =
  'useCanvasContext() is available only during CRC rendering and cannot be ' +
  'used during pure measurement.';

const constraints = {
  minWidth: 0,
  maxWidth: 100,
  minHeight: 0,
  maxHeight: 100,
};

const service: CanvasMeasurementService = {
  measureText: () => ({ width: 0 }) as TextMetrics,
};

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
});

describe('useCanvasContext', () => {
  it('returns the isolated Canvas context to a plain function component', async () => {
    const snapshots: Array<{
      context: CanvasRenderingContext2D;
      fillStyle: string | CanvasGradient | CanvasPattern;
      transform: DOMMatrix;
    }> = [];

    function Painter(): void {
      const context = useCanvasContext() as CanvasRenderingContext2D;
      snapshots.push({
        context,
        fillStyle: context.fillStyle,
        transform: context.getTransform(),
      });
      context.fillStyle = 'rgb(255, 0, 0)';
      context.translate(20, 10);
      context.fillRect(0, 0, 10, 10);
    }

    function Observer(): void {
      const context = useCanvasContext() as CanvasRenderingContext2D;
      snapshots.push({
        context,
        fillStyle: context.fillStyle,
        transform: context.getTransform(),
      });
    }

    const canvas = createCanvas();
    const controller = crc(canvas, [<Painter />, <Observer />]);
    await nextFrame();

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].context).toBe(canvas.getContext('2d'));
    expect(snapshots[1].context).toBe(snapshots[0].context);
    expect(snapshots[1].fillStyle).toBe('#000000');
    expect(snapshots[1].transform.e).toBe(0);
    expect(snapshots[1].transform.f).toBe(0);
    expect(canvas.getContext('2d')!.getImageData(25, 15, 1, 1).data[3])
      .toBe(255);
    controller.dispose();
  });

  it('does not allocate a hook slot or disturb surrounding hook identity', async () => {
    const states: number[] = [];
    const refs: object[] = [];
    let updateState: StateUpdater<number> | undefined;

    function Probe(): void {
      const [state, setState] = useState(0);
      updateState = setState;
      states.push(state);
      useCanvasContext();
      refs.push(useRef({}).current!);
    }

    const canvas = createCanvas();
    const controller = crc(canvas, <Probe />);
    await nextFrame();
    updateState?.(1);
    await nextFrame();

    const probeRefs = Array.from(getCRCInstance(canvas).refs.values())
      .find(ref => ref.element.type === Probe)!;
    expect(states).toEqual([0, 1]);
    expect(refs[1]).toBe(refs[0]);
    expect(probeRefs.hooks.map(hook => hook.kind)).toEqual(['state', 'ref']);
    controller.dispose();
  });

  it('throws the targeted diagnostic outside rendering', () => {
    expect(() => useCanvasContext()).toThrowError(CONTEXT_ERROR);
  });

  it('throws the targeted diagnostic during pure measurement', () => {
    const Measuring = definePrimitive(function renderMeasuring() {}, {
      measure: () => {
        useCanvasContext();
        return {
          status: 'measured' as const,
          size: { width: 1, height: 1 },
        };
      },
    });
    const element = createCRCElement(Measuring, {}, undefined, undefined);

    expect(() => measureElement(element, constraints, service))
      .toThrowError(CONTEXT_ERROR);
  });
});

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  document.body.appendChild(canvas);
  return canvas;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
