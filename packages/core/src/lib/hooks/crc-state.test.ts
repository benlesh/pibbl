import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crc } from '../crc';
import { defineComp } from '../define-comp';
import { clearSharedState, getCRCInstance } from '../global-state';
import { crcState, type StateUpdater } from './crc-state';

interface StateProbeProps {
  onRender: (value: number, setValue: StateUpdater<number>) => void;
  key?: string;
}

const StateProbe = defineComp(({ onRender }: StateProbeProps) => {
  const [value, setValue] = crcState(0);
  onRender(value, setValue);
});

const Empty = defineComp(() => {});

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  clearSharedState();
});

describe('crcState ownership', () => {
  it('ignores a stale setter after its component is removed', async () => {
    const canvas = createCanvas();
    let staleSetter: StateUpdater<number> | undefined;
    const controller = crc(canvas, StateProbe({
      onRender: (_value, setValue) => {
        staleSetter ??= setValue;
      },
    }));
    await nextFrame();

    crc(canvas, Empty({}));
    await nextFrame();
    expect(getCRCInstance(canvas).animationFrameId).toBeUndefined();

    expect(() => staleSetter?.(1)).not.toThrow();
    expect(getCRCInstance(canvas).animationFrameId).toBeUndefined();

    controller.dispose();
  });

  it('cannot let a disposed mount setter update a replacement mount', async () => {
    const canvas = createCanvas();
    let staleSetter: StateUpdater<number> | undefined;
    const staleController = crc(canvas, StateProbe({
      onRender: (_value, setValue) => {
        staleSetter ??= setValue;
      },
    }));
    await nextFrame();
    staleController.dispose();

    const liveValues: number[] = [];
    let liveSetter: StateUpdater<number> | undefined;
    const liveController = crc(canvas, StateProbe({
      onRender: (value, setValue) => {
        liveValues.push(value);
        liveSetter = setValue;
      },
    }));
    await nextFrame();

    expect(() => staleSetter?.(10)).not.toThrow();
    expect(getCRCInstance(canvas).animationFrameId).toBeUndefined();
    expect(liveValues).toEqual([0]);

    liveSetter?.(2);
    await nextFrame();
    expect(liveValues).toEqual([0, 2]);

    liveController.dispose();
  });
});

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return canvas;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
