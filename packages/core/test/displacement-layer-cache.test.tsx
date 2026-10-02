/** @jsxImportSource @crc/core */
import { crc, definePrimitive, Group, Layer, Rectangle, useTexture } from '@crc/core';
import { displacement } from '@crc/core/filters';
import { waterWaves } from '@crc/textures';
import { expect, it, vi } from 'vitest';
import { DisplacementGpu } from '../src/filters/displacement-gpu';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing';

it('reprocesses live water without repainting its clean child Layer', () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const applies = vi.spyOn(DisplacementGpu.prototype, 'apply');
  const readScene = vi.spyOn(OffscreenCanvasRenderingContext2D.prototype, 'getImageData').mockImplementation(() => { throw new Error('Unexpected scene readback'); });
  const readGpu = vi.spyOn(WebGL2RenderingContext.prototype, 'readPixels').mockImplementation(() => { throw new Error('Unexpected GPU readback'); });
  let paints = 0;
  let water!: ReturnType<typeof useTexture<{ type: 'pause'; paused: boolean } | { type: 'reset' }>>;
  const Content = definePrimitive((_props, _style, context) => {
    paints++; context.fillStyle = 'red'; context.fillRect(10, 10, 10, 10);
  });
  function Scene() {
    water = useTexture(waterWaves({ seed: 1, speed: 1 }), { resolution: { width: 8, height: 8 } });
    return <Group>
      <Group style={{ filter: displacement({ map: water, strength: 2, region: { x: 0, y: 0, width: 40, height: 40 } }) }}>
        <Layer style={{ width: 40, height: 40 }}><Content /></Layer>
      </Group>
      <Rectangle style={{ left: 40, width: 8, height: 8, fill: water }} />
    </Group>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 48; canvas.height = 40; document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  try {
    driver.flush(0);
    expect(paints).toBe(1);
    for (let index = 1; index <= 20; index++) driver.flush(index * 16);
    expect(applies.mock.calls.length).toBeGreaterThan(10);
    expect(paints).toBe(1);
    expect(readScene).not.toHaveBeenCalled(); expect(readGpu).not.toHaveBeenCalled();
    water.send({ type: 'pause', paused: true }); driver.flush(336);
    expect(driver.pendingHostFrames).toBe(0);
  } finally { controller.dispose(); applies.mockRestore(); readScene.mockRestore(); readGpu.mockRestore(); restore(); canvas.remove(); }
});

it('does not acquire a GPU or subscribe to live map pixels at zero strength', () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const contexts = vi.spyOn(OffscreenCanvas.prototype, 'getContext');
  let paints = 0;
  const Content = definePrimitive((_props, _style, context) => { paints++; context.fillRect(0, 0, 10, 10); });
  function Scene() {
    const map = useTexture(waterWaves({ speed: 1 }), { resolution: { width: 8, height: 8 } });
    return <Group style={{ filter: displacement({ map, strength: 0, region: { x: 0, y: 0, width: 40, height: 40 } }) }}><Content /></Group>;
  }
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 40; document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  try {
    driver.flush(0);
    for (let index = 1; index <= 20; index++) driver.flush(index * 16);
    expect(driver.pendingHostFrames).toBe(1); // The separately owned water producer is still active.
    expect(paints).toBe(1);
    expect(contexts.mock.calls.filter(([kind]) => kind === 'webgl2')).toHaveLength(0);
  } finally { controller.dispose(); contexts.mockRestore(); restore(); canvas.remove(); }
});
