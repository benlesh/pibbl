import type {
  EventTraceEntry,
  InteractionLabState,
  ScenarioController,
} from '@crc/scenarios';
import {
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

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): readonly number[] {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The interaction lab Canvas has no 2D context.');
  }
  return Array.from(context.getImageData(x, y, 1, 1).data);
}

async function mountCRCLab() {
  const canvas = document.createElement('canvas');
  canvas.width = interactionLabScenarioEntry.canvas.width;
  canvas.height = interactionLabScenarioEntry.canvas.height;
  canvas.style.cssText = 'display:block; margin:40px; width:480px; height:240px';
  const referenceHost = document.createElement('div');
  document.body.replaceChildren(canvas, referenceHost);
  const definition = await loadScenario(interactionLabScenarioEntry);
  const controller = await definition.mount({ canvas, referenceHost });
  activeControllers.add(controller);
  return { canvas, controller, referenceHost };
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
    expect(pixelAt(canvas, 10, 10)).toEqual([248, 250, 252, 255]);
    expect(pixelAt(canvas, 60, 140)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(canvas, 300, 140)).toEqual([124, 58, 237, 255]);

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
    const { controller, referenceHost } = await mountCRCLab();
    const fixture = referenceHost.querySelector<HTMLElement>('[data-testid="native-reference-stage"]');
    if (!fixture) {
      throw new Error('The shared native reference fixture was not mounted.');
    }
    await dispatchMouse(fixture, { x: 10, y: 10 }, 'mouseMoved');
    await controller.reset();
    await dispatchMouse(fixture, { x: 60, y: 90 }, 'mouseMoved');
    await dispatchMouse(fixture, { x: 80, y: 100 }, 'mouseMoved');
    await dispatchMouse(fixture, { x: 300, y: 90 }, 'mouseMoved');
    await dispatchMouse(fixture, { x: 460, y: 200 }, 'mouseMoved');

    expect(projectTrace(controller.getState().trace)).toEqual([
      { type: 'mouseover', target: 'left', relatedTarget: 'outside', x: 60, y: 90 },
      { type: 'mousemove', target: 'left', relatedTarget: null, x: 60, y: 90 },
      { type: 'mousemove', target: 'left', relatedTarget: null, x: 80, y: 100 },
      { type: 'mouseout', target: 'left', relatedTarget: 'right', x: 300, y: 90 },
      { type: 'mouseover', target: 'right', relatedTarget: 'left', x: 300, y: 90 },
      { type: 'mousemove', target: 'right', relatedTarget: null, x: 300, y: 90 },
      { type: 'mouseout', target: 'right', relatedTarget: 'outside', x: 460, y: 200 },
    ]);

    await dispatchMouse(fixture, { x: 60, y: 90 }, 'mouseMoved');
    await controller.reset();
    await dispatchMouse(fixture, { x: 60, y: 90 }, 'mousePressed');
    await dispatchMouse(fixture, { x: 60, y: 90 }, 'mouseReleased');
    expect(projectTrace(controller.getState().trace)).toEqual([
      { type: 'mousedown', target: 'left', relatedTarget: null, x: 60, y: 90 },
      { type: 'mouseup', target: 'left', relatedTarget: null, x: 60, y: 90 },
      { type: 'click', target: 'left', relatedTarget: null, x: 60, y: 90 },
    ]);
  });
});
