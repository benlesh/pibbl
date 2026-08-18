import type {
  CRCInstance,
  CRCInteractionRegion,
  CRCMouseEventListener,
} from '../src/lib/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComp } from '../src/lib/define-comp';
import { executeRender } from '../src/lib/execute-render';
import { GLOBAL_STATE } from '../src/lib/global-state';
import { removeInteractionRegion } from '../src/lib/interaction-dispatch';
import { mountCRC } from '../src/lib/mount-crc';
import { overlay, rect } from '../src/index';

const activeInstances = new Set<CRCInstance>();
const EmptyScene = defineComp<Record<string, never>>(() => undefined);

function mountDispatchHarness(
  cssSize: readonly [number, number] = [480, 240],
): { canvas: HTMLCanvasElement; instance: CRCInstance } {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 240;
  canvas.style.cssText = `display:block; width:${cssSize[0]}px; height:${cssSize[1]}px`;
  document.body.replaceChildren(canvas);
  mountCRC(canvas, EmptyScene({}));
  const instance = GLOBAL_STATE.crcInstances.get(canvas);
  if (!instance) {
    throw new Error('Dispatch harness failed to mount a CRC instance.');
  }
  activeInstances.add(instance);
  return { canvas, instance };
}

function dispatchMove(canvas: HTMLCanvasElement, x: number, y: number): void {
  dispatchMouse(canvas, 'mousemove', x, y);
}

function dispatchMouse(
  canvas: HTMLCanvasElement,
  type: 'click' | 'mousedown' | 'mousemove' | 'mouseup',
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

function rectanglePath(x: number, y: number, width: number, height: number): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}

function region(
  owner: CRCInstance,
  path: Path2D,
  handlers: Partial<Record<
    'click' | 'mousemove' | 'mouseover' | 'mouseout',
    CRCMouseEventListener
  >>,
): CRCInteractionRegion {
  return {
    kind: 'region',
    owner,
    handlers,
    path,
    fill: true,
    lineInteractionWidth: 0,
    transform: new DOMMatrix(),
    clippingStack: [],
    cursor: undefined,
  };
}

afterEach(() => {
  for (const instance of activeInstances) {
    instance.controller.dispose();
  }
  activeInstances.clear();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('interaction dispatcher mutation contract', () => {
  it('selects the topmost laid-out child and rejects clipped paint overflow', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 100;
    document.body.replaceChildren(canvas);
    const clicks: string[] = [];
    mountCRC(canvas, overlay({
      style: {
        width: 100,
        height: 60,
        overflow: 'clip',
        alignItems: 'center',
        justifyItems: 'center',
      },
      children: [
        rect({
          style: { width: 120, height: 60, fill: '#2563eb' },
          onClick: () => clicks.push('under'),
        }),
        rect({
          style: { width: 40, height: 40, fill: '#f97316' },
          onClick: () => clicks.push('top'),
        }),
      ],
    }));
    const instance = GLOBAL_STATE.crcInstances.get(canvas)!;
    activeInstances.add(instance);
    executeRender(canvas, 1);

    dispatchMouse(canvas, 'mousedown', 50, 30);
    dispatchMouse(canvas, 'mouseup', 50, 30);
    dispatchMouse(canvas, 'click', 50, 30);
    expect(clicks).toEqual(['top']);

    dispatchMouse(canvas, 'mousedown', 110, 30);
    dispatchMouse(canvas, 'mouseup', 110, 30);
    dispatchMouse(canvas, 'click', 110, 30);
    expect(clicks).toEqual(['top']);
  });

  it('reports intrinsic coordinates for a CSS-scaled Canvas', () => {
    const { canvas, instance } = mountDispatchHarness([240, 120]);
    const coordinates: number[][] = [];
    const target = region(
      instance,
      rectanglePath(0, 0, 480, 240),
      { mousemove: event => coordinates.push([event.x, event.y]) },
    );
    instance.regions.add(target);
    instance.paintEntries.add(target);

    dispatchMove(canvas, 120, 60);
    expect(coordinates).toEqual([[240, 120]]);
  });

  it('skips a removed observer and defers its replacement until the next logical event', () => {
    const { canvas, instance } = mountDispatchHarness();
    const calls: string[] = [];
    let mutated = false;
    const replacement = () => calls.push('replacement');
    const stale = () => calls.push('stale');
    const mutator = () => {
      calls.push('mutator');
      if (!mutated) {
        mutated = true;
        instance.events.mousemove.delete(stale);
        instance.events.mousemove.add(replacement);
      }
    };
    instance.events.mousemove.add(mutator);
    instance.events.mousemove.add(stale);

    dispatchMove(canvas, 10, 10);
    expect(calls).toEqual(['mutator']);

    dispatchMove(canvas, 20, 20);
    expect(calls).toEqual(['mutator', 'mutator', 'replacement']);
  });

  it('continues the same observer event after reporting a thrown handler', () => {
    const reportError = vi.spyOn(globalThis, 'reportError').mockImplementation(() => undefined);
    const { canvas, instance } = mountDispatchHarness();
    const calls: string[] = [];
    instance.events.mousemove.add(() => {
      calls.push('throws');
      throw new Error('expected observer failure');
    });
    instance.events.mousemove.add(() => calls.push('safe'));

    dispatchMove(canvas, 10, 10);
    expect(calls).toEqual(['throws', 'safe']);
    expect(reportError).toHaveBeenCalledOnce();
  });

  it('clears activation when the press resolves to Canvas background', () => {
    const { canvas, instance } = mountDispatchHarness();
    const onClick = vi.fn();
    const target = region(
      instance,
      rectanglePath(20, 20, 100, 100),
      { click: onClick },
    );
    instance.regions.add(target);
    instance.paintEntries.add(target);

    dispatchMouse(canvas, 'mousedown', 300, 180);
    expect(instance.interaction.primaryDownRegion).toBeUndefined();

    dispatchMouse(canvas, 'mouseup', 60, 60);
    expect(instance.interaction.primaryUpRegion).toBe(target);

    dispatchMouse(canvas, 'click', 60, 60);
    expect(onClick).not.toHaveBeenCalled();
    expect(instance.interaction.primaryDownRegion).toBeUndefined();
    expect(instance.interaction.primaryUpRegion).toBeUndefined();
  });

  it('skips planned entry and movement when mouseout synchronously removes the new target', () => {
    const { canvas, instance } = mountDispatchHarness();
    const calls: string[] = [];
    const right = region(
      instance,
      rectanglePath(268, 54, 184, 108),
      {
        mouseover: () => calls.push('right-over'),
        mousemove: () => calls.push('right-move'),
      },
    );
    const left = region(
      instance,
      rectanglePath(28, 54, 184, 108),
      {
        mouseout: () => {
          calls.push('left-out');
          removeInteractionRegion(instance, right);
        },
      },
    );
    instance.regions.add(left);
    instance.regions.add(right);
    instance.paintEntries.add(left);
    instance.paintEntries.add(right);
    instance.interaction.hoveredRegion = left;

    dispatchMove(canvas, 300, 90);
    expect(calls).toEqual(['left-out']);
    expect(instance.regions).toEqual(new Set([left]));
    expect(GLOBAL_STATE.crcInstances.get(canvas)).toBe(instance);
  });
});
