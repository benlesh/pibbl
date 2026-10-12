import type {
  AnyScenarioCatalogEntry,
  DrawingCompositionState,
  DrawingImagesState,
  DrawingLinesState,
  DrawingShapesState,
  DrawingTextState,
  ScenarioController,
  ScenarioDefinition,
} from '@pibbl/scenarios';
import {
  drawingCompositionScenarioEntry,
  drawingImagesScenarioEntry,
  drawingLinesScenarioEntry,
  drawingShapesScenarioEntry,
  drawingTextScenarioEntry,
  loadScenario,
  scenarioCatalog,
  validateScenarioCatalog,
} from '@pibbl/scenarios';
import { page, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import drawingCompositionSource from '../../scenarios/src/drawing-composition.example.tsx?raw';
import drawingImagesSource from '../../scenarios/src/drawing-images.example.tsx?raw';
import drawingLinesSource from '../../scenarios/src/drawing-lines.example.tsx?raw';
import drawingShapesSource from '../../scenarios/src/drawing-shapes.example.tsx?raw';
import drawingTextSource from '../../scenarios/src/drawing-text.example.tsx?raw';
import { loadScenarioSource } from '../../../playground/src/scenario-sources';
import { expectVisualMatch } from './visual-compare';

const activeControllers = new Set<ScenarioController<unknown>>();

const drawingEntries = [
  drawingShapesScenarioEntry,
  drawingLinesScenarioEntry,
  drawingTextScenarioEntry,
  drawingImagesScenarioEntry,
  drawingCompositionScenarioEntry,
] as const;

const drawingSources = [
  drawingShapesSource,
  drawingLinesSource,
  drawingTextSource,
  drawingImagesSource,
  drawingCompositionSource,
] as const;

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): readonly number[] {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The drawing lesson Canvas has no 2D context.');
  }
  return Array.from(context.getImageData(x, y, 1, 1).data);
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function waitForPixel(
  canvas: HTMLCanvasElement,
  point: { x: number; y: number },
  expected: readonly number[],
): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (pixelAt(canvas, point.x, point.y).every(
      (value, index) => value === expected[index],
    )) {
      return;
    }
    await nextFrame();
  }
  expect(pixelAt(canvas, point.x, point.y)).toEqual(expected);
}

async function mountLesson<TState>(
  entry: AnyScenarioCatalogEntry,
  beforeMount?: (canvas: HTMLCanvasElement) => void,
): Promise<{
  canvas: HTMLCanvasElement;
  controller: ScenarioController<TState>;
  definition: ScenarioDefinition<TState>;
}> {
  const canvas = document.createElement('canvas');
  canvas.width = entry.canvas.width;
  canvas.height = entry.canvas.height;
  canvas.style.cssText = 'display:block; width:480px; height:240px';
  document.body.replaceChildren(canvas);
  const definition = await loadScenario(entry) as ScenarioDefinition<TState>;
  beforeMount?.(canvas);
  const controller = await definition.mount({ canvas });
  activeControllers.add(controller as ScenarioController<unknown>);
  return { canvas, controller, definition };
}

afterEach(async () => {
  for (const controller of activeControllers) {
    await controller.dispose();
  }
  activeControllers.clear();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('complete public drawing gallery', () => {
  it('orders and loads every documentation-candidate lesson with its exact displayed source', async () => {
    expect(validateScenarioCatalog(scenarioCatalog)).toBe(scenarioCatalog);
    expect(drawingEntries.map(entry => entry.metadata.learningOrder)).toEqual([
      20,
      30,
      40,
      50,
      60,
    ]);

    for (let index = 0; index < drawingEntries.length; index++) {
      const entry = drawingEntries[index];
      const source = drawingSources[index];
      expect(entry.metadata.visibility).toBe('documentation-candidate');
      expect(source).toContain(entry.source.marker);
      await expect(loadScenarioSource(entry)).resolves.toBe(source);
      const definition = await loadScenario(entry as AnyScenarioCatalogEntry);
      expect(definition.id).toBe(entry.metadata.id);
      expect(definition.actionIds).toEqual(entry.actions.map(action => action.id));
    }

    expect(drawingEntries.flatMap(entry => entry.metadata.apiTags)).toEqual([
      'Rectangle',
      'Path',
      'SvgPath',
      'Circle',
      'Ellipse',
      'Arc',
      'Wedge',
      'Polygon',
      'RegularPolygon',
      'Star',
      'Clip',
      'createRegularPolygonPath',
      'Line',
      'HorizontalLine',
      'VerticalLine',
      'Text',
      'Image',
      'Group',
      'Clip',
      'Layer',
    ]);
  });

  it('drives every public shape update with exact interior, exterior, and stroke pixels', async () => {
    const shapes = await mountLesson<DrawingShapesState>(drawingShapesScenarioEntry);
    expect(shapes.controller.getState()).toEqual({
      clippedHits: 0,
      clippedMisses: 0,
      lastAction: 'mount',
      roundedCutMisses: 0,
      revision: 0,
      starHits: 0,
      updated: false,
    });
    expect(pixelAt(shapes.canvas, 10, 10)).toEqual([248, 250, 252, 255]);
    expect(pixelAt(shapes.canvas, 50, 50)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(shapes.canvas, 242, 60)).toEqual([245, 158, 11, 255]);
    expect(pixelAt(shapes.canvas, 396, 60)).toEqual([16, 185, 129, 255]);
    expect(pixelAt(shapes.canvas, 320, 60)).toEqual([99, 102, 241, 255]);
    expect(pixelAt(shapes.canvas, 23, 145)).toEqual([239, 68, 68, 255]);
    expect(pixelAt(shapes.canvas, 170, 180)).toEqual([247, 201, 72, 255]);
    expect(pixelAt(shapes.canvas, 270, 180)).toEqual([244, 63, 94, 255]);
    expect(pixelAt(shapes.canvas, 390, 180)).toEqual([20, 184, 166, 255]);
    expect(pixelAt(shapes.canvas, 350, 140)).toEqual([248, 250, 252, 255]);
    expect(pixelAt(shapes.canvas, 30, 124)).toEqual([14, 165, 233, 255]);
    expect(pixelAt(shapes.canvas, 78, 124)).toEqual([249, 115, 22, 255]);
    expect(pixelAt(shapes.canvas, 125, 136)).toEqual([20, 184, 166, 255]);
    expect(pixelAt(shapes.canvas, 175, 129)).toEqual([168, 85, 247, 255]);
    expect(pixelAt(shapes.canvas, 220, 125)).toEqual([244, 63, 94, 255]);
    expect(pixelAt(shapes.canvas, 200, 124)).toEqual([248, 250, 252, 255]);

    await userEvent.click(shapes.canvas, { position: { x: 270, y: 180 } });
    await shapes.controller.settled();
    expect(shapes.controller.getState()).toMatchObject({ starHits: 1 });
    await userEvent.click(shapes.canvas, { position: { x: 23, y: 145 } });
    await shapes.controller.settled();
    expect(shapes.controller.getState()).toMatchObject({ roundedCutMisses: 1 });
    await userEvent.click(shapes.canvas, { position: { x: 350, y: 140 } });
    await shapes.controller.settled();
    expect(shapes.controller.getState()).toMatchObject({ clippedMisses: 1 });
    await userEvent.click(shapes.canvas, { position: { x: 390, y: 180 } });
    await shapes.controller.settled();
    expect(shapes.controller.getState()).toMatchObject({ clippedHits: 1 });

    await shapes.controller.perform('update-shapes');
    expect(shapes.controller.getState()).toEqual({
      clippedHits: 1,
      clippedMisses: 1,
      lastAction: 'update-shapes',
      roundedCutMisses: 1,
      revision: 5,
      starHits: 1,
      updated: true,
    });
    expect(pixelAt(shapes.canvas, 50, 50)).toEqual([124, 58, 237, 255]);
    expect(pixelAt(shapes.canvas, 242, 60)).toEqual([236, 72, 153, 255]);
    expect(pixelAt(shapes.canvas, 396, 60)).toEqual([20, 184, 166, 255]);
    expect(pixelAt(shapes.canvas, 30, 124)).toEqual([139, 92, 246, 255]);
    expect(pixelAt(shapes.canvas, 78, 124)).toEqual([236, 72, 153, 255]);
    expect(pixelAt(shapes.canvas, 125, 136)).toEqual([250, 204, 21, 255]);
    expect(pixelAt(shapes.canvas, 175, 129)).toEqual([34, 197, 94, 255]);
    expect(pixelAt(shapes.canvas, 220, 125)).toEqual([59, 130, 246, 255]);
    expect(pixelAt(shapes.canvas, 320, 60)).toEqual([139, 92, 246, 255]);
    expect(pixelAt(shapes.canvas, 270, 180)).toEqual([236, 72, 153, 255]);
    expect(pixelAt(shapes.canvas, 390, 180)).toEqual([34, 197, 94, 255]);
    await shapes.controller.reset();
    expect(shapes.controller.getState()).toEqual({
      clippedHits: 0,
      clippedMisses: 0,
      lastAction: 'reset',
      roundedCutMisses: 0,
      revision: 0,
      starHits: 0,
      updated: false,
    });
    await shapes.controller.dispose();
    activeControllers.delete(shapes.controller as ScenarioController<unknown>);

    const lines = await mountLesson<DrawingLinesState>(drawingLinesScenarioEntry);
    expect(lines.controller.getState()).toEqual({
      lastAction: 'mount',
      revision: 0,
      updated: false,
    });
    expect(pixelAt(lines.canvas, 92, 34)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(lines.canvas, 50, 141)).toEqual([245, 158, 11, 255]);
    expect(pixelAt(lines.canvas, 311, 180)).toEqual([16, 185, 129, 255]);
    expect(pixelAt(lines.canvas, 470, 220)).toEqual([248, 250, 252, 255]);

    await lines.controller.perform('update-lines');
    expect(lines.controller.getState()).toEqual({
      lastAction: 'update-lines',
      revision: 1,
      updated: true,
    });
    expect(pixelAt(lines.canvas, 92, 28)).toEqual([124, 58, 237, 255]);
    expect(pixelAt(lines.canvas, 50, 151)).toEqual([245, 158, 11, 255]);
    expect(pixelAt(lines.canvas, 331, 180)).toEqual([16, 185, 129, 255]);
  });

  it('drives text layout, centered interaction, alpha, update, and reset contracts', async () => {
    await page.viewport(800, 600);
    const { canvas, controller, definition } =
      await mountLesson<DrawingTextState>(drawingTextScenarioEntry);
    expect(controller.getState()).toEqual({
      centeredClicks: 0,
      lastAction: 'mount',
      revision: 0,
      updated: false,
    });
    expect(definition.formatState(controller.getState())).toContainEqual({
      label: 'Centered clicks',
      value: '0',
    });
    expect(pixelAt(canvas, 24, 68)).toEqual([226, 232, 240, 255]);
    expect(pixelAt(canvas, 244, 68)).toEqual([226, 232, 240, 255]);
    expect(pixelAt(canvas, 24, 126)).toEqual([219, 234, 254, 255]);
    expect(pixelAt(canvas, 254, 126)).toEqual([254, 243, 199, 255]);
    expect(pixelAt(canvas, 300, 202)).toEqual([239, 68, 68, 255]);

    // This point is visibly inside the left half of centered/middle text.
    await userEvent.click(canvas, { position: { x: 350, y: 24 } });
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      centeredClicks: 1,
      lastAction: 'click-centered',
      revision: 1,
    });

    await controller.perform('update-copy');
    expect(controller.getState()).toEqual({
      centeredClicks: 1,
      lastAction: 'update-copy',
      revision: 2,
      updated: true,
    });
    expect(pixelAt(canvas, 300, 202)).toEqual([239, 68, 68, 255]);
    await controller.reset();
    expect(controller.getState()).toEqual({
      centeredClicks: 0,
      lastAction: 'reset',
      revision: 0,
      updated: false,
    });
  });

  it('verifies masked text content, placement and visible ink through updates and reset', async () => {
    type Draw = { text: string; x: number; y: number; alpha: number; font: string; maxWidth?: number };
    const draws: Draw[] = [];
    const { canvas, controller } = await mountLesson<DrawingTextState>(drawingTextScenarioEntry, canvas => {
      const context = canvas.getContext('2d')!;
      const fillText = context.fillText.bind(context);
      vi.spyOn(context, 'fillText').mockImplementation((text, x, y, maxWidth) => {
        const point = context.getTransform().transformPoint({ x, y });
        draws.push({ text, x: point.x, y: point.y, alpha: context.globalAlpha, font: context.font, maxWidth });
        // Mutation probe: command intent still exists, but no glyph reaches the bitmap.
        if (import.meta.env.VITE_PIBBL_DRAWING_VISUAL_DRILL !== 'omit-text-ink') fillText(text, x, y, maxWidth);
      });
    });
    function verify(updated: boolean) {
      const at = (x: number, y: number) => {
        const matches = draws.filter(draw => draw.x === x && draw.y === y);
        expect(matches).toHaveLength(1);
        return matches[0];
      };
      expect(at(24, 18).text).toBe(updated ? 'Updated canvas text' : 'Canvas text');
      expect(at(374, 24).text).toBe('centered');
      const ellipsis = at(32, 76);
      const source = updated ? 'A newly updated sentence' : 'A sentence that is too long';
      expect(ellipsis.text.endsWith('...')).toBe(true);
      const prefix = ellipsis.text.slice(0, -3);
      expect(prefix.length).toBeGreaterThan(0);
      expect(source.startsWith(prefix)).toBe(true);
      const measuring = document.createElement('canvas').getContext('2d')!;
      measuring.font = ellipsis.font;
      expect(measuring.measureText(ellipsis.text).width).toBeLessThanOrEqual(154);
      expect(measuring.measureText(source.slice(0, prefix.length + 1) + '...').width).toBeGreaterThan(154);
      expect(at(252, 76)).toMatchObject({ text: 'This line is fitted to its card', maxWidth: 196 });
      const wrapped = draws.filter(draw => draw.x === 34);
      expect(wrapped.length).toBeGreaterThan(1);
      expect(wrapped.map(draw => draw.text).join(' ')).toBe(updated
        ? 'Updated words wrap across this bounded card'
        : 'Several words wrap across this bounded card');
      expect(wrapped.map(draw => draw.y)).toEqual(wrapped.map((_, index) => 136 + index * 21));
      expect(at(264, 136).text).toBe('Clipped text stays inside this golden card');
      expect(at(264, 193)).toMatchObject({ text: 'invisible at alpha zero', alpha: 0 });
      expect(draws).toHaveLength(6 + wrapped.length);
      // Pixel evidence supplements command intent. Each region must contain visible
      // glyph ink, without pinning platform-specific antialiased glyph boundaries.
      for (const [x, y, width, height, background] of [
        [20, 10, 260, 44, [248, 250, 252]], [330, 4, 96, 46, [248, 250, 252]],
        [28, 72, 164, 28, [226, 232, 240]], [248, 72, 204, 28, [226, 232, 240]],
        [30, 132, 194, 68, [219, 234, 254]], [260, 132, 192, 36, [254, 243, 199]],
      ] as const) {
        const pixels = canvas.getContext('2d')!.getImageData(x, y, width, height).data;
        let ink = 0;
        for (let offset = 0; offset < pixels.length; offset += 4) {
          if (background.some((channel, index) => Math.abs(pixels[offset + index] - channel) > 16)) ink++;
        }
        expect(ink, `visible glyph ink in region ${x},${y}`).toBeGreaterThan(20);
      }
    }
    try {
      verify(false);
      draws.length = 0;
      await controller.perform('update-copy');
      verify(true);
      draws.length = 0;
      await controller.reset();
      verify(false);
    } finally { vi.restoreAllMocks(); }
  });

  it('drives explicit/natural image sizing, alpha, source change, failure, removal, and recovery', async () => {
    const { canvas, controller } =
      await mountLesson<DrawingImagesState>(drawingImagesScenarioEntry);
    await waitForPixel(canvas, { x: 30, y: 40 }, [14, 165, 233, 255]);
    await waitForPixel(canvas, { x: 230, y: 40 }, [236, 72, 153, 255]);
    await waitForPixel(canvas, { x: 420, y: 185 }, [115, 199, 243, 255]);
    expect(controller.getState()).toEqual({
      lastAction: 'mount',
      mode: 'primary',
      revision: 0,
      sizing: 'explicit',
    });
    expect(pixelAt(canvas, 370, 40)).toEqual([239, 68, 68, 255]);

    await controller.perform('change-image');
    await waitForPixel(canvas, { x: 30, y: 40 }, [236, 72, 153, 255]);
    expect(controller.getState()).toMatchObject({
      lastAction: 'change-image',
      mode: 'secondary',
      revision: 1,
    });

    await controller.perform('use-natural-size');
    expect(controller.getState()).toMatchObject({ sizing: 'natural' });
    expect(pixelAt(canvas, 130, 110)).toEqual([226, 232, 240, 255]);
    await controller.perform('use-explicit-size');
    await waitForPixel(canvas, { x: 130, y: 110 }, [236, 72, 153, 255]);

    await controller.perform('show-broken-image');
    expect(controller.getState()).toMatchObject({ mode: 'broken' });
    expect(pixelAt(canvas, 30, 40)).toEqual([226, 232, 240, 255]);
    await controller.perform('remove-image');
    expect(controller.getState()).toMatchObject({ mode: 'hidden' });
    expect(pixelAt(canvas, 30, 40)).toEqual([226, 232, 240, 255]);
    await controller.perform('show-image');
    await waitForPixel(canvas, { x: 30, y: 40 }, [14, 165, 233, 255]);
    await controller.reset();
    await waitForPixel(canvas, { x: 30, y: 40 }, [14, 165, 233, 255]);
    expect(controller.getState()).toEqual({
      lastAction: 'reset',
      mode: 'primary',
      revision: 0,
      sizing: 'explicit',
    });
  });

  it('drives group, nonzero/evenodd clips, and layer updates with exact pixels', async () => {
    const { canvas, controller } =
      await mountLesson<DrawingCompositionState>(drawingCompositionScenarioEntry);
    expect(controller.getState()).toEqual({
      lastAction: 'mount',
      revision: 0,
      updated: false,
    });
    expect(pixelAt(canvas, 30, 40)).toEqual([191, 219, 254, 255]);
    expect(pixelAt(canvas, 55, 65)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(canvas, 190, 30)).toEqual([248, 250, 252, 255]);
    expect(pixelAt(canvas, 216, 60)).toEqual([254, 243, 199, 255]);
    expect(pixelAt(canvas, 243, 96)).toEqual([245, 158, 11, 255]);
    expect(pixelAt(canvas, 350, 42)).toEqual([219, 234, 254, 255]);
    expect(pixelAt(canvas, 400, 80)).toEqual([37, 99, 235, 255]);

    await controller.perform('update-composition');
    expect(controller.getState()).toEqual({
      lastAction: 'update-composition',
      revision: 1,
      updated: true,
    });
    expect(pixelAt(canvas, 350, 42)).toEqual([251, 207, 232, 255]);
    expect(pixelAt(canvas, 400, 80)).toEqual([236, 72, 153, 255]);
    await controller.reset();
    expect(pixelAt(canvas, 400, 80)).toEqual([37, 99, 235, 255]);
  });

  it('keeps approved native-pixel visuals for the documentation-candidate learning set', async () => {
    await page.viewport(800, 600);
    const visuals = drawingEntries.map(entry => ({
      entry,
      ignoreRegions: entry === drawingTextScenarioEntry ? [
        // Text glyph rasterization is platform-sensitive; cards stay exact.
        { x: 22, y: 14, width: 140, height: 30, reason: 'Text glyph rasterization is platform-sensitive; surrounding cards remain unmasked.' },
        { x: 334, y: 10, width: 80, height: 28, reason: 'Text glyph rasterization is platform-sensitive; surrounding cards remain unmasked.' },
        { x: 30, y: 72, width: 160, height: 24, reason: 'Text glyph rasterization is platform-sensitive; surrounding cards remain unmasked.' },
        { x: 250, y: 72, width: 200, height: 24, reason: 'Text glyph rasterization is platform-sensitive; surrounding cards remain unmasked.' },
        { x: 32, y: 132, width: 188, height: 42, reason: 'Text glyph rasterization is platform-sensitive; surrounding cards remain unmasked.' },
        { x: 262, y: 132, width: 186, height: 26, reason: 'Text glyph rasterization is platform-sensitive; surrounding cards remain unmasked.' },
      ] : entry === drawingImagesScenarioEntry ? [
        // Scaled SVG curves vary; filled centers are checked below and outside backgrounds stay exact.
        { x: 68, y: 51, width: 62, height: 62, reason: 'Scaled SVG curve rasterization varies by platform; filled centers are checked separately and exterior backgrounds remain unmasked.' },
        { x: 153, y: 176, width: 165, height: 20, reason: 'Scaled SVG curve rasterization varies by platform; filled centers are checked separately and exterior backgrounds remain unmasked.' },
      ] : [],
    }));

    for (const visual of visuals) {
      const { canvas, controller } = await mountLesson<unknown>(visual.entry);
      if (visual.entry === drawingImagesScenarioEntry) {
        await waitForPixel(canvas, { x: 30, y: 40 }, [14, 165, 233, 255]);
        await waitForPixel(canvas, { x: 230, y: 40 }, [236, 72, 153, 255]);
        await waitForPixel(canvas, { x: 420, y: 185 }, [115, 199, 243, 255]);
        expect(pixelAt(canvas, 99, 82)).toEqual([224, 242, 254, 255]);
        const translucentCenter = pixelAt(canvas, 235, 185);
        // Independent source-over oracle: SVG #e0f2fe at 0.5 over #dbeafe.
        // Allow one channel unit for premultiplied-alpha quantization.
        for (const [channel, expected] of [221.5, 238, 254].entries()) {
          expect(Math.abs(translucentCenter[channel] - expected)).toBeLessThanOrEqual(1);
        }
        expect(translucentCenter[3]).toBe(255);
      }
      if (
        import.meta.env.VITE_PIBBL_DRAWING_VISUAL_DRILL === '1' &&
        visual.entry === drawingShapesScenarioEntry
      ) {
        await controller.perform('update-shapes');
      }
      if (
        (import.meta.env.VITE_PIBBL_DRAWING_VISUAL_DRILL === 'text-mask-gap' && visual.entry === drawingTextScenarioEntry) ||
        (import.meta.env.VITE_PIBBL_DRAWING_VISUAL_DRILL === 'image-mask-background' && visual.entry === drawingImagesScenarioEntry)
      ) {
        const context = canvas.getContext('2d')!;
        context.fillStyle = '#ff0000';
        context.fillRect(visual.entry === drawingTextScenarioEntry ? 40 : 30,
          visual.entry === drawingTextScenarioEntry ? 180 : 50, 12, 6);
      }
      const slug = visual.entry.metadata.slug;
      await expectVisualMatch({
        element: canvas,
        expectedPath: `packages/core/test/visual-baselines/tfc-09-${slug}.expected.png`,
        expectedArtifactPath: `test-screenshots/tfc-09/${slug}.expected.png`,
        actualPath: `../../../test-screenshots/tfc-09/${slug}.actual.png`,
        diffPath: `test-screenshots/tfc-09/${slug}.diff.png`,
        ignoreRegions: visual.ignoreRegions,
      });
      await controller.dispose();
      activeControllers.delete(controller);
    }
  });
});
