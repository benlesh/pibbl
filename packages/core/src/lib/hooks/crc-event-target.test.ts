import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { rect } from '../components/rect';
import { crc } from '../crc';
import { defineComp } from '../define-comp';
import type { CRCEventTargetRegistration } from '../events/registrations';
import type {
  CRCEventHandlers,
  CRCEventTargetOptions,
} from '../events/types';
import {
  clearSharedState,
  getCRCInstance,
} from '../global-state';
import type { CRCInteractionRegion } from '../types';
import { crcEventListener } from './crc-event-listener';
import { crcEventTarget } from './crc-event-target';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
});

describe('crcEventTarget', () => {
  it('requires an explicit path and reports the no-policy focus snapshot', async () => {
    expectTypeOf<CRCEventTargetOptions>()
      .toMatchTypeOf<{ readonly path: Path2D }>();

    const snapshots: unknown[] = [];
    const path = rectanglePath(0, 0, 40, 40);
    const Probe = defineComp(() => {
      snapshots.push(crcEventTarget({}, { path }));
    });
    const canvas = createCanvas();
    const controller = crc(canvas, Probe({}));
    await nextFrame();

    expect(snapshots).toEqual([{ isFocused: false, isFocusVisible: false }]);
    controller.dispose();
  });

  it('keeps one grouped target identity and one teardown while replacing handlers', async () => {
    const firstClick = vi.fn();
    const secondClick = vi.fn();
    const path = rectanglePath(0, 0, 40, 40);
    const Probe = defineComp<{
      onClick: CRCEventHandlers['onClick'];
      cursor?: string;
    }>(({ onClick, cursor }) => {
      crcEventTarget({
        onClick,
        onClickCapture: () => undefined,
        onKeyDown: () => undefined,
        onPointerDown: () => undefined,
      }, { path, cursor });
    });
    const canvas = createCanvas();
    const controller = crc(canvas, Probe({
      onClick: firstClick,
      cursor: 'pointer',
    }));
    await nextFrame();
    const instance = getCRCInstance(canvas);
    const first = onlyTarget(instance.eventRoot.targets);
    const component = first.component;

    expect(instance.eventRoot.targets.size).toBe(1);
    expect(instance.paintEntries.size).toBe(1);
    expect(component.hooks).toHaveLength(1);
    // Every mounted component already has one parent-runtime follower; the
    // grouped target contributes exactly one additional component teardown.
    expect(teardownCount(component.teardowns) - 1).toBe(1);
    expect(instance.eventRoot.nativeListeners?.count('click')).toBe(1);
    expect(instance.eventRoot.nativeListeners?.count('keydown')).toBe(1);
    expect(instance.eventRoot.nativeListeners?.count('pointerdown')).toBe(1);

    crc(canvas, Probe({ onClick: secondClick, cursor: 'crosshair' }));
    await nextFrame();
    const second = onlyTarget(instance.eventRoot.targets);

    expect(second).toBe(first);
    expect(second.handlers.click).toBe(secondClick);
    expect(second.cursor).toBe('crosshair');
    expect(component.hooks).toHaveLength(1);
    expect(teardownCount(component.teardowns) - 1).toBe(1);
    expect(instance.eventRoot.nativeListeners?.count('click')).toBe(1);
    controller.dispose();
  });

  it('releases the last handler and cursor, then revives the same hook identity', async () => {
    const path = rectanglePath(0, 0, 40, 40);
    const Probe = defineComp<{ enabled: boolean }>(({ enabled }) => {
      crcEventTarget(
        { onClick: enabled ? () => undefined : undefined },
        { path, cursor: enabled ? 'pointer' : undefined },
      );
    });
    const canvas = createCanvas();
    const controller = crc(canvas, Probe({ enabled: true }));
    await nextFrame();
    const instance = getCRCInstance(canvas);
    const target = onlyTarget(instance.eventRoot.targets);

    crc(canvas, Probe({ enabled: false }));
    await nextFrame();
    expect(instance.eventRoot.targets.size).toBe(0);
    expect(instance.paintEntries.size).toBe(0);
    expect(instance.eventRoot.nativeListeners?.count('click')).toBe(0);
    expect(target.live).toBe(false);

    crc(canvas, Probe({ enabled: true }));
    await nextFrame();
    expect(onlyTarget(instance.eventRoot.targets)).toBe(target);
    expect(target.live).toBe(true);
    controller.dispose();
  });
});

describe('crcEventListener', () => {
  it('groups capture and bubble handlers under one stable component listener', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const Probe = defineComp<{ onClick: CRCEventHandlers['onClick'] }>(
      ({ onClick }) => {
        crcEventListener({ onClick, onClickCapture: () => undefined });
      },
    );
    const canvas = createCanvas();
    const controller = crc(canvas, Probe({ onClick: first }));
    await nextFrame();
    const instance = getCRCInstance(canvas);
    const listeners = Array.from(instance.eventRoot.listenersByComponent.values());
    const registration = Array.from(listeners[0])[0];

    expect(listeners).toHaveLength(1);
    expect(listeners[0].size).toBe(1);
    expect(instance.eventRoot.targets.size).toBe(0);
    expect(instance.eventRoot.nativeListeners?.count('click')).toBe(1);

    crc(canvas, Probe({ onClick: second }));
    await nextFrame();
    const updated = Array.from(
      Array.from(instance.eventRoot.listenersByComponent.values())[0],
    )[0];
    expect(updated).toBe(registration);
    expect(updated.handlers.click).toBe(second);
    expect(instance.eventRoot.nativeListeners?.count('click')).toBe(1);
    controller.dispose();
  });

  it('does not infer a hit target from returned descendants', async () => {
    const calls: string[] = [];
    const Composite = defineComp<{
      onClick: CRCEventHandlers['onClick'];
    }>(({ onClick }) => {
      crcEventListener({ onClick });
      return rect({ style: { width: 40, height: 40, fill: '#000' } });
    });
    const canvas = createCanvas();
    const controller = crc(canvas, Composite({
      onClick: () => calls.push('listener'),
    }));
    await nextFrame();

    dispatchMouse(canvas, 'mousedown', 20, 20);
    dispatchMouse(canvas, 'mouseup', 20, 20);
    dispatchMouse(canvas, 'click', 20, 20);

    expect(calls).toEqual([]);
    expect(getCRCInstance(canvas).eventRoot.targets.size).toBe(0);
    controller.dispose();
  });
});

function onlyTarget(
  targets: ReadonlySet<CRCEventTargetRegistration | CRCInteractionRegion>,
): CRCEventTargetRegistration {
  expect(targets.size).toBe(1);
  const target = Array.from(targets)[0];
  if (target.kind !== 'target') {
    throw new Error('Expected one explicit event target registration.');
  }
  return target;
}

function teardownCount(teardowns: unknown): number {
  return (Reflect.get(teardowns as object, '_teardowns') as Set<unknown>).size;
}

function rectanglePath(x: number, y: number, width: number, height: number): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}

function dispatchMouse(
  canvas: HTMLCanvasElement,
  type: 'click' | 'mousedown' | 'mouseup',
  x: number,
  y: number,
): void {
  const bounds = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: bounds.left + x,
    clientY: bounds.top + y,
  }));
}

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
