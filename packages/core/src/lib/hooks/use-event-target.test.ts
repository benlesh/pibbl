import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { Rectangle } from '../components/rect';
import { crc } from '../crc';
import type { CRCEventTargetRegistration } from '../events/registrations';
import type {
  CRCEventHandlers,
  CRCEventTargetOptions,
} from '../events/types';
import {
  clearSharedState,
  getCRCInstance,
} from '../global-state';
import { useEventListener } from './use-event-listener';
import { useEventTarget } from './use-event-target';
import { useRegion } from './use-region';
import { createElement } from '../element/create-element';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
});

describe('useEventTarget', () => {
  it('adapts useRegion to the same grouped target record contract', async () => {
    const onClick = vi.fn();
    const Probe = (_props: {}) => {
      useRegion({ handlers: { click: onClick } });
    };
    const canvas = createCanvas();
    const controller = crc(canvas, createElement(Probe, {}));
    await nextFrame();
    const instance = getCRCInstance(canvas);
    const target = onlyTarget(instance.eventRoot.targets);

    expect(target).toMatchObject({
      kind: 'target',
      owner: instance,
      slot: 0,
      live: true,
    });
    expect(target.component.hooks[0]?.value).toBe(target);
    expect(target.handlers.click).toBe(onClick);
    expect(target.publicTarget.hasPointerCapture(1)).toBe(false);
    expect(instance.regions.has(target)).toBe(true);
    expect(Array.from(instance.paintEntries)).toEqual([target.paintEntry]);
    expect(instance.eventRoot.nativeListeners?.count('click')).toBe(1);
    expect(instance.eventRoot.nativeListeners?.count('mousedown')).toBe(1);
    expect(instance.eventRoot.nativeListeners?.count('mouseup')).toBe(1);
    controller.dispose();
  });

  it('requires an explicit path and reports the no-policy focus snapshot', async () => {
    expectTypeOf<CRCEventTargetOptions>()
      .toMatchTypeOf<{ readonly path: Path2D }>();

    const snapshots: unknown[] = [];
    const path = rectanglePath(0, 0, 40, 40);
    const Probe = (_props: {}) => {
      snapshots.push(useEventTarget({}, { path }));
    };
    const canvas = createCanvas();
    const controller = crc(canvas, createElement(Probe, {}));
    await nextFrame();

    expect(snapshots).toEqual([{ isFocused: false, isFocusVisible: false }]);
    controller.dispose();
  });

  it('keeps one grouped target identity and one teardown while replacing handlers', async () => {
    const firstClick = vi.fn();
    const secondClick = vi.fn();
    const path = rectanglePath(0, 0, 40, 40);
    const Probe = ({ onClick, cursor }: {
      onClick: CRCEventHandlers['onClick'];
      cursor?: string;
    }) => {
      useEventTarget({
        onClick,
        onClickCapture: () => undefined,
        onKeyDown: () => undefined,
        onPointerDown: () => undefined,
      }, { path, cursor });
    };
    const canvas = createCanvas();
    const controller = crc(canvas, createElement(Probe, {
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
    // Every mounted component already has a parent-runtime follower and one
    // signal-consumer release; the grouped target contributes one additional
    // component teardown.
    expect(teardownCount(component.teardowns) - 2).toBe(1);
    expect(instance.eventRoot.nativeListeners?.count('click')).toBe(1);
    expect(instance.eventRoot.nativeListeners?.count('keydown')).toBe(1);
    expect(instance.eventRoot.nativeListeners?.count('pointerdown')).toBe(1);
    const acquire = vi.spyOn(instance.eventRoot.nativeListeners!, 'acquire');

    crc(canvas, createElement(Probe, { onClick: secondClick, cursor: 'crosshair' }));
    await nextFrame();
    const second = onlyTarget(instance.eventRoot.targets);

    expect(second).toBe(first);
    expect(second.handlers.click).toBe(secondClick);
    expect(second.cursor).toBe('crosshair');
    expect(component.hooks).toHaveLength(1);
    expect(teardownCount(component.teardowns) - 2).toBe(1);
    expect(instance.eventRoot.nativeListeners?.count('click')).toBe(1);
    expect(acquire).not.toHaveBeenCalled();
    controller.dispose();
  });

  it('releases the last handler and cursor, then revives the same hook identity', async () => {
    const path = rectanglePath(0, 0, 40, 40);
    const Probe = ({ enabled }: { enabled: boolean }) => {
      useEventTarget(
        { onClick: enabled ? () => undefined : undefined },
        { path, cursor: enabled ? 'pointer' : undefined },
      );
    };
    const canvas = createCanvas();
    const controller = crc(canvas, createElement(Probe, { enabled: true }));
    await nextFrame();
    const instance = getCRCInstance(canvas);
    const target = onlyTarget(instance.eventRoot.targets);

    crc(canvas, createElement(Probe, { enabled: false }));
    await nextFrame();
    expect(instance.eventRoot.targets.size).toBe(0);
    expect(instance.paintEntries.size).toBe(0);
    expect(instance.eventRoot.nativeListeners?.count('click')).toBe(0);
    expect(target.live).toBe(false);

    crc(canvas, createElement(Probe, { enabled: true }));
    await nextFrame();
    expect(onlyTarget(instance.eventRoot.targets)).toBe(target);
    expect(target.live).toBe(true);
    controller.dispose();
  });
});

describe('useEventListener', () => {
  it('groups capture and bubble handlers under one stable component listener', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const Probe = ({ onClick }: { onClick: CRCEventHandlers['onClick'] }) => {
        useEventListener({ onClick, onClickCapture: () => undefined });
      };
    const canvas = createCanvas();
    const controller = crc(canvas, createElement(Probe, { onClick: first }));
    await nextFrame();
    const instance = getCRCInstance(canvas);
    const listeners = Array.from(instance.eventRoot.listenersByComponent.values());
    const registration = Array.from(listeners[0])[0];

    expect(listeners).toHaveLength(1);
    expect(listeners[0].size).toBe(1);
    expect(instance.eventRoot.targets.size).toBe(0);
    expect(instance.eventRoot.nativeListeners?.count('click')).toBe(1);

    crc(canvas, createElement(Probe, { onClick: second }));
    await nextFrame();
    const updated = Array.from(
      Array.from(instance.eventRoot.listenersByComponent.values())[0],
    )[0];
    expect(updated).toBe(registration);
    expect(updated.handlers.click).toBe(second);
    expect(instance.eventRoot.nativeListeners?.count('click')).toBe(1);
    controller.dispose();
  });

  it('propagates a returned painted descendant to its listener ancestor', async () => {
    const calls: string[] = [];
    const Composite = ({ onClick }: {
      onClick: CRCEventHandlers['onClick'];
    }) => {
      useEventListener({ onClick });
      return createElement(Rectangle, { style: { width: 40, height: 40, fill: '#000' } });
    };
    const canvas = createCanvas();
    const controller = crc(canvas, createElement(Composite, {
      onClick: () => calls.push('listener'),
    }));
    await nextFrame();

    dispatchMouse(canvas, 'mousedown', 20, 20);
    dispatchMouse(canvas, 'mouseup', 20, 20);
    dispatchMouse(canvas, 'click', 20, 20);

    expect(calls).toEqual(['listener']);
    expect(getCRCInstance(canvas).eventRoot.targets.size).toBe(1);
    controller.dispose();
  });
});

function onlyTarget(
  targets: ReadonlySet<CRCEventTargetRegistration>,
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
