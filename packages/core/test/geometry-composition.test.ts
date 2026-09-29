import type {
  EventTraceEntry,
  GeometryMatrixCaseId,
  GeometryMatrixPoint,
  GeometryMatrixState,
  ScenarioController,
} from '@crc/scenarios';
import {
  GEOMETRY_MATRIX_CASES,
  geometryMatrixScenarioEntry,
  loadScenario,
} from '@crc/scenarios';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import geometryMatrixSource from '../../scenarios/src/geometry-matrix.example.tsx?raw';
import { Absolute, Clip, crc, Group, Layer, Rectangle, type CRCController } from '../src/index';
import {
  clickMouse,
  backingPointForLogical,
  cssPointForIntrinsic,
  moveMouse,
} from './support/mouse-input';
import { expectVisualMatch } from './visual-compare';
import { createElement } from '../src/lib/element/create-element';

const activeControllers = new Set<ScenarioController<GeometryMatrixState>>();
const activeRuntimeControllers = new Set<CRCController>();
const BACKGROUND = { x: 470, y: 220 } as const;

function route(trace: readonly EventTraceEntry[]) {
  return trace.map(({ type, target }) => ({ type, target }));
}

function positionedRoute(trace: readonly EventTraceEntry[]) {
  return trace.map(({ type, target, x, y }) => ({ type, target, x, y }));
}

function pixelAt(canvas: HTMLCanvasElement, point: GeometryMatrixPoint): readonly number[] {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The geometry matrix Canvas has no 2D context.');
  }
  const backing = backingPointForLogical(canvas, point);
  return Array.from(context.getImageData(
    Math.floor(backing.x),
    Math.floor(backing.y),
    1,
    1,
  ).data);
}

function getMatrixCase(caseId: GeometryMatrixCaseId) {
  const matrixCase = GEOMETRY_MATRIX_CASES.find(candidate => candidate.id === caseId);
  if (!matrixCase) {
    throw new Error(`Unknown geometry matrix case "${caseId}".`);
  }
  return matrixCase;
}

async function moveIntrinsic(
  canvas: HTMLCanvasElement,
  point: GeometryMatrixPoint,
): Promise<void> {
  await moveMouse(canvas, cssPointForIntrinsic(canvas, point));
}

async function clickIntrinsic(
  canvas: HTMLCanvasElement,
  point: GeometryMatrixPoint,
): Promise<void> {
  await clickMouse(canvas, cssPointForIntrinsic(canvas, point));
}

async function mountMatrix() {
  await page.viewport(900, 700);
  const canvas = document.createElement('canvas');
  canvas.width = geometryMatrixScenarioEntry.canvas.width;
  canvas.height = geometryMatrixScenarioEntry.canvas.height;
  canvas.style.cssText = 'display:block; margin:40px';
  document.body.replaceChildren(canvas);
  const definition = await loadScenario(geometryMatrixScenarioEntry);
  const controller = await definition.mount({ canvas });
  activeControllers.add(controller);
  return { canvas, controller, definition };
}

async function clearTrace(controller: ScenarioController<GeometryMatrixState>): Promise<void> {
  await controller.perform('clear-trace');
  expect(controller.getState().trace).toEqual([]);
}

async function prepareCase(
  controller: ScenarioController<GeometryMatrixState>,
  canvas: HTMLCanvasElement,
  caseId: GeometryMatrixCaseId,
): Promise<void> {
  await controller.perform(`show-${caseId}`);
  await moveIntrinsic(canvas, BACKGROUND);
  await clearTrace(controller);
}

afterEach(async () => {
  for (const controller of activeControllers) {
    await controller.dispose();
  }
  activeControllers.clear();
  for (const controller of activeRuntimeControllers) {
    controller.dispose();
  }
  activeRuntimeControllers.clear();
  document.body.replaceChildren();
});

describe('geometry interaction matrix', () => {
  it('composes translated and scaled groups with fractional negative layout offsets', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 120;
    document.body.replaceChildren(canvas);
    const moves: string[] = [];
    const controller = crc(canvas, createElement(Group, {
      style: {
        scaleX: 1.5,
        scaleY: 1.25,
        translateX: 20,
        translateY: 10,
      },
      children: [createElement(Absolute, {
        style: { width: 80, height: 60 },
        children: [createElement(Rectangle, {
          style: {
            left: -4.75,
            top: 3.25,
            width: 20.5,
            height: 10.5,
            fill: '#16a34a',
          },
          onMouseMove: () => moves.push('fractional-layout'),
        })],
      })],
    }));
    activeRuntimeControllers.add(controller);
    await settleFrames();

    expect(pixelAt(canvas, { x: 21, y: 20 })).toEqual([0, 0, 0, 0]);
    expect(pixelAt(canvas, { x: 23, y: 20 })).toEqual([22, 163, 74, 255]);
    expect(pixelAt(canvas, { x: 54, y: 20 })).toEqual([0, 0, 0, 0]);
    expect(pixelAt(canvas, { x: 30, y: 15 })).toEqual([0, 0, 0, 0]);
    expect(pixelAt(canvas, { x: 30, y: 30 })).toEqual([0, 0, 0, 0]);
    expect(pixelAt(canvas, { x: 22, y: 20 })[3]).toBeGreaterThan(0);
    expect(pixelAt(canvas, { x: 22, y: 20 })[3]).toBeLessThan(255);
    expect(pixelAt(canvas, { x: 53, y: 20 })[3]).toBeGreaterThan(0);
    expect(pixelAt(canvas, { x: 53, y: 20 })[3]).toBeLessThan(255);
    expect(pixelAt(canvas, { x: 30, y: 16 })[3]).toBeGreaterThan(0);
    expect(pixelAt(canvas, { x: 30, y: 16 })[3]).toBeLessThan(255);
    expect(pixelAt(canvas, { x: 30, y: 29 })[3]).toBeGreaterThan(0);
    expect(pixelAt(canvas, { x: 30, y: 29 })[3]).toBeLessThan(255);

    dispatchMove(canvas, 22.8, 20);
    dispatchMove(canvas, 22.9, 20);
    dispatchMove(canvas, 53.6, 20);
    dispatchMove(canvas, 53.7, 20);
    dispatchMove(canvas, 30, 16.5);
    dispatchMove(canvas, 30, 16.6);
    dispatchMove(canvas, 30, 29.6);
    dispatchMove(canvas, 30, 29.8);
    expect(moves).toEqual([
      'fractional-layout',
      'fractional-layout',
      'fractional-layout',
      'fractional-layout',
    ]);
  });

  it('keeps nested layout paint and hit geometry inside the same clip and layer', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 100;
    document.body.replaceChildren(canvas);
    const clippingPath = new Path2D();
    clippingPath.rect(30, 20, 40, 40);
    const moves: string[] = [];
    const controller = crc(canvas, createElement(Clip, {
      style: { d: clippingPath },
      children: [createElement(Layer, {
        style: { width: 120, height: 90 },
        children: createElement(Absolute, {
          style: { width: 120, height: 90 },
          children: [createElement(Rectangle, {
            style: {
              left: 20,
              top: 10,
              width: 60,
              height: 60,
              fill: '#7c3aed',
            },
            onMouseMove: () => moves.push('layer-layout'),
          })],
        }),
      })],
    }));
    activeRuntimeControllers.add(controller);
    await settleFrames();

    expect(pixelAt(canvas, { x: 40, y: 30 })).toEqual([124, 58, 237, 255]);
    expect(pixelAt(canvas, { x: 25, y: 15 })).toEqual([0, 0, 0, 0]);
    expect(pixelAt(canvas, { x: 75, y: 50 })).toEqual([0, 0, 0, 0]);
    dispatchMove(canvas, 40, 30);
    dispatchMove(canvas, 25, 15);
    dispatchMove(canvas, 75, 50);
    expect(moves).toEqual(['layer-layout']);
  });

  it('loads the trusted public scenario, exact probes, and reset state', async () => {
    expect(geometryMatrixSource).toContain(geometryMatrixScenarioEntry.source.marker);
    expect(geometryMatrixScenarioEntry.actions.map(action => action.id)).toEqual([
      ...GEOMETRY_MATRIX_CASES.map(matrixCase => `show-${matrixCase.id}`),
      'clear-trace',
    ]);
    const { canvas, controller, definition } = await mountMatrix();

    for (const matrixCase of GEOMETRY_MATRIX_CASES) {
      await controller.perform(`show-${matrixCase.id}`);
      expect(controller.getState()).toMatchObject({
        caseId: matrixCase.id,
        cssHeight: matrixCase.cssSize.height,
        cssWidth: matrixCase.cssSize.width,
        lastTarget: null,
        trace: [],
      });
      expect(canvas.getBoundingClientRect()).toMatchObject({
        width: matrixCase.cssSize.width,
        height: matrixCase.cssSize.height,
      });
      for (const probe of matrixCase.probes) {
        expect(pixelAt(canvas, probe.point), `${matrixCase.id}/${probe.id}`).toEqual(
          probe.expectedPixel,
        );
      }
    }

    await controller.reset();
    expect(controller.getState()).toMatchObject({
      caseId: 'root-fill',
      cssHeight: 240,
      cssWidth: 480,
      lastAction: 'reset',
      lastCoordinates: null,
      lastTarget: null,
      trace: [],
    });
    expect(definition.formatState(controller.getState())).toContainEqual({
      label: 'Canvas size',
      value: '480 × 240 intrinsic · 480 × 240 CSS',
    });
  });

  it.each(['root-fill', 'css-scaled-fill'] as const)(
    'preserves fill hits, exact boundaries, misses, and intrinsic coordinates for %s',
    async (caseId) => {
      const { canvas, controller } = await mountMatrix();
      const matrixCase = getMatrixCase(caseId);
      const center = matrixCase.probes[0];
      const boundary = matrixCase.probes[1];
      const outside = matrixCase.probes[2];
      await prepareCase(controller, canvas, caseId);

      await moveIntrinsic(canvas, center.point);
      expect(positionedRoute(controller.getState().trace)).toEqual([
        { type: 'mouseover', target: 'fill', ...center.point },
        { type: 'mousemove', target: 'fill', ...center.point },
      ]);
      expect(canvas.style.cursor).toBe('pointer');

      await moveIntrinsic(canvas, BACKGROUND);
      await clearTrace(controller);
      await moveIntrinsic(canvas, boundary.point);
      expect(positionedRoute(controller.getState().trace)).toEqual([
        { type: 'mouseover', target: 'fill', ...boundary.point },
        { type: 'mousemove', target: 'fill', ...boundary.point },
      ]);

      await moveIntrinsic(canvas, BACKGROUND);
      await clearTrace(controller);
      await moveIntrinsic(canvas, outside.point);
      expect(controller.getState().trace).toEqual([]);
      expect(canvas.style.cursor).toBe('');
    },
  );

  it('composes nested translation, rotation, scale, skew, and an inner clip', async () => {
    const { canvas, controller } = await mountMatrix();
    await prepareCase(controller, canvas, 'compound-transform-clip');

    await moveIntrinsic(canvas, { x: 120, y: 70 });
    expect(positionedRoute(controller.getState().trace)).toEqual([
      { type: 'mouseover', target: 'transformed', x: 120, y: 70 },
      { type: 'mousemove', target: 'transformed', x: 120, y: 70 },
    ]);
    await clearTrace(controller);
    await moveIntrinsic(canvas, { x: 120, y: 45 });
    expect(positionedRoute(controller.getState().trace)).toEqual([
      { type: 'mouseout', target: 'transformed', x: 120, y: 45 },
    ]);
    await clearTrace(controller);
    await moveIntrinsic(canvas, { x: 180, y: 70 });
    expect(controller.getState().trace).toEqual([]);
    expect(canvas.style.cursor).toBe('');
  });

  it('requires every nested clip and rejects the evenodd hole', async () => {
    const { canvas, controller } = await mountMatrix();
    await prepareCase(controller, canvas, 'nested-clip-intersection');

    for (const point of [
      { x: 80, y: 120 },
      { x: 340, y: 120 },
      { x: 230, y: 120 },
    ]) {
      await moveIntrinsic(canvas, point);
      expect(controller.getState().trace, JSON.stringify(point)).toEqual([]);
    }

    await moveIntrinsic(canvas, { x: 150, y: 85 });
    expect(positionedRoute(controller.getState().trace)).toEqual([
      { type: 'mouseover', target: 'clipped', x: 150, y: 85 },
      { type: 'mousemove', target: 'clipped', x: 150, y: 85 },
    ]);
    await clearTrace(controller);
    await moveIntrinsic(canvas, { x: 230, y: 120 });
    expect(positionedRoute(controller.getState().trace)).toEqual([
      { type: 'mouseout', target: 'clipped', x: 230, y: 120 },
    ]);
    expect(canvas.style.cursor).toBe('');
  });

  it('selects one root-or-layer target in global paint order', async () => {
    const { canvas, controller } = await mountMatrix();
    await prepareCase(controller, canvas, 'layer-paint-order');

    const routePoints = [
      { target: 'root-under', cursor: 'default', point: { x: 50, y: 120 } },
      { target: 'layer-one', cursor: 'pointer', point: { x: 120, y: 120 } },
      { target: 'root-middle', cursor: 'crosshair', point: { x: 260, y: 120 } },
      { target: 'layer-two', cursor: 'grab', point: { x: 350, y: 120 } },
    ] as const;
    for (const step of routePoints) {
      await moveIntrinsic(canvas, step.point);
      expect(canvas.style.cursor, step.target).toBe(step.cursor);
    }

    expect(route(controller.getState().trace)).toEqual([
      { type: 'mouseover', target: 'root-under' },
      { type: 'mousemove', target: 'root-under' },
      { type: 'mouseout', target: 'root-under' },
      { type: 'mouseover', target: 'layer-one' },
      { type: 'mousemove', target: 'layer-one' },
      { type: 'mouseout', target: 'layer-one' },
      { type: 'mouseover', target: 'root-middle' },
      { type: 'mousemove', target: 'root-middle' },
      { type: 'mouseout', target: 'root-middle' },
      { type: 'mouseover', target: 'layer-two' },
      { type: 'mousemove', target: 'layer-two' },
    ]);
  });

  it('forwards one root-coordinate route through transformed and cropped nested layers', async () => {
    const { canvas, controller } = await mountMatrix();
    await prepareCase(controller, canvas, 'transformed-nested-layer');

    await moveIntrinsic(canvas, { x: 150, y: 60 });
    expect(positionedRoute(controller.getState().trace)).toEqual([
      { type: 'mouseover', target: 'nested-layer', x: 150, y: 60 },
      { type: 'mousemove', target: 'nested-layer', x: 150, y: 60 },
    ]);
    await clearTrace(controller);
    await clickIntrinsic(canvas, { x: 150, y: 60 });
    expect(positionedRoute(controller.getState().trace)).toEqual([
      { type: 'mousedown', target: 'nested-layer', x: 150, y: 60 },
      { type: 'mouseup', target: 'nested-layer', x: 150, y: 60 },
      { type: 'click', target: 'nested-layer', x: 150, y: 60 },
    ]);

    await clearTrace(controller);
    await moveIntrinsic(canvas, { x: 190, y: 70 });
    expect(route(controller.getState().trace)).toEqual([
      { type: 'mouseout', target: 'nested-layer' },
      { type: 'mouseover', target: 'layer-base' },
      { type: 'mousemove', target: 'layer-base' },
    ]);
    await clearTrace(controller);
    await moveIntrinsic(canvas, { x: 210, y: 100 });
    expect(route(controller.getState().trace)).toEqual([
      { type: 'mousemove', target: 'layer-base' },
    ]);
    await clearTrace(controller);
    await moveIntrinsic(canvas, { x: 50, y: 50 });
    expect(route(controller.getState().trace)).toEqual([
      { type: 'mouseout', target: 'layer-base' },
    ]);
    expect(canvas.style.cursor).toBe('');
  });

  it('keeps a transformed interaction stroke deterministic at and beyond its boundary', async () => {
    const { canvas, controller } = await mountMatrix();
    await prepareCase(controller, canvas, 'stroke-boundary');

    for (const point of [{ x: 240, y: 120 }, { x: 240, y: 110 }]) {
      await moveIntrinsic(canvas, BACKGROUND);
      await clearTrace(controller);
      await moveIntrinsic(canvas, point);
      expect(positionedRoute(controller.getState().trace), JSON.stringify(point)).toEqual([
        { type: 'mouseover', target: 'stroke', ...point },
        { type: 'mousemove', target: 'stroke', ...point },
      ]);
    }
    await moveIntrinsic(canvas, BACKGROUND);
    await clearTrace(controller);
    await moveIntrinsic(canvas, { x: 240, y: 109 });
    expect(controller.getState().trace).toEqual([]);
    expect(pixelAt(canvas, { x: 240, y: 110 })).toEqual([248, 250, 252, 255]);
  });
});

function dispatchMove(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new MouseEvent('mousemove', {
    bubbles: true,
    clientX: bounds.left + x,
    clientY: bounds.top + y,
  }));
}

function settleFrames(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() =>
    requestAnimationFrame(() => resolve()),
  ));
}

describe('geometry visual matrix', () => {
  it.each(GEOMETRY_MATRIX_CASES.map(matrixCase => [matrixCase.id] as const))(
    'matches the reviewed %s rendering exactly',
    async (caseId) => {
      const { canvas, controller } = await mountMatrix();
      await controller.perform(`show-${caseId}`);
      await controller.settled();

      if (
        import.meta.env.VITE_CRC_GEOMETRY_VISUAL_DRILL === '1' &&
        caseId === 'compound-transform-clip'
      ) {
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('The geometry visual drill Canvas has no 2D context.');
        }
        context.fillStyle = '#ec4899';
        context.fillRect(210, 20, 60, 50);
      }

      await expectVisualMatch({
        element: canvas,
        expectedPath: `packages/core/test/visual-baselines/tfc-05-${caseId}.expected.png`,
        expectedArtifactPath: `test-screenshots/tfc-05/${caseId}.expected.png`,
        actualPath: `../../../test-screenshots/tfc-05/${caseId}.actual.png`,
        diffPath: `test-screenshots/tfc-05/${caseId}.diff.png`,
      });
    },
  );
});
