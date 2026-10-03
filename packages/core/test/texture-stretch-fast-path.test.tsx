import { afterEach, expect, it, vi } from 'vitest';
import { Rectangle, crc, defineTexture, signal, useTexture } from '@crc/core';
import { clearSharedState } from '../src/lib/global-state.js';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing.js';

afterEach(() => { clearSharedState(); vi.restoreAllMocks(); document.body.replaceChildren(); });

it('uses no CanvasPattern allocations for eligible stretched Rectangle texture fills', () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const revision = signal(0);
  const recipe = defineTexture<{}, { color: string }>({
    create: () => ({ color: '#ff0000' }),
    rasterize(state, { canvas }) { const context = canvas.getContext('2d')!; context.fillStyle = state.color; context.fillRect(0, 0, 8, 8); },
  });
  function Scene() { revision.get(); const texture = useTexture(recipe({}), { resolution: { width: 8, height: 8 } }); return <Rectangle style={{ width: 40, height: 20, fill: texture.paint({ mode: 'stretch' }) }} />; }
  const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 20; document.body.append(canvas);
  const createPattern = vi.spyOn(CanvasRenderingContext2D.prototype, 'createPattern');
  const controller = crc(canvas, <Scene />);
  try {
    driver.flush(0); revision.set(1); driver.flush(16); revision.set(2); driver.flush(32);
    expect(createPattern).not.toHaveBeenCalled();
    expect([...canvas.getContext('2d')!.getImageData(10, 10, 1, 1).data]).toEqual([255, 0, 0, 255]);
  } finally { controller.dispose(); restore(); }
});
