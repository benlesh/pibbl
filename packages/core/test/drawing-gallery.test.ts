import type {
  AnyScenarioCatalogEntry,
  DrawingCompositionState,
  DrawingImagesState,
  DrawingLinesState,
  DrawingShapesState,
  DrawingTextState,
  ScenarioController,
  ScenarioDefinition,
} from '@crc/scenarios';
import {
  drawingCompositionScenarioEntry,
  drawingImagesScenarioEntry,
  drawingLinesScenarioEntry,
  drawingShapesScenarioEntry,
  drawingTextScenarioEntry,
  loadScenario,
  scenarioCatalog,
  validateScenarioCatalog,
} from '@crc/scenarios';
import { page, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
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
  const controller = await definition.mount({ canvas });
  activeControllers.add(controller as ScenarioController<unknown>);
  return { canvas, controller, definition };
}

afterEach(async () => {
  for (const controller of activeControllers) {
    await controller.dispose();
  }
  activeControllers.clear();
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

  it('drives rect, path, svgPath, and line updates with exact boundary pixels', async () => {
    const shapes = await mountLesson<DrawingShapesState>(drawingShapesScenarioEntry);
    expect(shapes.controller.getState()).toEqual({
      lastAction: 'mount',
      revision: 0,
      updated: false,
    });
    expect(pixelAt(shapes.canvas, 10, 10)).toEqual([248, 250, 252, 255]);
    expect(pixelAt(shapes.canvas, 50, 50)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(shapes.canvas, 242, 60)).toEqual([245, 158, 11, 255]);
    expect(pixelAt(shapes.canvas, 396, 60)).toEqual([16, 185, 129, 255]);
    expect(pixelAt(shapes.canvas, 50, 170)).toEqual([239, 68, 68, 255]);
    expect(pixelAt(shapes.canvas, 150, 170)).toEqual([34, 197, 94, 255]);
    expect(pixelAt(shapes.canvas, 320, 170)).toEqual([226, 232, 240, 255]);
    expect(pixelAt(shapes.canvas, 420, 170)).toEqual([99, 102, 241, 255]);

    await shapes.controller.perform('update-shapes');
    expect(shapes.controller.getState()).toEqual({
      lastAction: 'update-shapes',
      revision: 1,
      updated: true,
    });
    expect(pixelAt(shapes.canvas, 50, 50)).toEqual([124, 58, 237, 255]);
    expect(pixelAt(shapes.canvas, 242, 60)).toEqual([236, 72, 153, 255]);
    expect(pixelAt(shapes.canvas, 396, 60)).toEqual([20, 184, 166, 255]);
    await shapes.controller.reset();
    expect(shapes.controller.getState()).toEqual({
      lastAction: 'reset',
      revision: 0,
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
        { x: 18, y: 10, width: 230, height: 44 },
        { x: 330, y: 4, width: 96, height: 46 },
        { x: 28, y: 68, width: 164, height: 34 },
        { x: 248, y: 68, width: 204, height: 34 },
        { x: 30, y: 126, width: 194, height: 76 },
        { x: 260, y: 126, width: 192, height: 42 },
      ] : entry === drawingImagesScenarioEntry ? [
        // Decoded/scaled SVG edges vary; their exact semantic pixels are asserted above.
        { x: 20, y: 28, width: 158, height: 108 },
        { x: 20, y: 168, width: 432, height: 36 },
      ] : [],
    }));

    for (const visual of visuals) {
      const { canvas, controller } = await mountLesson<unknown>(visual.entry);
      if (visual.entry === drawingImagesScenarioEntry) {
        await waitForPixel(canvas, { x: 30, y: 40 }, [14, 165, 233, 255]);
        await waitForPixel(canvas, { x: 230, y: 40 }, [236, 72, 153, 255]);
        await waitForPixel(canvas, { x: 420, y: 185 }, [115, 199, 243, 255]);
      }
      if (
        import.meta.env.VITE_CRC_DRAWING_VISUAL_DRILL === '1' &&
        visual.entry === drawingShapesScenarioEntry
      ) {
        await controller.perform('update-shapes');
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
