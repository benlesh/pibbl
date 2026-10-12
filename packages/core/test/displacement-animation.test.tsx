/** @jsxImportSource @pibbl/core */
import { pibbl, defineTexture, Group, Rectangle, signal, drive, tween, usePlayback, useTexture, type PibblPlayback } from '@pibbl/core';
import { displacement } from '@pibbl/core/filters';
import { expect, it } from 'vitest';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing';

it('changes presentation without changing animation samples at identical logical times', () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const offset = signal(10), enabled = signal(false);
  let playback!: PibblPlayback;
  const map = defineTexture({
    create() {},
    rasterize(_state, { canvas }) { const context = canvas.getContext('2d')!; context.fillStyle = 'rgb(255 128 128)'; context.fillRect(0, 0, canvas.width, canvas.height); },
  });
  function Scene() {
    const texture = useTexture(map({}), { resolution: { width: 8, height: 8 } });
    playback = usePlayback(drive(offset, tween({ from: 10, to: 30, duration: 100 })));
    return <Group style={{ filter: enabled.get() ? displacement({ map: texture, strength: 4, region: { x: 0, y: 0, width: 50, height: 30 } }) : [] }}>
      <Rectangle style={{ left: offset, top: 10, width: 8, height: 8, fill: 'red' }} />
    </Group>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 50; canvas.height = 30; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />);
  try {
    driver.flush(-1); playback.play(); driver.flush(0); driver.flush(50);
    expect(offset.get()).toBe(20);
    const pixel = (x: number) => canvas.getContext('2d')!.getImageData(x, 12, 1, 1).data[3];
    expect(pixel(17)).toBe(0); expect(pixel(26)).toBe(255);
    enabled.set(true); driver.flush(50);
    expect(offset.get()).toBe(20);
    expect(pixel(17)).toBe(255); expect(pixel(26)).toBe(0);
    driver.flush(100);
    expect(offset.get()).toBe(30);
    expect(pixel(27)).toBe(255); expect(pixel(36)).toBe(0);
    enabled.set(false); driver.flush(100);
    expect(offset.get()).toBe(30);
    expect(pixel(27)).toBe(0); expect(pixel(36)).toBe(255);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});
