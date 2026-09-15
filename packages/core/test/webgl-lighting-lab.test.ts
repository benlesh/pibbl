import type { ScenarioController } from '@crc/scenarios';
import * as scenarios from '@crc/scenarios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clickLogicalPoint,
  dragPointerLogicalPoint,
  wheelLogicalPoint,
} from './support/user-input';

const laboratorySources = import.meta.glob(
  '../../scenarios/src/webgl-lighting-lab.example.tsx',
  { eager: true, import: 'default', query: '?raw' },
);

type LightingLabState = {
  readonly lightMode: string;
  readonly backgroundMode: 'transparent' | 'opaque' | 'alpha';
  readonly shadowQuality: false | 'low' | 'medium' | 'high';
  readonly transformedLight: boolean;
  readonly casterAlpha: 'opaque' | 'partial' | 'zero';
  readonly lit: boolean;
  readonly emissive: boolean;
  readonly revision: number;
  readonly lastTarget: string | null;
  readonly focusTarget: string;
};

let activeController: ScenarioController<LightingLabState> | undefined;

function entry() {
  return (scenarios as Record<string, unknown>)[
    'webglLightingLabScenarioEntry'
  ] as any;
}

function actionIds(): readonly string[] {
  return (scenarios as Record<string, unknown>)[
    'WEBGL_LIGHTING_LAB_ACTION_IDS'
  ] as readonly string[];
}

function probes(): Record<string, { readonly x: number; readonly y: number }> {
  return (scenarios as Record<string, unknown>)[
    'WEBGL_LIGHTING_LAB_PROBES'
  ] as Record<string, { readonly x: number; readonly y: number }>;
}

function pixelSignature(canvas: HTMLCanvasElement): number {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The WebGL lighting lab has no 2D context.');
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let hash = 2166136261;
  for (const value of pixels) {
    hash ^= value;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function imageData(canvas: HTMLCanvasElement): Uint8ClampedArray {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The WebGL lighting lab has no 2D context.');
  return context.getImageData(0, 0, canvas.width, canvas.height).data;
}

function pixelAt(
  canvas: HTMLCanvasElement,
  point: { readonly x: number; readonly y: number },
): readonly number[] {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The WebGL lighting lab has no 2D context.');
  return [...context.getImageData(point.x, point.y, 1, 1).data];
}

function hasDarkenedNeutralPixel(
  shadowed: Uint8ClampedArray,
  unshadowed: Uint8ClampedArray,
): boolean {
  for (let offset = 0; offset < shadowed.length; offset += 4) {
    const noShadow = [
      unshadowed[offset]!,
      unshadowed[offset + 1]!,
      unshadowed[offset + 2]!,
    ];
    const withShadow = [
      shadowed[offset]!,
      shadowed[offset + 1]!,
      shadowed[offset + 2]!,
    ];
    if (
      unshadowed[offset + 3] === 255 &&
      shadowed[offset + 3] === 255 &&
      Math.max(...noShadow) - Math.min(...noShadow) <= 10 &&
      noShadow[0]! >= 70 &&
      withShadow.every((value, channel) => noShadow[channel]! - value >= 20)
    ) {
      return true;
    }
  }
  return false;
}

function pinkCasterCenter(
  pixels: Uint8ClampedArray,
  width: number,
): { readonly x: number; readonly y: number } {
  let minimumX = width;
  let minimumY = Number.POSITIVE_INFINITY;
  let maximumX = -1;
  let maximumY = -1;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const red = pixels[offset]!;
    const green = pixels[offset + 1]!;
    const blue = pixels[offset + 2]!;
    if (red > 90 && red > blue + 12 && blue > green + 12) {
      const index = offset / 4;
      const x = index % width;
      const y = Math.floor(index / width);
      minimumX = Math.min(minimumX, x);
      maximumX = Math.max(maximumX, x);
      minimumY = Math.min(minimumY, y);
      maximumY = Math.max(maximumY, y);
    }
  }
  if (maximumX < minimumX || maximumY < minimumY) {
    throw new Error('The visible pink caster could not be located.');
  }
  return {
    x: Math.round((minimumX + maximumX) / 2),
    y: Math.round((minimumY + maximumY) / 2),
  };
}

async function mountLab() {
  const scenarioEntry = entry();
  if (!scenarioEntry) throw new Error('The WebGL lighting lab is not registered.');
  const canvas = document.createElement('canvas');
  canvas.width = scenarioEntry.canvas.width;
  canvas.height = scenarioEntry.canvas.height;
  canvas.style.cssText = `display:block;width:${canvas.width}px;height:${canvas.height}px`;
  document.body.replaceChildren(canvas);
  const definition = await scenarios.loadScenario(scenarioEntry);
  activeController = await definition.mount({ canvas });
  await activeController.settled();
  return { canvas, controller: activeController, definition, scenarioEntry };
}

afterEach(async () => {
  await activeController?.dispose();
  activeController = undefined;
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('public WebGL lighting laboratory', () => {
  it('registers the exact route, source, actions, and public-only example', async () => {
    const scenarioEntry = entry();
    expect(scenarioEntry).toMatchObject({
      metadata: {
        id: 'webgl-lighting',
        slug: 'webgl-lighting',
        learningOrder: 175,
      },
      canvas: { width: 720, height: 420 },
      source: {
        id: 'webgl-lighting-laboratory-example',
        path: 'packages/scenarios/src/webgl-lighting-lab.example.tsx',
      },
    });
    expect(scenarios.getScenarioRoute(scenarioEntry)).toBe(
      '#/testing/webgl-lighting',
    );
    expect(scenarios.scenarioCatalog).toContain(scenarioEntry);
    expect(actionIds()).toEqual([
      'show-ambient',
      'show-hemisphere',
      'show-directional',
      'show-point',
      'show-spot',
      'show-all',
      'show-background-transparent',
      'show-background-opaque',
      'show-background-alpha',
      'shadows-off',
      'shadows-low',
      'shadows-medium',
      'shadows-high',
      'toggle-transformed-light',
      'caster-opaque',
      'caster-partial',
      'caster-zero',
      'toggle-lit',
      'toggle-emissive',
      'move-caster',
      'reset',
    ]);

    const source = laboratorySources[
      '../../scenarios/src/webgl-lighting-lab.example.tsx'
    ];
    expect(source).toBeTypeOf('string');
    expect(source).toMatch(/@jsxImportSource @crc\/core/u);
    expect(source).toMatch(/from '@crc\/core'/u);
    expect(source).toMatch(/from '@crc\/webgl'/u);
    expect(source).not.toMatch(/@crc\/(?:core|webgl)\/(?:internal|src|lib)/u);

    const definition = await scenarios.loadScenario(scenarioEntry);
    expect(definition.actionIds).toEqual(actionIds());
  });

  it('drives every light, shadow quality, transform, alpha, and material control', async () => {
    const { controller } = await mountLab();
    expect(controller.getState()).toMatchObject({
      lightMode: 'all',
      backgroundMode: 'alpha',
      shadowQuality: 'medium',
      transformedLight: false,
      casterAlpha: 'opaque',
      lit: true,
      emissive: true,
      revision: 0,
    });

    for (const [action, expected] of [
      ['show-ambient', { lightMode: 'ambient' }],
      ['show-hemisphere', { lightMode: 'hemisphere' }],
      ['show-directional', { lightMode: 'directional' }],
      ['show-point', { lightMode: 'point' }],
      ['show-spot', { lightMode: 'spot' }],
      ['show-all', { lightMode: 'all' }],
      ['show-background-transparent', { backgroundMode: 'transparent' }],
      ['show-background-opaque', { backgroundMode: 'opaque' }],
      ['show-background-alpha', { backgroundMode: 'alpha' }],
      ['shadows-off', { shadowQuality: false }],
      ['shadows-low', { shadowQuality: 'low' }],
      ['shadows-medium', { shadowQuality: 'medium' }],
      ['shadows-high', { shadowQuality: 'high' }],
      ['toggle-transformed-light', { transformedLight: true }],
      ['caster-partial', { casterAlpha: 'partial' }],
      ['caster-zero', { casterAlpha: 'zero' }],
      ['caster-opaque', { casterAlpha: 'opaque' }],
      ['toggle-lit', { lit: false }],
      ['toggle-emissive', { emissive: false }],
    ] as const) {
      await controller.perform(action);
      expect(controller.getState()).toMatchObject(expected);
    }
    expect(controller.getState().revision).toBe(19);
  });

  it('keeps ambient and hemisphere shadowless, renders six point faces, and reuses direct shadows while orbiting', async () => {
    const probeContext = new OffscreenCanvas(1, 1).getContext('webgl2');
    if (!probeContext) throw new Error('WebGL2 is required for the lighting lab.');
    const glPrototype = Object.getPrototypeOf(
      probeContext,
    ) as WebGL2RenderingContext;
    const attach = vi.spyOn(glPrototype, 'framebufferTexture2D');
    const { canvas, controller } = await mountLab();

    attach.mockClear();
    await controller.perform('show-ambient');
    await controller.perform('show-hemisphere');
    expect(attach).not.toHaveBeenCalled();

    await controller.perform('show-point');
    attach.mockClear();
    await controller.perform('move-caster');
    const expectedCubeFaces = [
      probeContext.TEXTURE_CUBE_MAP_POSITIVE_X,
      probeContext.TEXTURE_CUBE_MAP_NEGATIVE_X,
      probeContext.TEXTURE_CUBE_MAP_POSITIVE_Y,
      probeContext.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      probeContext.TEXTURE_CUBE_MAP_POSITIVE_Z,
      probeContext.TEXTURE_CUBE_MAP_NEGATIVE_Z,
    ] as const;
    const cubeFaces = new Set(expectedCubeFaces);
    expect(
      attach.mock.calls
        .filter((call) => cubeFaces.has(call[2]))
        .map((call) => call[2]),
    ).toEqual(expectedCubeFaces);

    attach.mockClear();
    const beforeOrbit = pixelSignature(canvas);
    await dragPointerLogicalPoint(
      canvas,
      probes().orbitStart,
      probes().orbitEnd,
    );
    await controller.settled();
    const afterDrag = pixelSignature(canvas);
    await wheelLogicalPoint(canvas, probes().orbitEnd, 180);
    await controller.settled();
    const afterWheel = pixelSignature(canvas);
    expect(afterDrag).not.toBe(beforeOrbit);
    expect(afterWheel).not.toBe(afterDrag);
    expect(
      attach.mock.calls.filter((call) => cubeFaces.has(call[2])),
    ).toHaveLength(0);
  });

  it('renders transparent-default, opaque, and alpha backgrounds without intercepting clicks', async () => {
    const { canvas, controller } = await mountLab();
    const backgroundProbe = probes().emptyBackground;
    const initialAlpha = pixelAt(canvas, backgroundProbe);

    await clickLogicalPoint(canvas, backgroundProbe);
    expect(controller.getState().lastTarget).toBe('backing');

    await controller.perform('show-background-transparent');
    const transparent = pixelAt(canvas, backgroundProbe);
    expect(transparent).toEqual([23, 48, 71, 255]);
    await clickLogicalPoint(canvas, backgroundProbe);
    expect(controller.getState().lastTarget).toBe('backing');

    await controller.perform('show-background-opaque');
    const opaque = pixelAt(canvas, backgroundProbe);
    expect(opaque).toEqual([7, 17, 31, 255]);
    await clickLogicalPoint(canvas, backgroundProbe);
    expect(controller.getState().lastTarget).toBe('backing');

    await controller.perform('show-background-alpha');
    const alpha = pixelAt(canvas, backgroundProbe);
    expect(alpha).toEqual(initialAlpha);
    expect(alpha[3]).toBe(255);
    for (let channel = 0; channel < 3; channel += 1) {
      expect(alpha[channel]).toBeGreaterThan(opaque[channel]!);
      expect(alpha[channel]).toBeLessThan(transparent[channel]!);
    }
    await clickLogicalPoint(canvas, backgroundProbe);
    expect(controller.getState().lastTarget).toBe('backing');
  });

  it('shows genuine direct-light contrast while keeping zero-alpha focus geometry and releasing owned resources', async () => {
    const probeContext = new OffscreenCanvas(1, 1).getContext('webgl2');
    if (!probeContext) throw new Error('WebGL2 is required for the lighting lab.');
    const glPrototype = Object.getPrototypeOf(
      probeContext,
    ) as WebGL2RenderingContext;
    const deleteFramebuffer = vi.spyOn(glPrototype, 'deleteFramebuffer');
    const deleteTexture = vi.spyOn(glPrototype, 'deleteTexture');
    const removeListener = vi.spyOn(
      OffscreenCanvas.prototype,
      'removeEventListener',
    );
    const { canvas, controller } = await mountLab();

    await clickLogicalPoint(canvas, probes().emptyBackground);
    expect(controller.getState().lastTarget).toBe('backing');

    await controller.perform('show-directional');
    const shadowed = imageData(canvas);
    await controller.perform('shadows-off');
    const unshadowed = imageData(canvas);
    expect(hasDarkenedNeutralPixel(shadowed, unshadowed)).toBe(true);
    const casterPoint = pinkCasterCenter(unshadowed, canvas.width);

    await controller.perform('caster-zero');
    await clickLogicalPoint(canvas, casterPoint);
    expect(controller.getState().focusTarget).toBe('caster');
    expect(controller.getState().lastTarget).toBe('caster');

    await controller.dispose();
    activeController = undefined;
    expect(deleteFramebuffer.mock.calls.length).toBeGreaterThan(0);
    expect(deleteTexture.mock.calls.length).toBeGreaterThan(0);
    expect(removeListener.mock.calls.map(([type]) => type)).toEqual([
      'webglcontextlost',
      'webglcontextrestored',
    ]);
  });
});
