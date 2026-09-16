import {
  Fragment,
  Rectangle,
  crc,
  createElement,
  type CRCController,
} from '@crc/core';
import type {
  ScenarioController,
  WebGLLabState,
} from '@crc/scenarios';
import {
  WEBGL_LAB_ACTION_IDS,
  WEBGL_LAB_PROBES,
  getLearningExampleBySlug,
  getLearningExampleRoute,
  getScenarioRoute,
  loadScenario,
  scenarioCatalog,
  webglLabScenarioEntry,
} from '@crc/scenarios';
import {
  Cube,
  Group3D,
  WebGLLayer,
  crcAnimationFrame,
} from '@crc/webgl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import learningWebGLSource from '../../scenarios/src/learning/composition/webgl-islands.example.tsx?raw';
import webglLabSource from '../../scenarios/src/webgl-lab.example.tsx?raw';
import {
  clickLogicalPoint,
  penDownLogicalPoint,
  penUpLogicalPoint,
  pressKey,
  tab,
  touchEndLogicalPoint,
  touchStartLogicalPoint,
} from './support/user-input';
import { expectVisualMatch } from './visual-compare';

const activeControllers = new Set<ScenarioController<WebGLLabState>>();
const activeCRCs = new Set<CRCController>();

function installControlledFrames() {
  let nextId = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  const pending = new Set<number>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    const id = ++nextId;
    callbacks.set(id, callback);
    pending.add(id);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
    pending.delete(id);
  });
  return {
    runNext(timestamp: number): void {
      const id = pending.values().next().value;
      if (id === undefined) throw new Error('No animation frame is pending.');
      const callback = callbacks.get(id);
      if (!callback) throw new Error(`Unknown animation frame ${id}.`);
      pending.delete(id);
      callback(timestamp);
    },
  };
}

function pixelSignature(canvas: HTMLCanvasElement): number {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The WebGL laboratory Canvas has no 2D context.');
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let hash = 2166136261;
  for (const value of pixels) {
    hash ^= value;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pixelAt(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
): readonly number[] {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The WebGL laboratory Canvas has no 2D context.');
  return [...context.getImageData(x, y, 1, 1).data];
}

function expectPixelClose(
  actual: readonly number[],
  expected: readonly [number, number, number, number],
): void {
  expect(actual).toHaveLength(4);
  for (let channel = 0; channel < expected.length; channel += 1) {
    expect(Math.abs(actual[channel]! - expected[channel]!)).toBeLessThanOrEqual(
      2,
    );
  }
}

afterEach(async () => {
  for (const controller of activeControllers) await controller.dispose();
  activeControllers.clear();
  for (const controller of activeCRCs) controller.dispose();
  activeCRCs.clear();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

async function mountWebGLLab() {
  const canvas = document.createElement('canvas');
  canvas.width = webglLabScenarioEntry.canvas.width;
  canvas.height = webglLabScenarioEntry.canvas.height;
  canvas.style.cssText = `display:block;width:${canvas.width}px;height:${canvas.height}px`;
  document.body.replaceChildren(canvas);
  const definition = await loadScenario(webglLabScenarioEntry);
  const controller = await definition.mount({ canvas });
  activeControllers.add(controller);
  await controller.settled();
  return { canvas, controller, definition };
}

describe('public WebGL island scenarios', () => {
  it('registers exact learning and laboratory routes, actions, and state fields', async () => {
    const learningEntry = getLearningExampleBySlug('webgl-islands');
    expect(learningEntry).toMatchObject({
      slug: 'webgl-islands',
      section: 'composition',
      api: [
        'WebGLLayer',
        'Group3D',
        'Cube',
        'Sphere',
        'crcAnimationFrame',
      ],
      source: {
        path: 'packages/scenarios/src/learning/composition/webgl-islands.example.tsx',
      },
    });
    expect(learningEntry && getLearningExampleRoute(learningEntry)).toBe(
      '#/examples/composition/webgl-islands',
    );

    expect(scenarioCatalog).toContain(webglLabScenarioEntry);
    expect(getScenarioRoute(webglLabScenarioEntry)).toBe(
      '#/testing/webgl-islands',
    );
    expect(webglLabScenarioEntry).toMatchObject({
      metadata: {
        id: 'webgl-islands',
        slug: 'webgl-islands',
        summary:
          'Prove settled transparency, Canvas/WebGL composition, depth picking, transforms, clips, layers, filters, focus, and animation.',
        apiTags: ['WebGLLayer', 'Group3D', 'Mesh', 'Cube', 'Sphere'],
        conceptTags: [
          'settled transparency',
          'depth picking',
          'declarative scene composition',
          'Canvas paint order',
        ],
      },
      canvas: { width: 480, height: 300 },
      source: {
        id: 'webgl-islands-laboratory-example',
        marker:
          "WEBGL_LAB_SOURCE_ID = 'webgl-islands-laboratory-example'",
        path: 'packages/scenarios/src/webgl-lab.example.tsx',
      },
    });
    expect(webglLabScenarioEntry.actions.map((action) => action.id)).toEqual(
      WEBGL_LAB_ACTION_IDS,
    );
    expect(WEBGL_LAB_ACTION_IDS).toEqual([
      'show-mixed-order',
      'show-depth',
      'show-transparency',
      'show-transforms',
      'show-clipped',
      'show-layered',
      'show-filtered',
      'show-focus',
      'show-animation',
      'change-camera',
      'rotate-scene',
      'toggle-pointer-events',
      'swap-source-order',
      'advance-animation',
    ]);

    const definition = await loadScenario(webglLabScenarioEntry);
    expect(definition.actionIds).toEqual(WEBGL_LAB_ACTION_IDS);
    expect(definition.formatState({
      mode: 'mixed-order',
      revision: 3,
      lastTarget: 'cube',
      cubeSelections: 4,
      sphereSelections: 5,
      animationAngle: 30,
      focusTarget: 'sphere',
      transparencyOrder: 'near-first source → far-to-near blend',
    })).toEqual([
      { label: 'Mode', value: 'mixed-order' },
      { label: 'Revision', value: '3' },
      { label: 'Last target', value: 'cube' },
      { label: 'Cube selections', value: '4' },
      { label: 'Sphere selections', value: '5' },
      { label: 'Animation angle', value: '30°' },
      { label: 'Focus target', value: 'sphere' },
      {
        label: 'Transparency order',
        value: 'near-first source → far-to-near blend',
      },
    ]);
  });

  it('uses one core JSX runtime and direct public imports in both source files', () => {
    for (const source of [learningWebGLSource, webglLabSource]) {
      expect(source.match(/@jsxImportSource @crc\/core/gu)).toHaveLength(1);
      expect(source).toMatch(/from ['"]@crc\/core['"]/u);
      expect(source).toMatch(/from ['"]@crc\/webgl['"]/u);
      expect(source).not.toMatch(/@crc\/core\/(?:internal|src|lib)(?:\/|['"])/u);
      expect(source).not.toMatch(/@crc\/webgl\/(?:src|lib)(?:\/|['"])/u);
    }
  });

  it('labels the public footer with the scenario revision', async () => {
    const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');

    const { controller } = await mountWebGLLab();
    expect(fillText.mock.calls.map(([text]) => text)).toContain(
      'cube 0 · sphere 0 · revision 0',
    );

    await controller.perform('show-filtered');
    expect(fillText.mock.calls.map(([text]) => text)).toContain(
      'cube 0 · sphere 0 · revision 1',
    );
  });

  it('passes through transparent pixels while preserving Canvas/WebGL source order', async () => {
    const { canvas, controller } = await mountWebGLLab();
    expect(controller.getState()).toEqual({
      mode: 'mixed-order',
      revision: 0,
      lastTarget: null,
      cubeSelections: 0,
      sphereSelections: 0,
      animationAngle: 0,
      focusTarget: 'none',
      transparencyOrder: 'near-first source → far-to-near blend',
    });

    await clickLogicalPoint(canvas, WEBGL_LAB_PROBES.lowerCanvas);
    expect(controller.getState().lastTarget).toBe('lower-canvas');
    await clickLogicalPoint(canvas, WEBGL_LAB_PROBES.transparentIsland);
    expect(controller.getState().lastTarget).toBe('lower-canvas');
    await clickLogicalPoint(canvas, WEBGL_LAB_PROBES.cube);
    expect(controller.getState()).toMatchObject({
      lastTarget: 'cube',
      cubeSelections: 1,
    });
    await clickLogicalPoint(canvas, WEBGL_LAB_PROBES.sphere);
    expect(controller.getState()).toMatchObject({
      lastTarget: 'sphere',
      sphereSelections: 1,
    });
    await clickLogicalPoint(canvas, WEBGL_LAB_PROBES.upperStar);
    expect(controller.getState().lastTarget).toBe('upper-star');

    await controller.perform('swap-source-order');
    await clickLogicalPoint(canvas, WEBGL_LAB_PROBES.upperStar);
    expect(controller.getState()).toMatchObject({
      mode: 'mixed-order',
      revision: 1,
      lastTarget: 'cube',
      cubeSelections: 2,
    });

    await controller.perform('toggle-pointer-events');
    await clickLogicalPoint(canvas, WEBGL_LAB_PROBES.cube);
    expect(controller.getState().lastTarget).toBe('lower-canvas');
  });

  it('settles near-first transparent source into a far-to-near blend', async () => {
    const { canvas, controller } = await mountWebGLLab();

    await controller.perform('show-transparency');
    expect(controller.getState()).toMatchObject({
      mode: 'transparency',
      revision: 1,
      transparencyOrder: 'near-first source → far-to-near blend',
    });

    expectPixelClose(
      pixelAt(
        canvas,
        WEBGL_LAB_PROBES.transparencyFarOnly.x,
        WEBGL_LAB_PROBES.transparencyFarOnly.y,
      ),
      [127, 216, 174, 255],
    );
    expectPixelClose(
      pixelAt(
        canvas,
        WEBGL_LAB_PROBES.transparencyOverlap.x,
        WEBGL_LAB_PROBES.transparencyOverlap.y,
      ),
      [183, 142, 121, 255],
    );
    expectPixelClose(
      pixelAt(
        canvas,
        WEBGL_LAB_PROBES.transparencyNearOnly.x,
        WEBGL_LAB_PROBES.transparencyNearOnly.y,
      ),
      [229, 151, 161, 255],
    );

    // Immediate near-first drawing with depth writes would omit the far mesh.
    expect(pixelAt(
      canvas,
      WEBGL_LAB_PROBES.transparencyOverlap.x,
      WEBGL_LAB_PROBES.transparencyOverlap.y,
    )).not.toEqual([229, 151, 161, 255]);
  });

  it('keeps depth, transforms, clips, Layer bridges, and filter overflow geometric', async () => {
    const { canvas, controller } = await mountWebGLLab();

    await controller.perform('show-depth');
    await clickLogicalPoint(canvas, WEBGL_LAB_PROBES.overlappingSphere);
    expect(controller.getState()).toMatchObject({
      mode: 'depth',
      lastTarget: 'sphere',
      sphereSelections: 1,
    });

    await controller.perform('show-transforms');
    await clickLogicalPoint(canvas, WEBGL_LAB_PROBES.transformedCube);
    expect(controller.getState()).toMatchObject({
      mode: 'transforms',
      lastTarget: 'cube',
      cubeSelections: 1,
    });

    await controller.perform('show-clipped');
    await clickLogicalPoint(canvas, WEBGL_LAB_PROBES.clippedVisible);
    expect(controller.getState().lastTarget).toBe('cube');
    await clickLogicalPoint(canvas, WEBGL_LAB_PROBES.clippedAway);
    expect(controller.getState().lastTarget).toBe('lower-canvas');

    await controller.perform('show-layered');
    await clickLogicalPoint(canvas, WEBGL_LAB_PROBES.layeredCube);
    expect(controller.getState().lastTarget).toBe('cube');

    await controller.perform('show-filtered');
    await clickLogicalPoint(canvas, WEBGL_LAB_PROBES.filteredSource);
    expect(controller.getState().lastTarget).toBe('cube');
    await clickLogicalPoint(canvas, WEBGL_LAB_PROBES.filteredShadowOnly);
    expect(controller.getState().lastTarget).toBe('lower-canvas');
  });

  it('routes real pointer, touch, keyboard, and focus input to WebGL targets', async () => {
    const { canvas, controller } = await mountWebGLLab();
    const before = document.createElement('button');
    canvas.before(before);

    await penDownLogicalPoint(canvas, WEBGL_LAB_PROBES.cube);
    expect(controller.getState()).toMatchObject({
      lastTarget: 'cube',
      cubeSelections: 0,
    });
    await penUpLogicalPoint(canvas, WEBGL_LAB_PROBES.cube);
    expect(controller.getState().cubeSelections).toBe(1);

    await touchStartLogicalPoint(canvas, WEBGL_LAB_PROBES.sphere);
    expect(controller.getState()).toMatchObject({
      lastTarget: 'sphere',
      sphereSelections: 0,
    });
    await touchEndLogicalPoint(canvas);

    await controller.perform('show-focus');
    before.focus();
    await tab();
    expect(document.activeElement).toBe(canvas);
    expect(controller.getState().focusTarget).toBe('cube');
    const selections = controller.getState().cubeSelections;
    await pressKey('Enter');
    expect(controller.getState()).toMatchObject({
      lastTarget: 'cube',
      cubeSelections: selections + 1,
      focusTarget: 'cube',
    });
  });

  it('changes camera, rotation, and animation angle deterministically', async () => {
    const { canvas, controller } = await mountWebGLLab();
    await clickLogicalPoint(canvas, WEBGL_LAB_PROBES.cameraOuterCube);
    expect(controller.getState()).toMatchObject({
      lastTarget: 'cube',
      cubeSelections: 1,
    });
    const defaultCameraPixels = pixelSignature(canvas);

    await controller.perform('change-camera');
    expect(controller.getState()).toMatchObject({
      mode: 'mixed-order',
      revision: 1,
    });
    expect(pixelSignature(canvas)).not.toBe(defaultCameraPixels);
    await clickLogicalPoint(canvas, WEBGL_LAB_PROBES.cameraOuterCube);
    expect(controller.getState().lastTarget).toBe('lower-canvas');

    await controller.perform('show-transforms');
    const initialTransformPixels = pixelSignature(canvas);
    await controller.perform('rotate-scene');
    expect(controller.getState()).toMatchObject({
      mode: 'transforms',
      revision: 3,
    });
    expect(pixelSignature(canvas)).not.toBe(initialTransformPixels);

    await controller.perform('show-animation');
    const initialAnimationPixels = pixelSignature(canvas);
    await controller.perform('advance-animation');
    expect(controller.getState()).toMatchObject({
      mode: 'animation',
      revision: 5,
      animationAngle: 30,
    });
    expect(pixelSignature(canvas)).not.toBe(initialAnimationPixels);

  });

  it('uses one animation timestamp for the committed pixels and pick transform', async () => {
    const frames = installControlledFrames();
    const timestamps: number[] = [];
    let lastTarget: 'background' | 'cube' | null = null;
    function AnimatedCube(_props: {}) {
      const timestamp = crcAnimationFrame();
      timestamps.push(timestamp);
      return createElement(Group3D, {
        style: { rotationYDegrees: timestamp / 10 },
        children: createElement(Cube, {
          style: {
            size: 1,
            translateX: 1.2,
            color: '#8b5cf6',
            lit: false,
          },
          onClick: () => {
            lastTarget = 'cube';
          },
        }),
      });
    }
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    canvas.style.cssText = 'display:block;width:200px;height:200px';
    document.body.replaceChildren(canvas);
    const scene = createElement(
      Fragment,
      null,
      createElement(Rectangle, {
        style: { width: 200, height: 200, fill: '#dbeafe' },
        onClick: () => {
          lastTarget = 'background';
        },
      }),
      createElement(WebGLLayer, {
        style: { width: 200, height: 200 },
        children: createElement(AnimatedCube, {}),
      }),
    );
    const controller = crc(canvas, scene, { pixelRatio: 1 });
    activeCRCs.add(controller);

    frames.runNext(0);
    const initialPixels = pixelSignature(canvas);
    await clickLogicalPoint(canvas, { x: 150, y: 100 });
    expect(lastTarget).toBe('cube');

    lastTarget = null;
    frames.runNext(900);
    expect(timestamps).toEqual([0, 900]);
    expect(pixelSignature(canvas)).not.toBe(initialPixels);
    await clickLogicalPoint(canvas, { x: 150, y: 100 });
    expect(lastTarget).toBe('background');
    await clickLogicalPoint(canvas, { x: 100, y: 100 });
    expect(lastTarget).toBe('cube');
  });

  it('matches the reviewed Canvas/WebGL composition baseline', async () => {
    const { canvas, controller } = await mountWebGLLab();
    await controller.perform('show-filtered');
    await controller.settled();

    const background = pixelAt(canvas, 400, 150);
    expect(pixelAt(canvas, 359, 150)).not.toEqual(background);
    expect(pixelAt(canvas, 360, 150)).toEqual(background);

    await expectVisualMatch({
      element: canvas,
      expectedPath:
        'packages/core/test/visual-baselines/webgl-islands.expected.png',
      expectedArtifactPath:
        'test-screenshots/webgl-islands/webgl-islands.expected.png',
      actualPath:
        '../../../test-screenshots/webgl-islands/webgl-islands.actual.png',
      diffPath: 'test-screenshots/webgl-islands/webgl-islands.diff.png',
    });
  });
});
