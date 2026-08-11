import type {
  EventTraceEntry,
  InteractionLabState,
  ScenarioController,
} from '@crc/scenarios';
import {
  EventTraceRecorder,
  interactionLabScenarioEntry,
  loadScenario,
} from '@crc/scenarios';
import { cdp, page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import interactionLabSource from '../../scenarios/src/interaction-lab.example.ts?raw';

const activeControllers = new Set<ScenarioController<InteractionLabState>>();

interface Point {
  x: number;
  y: number;
}

function screenPoint(element: HTMLElement, point: Point): Point {
  const bounds = element.getBoundingClientRect();
  const frame = window.frameElement;
  if (!frame) {
    return { x: bounds.left + point.x, y: bounds.top + point.y };
  }
  const frameBounds = frame.getBoundingClientRect();
  return {
    x: frameBounds.left + (bounds.left + point.x) * (frameBounds.width / window.innerWidth),
    y: frameBounds.top + (bounds.top + point.y) * (frameBounds.height / window.innerHeight),
  };
}

async function dispatchMouse(
  element: HTMLElement,
  point: Point,
  type: 'mouseMoved' | 'mousePressed' | 'mouseReleased',
): Promise<void> {
  const position = screenPoint(element, point);
  await cdp().send('Input.dispatchMouseEvent', {
    type,
    x: position.x,
    y: position.y,
    button: type === 'mouseMoved' ? 'none' : 'left',
    clickCount: type === 'mouseMoved' ? 0 : 1,
  });
}

function projectTrace(trace: readonly EventTraceEntry[]) {
  return trace.map(({ type, target, relatedTarget, x, y }) => ({
    type,
    target,
    relatedTarget,
    x,
    y,
  }));
}

async function mountCRCLab() {
  const canvas = document.createElement('canvas');
  canvas.width = interactionLabScenarioEntry.canvas.width;
  canvas.height = interactionLabScenarioEntry.canvas.height;
  canvas.style.cssText = 'display:block; margin:40px; width:480px; height:240px';
  document.body.replaceChildren(canvas);
  const definition = await loadScenario(interactionLabScenarioEntry);
  const controller = await definition.mount({ canvas });
  activeControllers.add(controller);
  return { canvas, controller };
}

function mountNativeFixture() {
  const fixture = document.createElement('div');
  fixture.dataset.region = 'outside';
  fixture.style.cssText = 'position:relative; margin:40px; width:480px; height:240px; background:#f8fafc';
  const left = document.createElement('div');
  left.dataset.region = 'left';
  left.style.cssText = 'position:absolute; left:28px; top:54px; width:184px; height:108px; background:#2563eb';
  const right = document.createElement('div');
  right.dataset.region = 'right';
  right.style.cssText = 'position:absolute; left:268px; top:54px; width:184px; height:108px; background:#7c3aed';
  fixture.append(left, right);
  document.body.replaceChildren(fixture);

  const recorder = new EventTraceRecorder();
  const eventTypes = ['mouseover', 'mousemove', 'mouseout', 'mousedown', 'mouseup', 'click'] as const;
  const listeners = eventTypes.map((type) => {
    const listener = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const region = target.dataset.region;
      if (region !== 'left' && region !== 'right') {
        return;
      }
      const bounds = fixture.getBoundingClientRect();
      recorder.record({
        source: 'native',
        type,
        target: region,
        x: Math.round(event.clientX - bounds.left),
        y: Math.round(event.clientY - bounds.top),
        event,
        relatedTarget: (event.relatedTarget as HTMLElement | null)?.dataset.region ?? null,
      });
    };
    document.addEventListener(type, listener, true);
    return [type, listener] as const;
  });

  return {
    fixture,
    recorder,
    dispose: () => {
      for (const [type, listener] of listeners) {
        document.removeEventListener(type, listener, true);
      }
    },
  };
}

afterEach(async () => {
  for (const controller of activeControllers) {
    await controller.dispose();
  }
  activeControllers.clear();
  document.body.replaceChildren();
});

describe('interaction trace characterization', () => {
  it('freezes the current CRC enter, move, switch, exit, and click-family traces', async () => {
    await page.viewport(800, 600);
    expect(interactionLabSource).toContain(interactionLabScenarioEntry.source.marker);
    const { canvas, controller } = await mountCRCLab();

    await dispatchMouse(canvas, { x: 10, y: 10 }, 'mouseMoved');
    await controller.reset();
    await dispatchMouse(canvas, { x: 60, y: 90 }, 'mouseMoved');
    await dispatchMouse(canvas, { x: 80, y: 100 }, 'mouseMoved');
    await dispatchMouse(canvas, { x: 300, y: 90 }, 'mouseMoved');
    await dispatchMouse(canvas, { x: 460, y: 200 }, 'mouseMoved');

    expect(projectTrace(controller.getState().trace)).toEqual([
      { type: 'mousemove', target: 'left', relatedTarget: null, x: 60, y: 90 },
      { type: 'mouseover', target: 'left', relatedTarget: null, x: 60, y: 90 },
      { type: 'mousemove', target: 'left', relatedTarget: null, x: 80, y: 100 },
      { type: 'mouseout', target: 'left', relatedTarget: null, x: 300, y: 90 },
      { type: 'mousemove', target: 'right', relatedTarget: null, x: 300, y: 90 },
      { type: 'mouseover', target: 'right', relatedTarget: null, x: 300, y: 90 },
      { type: 'mouseout', target: 'right', relatedTarget: null, x: 460, y: 200 },
    ]);

    await controller.reset();
    await dispatchMouse(canvas, { x: 60, y: 90 }, 'mouseMoved');
    await controller.reset();
    await dispatchMouse(canvas, { x: 60, y: 90 }, 'mousePressed');
    await dispatchMouse(canvas, { x: 60, y: 90 }, 'mouseReleased');
    expect(projectTrace(controller.getState().trace)).toEqual([
      { type: 'mousedown', target: 'left', relatedTarget: null, x: 60, y: 90 },
      { type: 'mouseup', target: 'left', relatedTarget: null, x: 60, y: 90 },
      { type: 'click', target: 'left', relatedTarget: null, x: 60, y: 90 },
    ]);
  });

  it('records the analogous native DOM traces as characterization evidence', async () => {
    await page.viewport(800, 600);
    const fixture = mountNativeFixture();
    try {
      await dispatchMouse(fixture.fixture, { x: 10, y: 10 }, 'mouseMoved');
      fixture.recorder.reset();
      await dispatchMouse(fixture.fixture, { x: 60, y: 90 }, 'mouseMoved');
      await dispatchMouse(fixture.fixture, { x: 80, y: 100 }, 'mouseMoved');
      await dispatchMouse(fixture.fixture, { x: 300, y: 90 }, 'mouseMoved');
      await dispatchMouse(fixture.fixture, { x: 460, y: 200 }, 'mouseMoved');

      expect(projectTrace(fixture.recorder.getEntries())).toEqual([
        { type: 'mouseover', target: 'left', relatedTarget: 'outside', x: 60, y: 90 },
        { type: 'mousemove', target: 'left', relatedTarget: null, x: 60, y: 90 },
        { type: 'mousemove', target: 'left', relatedTarget: null, x: 80, y: 100 },
        { type: 'mouseout', target: 'left', relatedTarget: 'right', x: 300, y: 90 },
        { type: 'mouseover', target: 'right', relatedTarget: 'left', x: 300, y: 90 },
        { type: 'mousemove', target: 'right', relatedTarget: null, x: 300, y: 90 },
        { type: 'mouseout', target: 'right', relatedTarget: 'outside', x: 460, y: 200 },
      ]);

      await dispatchMouse(fixture.fixture, { x: 60, y: 90 }, 'mouseMoved');
      fixture.recorder.reset();
      await dispatchMouse(fixture.fixture, { x: 60, y: 90 }, 'mousePressed');
      await dispatchMouse(fixture.fixture, { x: 60, y: 90 }, 'mouseReleased');
      expect(projectTrace(fixture.recorder.getEntries())).toEqual([
        { type: 'mousedown', target: 'left', relatedTarget: null, x: 60, y: 90 },
        { type: 'mouseup', target: 'left', relatedTarget: null, x: 60, y: 90 },
        { type: 'click', target: 'left', relatedTarget: null, x: 60, y: 90 },
      ]);
    } finally {
      fixture.dispose();
    }
  });
});
