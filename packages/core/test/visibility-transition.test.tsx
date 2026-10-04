import { afterEach, expect, it } from 'vitest';
import { crc, Group, Rectangle, fade, useVisibilityTransition, type CRCVisibilityTransition } from '@crc/core';
import { installSchedulerDriverForTest, ManualSchedulerDriver, snapshotRealmScheduler } from '../src/lib/scheduler/testing';

const roots: ReturnType<typeof crc>[] = [];
let restore: (() => void) | undefined;
afterEach(() => { roots.splice(0).forEach(root => root.dispose()); restore?.(); document.body.replaceChildren(); });

it('fades a combined subtree and resolves hide only after its final frame', async () => {
  const driver = new ManualSchedulerDriver(); restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 120;
  canvas.style.width = '120px'; canvas.style.height = '120px'; document.body.append(canvas);
  let handle!: CRCVisibilityTransition;
  function Scene() {
    handle = useVisibilityTransition({ initial: true, enter: fade(), exit: fade(), duration: 100 });
    return <Group style={{ transition: handle.binding }}><Rectangle style={{ width: 100, height: 100, fill: 'red' }} /><Rectangle style={{ left: 25, top: 25, width: 75, height: 75, fill: 'red' }} /></Group>;
  }
  roots.push(crc(canvas, <Scene />)); driver.flush(0);
  const completion = handle.hide(); driver.flush(10); driver.flush(60);
  const context = canvas.getContext('2d')!;
  expect(context.getImageData(10, 10, 1, 1).data[3]).toBeCloseTo(128, -1);
  expect(context.getImageData(50, 50, 1, 1).data[3]).toBeCloseTo(128, -1);
  driver.flush(110);
  expect(await completion).toMatchObject({ status: 'finished', phase: 'exit' });
  expect(handle.status.get()).toBe('hidden');
  expect(context.getImageData(50, 50, 1, 1).data[3]).toBe(0);
});

it('settles replaced requests as cancelled and pending requests as disposed', async () => {
  const driver = new ManualSchedulerDriver(); restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); document.body.append(canvas);
  let handle!: CRCVisibilityTransition;
  function Scene() { handle = useVisibilityTransition({ initial: true, enter: fade(), duration: 100 }); return <Rectangle style={{ width: 50, height: 50, fill: 'red', transition: handle.binding }} />; }
  const root = crc(canvas, <Scene />); roots.push(root); driver.flush(0);
  const hidden = handle.hide(); driver.flush(10); driver.flush(35);
  const progress = handle.progress.get();
  const shown = handle.show(); driver.flush(35);
  expect(handle.progress.get()).toBe(progress);
  expect(await hidden).toMatchObject({ status: 'cancelled', phase: 'exit' });
  root.dispose();
  expect(await shown).toMatchObject({ status: 'disposed', phase: 'enter' });
});

it('coalesces reversal before a frame and finishes an exit at its hidden endpoint', async () => {
  const driver = new ManualSchedulerDriver(); restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); document.body.append(canvas);
  let handle!: CRCVisibilityTransition;
  function Scene() { handle = useVisibilityTransition({ enter: fade(), duration: 100 }); return <Rectangle style={{ width: 50, height: 50, fill: 'red', transition: handle.binding }} />; }
  roots.push(crc(canvas, <Scene />)); driver.flush(0);
  const first = handle.hide(); const second = handle.show(); driver.flush(10); driver.flush(110);
  expect(await first).toMatchObject({ status: 'cancelled' });
  expect(await second).toMatchObject({ status: 'finished', phase: 'enter' });
  expect(handle.progress.get()).toBe(1);
  const last = handle.hide(); driver.flush(120); driver.flush(140); handle.finish(); driver.flush(150);
  expect(await last).toMatchObject({ status: 'finished', phase: 'exit' });
  expect(handle.progress.get()).toBe(0);
});

it('burns arbitrary captured content within a declared region, chars the front, and restores exact endpoints', async () => {
  const { embers } = await import('@crc/core');
  const driver = new ManualSchedulerDriver(); restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 160;
  canvas.style.width = '160px'; canvas.style.height = '160px'; document.body.append(canvas);
  let handle!: CRCVisibilityTransition;
  function Scene() {
    handle = useVisibilityTransition({ enter: embers({ region: { x: 20, y: 20, width: 120, height: 120 }, charDepth: 30, seed: 4, linger: 0 }), duration: 100 });
    return <Group style={{ transition: handle.binding }}><Rectangle style={{ left: 20, top: 20, width: 120, height: 120, fill: 'white' }} /></Group>;
  }
  roots.push(crc(canvas, <Scene />)); driver.flush(0);
  const context = canvas.getContext('2d')!;
  expect([...context.getImageData(80, 100, 1, 1).data]).toEqual([255, 255, 255, 255]);
  const hidden = handle.hide(); driver.flush(10); driver.flush(60);
  // The opaque subject is gone here; airborne embers may now cross this point.
  expect(context.getImageData(80, 30, 1, 1).data[3]).toBeLessThan(255);
  expect(context.getImageData(80, 100, 1, 1).data[0]).toBeLessThan(200);
  expect(context.getImageData(80, 135, 1, 1).data[0]).toBe(255);
  driver.flush(110); expect(await hidden).toMatchObject({ status: 'finished' });
  expect(context.getImageData(80, 135, 1, 1).data[3]).toBe(0);
  const shown = handle.show(); driver.flush(120); driver.flush(220);
  expect(await shown).toMatchObject({ status: 'finished' });
  expect([...context.getImageData(80, 100, 1, 1).data]).toEqual([255, 255, 255, 255]);
});

it('evolves the burn contour at different local rates instead of translating one fixed edge', async () => {
  const { embers } = await import('@crc/core');
  const driver = new ManualSchedulerDriver(); restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240;
  canvas.style.width = '240px'; canvas.style.height = '240px'; document.body.append(canvas);
  let handle!: CRCVisibilityTransition;
  function Scene() {
    handle = useVisibilityTransition({ enter: embers({ region: { x: 20, y: 20, width: 200, height: 200 }, charDepth: 0, burnWidth: 0, seed: 4, linger: 0 }), duration: 100 });
    return <Rectangle style={{ left: 20, top: 20, width: 200, height: 200, fill: 'white', transition: handle.binding }} />;
  }
  roots.push(crc(canvas, <Scene />)); driver.flush(0);
  void handle.hide(); driver.flush(10);
  const edge = () => {
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, 240, 240).data;
    return Array.from({ length: 17 }, (_, i) => {
      const x = 40 + i * 10;
      for (let y = 20; y < 220; y++) if (pixels[(y * 240 + x) * 4 + 3] === 255) return y;
      throw new Error('Missing solid burn edge');
    });
  };
  driver.flush(45); const first = edge();
  driver.flush(65); const second = edge();
  const travel = second.map((y, i) => y - first[i]!);
  expect(Math.min(...travel)).toBeGreaterThan(0);
  expect(Math.max(...travel) - Math.min(...travel)).toBeGreaterThan(2);
  expect(Math.max(...second) - Math.min(...second)).toBeLessThan(9);
  driver.flush(65); expect(edge()).toEqual(second);
});

it('keeps drifting ash visible after material disappears and completes only after its tail', async () => {
  const { embers } = await import('@crc/core');
  const driver = new ManualSchedulerDriver(); restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240;
  canvas.style.width = '240px'; canvas.style.height = '240px'; document.body.append(canvas);
  let handle!: CRCVisibilityTransition;
  function Scene() {
    handle = useVisibilityTransition({ enter: embers({ region: { x: 30, y: 80, width: 150, height: 120 }, seed: 4, wind: 30, linger: 300 }), duration: 100 });
    return <Rectangle style={{ left: 30, top: 80, width: 150, height: 120, fill: 'white', transition: handle.binding }} />;
  }
  roots.push(crc(canvas, <Scene />)); driver.flush(0);
  const completion = handle.hide(); let settled = false; void completion.then(() => { settled = true; });
  driver.flush(10); driver.flush(60); driver.flush(110); driver.flush(160);
  expect(handle.progress.get()).toBe(0);
  expect(handle.status.get()).toBe('exiting');
  await Promise.resolve(); expect(settled).toBe(false);
  const context = canvas.getContext('2d')!;
  const first = [...context.getImageData(0, 0, 240, 240).data];
  expect(first.some((value, index) => index % 4 === 3 && value > 0)).toBe(true);
  driver.flush(210);
  expect([...context.getImageData(0, 0, 240, 240).data]).not.toEqual(first);
  driver.flush(460); driver.flush(470);
  expect(await completion).toMatchObject({ status: 'finished', phase: 'exit' });
  expect(context.getImageData(0, 0, 240, 240).data.every(value => value === 0)).toBe(true);
});

it('can reverse a lingering exit, force completion, and dispose a pending tail', async () => {
  const { embers } = await import('@crc/core');
  const driver = new ManualSchedulerDriver(); restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 160; document.body.append(canvas);
  let handle!: CRCVisibilityTransition;
  function Scene() {
    handle = useVisibilityTransition({ enter: embers({ region: { x: 20, y: 20, width: 120, height: 120 }, linger: 300 }), duration: 100 });
    return <Rectangle style={{ left: 20, top: 20, width: 120, height: 120, fill: 'white', transition: handle.binding }} />;
  }
  const root = crc(canvas, <Scene />); roots.push(root); driver.flush(0);
  const exiting = handle.hide(); driver.flush(10); driver.flush(110); driver.flush(120);
  const entering = handle.show(); driver.flush(130);
  expect(await exiting).toMatchObject({ status: 'cancelled' });
  driver.flush(230); driver.flush(240);
  expect(handle.progress.get()).toBe(1);
  expect(handle.status.get()).toBe('entering');
  handle.finish(); driver.flush(250);
  expect(await entering).toMatchObject({ status: 'finished' });
  expect(handle.status.get()).toBe('visible');
  const last = handle.hide(); driver.flush(260); driver.flush(360); driver.flush(370);
  root.dispose(); expect(await last).toMatchObject({ status: 'disposed' });
  expect(driver.pendingHostFrames).toBe(0);
});

it('reconstructs captured content with a hologram and restores the original material', async () => {
  const { hologram } = await import('@crc/core');
  const driver = new ManualSchedulerDriver(); restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 160;
  canvas.style.width = '160px'; canvas.style.height = '160px'; document.body.append(canvas);
  let handle!: CRCVisibilityTransition;
  function Scene() {
    handle = useVisibilityTransition({ initial: false, enter: hologram({ region: { x: 20, y: 20, width: 120, height: 120 }, fog: 0, glitch: 0 }), duration: 100 });
    return <Rectangle style={{ left: 20, top: 20, width: 120, height: 120, fill: 'red', transition: handle.binding }} />;
  }
  roots.push(crc(canvas, <Scene />)); driver.flush(0);
  const context = canvas.getContext('2d')!;
  expect(context.getImageData(80, 110, 1, 1).data[3]).toBe(0);
  const shown = handle.show(); driver.flush(10); driver.flush(60);
  const reconstructed = context.getImageData(80, 110, 1, 1).data;
  expect(reconstructed[2]).toBeGreaterThan(reconstructed[0]);
  expect(reconstructed[3]).toBeGreaterThan(200);
  expect(context.getImageData(80, 30, 1, 1).data[3]).toBeLessThan(20);
  driver.flush(110); expect(await shown).toMatchObject({ status: 'finished' });
  expect([...context.getImageData(80, 110, 1, 1).data]).toEqual([255, 0, 0, 255]);
  const hidden = handle.hide(); driver.flush(120); driver.flush(220);
  expect(await hidden).toMatchObject({ status: 'finished' });
  expect(context.getImageData(80, 110, 1, 1).data[3]).toBe(0);
});

it('stretches and overexposes arbitrary Bifrost content before restoring its material', async () => {
  const { bifrost } = await import('@crc/core');
  const driver = new ManualSchedulerDriver(); restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240;
  canvas.style.width = '240px'; canvas.style.height = '240px'; document.body.append(canvas);
  let handle!: CRCVisibilityTransition;
  function Scene() {
    handle = useVisibilityTransition({ initial: false, enter: bifrost({ region: { x: 0, y: 0, width: 60, height: 80 }, entry: { x: 30, y: -200 } }), duration: 100 });
    return <Rectangle style={{ left: 90, top: 100, width: 60, height: 80, fill: '#203040', transition: handle.binding }} />;
  }
  roots.push(crc(canvas, <Scene />)); driver.flush(0);
  const shown = handle.show(); driver.flush(10); driver.flush(30);
  const c = canvas.getContext('2d')!;
  expect(c.getImageData(120, 60, 1, 1).data[3]).toBeGreaterThan(100);
  driver.flush(75);
  const hot = c.getImageData(120, 140, 1, 1).data;
  expect(Math.min(hot[0]!, hot[1]!, hot[2]!)).toBeGreaterThan(230);
  driver.flush(110); expect(await shown).toMatchObject({ status: 'finished' });
  expect([...c.getImageData(120, 140, 1, 1).data]).toEqual([32, 48, 64, 255]);
  expect(c.getImageData(120, 60, 1, 1).data[3]).toBe(0);
});

it('supports common transition definitions with clean endpoints through the same binding', async () => {
  const api = await import('@crc/core');
  const region = { x: 30, y: 30, width: 100, height: 100 };
  const effects = [api.slide({ x: 70, y: 0 }), api.zoom({ origin: { x: 80, y: 80 }, from: .1 }), api.wipe({ region, direction: 'left' }), api.blurReveal({ radius: 16 }), api.dissolve({ region, cellSize: 8, seed: 2 })];
  for (const effect of effects) {
    const driver = new ManualSchedulerDriver(); restore = installSchedulerDriverForTest(driver);
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 200;
    canvas.style.width = '200px'; canvas.style.height = '200px'; document.body.append(canvas);
    let handle!: CRCVisibilityTransition;
    function Scene() { handle = useVisibilityTransition({ initial: false, enter: effect, duration: 100 }); return <Rectangle style={{ ...region, fill: 'red', transition: handle.binding }} />; }
    const root = crc(canvas, <Scene />); roots.push(root); driver.flush(0);
    const context = canvas.getContext('2d')!;
    expect(context.getImageData(80, 80, 1, 1).data[3]).toBe(0);
    const shown = handle.show(); driver.flush(10); driver.flush(60);
    const middle = context.getImageData(0, 0, 200, 200).data;
    const painted = middle.filter((value, i) => i % 4 === 3 && value > 0).length;
    expect(painted).toBeGreaterThan(0);
    driver.flush(110); expect(await shown).toMatchObject({ status: 'finished' });
    expect([...context.getImageData(80, 80, 1, 1).data]).toEqual([255, 0, 0, 255]);
    const hidden = handle.hide(); driver.flush(120); driver.flush(220);
    expect(await hidden).toMatchObject({ status: 'finished' });
    expect(context.getImageData(80, 80, 1, 1).data[3]).toBe(0);
    root.dispose(); restore(); restore = undefined;
  }
});

it('runs a custom WASM-backed transition through the public effect contract', async () => {
  const { defineTransition } = await import('@crc/core');
  // (module (func (export "sample") (param f64) (result f64) local.get 0 local.get 0 f64.mul))
  const module = await WebAssembly.instantiate(new Uint8Array([0,97,115,109,1,0,0,0,1,6,1,96,1,124,1,124,3,2,1,0,7,10,1,6,115,97,109,112,108,101,0,0,10,9,1,7,0,32,0,32,0,162,11]));
  const sample = module.instance.exports.sample as (value: number) => number;
  const times: number[] = [];
  const effect = defineTransition({ render({ context, progress, elapsed, drawSource }) { times.push(elapsed); context.globalAlpha = sample(progress); drawSource(); } });
  const driver = new ManualSchedulerDriver(); restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100; document.body.append(canvas);
  let handle!: CRCVisibilityTransition;
  function Scene() { handle = useVisibilityTransition({ enter: effect, duration: 100 }); return <Rectangle style={{ width: 100, height: 100, fill: 'red', transition: handle.binding }} />; }
  roots.push(crc(canvas, <Scene />)); driver.flush(0);
  const hidden = handle.hide(); driver.flush(10); driver.flush(60);
  expect(canvas.getContext('2d')!.getImageData(50, 50, 1, 1).data[3]).toBeCloseTo(64, -1);
  expect(times.at(-1)).toBe(50);
  driver.flush(110); expect(await hidden).toMatchObject({ status: 'finished' });
});

it('rejects signal writes in custom rendering and settles the owner on disposal after failure', async () => {
  const { defineTransition, signal } = await import('@crc/core');
  const value = signal(0);
  const effect = defineTransition({ render() { value.set(1); } });
  const driver = new ManualSchedulerDriver(); restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); document.body.append(canvas);
  let handle!: CRCVisibilityTransition;
  function Scene() { handle = useVisibilityTransition({ initial: false, enter: effect, duration: 100 }); return <Rectangle style={{ width: 100, height: 100, fill: 'red', transition: handle.binding }} />; }
  const root = crc(canvas, <Scene />); roots.push(root); driver.flush(0);
  const shown = handle.show(); driver.flush(10);
  expect(() => driver.flush(60)).toThrow();
  expect(value.get()).toBe(0);
  root.dispose(); expect(await shown).toMatchObject({ status: 'disposed' });
  expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
  // Drain any queued completion cleanup after a failed render; no animation may remain.
  if (driver.pendingHostFrames) driver.flush(70);
  expect(driver.pendingHostFrames).toBe(0);
});

it('paints one continuous hot burn front across a wide subject', async () => {
  const { embers } = await import('@crc/core');
  const driver = new ManualSchedulerDriver(); restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); canvas.width = 820; canvas.height = 160;
  canvas.style.width = '820px'; canvas.style.height = '160px'; document.body.append(canvas);
  let handle!: CRCVisibilityTransition;
  function Scene() {
    handle = useVisibilityTransition({ enter: embers({ region: { x: 0, y: 0, width: 780, height: 120 }, seed: 4, linger: 0 }), duration: 100 });
    return <Rectangle style={{ left: 20, top: 20, width: 780, height: 120, fill: 'white', transition: handle.binding }} />;
  }
  roots.push(crc(canvas, <Scene />)); driver.flush(0);
  void handle.hide(); driver.flush(10); driver.flush(60);
  const data = canvas.getContext('2d')!.getImageData(0, 0, 820, 160).data;
  let continuous = 0, columns = 0;
  for (let x = 25; x < 795; x += 2) {
    columns++;
    for (let y = 74; y < 90; y++) {
      const i = (y * 820 + x) * 4;
      if (data[i]! > 180 && data[i + 1]! > 80 && data[i + 2]! < 220 && data[i]! > data[i + 1]! * 1.1) { continuous++; break; }
    }
  }
  expect(continuous / columns).toBeGreaterThan(.98);
});

it('moves Bifrost color patches with elapsed transit time independently of reveal progress', async () => {
  const { bifrost } = await import('@crc/core');
  const driver = new ManualSchedulerDriver(); restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 300;
  canvas.style.width = '240px'; canvas.style.height = '300px'; document.body.append(canvas);
  let handle!: CRCVisibilityTransition;
  const effect = bifrost({ region: { x: 70, y: 180, width: 100, height: 80 }, entry: { x: 120, y: 0 }, seed: 8 });
  function Scene({ duration }: { duration: number }) {
    handle = useVisibilityTransition({ initial: false, enter: effect, duration });
    return <Rectangle style={{ left: 70, top: 180, width: 100, height: 80, fill: 'red', transition: handle.binding }} />;
  }
  const first = crc(canvas, <Scene duration={1000} />); roots.push(first); driver.flush(0);
  void handle.show(); driver.flush(10); driver.flush(410);
  expect(handle.progress.get()).toBeCloseTo(.4);
  const pixels = [...canvas.getContext('2d')!.getImageData(40, 20, 160, 100).data];
  first.dispose();
  roots.push(crc(canvas, <Scene duration={2000} />)); driver.flush(500);
  void handle.show(); driver.flush(510); driver.flush(1310);
  expect(handle.progress.get()).toBeCloseTo(.4);
  const later = [...canvas.getContext('2d')!.getImageData(40, 20, 160, 100).data];
  expect(later).not.toEqual(pixels);
  expect(later.some((value, i) => i % 4 === 3 && value > 0)).toBe(true);
});

it('lazily uses a WASM instance for Bifrost calculations and reuses it across frames', async () => {
  const { vi } = await import('vitest');
  const { bifrost } = await import('@crc/core');
  const NativeInstance = WebAssembly.Instance;
  const instances = vi.spyOn(WebAssembly, 'Instance').mockImplementation(function(module, imports) { return new NativeInstance(module, imports); });
  const driver = new ManualSchedulerDriver(); restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 200; document.body.append(canvas);
  let handle!: CRCVisibilityTransition;
  try {
    const effect = bifrost({ region: { x: 50, y: 100, width: 100, height: 80 }, seed: 43 });
    expect(instances).not.toHaveBeenCalled();
    function Scene() { handle = useVisibilityTransition({ enter: effect, duration: 100 }); return <Rectangle style={{ left: 50, top: 100, width: 100, height: 80, fill: 'red', transition: handle.binding }} />; }
    roots.push(crc(canvas, <Scene />)); driver.flush(0);
    expect(instances).not.toHaveBeenCalled();
    void handle.hide(); driver.flush(10); driver.flush(35);
    expect(instances).toHaveBeenCalledTimes(1);
    driver.flush(60); expect(instances).toHaveBeenCalledTimes(1);
    handle.finish(); driver.flush(70);
    expect(handle.status.get()).toBe('hidden');
  } finally { instances.mockRestore(); }
});
