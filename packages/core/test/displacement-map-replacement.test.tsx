/** @jsxImportSource @crc/core */
import { crc, defineTexture, Group, Rectangle, useSignal, useTexture, type WritableSignal, type Texture, type TexturePaint } from '@crc/core';
import { displacement } from '@crc/core/filters';
import { expect, it, vi } from 'vitest';
import { DisplacementGpu } from '../src/filters/displacement-gpu';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing';

it('replaces a public map input and detaches its old revision consumer and GPU upload', () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const solid = defineTexture<string, { color: string }, string>({
    create: (_context, color) => ({ color }),
    receive(state, color, context) { state.color = color; context.invalidate(); },
    rasterize(state, { canvas }) { const context = canvas.getContext('2d')!; context.fillStyle = state.color; context.fillRect(0, 0, canvas.width, canvas.height); },
  });
  let first!: Texture<string>, second!: Texture<string>, selected!: WritableSignal<TexturePaint>;
  function Scene() {
    first = useTexture(solid('rgb(128 128 128)'), { resolution: { width: 8, height: 8 } });
    second = useTexture(solid('rgb(255 128 128)'), { resolution: { width: 8, height: 8 } });
    selected = useSignal<TexturePaint>(first);
    return <Group style={{ filter: displacement({ map: selected, strength: 4, region: { x: 0, y: 0, width: 40, height: 40 } }) }}>
      <Rectangle style={{ x: 10, y: 10, width: 10, height: 10, fill: 'red' }} />
    </Group>;
  }
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 40; document.body.append(canvas);
  const applies = vi.spyOn(DisplacementGpu.prototype, 'apply');
  const deletes = vi.spyOn(WebGL2RenderingContext.prototype, 'deleteTexture');
  const controller = crc(canvas, <Scene />);
  try {
    driver.flush(0);
    const pixel = (x: number) => canvas.getContext('2d')!.getImageData(x, 12, 1, 1).data[3];
    expect(pixel(7)).toBe(0); expect(pixel(17)).toBe(255);
    deletes.mockClear();
    selected.set(second); driver.flush(16);
    expect(pixel(7)).toBe(255); expect(pixel(17)).toBe(0);
    expect(deletes).toHaveBeenCalledTimes(1);
    applies.mockClear();
    first.send('rgb(0 128 128)'); driver.flush(32);
    expect(applies).not.toHaveBeenCalled();
    expect(pixel(7)).toBe(255);
    second.send('rgb(128 128 128)'); driver.flush(48);
    expect(applies).toHaveBeenCalledTimes(1);
    expect(pixel(7)).toBe(0); expect(pixel(17)).toBe(255);
  } finally { controller.dispose(); applies.mockRestore(); deletes.mockRestore(); restore(); canvas.remove(); }
});
