import { signalObserversForTest } from "./support/signal-observer";
import type {
  CRCInstance,
  CRCInteractionRegion,
} from '../src/lib/types';
import type {
  EventTraceEntry,
  InteractionLabState,
  ScenarioController,
} from '@crc/scenarios';
import {
  interactionLabScenarioEntry,
  loadScenario,
} from '@crc/scenarios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeRender } from '../src/lib/execute-render';
import { GLOBAL_STATE } from '../src/lib/global-state';
import { removeInteractionRegion } from '../src/lib/events/dispatch';
import { mountCRC } from '../src/lib/mount-crc';
import {
  createTarget,
  updateTarget,
} from '../src/lib/events/registrations';
import { dispatchToLogicalTarget } from '../src/lib/events/dispatch';
import { Group, Overlay, Rectangle, signal } from '../src/index';
import { createElement } from '../src/lib/element/create-element';
import { getSignalNode } from '../src/lib/signals/graph';

const activeInstances = new Set<CRCInstance>();
const activeScenarioControllers = new Set<
  ScenarioController<InteractionLabState>
>();
const EmptyScene = (_props: {}) => undefined;

function mountDispatchHarness(
  cssSize: readonly [number, number] = [480, 240],
): { canvas: HTMLCanvasElement; instance: CRCInstance } {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 240;
  canvas.style.cssText = `display:block; width:${cssSize[0]}px; height:${cssSize[1]}px`;
  document.body.replaceChildren(canvas);
  mountCRC(canvas, createElement(EmptyScene, {}));
  const instance = GLOBAL_STATE.crcInstances.get(canvas);
  if (!instance) {
    throw new Error('Dispatch harness failed to mount a CRC instance.');
  }
  activeInstances.add(instance);
  executeRender(canvas, 1);
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
    (event: import('../src/lib/events/types').CRCLogicalMouseEvent) => void
  >>,
): CRCInteractionRegion {
  const component = Array.from(owner.refs.values())[0];
  if (!component) throw new Error('Dispatch harness root component is missing.');
  const target = createTarget(owner, component, 0);
  updateTarget(target, {
    onClick: handlers.click,
    onMouseMove: handlers.mousemove,
    onMouseOver: handlers.mouseover,
    onMouseOut: handlers.mouseout,
  }, { path, fill: true });
  return target;
}

afterEach(async () => {
  for (const instance of activeInstances) {
    instance.controller.dispose();
  }
  activeInstances.clear();
  await Promise.all(
    Array.from(activeScenarioControllers, controller => controller.dispose()),
  );
  activeScenarioControllers.clear();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function semanticTrace(trace: readonly EventTraceEntry[]) {
  return trace.map(entry => ({
    type: entry.type,
    target: entry.target,
    currentTarget: entry.currentTarget,
    phase: entry.phase,
    relatedTarget: entry.relatedTarget,
    canceled: entry.canceled,
    fields: entry.fields,
  }));
}

async function mountEventFixture(fixture: string) {
  const canvas = document.createElement('canvas');
  canvas.width = interactionLabScenarioEntry.canvas.width;
  canvas.height = interactionLabScenarioEntry.canvas.height;
  canvas.style.cssText = 'display:block; width:480px; height:240px';
  document.body.replaceChildren(canvas);
  const definition = await loadScenario(interactionLabScenarioEntry);
  const controller = await definition.mount({ canvas });
  activeScenarioControllers.add(controller);
  await controller.perform(`show-${fixture}`);
  await controller.settled();
  return { canvas, controller, definition };
}

function dispatchPointer(
  canvas: HTMLCanvasElement,
  type: string,
  x: number,
  y: number,
  init: PointerEventInit = {},
): PointerEvent {
  const bounds = canvas.getBoundingClientRect();
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: bounds.left + x,
    clientY: bounds.top + y,
    pointerId: 31,
    pointerType: 'pen',
    ...init,
  });
  canvas.dispatchEvent(event);
  return event;
}

function createTouch(
  canvas: HTMLCanvasElement,
  identifier: number,
  x: number,
  y: number,
): Touch {
  const bounds = canvas.getBoundingClientRect();
  return new Touch({
    identifier,
    target: canvas,
    clientX: bounds.left + x,
    clientY: bounds.top + y,
  });
}

function dispatchTouch(
  canvas: HTMLCanvasElement,
  type: 'touchend' | 'touchmove' | 'touchstart',
  touches: Touch[],
  changedTouches: Touch[],
): void {
  canvas.dispatchEvent(new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches,
    targetTouches: touches,
    changedTouches,
  }));
}

function dispatchDrag(
  canvas: HTMLCanvasElement,
  type: 'dragover' | 'drop',
  x: number,
  y: number,
  dataTransfer: DataTransfer,
): void {
  const bounds = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new DragEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: bounds.left + x,
    clientY: bounds.top + y,
    dataTransfer,
  }));
}

describe('interaction dispatcher mutation contract', () => {
  it('batches capture, target, and bubble signal writes as one dispatch', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 60;
    document.body.replaceChildren(canvas);
    const value = signal(0);
    const observations: number[] = [];
    const phases: string[] = [];
    signalObserversForTest(getSignalNode(value)).add(() => observations.push(value.get()));
    const write = (phase: string, next: number) => () => {
      phases.push(phase);
      value.set(next);
      expect(observations).toEqual([]);
    };
    mountCRC(canvas, createElement(Group, {
      onClickCapture: write('capture', 1),
      onClick: write('bubble', 4),
      children: createElement(Rectangle, {
        style: { width: 100, height: 60, fill: '#2563eb' },
        onClickCapture: write('target-capture', 2),
        onClick: write('target', 3),
      }),
    }));
    const instance = GLOBAL_STATE.crcInstances.get(canvas)!;
    activeInstances.add(instance);
    executeRender(canvas, 1);

    dispatchMouse(canvas, 'mousedown', 20, 20);
    dispatchMouse(canvas, 'mouseup', 20, 20);
    dispatchMouse(canvas, 'click', 20, 20);

    expect(phases).toEqual(['capture', 'target-capture', 'target', 'bubble']);
    expect(observations).toEqual([4]);
  });

  it('lets later default painted content occlude a registered target', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 60;
    document.body.replaceChildren(canvas);
    const clicks: string[] = [];
    mountCRC(canvas, createElement(Overlay, {
      style: { width: 100, height: 60 },
      children: [
        createElement(Rectangle, {
          style: { width: 100, height: 60, fill: '#2563eb' },
          onClick: () => clicks.push('under'),
        }),
        createElement(Rectangle, {
          style: { width: 100, height: 60, fill: '#f97316' },
        }),
      ],
    }));
    const instance = GLOBAL_STATE.crcInstances.get(canvas)!;
    activeInstances.add(instance);
    executeRender(canvas, 1);

    dispatchMouse(canvas, 'mousedown', 50, 30);
    dispatchMouse(canvas, 'mouseup', 50, 30);
    dispatchMouse(canvas, 'click', 50, 30);

    expect(clicks).toEqual([]);
    expect(instance.paintEntries).toHaveLength(2);
  });

  it('selects the topmost laid-out child and rejects clipped paint overflow', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 100;
    document.body.replaceChildren(canvas);
    const clicks: string[] = [];
    mountCRC(canvas, createElement(Overlay, {
      style: {
        width: 100,
        height: 60,
        overflow: 'clip',
        alignItems: 'center',
        justifyItems: 'center',
      },
      children: [
        createElement(Rectangle, {
          style: { width: 120, height: 60, fill: '#2563eb' },
          onClick: () => clicks.push('under'),
        }),
        createElement(Rectangle, {
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
    instance.paintEntries.add(target.paintEntry!);

    dispatchMove(canvas, 120, 60);
    expect(coordinates).toEqual([[240, 120]]);
  });

  it('skips a removed observer and defers its replacement until the next logical event', () => {
    const { canvas, instance } = mountDispatchHarness();
    const calls: string[] = [];
    let mutated = false;
    const observers = instance.eventRoot.observers.get('mousemove')!;
    const replacement = () => calls.push('replacement');
    const stale = () => calls.push('stale');
    const mutator = () => {
      calls.push('mutator');
      if (!mutated) {
        mutated = true;
        observers.delete(stale);
        observers.add(replacement);
      }
    };
    observers.add(mutator);
    observers.add(stale);

    dispatchMove(canvas, 10, 10);
    expect(calls).toEqual(['mutator']);

    dispatchMove(canvas, 20, 20);
    expect(calls).toEqual(['mutator', 'mutator', 'replacement']);
  });

  it('continues the same observer event after reporting a thrown handler', () => {
    const reportError = vi.spyOn(globalThis, 'reportError').mockImplementation(() => undefined);
    const { canvas, instance } = mountDispatchHarness();
    const calls: string[] = [];
    const observers = instance.eventRoot.observers.get('mousemove')!;
    observers.add(() => {
      calls.push('throws');
      throw new Error('expected observer failure');
    });
    observers.add(() => calls.push('safe'));

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
    instance.paintEntries.add(target.paintEntry!);

    dispatchMouse(canvas, 'mousedown', 300, 180);
    expect(instance.interaction.primaryDown).toBeUndefined();

    dispatchMouse(canvas, 'mouseup', 60, 60);
    expect(instance.interaction.primaryUp?.path.at(-1)).toBe(target);

    dispatchMouse(canvas, 'click', 60, 60);
    expect(onClick).not.toHaveBeenCalled();
    expect(instance.interaction.primaryDown).toBeUndefined();
    expect(instance.interaction.primaryUp).toBeUndefined();
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
    instance.paintEntries.add(left.paintEntry!);
    instance.paintEntries.add(right.paintEntry!);
    instance.interaction.hoveredRegion = left;

    dispatchMove(canvas, 300, 90);
    expect(calls).toEqual(['left-out']);
    expect(instance.regions).toEqual(new Set([left]));
    expect(GLOBAL_STATE.crcInstances.get(canvas)).toBe(instance);
  });
});

describe('shared public user-event laboratory', () => {
  it('freezes listener capture, target, and bubble order with phases', async () => {
    const { canvas, controller, definition } = await mountEventFixture('propagation');

    dispatchPointer(canvas, 'pointerdown', 150, 120);

    expect(semanticTrace(controller.getState().trace)).toEqual([
      {
        type: 'pointerdown',
        target: 'propagation-target',
        currentTarget: 'propagation-parent',
        phase: 1,
        relatedTarget: null,
        canceled: false,
        fields: { handler: 'capture', pointerId: 31, pointerType: 'pen' },
      },
      {
        type: 'pointerdown',
        target: 'propagation-target',
        currentTarget: 'propagation-target',
        phase: 2,
        relatedTarget: null,
        canceled: false,
        fields: { handler: 'target-capture', pointerId: 31, pointerType: 'pen' },
      },
      {
        type: 'pointerdown',
        target: 'propagation-target',
        currentTarget: 'propagation-target',
        phase: 2,
        relatedTarget: null,
        canceled: false,
        fields: { handler: 'target', pointerId: 31, pointerType: 'pen' },
      },
      {
        type: 'pointerdown',
        target: 'propagation-target',
        currentTarget: 'propagation-parent',
        phase: 3,
        relatedTarget: null,
        canceled: false,
        fields: { handler: 'bubble', pointerId: 31, pointerType: 'pen' },
      },
    ]);
    const formatted = definition.formatState(controller.getState())
      .find(field => field.label === 'Actual trace')?.value ?? '';
    expect(formatted).toContain('target=propagation-target');
    expect(formatted).toContain('current=propagation-parent');
    expect(formatted).toContain('related=none');
  });

  it('routes captured pointer movement outside custom target geometry', async () => {
    const { canvas, controller } = await mountEventFixture('pointer-capture');
    const active = new Set<number>();
    vi.spyOn(canvas, 'setPointerCapture').mockImplementation(pointerId => {
      active.add(pointerId);
    });
    vi.spyOn(canvas, 'hasPointerCapture').mockImplementation(pointerId =>
      active.has(pointerId));
    vi.spyOn(canvas, 'releasePointerCapture').mockImplementation(pointerId => {
      active.delete(pointerId);
    });

    dispatchPointer(canvas, 'pointerdown', 150, 120);
    dispatchPointer(canvas, 'gotpointercapture', 150, 120);
    dispatchPointer(canvas, 'pointermove', 430, 210);
    dispatchPointer(canvas, 'pointerup', 430, 210);
    dispatchPointer(canvas, 'lostpointercapture', 430, 210);

    expect(semanticTrace(controller.getState().trace)).toEqual([
      {
        type: 'pointerdown', target: 'custom-capture', currentTarget: 'custom-capture', phase: 2,
        relatedTarget: null, canceled: false,
        fields: { captured: true, pointerId: 31, x: 150, y: 120 },
      },
      {
        type: 'gotpointercapture', target: 'custom-capture', currentTarget: 'custom-capture', phase: 2,
        relatedTarget: null, canceled: false,
        fields: { captured: true, pointerId: 31, x: 150, y: 120 },
      },
      {
        type: 'pointermove', target: 'custom-capture', currentTarget: 'custom-capture', phase: 2,
        relatedTarget: null, canceled: false,
        fields: { captured: true, pointerId: 31, x: 430, y: 210 },
      },
      {
        type: 'pointerup', target: 'custom-capture', currentTarget: 'custom-capture', phase: 2,
        relatedTarget: null, canceled: false,
        fields: { captured: false, pointerId: 31, x: 430, y: 210 },
      },
      {
        type: 'lostpointercapture', target: 'custom-capture', currentTarget: 'custom-capture', phase: 2,
        relatedTarget: null, canceled: false,
        fields: { captured: false, pointerId: 31, x: 430, y: 210 },
      },
    ]);
  });

  it('retains a touch contact target through movement outside geometry', async () => {
    const { canvas, controller } = await mountEventFixture('touch-retention');
    const start = createTouch(canvas, 7, 150, 120);
    const moved = createTouch(canvas, 7, 430, 210);

    dispatchTouch(canvas, 'touchstart', [start], [start]);
    dispatchTouch(canvas, 'touchmove', [moved], [moved]);
    dispatchTouch(canvas, 'touchend', [], [moved]);

    expect(semanticTrace(controller.getState().trace)).toEqual([
      {
        type: 'touchstart', target: 'touch-owner', currentTarget: 'touch-owner', phase: 2,
        relatedTarget: null, canceled: false,
        fields: { changed: '7', touches: '7', x: 150, y: 120 },
      },
      {
        type: 'touchmove', target: 'touch-owner', currentTarget: 'touch-owner', phase: 2,
        relatedTarget: null, canceled: false,
        fields: { changed: '7', touches: '7', x: 430, y: 210 },
      },
      {
        type: 'touchend', target: 'touch-owner', currentTarget: 'touch-owner', phase: 2,
        relatedTarget: null, canceled: false,
        fields: { changed: '7', touches: '', x: 430, y: 210 },
      },
    ]);
  });

  it('projects wheel deltas and forwards logical cancellation to native input', async () => {
    const { canvas, controller } = await mountEventFixture('wheel-cancellation');
    const bounds = canvas.getBoundingClientRect();
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: bounds.left + 150,
      clientY: bounds.top + 120,
      deltaX: 4,
      deltaY: 18,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
    });

    const accepted = canvas.dispatchEvent(event);

    expect(accepted).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    expect(semanticTrace(controller.getState().trace)).toEqual([
      {
        type: 'wheel', target: 'wheel-target', currentTarget: 'wheel-target', phase: 2,
        relatedTarget: null, canceled: true,
        fields: { deltaMode: 0, deltaX: 4, deltaY: 18 },
      },
    ]);
  });

  it('projects keyboard and composition fields through internal logical transport', async () => {
    const { canvas, controller } = await mountEventFixture('keyboard-fields');
    const instance = GLOBAL_STATE.crcInstances.get(canvas)!;
    const target = Array.from(instance.eventRoot.targets)[0]!;

    dispatchToLogicalTarget('keydown', target, new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'KeyK',
      isComposing: true,
      key: 'k',
      repeat: true,
      shiftKey: true,
    }));
    expect(semanticTrace(controller.getState().trace)).toEqual([
      {
        type: 'keydown', target: 'keyboard-target', currentTarget: 'keyboard-target', phase: 2,
        relatedTarget: null, canceled: false,
        fields: {
          code: 'KeyK', isComposing: true, key: 'k', repeat: true,
          shiftKey: true,
        },
      },
    ]);

    await controller.perform('show-composition');
    const compositionTarget = Array.from(instance.eventRoot.targets)[0]!;
    for (const [type, data] of [
      ['compositionstart', 'に'],
      ['compositionupdate', '日本'],
      ['compositionend', '日本語'],
    ] as const) {
      dispatchToLogicalTarget(
        type,
        compositionTarget,
        new CompositionEvent(type, { bubbles: true, data }),
      );
    }
    expect(semanticTrace(controller.getState().trace)).toEqual([
      {
        type: 'compositionstart', target: 'composition-target', currentTarget: 'composition-target', phase: 2,
        relatedTarget: null, canceled: false, fields: { data: 'に' },
      },
      {
        type: 'compositionupdate', target: 'composition-target', currentTarget: 'composition-target', phase: 2,
        relatedTarget: null, canceled: false, fields: { data: '日本' },
      },
      {
        type: 'compositionend', target: 'composition-target', currentTarget: 'composition-target', phase: 2,
        relatedTarget: null, canceled: false, fields: { data: '日本語' },
      },
    ]);
  });

  it('projects clipboard payload and drag/drop boundary relationships', async () => {
    const { canvas, controller } = await mountEventFixture('clipboard');
    const instance = GLOBAL_STATE.crcInstances.get(canvas)!;
    const clipboardTarget = Array.from(instance.eventRoot.targets)[0]!;
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', 'CRC clipboard');

    dispatchToLogicalTarget('paste', clipboardTarget, new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData,
    }));
    expect(semanticTrace(controller.getState().trace)).toEqual([
      {
        type: 'paste', target: 'clipboard-target', currentTarget: 'clipboard-target', phase: 2,
        relatedTarget: null, canceled: false,
        fields: { text: 'CRC clipboard' },
      },
    ]);

    await controller.perform('show-drag-drop');
    const dragData = new DataTransfer();
    dragData.setData('text/plain', 'CRC drag');
    dispatchDrag(canvas, 'dragover', 120, 120, dragData);
    dispatchDrag(canvas, 'dragover', 360, 120, dragData);
    dispatchDrag(canvas, 'dragover', 120, 120, dragData);
    dispatchDrag(canvas, 'drop', 120, 120, dragData);
    expect(semanticTrace(controller.getState().trace)).toEqual([
      {
        type: 'dragenter', target: 'drag-a', currentTarget: 'drag-a', phase: 2,
        relatedTarget: null, canceled: false, fields: { text: 'CRC drag' },
      },
      {
        type: 'dragover', target: 'drag-a', currentTarget: 'drag-a', phase: 2,
        relatedTarget: null, canceled: false, fields: { text: 'CRC drag' },
      },
      {
        type: 'dragleave', target: 'drag-a', currentTarget: 'drag-a', phase: 2,
        relatedTarget: 'drag-b', canceled: false,
        fields: { text: 'CRC drag' },
      },
      {
        type: 'dragenter', target: 'drag-b', currentTarget: 'drag-b', phase: 2,
        relatedTarget: 'drag-a', canceled: false,
        fields: { text: 'CRC drag' },
      },
      {
        type: 'dragover', target: 'drag-b', currentTarget: 'drag-b', phase: 2,
        relatedTarget: null, canceled: false, fields: { text: 'CRC drag' },
      },
      {
        type: 'dragleave', target: 'drag-b', currentTarget: 'drag-b', phase: 2,
        relatedTarget: 'drag-a', canceled: false,
        fields: { text: 'CRC drag' },
      },
      {
        type: 'dragenter', target: 'drag-a', currentTarget: 'drag-a', phase: 2,
        relatedTarget: 'drag-b', canceled: false,
        fields: { text: 'CRC drag' },
      },
      {
        type: 'dragover', target: 'drag-a', currentTarget: 'drag-a', phase: 2,
        relatedTarget: null, canceled: false, fields: { text: 'CRC drag' },
      },
      {
        type: 'drop', target: 'drag-a', currentTarget: 'drag-a', phase: 2,
        relatedTarget: null, canceled: false, fields: { text: 'CRC drag' },
      },
    ]);
  });

  it('rejects a third object reusing a bound drag fixture label', async () => {
    const { canvas } = await mountEventFixture('drag-drop');
    const reportError = vi.spyOn(globalThis, 'reportError').mockImplementation(
      () => undefined,
    );
    const instance = GLOBAL_STATE.crcInstances.get(canvas)!;
    const [targetA] = Array.from(instance.eventRoot.targets);
    if (!targetA) {
      throw new Error('Drag fixture target A is missing.');
    }
    const unexpectedRelatedTarget = createTarget(
      instance,
      targetA.component,
      999,
    );
    const dragData = new DataTransfer();

    dispatchDrag(canvas, 'dragover', 120, 120, dragData);
    dispatchDrag(canvas, 'dragover', 360, 120, dragData);

    dispatchToLogicalTarget(
      'dragleave',
      targetA,
      new DragEvent('dragleave', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dragData,
      }),
      unexpectedRelatedTarget,
    );

    expect(reportError).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Unexpected drag related target: every fixture label is already bound.',
    }));
  });
});
