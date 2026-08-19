import {
  canvasSurfaceScenarioEntry,
  loadScenario,
  type CanvasSurfaceState,
  type ScenarioController,
} from '@crc/scenarios';
import { afterEach, describe, expect, it } from 'vitest';
import canvasSurfaceSource from '../../scenarios/src/canvas-surface.example.ts?raw';

let activeController: ScenarioController<CanvasSurfaceState> | undefined;

afterEach(async () => {
  await activeController?.dispose();
  activeController = undefined;
  document.body.replaceChildren();
});

describe('Canvas surface public contract', () => {
  it('proves fixed density, responsive reflow, stable identity, and logical mouse coordinates', async () => {
    expect(canvasSurfaceSource).toContain(canvasSurfaceScenarioEntry.source.marker);
    const definition = await loadScenario(canvasSurfaceScenarioEntry);
    const canvas = document.createElement('canvas');
    canvas.width = canvasSurfaceScenarioEntry.canvas.width;
    canvas.height = canvasSurfaceScenarioEntry.canvas.height;
    canvas.style.display = 'block';
    document.body.appendChild(canvas);

    const controller = await definition.mount({ canvas });
    activeController = controller;
    await controller.settled();

    expect(controller.getState()).toMatchObject({
      mode: 'fixed',
      cssWidth: 480,
      cssHeight: 240,
      logicalWidth: 480,
      logicalHeight: 240,
      backingWidth: 960,
      backingHeight: 480,
      pixelRatio: 2,
    });
    const fixedIdentity = controller.getState().identity;

    await controller.perform('resize-fixed');
    expect(controller.getState()).toMatchObject({
      mode: 'fixed',
      cssWidth: 720,
      cssHeight: 360,
      logicalWidth: 480,
      logicalHeight: 240,
      backingWidth: 1440,
      backingHeight: 720,
      identity: fixedIdentity,
    });

    await controller.perform('show-responsive');
    expect(controller.getState()).toMatchObject({
      mode: 'responsive',
      logicalWidth: 720,
      logicalHeight: 360,
      backingWidth: 1440,
      backingHeight: 720,
    });
    const responsiveIdentity = controller.getState().identity;
    expect(responsiveIdentity).not.toBe(fixedIdentity);

    await controller.perform('resize-responsive');
    expect(controller.getState()).toMatchObject({
      mode: 'responsive',
      cssWidth: 600,
      cssHeight: 300,
      logicalWidth: 600,
      logicalHeight: 300,
      backingWidth: 1200,
      backingHeight: 600,
      identity: responsiveIdentity,
    });

    canvas.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: canvas.getBoundingClientRect().left + 300,
      clientY: canvas.getBoundingClientRect().top + 150,
    }));
    expect(controller.getState().lastCoordinates).toEqual([300, 150]);

    await controller.reset();
    expect(controller.getState()).toMatchObject({
      mode: 'fixed',
      cssWidth: 480,
      cssHeight: 240,
      logicalWidth: 480,
      logicalHeight: 240,
      backingWidth: 960,
      backingHeight: 480,
    });
  });
});
