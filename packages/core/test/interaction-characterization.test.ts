import type {
  EventTraceEntry,
  InteractionLabState,
  ScenarioController,
} from '@crc/scenarios';
import {
  getMouseContractCase,
  interactionLabScenarioEntry,
  loadScenario,
} from '@crc/scenarios';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import interactionLabSource from '../../scenarios/src/interaction-lab.example.tsx?raw';
import {
  clickMouse,
  moveMouse,
  pressMouse,
  releaseMouse,
} from './support/mouse-input';
import type { MousePoint } from './support/mouse-input';

const activeControllers = new Set<ScenarioController<InteractionLabState>>();

const BACKGROUND = { x: 460, y: 200 } as const;
const LEFT = { x: 60, y: 90 } as const;
const LEFT_WITHIN = { x: 80, y: 100 } as const;
const RIGHT = { x: 300, y: 90 } as const;

function route(trace: readonly EventTraceEntry[]) {
  return trace.map(({ type, target }) => ({ type, target }));
}

function positionedRoute(trace: readonly EventTraceEntry[]) {
  return trace.map(({ type, target, x, y }) => ({ type, target, x, y }));
}

function expectedRoute(
  caseId: string,
  targets: Readonly<Record<string, string>> = { a: 'left', b: 'right' },
) {
  const contractCase = getMouseContractCase(caseId);
  if (!contractCase) {
    throw new Error(`Unknown mouse contract case "${caseId}".`);
  }
  return contractCase.crcTrace.map(({ type, target }) => ({
    type,
    target: targets[target] ?? target,
  }));
}

function nativeContractProjection(
  caseId: string,
  point: MousePoint,
  targets: { a: string; b: string } = { a: 'left', b: 'right' },
) {
  const contractCase = getMouseContractCase(caseId);
  if (!contractCase?.nativeTrace) {
    throw new Error(`Mouse contract case "${caseId}" has no native trace.`);
  }
  const fixtureTarget = (target: string | null) => {
    if (target === 'a') return targets.a;
    if (target === 'b') return targets.b;
    if (target === 'canvas-background') return 'outside';
    if (target === 'outside-root') return null;
    return target;
  };
  return contractCase.nativeTrace.map(({ type, target, logicalRelatedTarget }) => ({
    type,
    target: fixtureTarget(target),
    relatedTarget: fixtureTarget(logicalRelatedTarget),
    ...point,
  }));
}

function nativeProjection(trace: readonly EventTraceEntry[]) {
  return trace.filter(entry => entry.source === 'native').map(({
    type,
    target,
    relatedTarget,
    x,
    y,
  }) => ({ type, target, relatedTarget, x, y }));
}

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): readonly number[] {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The interaction lab Canvas has no 2D context.');
  }
  return Array.from(context.getImageData(x, y, 1, 1).data);
}

async function mountLab() {
  const canvas = document.createElement('canvas');
  canvas.width = interactionLabScenarioEntry.canvas.width;
  canvas.height = interactionLabScenarioEntry.canvas.height;
  canvas.style.cssText = 'display:block; margin:40px; width:480px; height:240px';
  const referenceHost = document.createElement('div');
  document.body.replaceChildren(canvas, referenceHost);
  const definition = await loadScenario(interactionLabScenarioEntry);
  const controller = await definition.mount({ canvas, referenceHost });
  activeControllers.add(controller);
  return { canvas, controller, definition, referenceHost };
}

async function clearTrace(controller: ScenarioController<InteractionLabState>): Promise<void> {
  await controller.perform('clear-trace');
  expect(controller.getState().trace).toEqual([]);
}

async function prepareFixture(
  controller: ScenarioController<InteractionLabState>,
  canvas: HTMLCanvasElement,
  fixture: InteractionLabState['fixture'],
): Promise<void> {
  await controller.perform(`show-${fixture}`);
  await moveMouse(canvas, BACKGROUND);
  await clearTrace(controller);
}

afterEach(async () => {
  for (const controller of activeControllers) {
    await controller.dispose();
  }
  activeControllers.clear();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('interaction ordering and target contract', () => {
  it('loads the trusted shared laboratory and preserves its deterministic visuals', async () => {
    await page.viewport(900, 700);
    expect(interactionLabSource).toContain(interactionLabScenarioEntry.source.marker);
    const { canvas, controller, definition } = await mountLab();

    expect(controller.getState().fixture).toBe('regions');
    expect(pixelAt(canvas, 10, 10)).toEqual([248, 250, 252, 255]);
    expect(pixelAt(canvas, 60, 140)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(canvas, 300, 140)).toEqual([124, 58, 237, 255]);
    expect(definition.formatState(controller.getState())).toContainEqual({
      label: 'Actual trace',
      value: 'none',
    });

    await controller.perform('show-overlap');
    expect(pixelAt(canvas, 100, 120)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(canvas, 220, 120)).toEqual([124, 58, 237, 255]);
    await controller.reset();
    expect(controller.getState()).toMatchObject({
      fixture: 'regions',
      handlerGeneration: 1,
      lastAction: 'reset',
      trace: [],
    });
  });

  it('matches the approved enter, stable, switch, background, root-exit, and re-entry routes', async () => {
    await page.viewport(900, 700);
    const { canvas, controller } = await mountLab();
    await moveMouse(canvas, BACKGROUND);
    await clearTrace(controller);

    await moveMouse(canvas, LEFT);
    expect(route(controller.getState().trace)).toEqual(expectedRoute('enter-region'));
    expect(positionedRoute(controller.getState().trace)).toEqual([
      { type: 'mouseover', target: 'left', ...LEFT },
      { type: 'mousemove', target: 'left', ...LEFT },
    ]);

    await clearTrace(controller);
    await moveMouse(canvas, LEFT_WITHIN);
    expect(route(controller.getState().trace)).toEqual(expectedRoute('move-within-region'));

    await clearTrace(controller);
    await moveMouse(canvas, RIGHT);
    expect(route(controller.getState().trace)).toEqual(expectedRoute('switch-regions'));

    await clearTrace(controller);
    await moveMouse(canvas, BACKGROUND);
    expect(route(controller.getState().trace)).toEqual(expectedRoute(
      'leave-region-to-canvas-background',
      { a: 'right' },
    ));

    await moveMouse(canvas, LEFT);
    await clearTrace(controller);
    await moveMouse(canvas, { x: 500, y: 200 });
    expect(route(controller.getState().trace)).toEqual(expectedRoute('exit-root-canvas'));
    await moveMouse(canvas, { x: 520, y: 200 });
    expect(route(controller.getState().trace)).toEqual(expectedRoute('exit-root-canvas'));

    await clearTrace(controller);
    await moveMouse(canvas, LEFT);
    expect(route(controller.getState().trace)).toEqual(expectedRoute('enter-region'));
  });

  it('selects one reverse-paint-order target and keeps its cursor in agreement', async () => {
    await page.viewport(900, 700);
    const { canvas, controller } = await mountLab();
    await prepareFixture(controller, canvas, 'overlap');

    await moveMouse(canvas, { x: 100, y: 120 });
    expect(route(controller.getState().trace)).toEqual(expectedRoute(
      'enter-region',
      { a: 'lower' },
    ));
    expect(canvas.style.cursor).toBe('crosshair');

    await clearTrace(controller);
    await moveMouse(canvas, { x: 220, y: 120 });
    expect(route(controller.getState().trace)).toEqual(expectedRoute(
      'switch-regions',
      { a: 'lower', b: 'top' },
    ));
    expect(canvas.style.cursor).toBe('pointer');

    await clearTrace(controller);
    await controller.perform('reorder-overlap');
    await moveMouse(canvas, { x: 220, y: 120 });
    expect(route(controller.getState().trace)).toEqual(expectedRoute(
      'switch-regions',
      { a: 'top', b: 'lower' },
    ));
    expect(canvas.style.cursor).toBe('crosshair');

    await controller.perform('show-overlap');
    await moveMouse(canvas, { x: 220, y: 120 });
    await clearTrace(controller);
    await controller.perform('remove-top');
    expect(canvas.style.cursor).toBe('');
    await moveMouse(canvas, { x: 220, y: 120 });
    expect(route(controller.getState().trace)).toEqual(expectedRoute(
      'enter-region',
      { a: 'lower' },
    ));
    expect(canvas.style.cursor).toBe('crosshair');
  });

  it('selects a child nested under an interactive ancestor without fan-out', async () => {
    await page.viewport(900, 700);
    const { canvas, controller } = await mountLab();
    await prepareFixture(controller, canvas, 'nested');

    await moveMouse(canvas, { x: 100, y: 110 });
    expect(route(controller.getState().trace)).toEqual([
      { type: 'mousemove', target: 'ancestor' },
    ]);
    expect(canvas.style.cursor).toBe('');

    await clearTrace(controller);
    await moveMouse(canvas, { x: 220, y: 120 });
    expect(route(controller.getState().trace)).toEqual(expectedRoute(
      'enter-region',
      { a: 'child' },
    ));
    expect(controller.getState().trace.some(entry => entry.target === 'ancestor')).toBe(false);
    expect(canvas.style.cursor).toBe('pointer');

    await clearTrace(controller);
    await moveMouse(canvas, { x: 100, y: 110 });
    expect(route(controller.getState().trace)).toEqual([
      { type: 'mouseout', target: 'child' },
      { type: 'mousemove', target: 'ancestor' },
    ]);
    expect(canvas.style.cursor).toBe('');
  });

  it.each([
    { fixture: 'fill', caseId: 'fill-hit', hit: { x: 150, y: 120 }, miss: { x: 50, y: 210 } },
    { fixture: 'stroke', caseId: 'stroke-hit', hit: { x: 91, y: 126 }, miss: { x: 150, y: 126 } },
    { fixture: 'fill-stroke', caseId: 'fill-stroke-hit', hit: { x: 91, y: 126 }, miss: { x: 50, y: 210 } },
    { fixture: 'transparent', caseId: 'transparent-fill-hit', hit: { x: 150, y: 120 }, miss: { x: 50, y: 210 } },
    { fixture: 'interaction-width', caseId: 'line-interaction-width-hit', hit: { x: 240, y: 135 }, miss: { x: 240, y: 155 } },
  ] as const)('emits entry before movement for $fixture geometry and rejects its miss', async ({
    fixture,
    caseId,
    hit,
    miss,
  }) => {
    await page.viewport(900, 700);
    const { canvas, controller } = await mountLab();
    await prepareFixture(controller, canvas, fixture);

    await moveMouse(canvas, miss);
    expect(controller.getState().trace, `${fixture} negative probe`).toEqual([]);
    expect(canvas.style.cursor).toBe('');

    await moveMouse(canvas, hit);
    expect(route(controller.getState().trace), fixture).toEqual(expectedRoute(caseId, { a: 'a' }));
    expect(canvas.style.cursor).toBe('pointer');
    if (fixture === 'transparent') {
      expect(pixelAt(canvas, 150, 120)).toEqual([226, 232, 240, 255]);
    }
  });

  it('keeps a handler with no configured hit geometry inert', async () => {
    await page.viewport(900, 700);
    const { canvas, controller } = await mountLab();
    await prepareFixture(controller, canvas, 'no-hit');
    await moveMouse(canvas, { x: 150, y: 120 });
    expect(controller.getState().trace).toEqual([]);
    expect(canvas.style.cursor).toBe('');
  });

  it('keeps stable identity across handler replacement and removes handlers without ghosts', async () => {
    await page.viewport(900, 700);
    const { canvas, controller } = await mountLab();
    await moveMouse(canvas, LEFT);
    await clearTrace(controller);

    await controller.perform('replace-handler');
    await moveMouse(canvas, LEFT_WITHIN);
    expect(route(controller.getState().trace)).toEqual(expectedRoute('move-within-region'));
    expect(controller.getState().lastHandlerGeneration).toBe(2);

    await clearTrace(controller);
    await controller.perform('remove-handler');
    expect(canvas.style.cursor).toBe('');
    await moveMouse(canvas, LEFT);
    await clickMouse(canvas, LEFT);
    expect(controller.getState().trace).toEqual([]);
  });

  it('queues target-specific removal from mouseout while keeping the runtime live', async () => {
    await page.viewport(900, 700);
    const { canvas, controller } = await mountLab();
    await prepareFixture(controller, canvas, 'remove-target-after-transition');
    await moveMouse(canvas, LEFT);
    await clearTrace(controller);
    await moveMouse(canvas, RIGHT);
    expect(route(controller.getState().trace)).toEqual(expectedRoute('switch-regions'));
    await controller.settled();
    expect(controller.getState().rightVisible).toBe(false);
    expect(pixelAt(canvas, RIGHT.x, RIGHT.y)).toEqual([248, 250, 252, 255]);
    await clearTrace(controller);
    await moveMouse(canvas, LEFT);
    expect(route(controller.getState().trace)).toEqual(expectedRoute('enter-region'));
  });

  it('enforces same-live-target primary activation and removed-target cancellation', async () => {
    await page.viewport(900, 700);
    const { canvas, controller } = await mountLab();

    await moveMouse(canvas, LEFT);
    await clearTrace(controller);
    await clickMouse(canvas, LEFT);
    expect(route(controller.getState().trace)).toEqual(expectedRoute('primary-click-same-target'));

    await clearTrace(controller);
    await pressMouse(canvas, LEFT);
    await moveMouse(canvas, RIGHT);
    await releaseMouse(canvas, RIGHT);
    expect(route(controller.getState().trace)).toEqual(expectedRoute('primary-click-cross-target'));

    await moveMouse(canvas, LEFT);
    await clearTrace(controller);
    await pressMouse(canvas, LEFT);
    await moveMouse(canvas, BACKGROUND);
    await moveMouse(canvas, LEFT);
    await releaseMouse(canvas, LEFT);
    expect(route(controller.getState().trace)).toEqual(expectedRoute('primary-click-reentry'));

    await clearTrace(controller);
    await pressMouse(canvas, LEFT);
    await controller.perform('remove-handler');
    await releaseMouse(canvas, LEFT);
    expect(route(controller.getState().trace)).toEqual(expectedRoute('remove-target-during-press'));
  });

  it('does not activate a region when the primary press starts on Canvas background', async () => {
    await page.viewport(900, 700);
    const { canvas, controller } = await mountLab();
    await moveMouse(canvas, BACKGROUND);
    await clearTrace(controller);

    await pressMouse(canvas, BACKGROUND);
    await releaseMouse(canvas, LEFT);

    expect(route(controller.getState().trace)).toEqual([
      { type: 'mouseup', target: 'left' },
    ]);
  });

  it('delivers double click and preserves the active browser context-menu order', async () => {
    await page.viewport(900, 700);
    const { canvas, controller } = await mountLab();
    await moveMouse(canvas, LEFT);
    await clearTrace(controller);
    await pressMouse(canvas, LEFT, { clickCount: 1 });
    await releaseMouse(canvas, LEFT, { clickCount: 1 });
    await pressMouse(canvas, LEFT, { clickCount: 2 });
    await releaseMouse(canvas, LEFT, { clickCount: 2 });
    expect(route(controller.getState().trace)).toEqual(expectedRoute('double-click'));

    await moveMouse(canvas, RIGHT);
    await clearTrace(controller);
    const nativeOrder: string[] = [];
    const recordNative = (event: Event) => nativeOrder.push(event.type);
    for (const type of ['mousedown', 'contextmenu', 'mouseup']) {
      canvas.addEventListener(type, recordNative);
    }
    await pressMouse(canvas, RIGHT, { button: 'right' });
    await releaseMouse(canvas, RIGHT, { button: 'right' });
    for (const type of ['mousedown', 'contextmenu', 'mouseup']) {
      canvas.removeEventListener(type, recordNative);
    }
    expect(route(controller.getState().trace)).toEqual(nativeOrder.map(type => ({
      type,
      target: 'right',
    })));
    expect(new Set(nativeOrder)).toEqual(new Set(['mousedown', 'contextmenu', 'mouseup']));
  });

  it('cross-checks analogous movement traces against the current native Chromium fixture', async () => {
    await page.viewport(900, 700);
    const { controller, referenceHost } = await mountLab();
    const fixture = referenceHost.querySelector<HTMLElement>('[data-testid="native-reference-stage"]');
    if (!fixture) {
      throw new Error('The shared native reference fixture was not mounted.');
    }

    await moveMouse(fixture, { x: 10, y: 10 });
    await clearTrace(controller);
    await moveMouse(fixture, LEFT);
    await moveMouse(fixture, LEFT_WITHIN);
    await moveMouse(fixture, RIGHT);
    await moveMouse(fixture, BACKGROUND);

    expect(nativeProjection(controller.getState().trace)).toEqual([
      ...nativeContractProjection('enter-region', LEFT),
      ...nativeContractProjection('move-within-region', LEFT_WITHIN),
      ...nativeContractProjection('switch-regions', RIGHT),
      ...nativeContractProjection(
        'leave-region-to-canvas-background',
        BACKGROUND,
        { a: 'right', b: 'right' },
      ),
    ]);
  });
});
