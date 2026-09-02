import type {
  ScenarioController,
  ScenarioDefinition,
  SmokeScenarioState,
} from '@crc/scenarios';
import {
  loadScenario,
  scenarioCatalog,
  smokeScenarioEntry,
  validateScenarioCatalog,
} from '@crc/scenarios';
import { page, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import smokeSource from '../../scenarios/src/smoke.example.tsx?raw';
import { moveMouse, pressMouse, releaseMouse } from './support/mouse-input';
import { expectVisualMatch } from './visual-compare';

interface SmokeTestHarness {
  canvas: HTMLCanvasElement;
  controller: ScenarioController<SmokeScenarioState>;
  visual: HTMLElement;
}

let activeController: ScenarioController<SmokeScenarioState> | undefined;
const packageMode = import.meta.env.MODE === 'built' ? 'built' : 'source';

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): readonly number[] {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The smoke test canvas has no 2D context.');
  }
  return Array.from(context.getImageData(x, y, 1, 1).data);
}

function appendState(
  stateList: HTMLDListElement,
  definition: ScenarioDefinition<SmokeScenarioState>,
  state: Readonly<SmokeScenarioState>,
): void {
  stateList.replaceChildren();
  const title = document.createElement('p');
  title.textContent = 'Live scenario state';
  stateList.appendChild(title);
  for (const field of definition.formatState(state)) {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    term.textContent = field.label;
    const detail = document.createElement('dd');
    detail.textContent = field.value;
    row.append(term, detail);
    stateList.appendChild(row);
  }
}

async function mountSmokeHarness(
  definition: ScenarioDefinition<SmokeScenarioState>,
): Promise<SmokeTestHarness> {
  await page.viewport(800, 600);
  const style = document.createElement('style');
  style.textContent = `
    html, body { margin: 0; }
    [data-testid="smoke-visual"] {
      background: #f8fafc;
      display: grid;
      grid-template-columns: 480px 240px;
      height: 240px;
      width: 720px;
    }
    canvas { display: block; height: 240px; width: 480px; }
    dl {
      background: #0f172a;
      color: #f8fafc;
      display: grid;
      grid-auto-rows: min-content;
      height: 240px;
      margin: 0;
      overflow: hidden;
      padding: 20px;
    }
    dl > p {
      color: #94a3b8;
      font: 700 11px/1.4 Arial, sans-serif;
      letter-spacing: 0.08em;
      margin: 0 0 12px;
      text-transform: uppercase;
    }
    dl > div {
      border-top: 1px solid #334155;
      display: grid;
      gap: 2px;
      padding: 8px 0;
    }
    dt { color: #94a3b8; font: 12px/1.4 Arial, sans-serif; }
    dd { font: 700 16px/1.4 Arial, sans-serif; margin: 0; }
  `;
  document.head.appendChild(style);
  const visual = document.createElement('div');
  visual.dataset.testid = 'smoke-visual';
  const canvas = document.createElement('canvas');
  canvas.width = smokeScenarioEntry.canvas.width;
  canvas.height = smokeScenarioEntry.canvas.height;
  const stateList = document.createElement('dl');
  visual.append(canvas, stateList);
  document.body.replaceChildren(visual);

  const controller = await definition.mount({
    canvas,
    onStateChange: state => appendState(stateList, definition, state),
  });
  activeController = controller;
  return { canvas, controller, visual };
}

afterEach(async () => {
  await activeController?.dispose();
  activeController = undefined;
  document.head.querySelectorAll('style').forEach(style => style.remove());
  document.body.replaceChildren();
});

describe('shared smoke scenario', () => {
  it('loads the catalog source and drives mount, update, click, reset, and disposal', async () => {
    expect(validateScenarioCatalog(scenarioCatalog)).toBe(scenarioCatalog);
    expect(smokeSource).toContain(`SMOKE_SOURCE_ID = '${smokeScenarioEntry.source.id}'`);
    expect(smokeScenarioEntry.source.path).toBe('packages/scenarios/src/smoke.example.tsx');

    const definition = await loadScenario(smokeScenarioEntry);
    const { canvas, controller } = await mountSmokeHarness(definition);

    expect(controller.getState()).toEqual({
      revision: 0,
      clicks: 0,
      lastAction: 'mount',
    });
    expect(pixelAt(canvas, 10, 10)).toEqual([248, 250, 252, 255]);
    expect(pixelAt(canvas, 200, 150)).toEqual([37, 99, 235, 255]);

    await controller.perform('update');
    expect(controller.getState()).toEqual({
      revision: 1,
      clicks: 0,
      lastAction: 'update',
    });
    expect(pixelAt(canvas, 200, 150)).toEqual([124, 58, 237, 255]);

    const background = { x: 400, y: 200 };
    const target = { x: 100, y: 100 };
    await moveMouse(canvas, background);
    await pressMouse(canvas, background);
    await releaseMouse(canvas, target);
    await controller.settled();
    expect(controller.getState()).toEqual({
      revision: 1,
      clicks: 0,
      lastAction: 'update',
    });

    await userEvent.click(canvas, { position: { x: 100, y: 100 } });
    await controller.settled();
    expect(controller.getState()).toEqual({
      revision: 1,
      clicks: 1,
      lastAction: 'click',
    });
    expect(pixelAt(canvas, 200, 150)).toEqual([234, 88, 12, 255]);

    await controller.reset();
    expect(controller.getState()).toEqual({
      revision: 0,
      clicks: 0,
      lastAction: 'reset',
    });
    expect(pixelAt(canvas, 200, 150)).toEqual([37, 99, 235, 255]);

    if (import.meta.env.VITE_CRC_VISUAL_DRILL === '1') {
      await controller.perform('update');
    }
    const visual = document.querySelector('[data-testid="smoke-visual"]');
    if (!visual) {
      throw new Error('The smoke visual surface was not mounted.');
    }
    await expectVisualMatch({
      element: visual,
      expectedPath: 'packages/core/test/visual-baselines/dep-01-smoke.expected.png',
      expectedArtifactPath: `test-screenshots/dep-03/${packageMode}/smoke.expected.png`,
      actualPath: `../../../test-screenshots/dep-03/${packageMode}/smoke.actual.png`,
      diffPath: `test-screenshots/dep-03/${packageMode}/smoke.diff.png`,
      ignoreRegions: [
        { x: 40, y: 68, width: 184, height: 78 },
        { x: 238, y: 48, width: 234, height: 104 },
        { x: 494, y: 16, width: 218, height: 26 },
        { x: 494, y: 52, width: 218, height: 46 },
        { x: 494, y: 109, width: 218, height: 46 },
        { x: 494, y: 166, width: 218, height: 46 },
      ],
    });
    if (import.meta.env.VITE_CRC_VISUAL_DRILL === '1') {
      await controller.reset();
    }

    await userEvent.click(canvas, { position: { x: 100, y: 100 } });
    await controller.settled();
    expect(controller.getState().clicks).toBe(1);

    await controller.dispose();
    await expect(controller.perform('update')).rejects.toThrow(
      'Cannot operate on a disposed smoke scenario.',
    );
    activeController = undefined;
  });
});
