import { afterEach, expect, it } from 'vitest';
import { pibbl, drive, repeat, signal, usePlayback, type PibblPlayback } from '@pibbl/core';
import { Sprite, loadSpriteSheet, defineSpriteAnimation } from '../../../src/features/sprites/index';
import { installSchedulerDriverForTest, ManualSchedulerDriver } from '../../../src/lib/scheduler/testing';

let cleanup = () => {};
afterEach(() => cleanup());
it('draws grid frames through ordinary seekable animation and retains frame identity', async () => {
  const source = document.createElement('canvas');
  source.width = 4; source.height = 2;
  const paint = source.getContext('2d')!;
  paint.fillStyle = '#ff0000'; paint.fillRect(0, 0, 2, 2);
  paint.fillStyle = '#0000ff'; paint.fillRect(2, 0, 2, 2);
  const sheet = await loadSpriteSheet(source.toDataURL(), { grid: { frameWidth: 2, frameHeight: 2 } });
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 2;
  document.body.append(canvas);
  const frame = signal(sheet.frames[0]);
  let player!: PibblPlayback;
  function Scene() {
    player = usePlayback(drive(frame, defineSpriteAnimation({ frames: [sheet.frames[0], sheet.frames[1]], fps: 10 })));
    return <Sprite frame={frame} sampling="nearest" />;
  }
  const controller = pibbl(canvas, <Scene />);
  cleanup = () => { controller.dispose(); restore(); sheet.dispose(); canvas.remove(); };
  driver.flush(0);
  expect([...canvas.getContext('2d')!.getImageData(0, 0, 1, 1).data]).toEqual([255, 0, 0, 255]);
  player.seek(100); driver.flush(0);
  expect(frame.get()).toBe(sheet.frames[1]);
  expect([...canvas.getContext('2d')!.getImageData(0, 0, 1, 1).data]).toEqual([0, 0, 255, 255]);
  player.seek(0); driver.flush(0);
  expect(frame.get()).toBe(sheet.frames[0]);
});

it('composes a contiguous sprite loop through the public repeat API', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 1;
  const sheet = await loadSpriteSheet(canvas.toDataURL(), { grid: { frameWidth: 1, frameHeight: 1 } });
  try {
    const frame = signal(sheet.frames[0]);
    expect(() => repeat(drive(frame, defineSpriteAnimation({ frames: [sheet.frames[0], sheet.frames[1]], fps: 10 })), { iterations: Infinity })).not.toThrow();
  } finally { sheet.dispose(); }
});
