import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crc } from '../crc';
import { clearSharedState } from '../global-state';
import { crcState, type StateUpdater } from './crc-state';
import { crcWhenChanged } from './crc-when-changed';
import { createElement } from '../element/create-element';
import { snapshotRealmScheduler } from '../scheduler/testing';

interface StateProbeProps {
  onRender: (value: number, setValue: StateUpdater<number>) => void;
}

const StateProbe = ({ onRender }: StateProbeProps) => {
  const [value, setValue] = crcState(0);
  onRender(value, setValue);
};

const Empty = (_props: {}) => {};

const CleanupSetterProbe = ({ onUpdater }: {
  onUpdater: () => void;
}) => {
  const [, setValue] = crcState(0);
  crcWhenChanged(() => () => setValue(value => {
    onUpdater();
    return value + 1;
  }), []);
};

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
    const controller = crc(canvas, createElement(StateProbe, {
      onRender: (_value, setValue) => {
        staleSetter ??= setValue;
      },
    }));
    await nextFrame();

    crc(canvas, createElement(Empty, {}));
    await nextFrame();
    expect(snapshotRealmScheduler()).toMatchObject({
      pendingHostFrames: 0,
      registeredRoots: 1,
      dirtyRoots: 0,
    });

    expect(() => staleSetter?.(1)).not.toThrow();
    expect(snapshotRealmScheduler()).toMatchObject({
      pendingHostFrames: 0,
      registeredRoots: 1,
      dirtyRoots: 0,
    });

    controller.dispose();
  });

  it('cannot let an exact-instance disposed mount setter update a replacement mount', async () => {
    const canvas = createCanvas();
    let staleSetter: StateUpdater<number> | undefined;
    const staleController = crc(canvas, createElement(StateProbe, {
      onRender: (_value, setValue) => {
        staleSetter ??= setValue;
      },
    }));
    await nextFrame();
    staleController.dispose();

    const liveValues: number[] = [];
    let liveSetter: StateUpdater<number> | undefined;
    const liveController = crc(canvas, createElement(StateProbe, {
      onRender: (value, setValue) => {
        liveValues.push(value);
        liveSetter = setValue;
      },
    }));
    await nextFrame();

    expect(() => staleSetter?.(10)).not.toThrow();
    expect(snapshotRealmScheduler()).toMatchObject({
      pendingHostFrames: 0,
      registeredRoots: 1,
      dirtyRoots: 0,
    });
    expect(liveValues).toEqual([0]);

    liveSetter?.(2);
    await nextFrame();
    expect(liveValues).toEqual([0, 2]);

    liveController.dispose();
  });

  it('ignores a setter called while its component is being removed', async () => {
    const canvas = createCanvas();
    let updaterCalls = 0;
    const controller = crc(canvas, createElement(CleanupSetterProbe, {
      onUpdater: () => updaterCalls++,
    }));
    await nextFrame();

    crc(canvas, createElement(Empty, {}));
    await nextFrame();

    expect(updaterCalls).toBe(0);
    expect(snapshotRealmScheduler()).toMatchObject({
      pendingHostFrames: 0,
      registeredRoots: 1,
      dirtyRoots: 0,
    });

    controller.dispose();
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
