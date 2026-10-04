import { afterEach, expect, it } from 'vitest';
import { crc, Group, Rectangle, Clip, Layer, fade, defineTransition, useVisibilityTransition, signal, type CRCVisibilityTransition } from '@crc/core';
import { opacity } from '@crc/core/filters';
import { installSchedulerDriverForTest, ManualSchedulerDriver, snapshotRealmScheduler } from '../src/lib/scheduler/testing';
const roots: ReturnType<typeof crc>[] = [];
let driver: ManualSchedulerDriver;
let restore: (() => void) | undefined;
afterEach(() => {
  roots.splice(0).forEach(root => root.dispose());
  if (driver?.pendingHostFrames) driver.flush(10000);
  restore?.(); restore = undefined; document.body.replaceChildren();
});
function setup() {
  driver = new ManualSchedulerDriver(); restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 160;
  canvas.style.width = '160px'; canvas.style.height = '160px'; document.body.append(canvas); return canvas;
}

it('retains earlier in-run history across repeated reversals without a particle tail', () => {
  const canvas = setup(); let handle!: CRCVisibilityTransition; let past = 0;
  const effect = defineTransition({ render({ progressAt, drawSource }) { past = progressAt(25); drawSource(); } });
  function Scene() { handle = useVisibilityTransition({ initial: false, enter: effect, duration: 100 }); return <Rectangle style={{ width: 100, height: 100, fill: 'red', transition: handle.binding }} />; }
  roots.push(crc(canvas, <Scene />)); driver.flush(0);
  void handle.show(); driver.flush(10); driver.flush(60); expect(past).toBeCloseTo(.25);
  void handle.hide(); driver.flush(60); driver.flush(80);
  void handle.show(); driver.flush(80); driver.flush(90);
  void handle.hide(); driver.flush(90); driver.flush(100);
  expect(past).toBeCloseTo(.25);
});

it('aligns history with committed progress when reversal is admitted on a later frame', () => {
  const canvas = setup(); let handle!: CRCVisibilityTransition; let sampled = 0;
  const effect = defineTransition({ render({ progressAt, elapsed, drawSource }) { sampled = progressAt(elapsed); drawSource(); } });
  function Scene() { handle = useVisibilityTransition({ initial: false, enter: effect, duration: 100 }); return <Rectangle style={{ width: 100, height: 100, fill: 'red', transition: handle.binding }} />; }
  roots.push(crc(canvas, <Scene />)); driver.flush(0);
  void handle.show(); driver.flush(10); driver.flush(60);
  void handle.hide(); driver.flush(80);
  expect(sampled).toBeCloseTo(handle.progress.get());
  driver.flush(90); expect(sampled).toBeCloseTo(handle.progress.get());
});

it('completes zero-duration enter and exit after painting their endpoints', async () => {
  const canvas = setup(); let handle!: CRCVisibilityTransition;
  function Scene() { handle = useVisibilityTransition({ initial: false, enter: fade(), duration: 0 }); return <Rectangle style={{ width: 100, height: 100, fill: 'red', transition: handle.binding }} />; }
  roots.push(crc(canvas, <Scene />)); driver.flush(0);
  const shown = handle.show(); driver.flush(10);
  expect(handle.status.get()).toBe('visible'); expect(await shown).toMatchObject({ status: 'finished' });
  expect(canvas.getContext('2d')!.getImageData(50, 50, 1, 1).data[3]).toBe(255);
  const hidden = handle.hide(); driver.flush(20);
  expect(handle.status.get()).toBe('hidden'); expect(await hidden).toMatchObject({ status: 'finished' });
  expect(canvas.getContext('2d')!.getImageData(50, 50, 1, 1).data[3]).toBe(0);
});

it('honors distinct enter and exit tails and repeated requests during a tail', async () => {
  const canvas = setup(); let handle!: CRCVisibilityTransition; const phases: string[] = [];
  const effect = (linger: number) => defineTransition({ linger, render({ context, phase, progress, drawSource }) { phases.push(phase); context.globalAlpha = progress; drawSource(); } });
  function Scene() { handle = useVisibilityTransition({ initial: false, enter: effect(20), exit: effect(80), duration: 50 }); return <Rectangle style={{ width: 100, height: 100, fill: 'red', transition: handle.binding }} />; }
  roots.push(crc(canvas, <Scene />)); driver.flush(0);
  const shown = handle.show(); driver.flush(10); driver.flush(60); driver.flush(70); driver.flush(90);
  expect(handle.status.get()).toBe('visible'); expect(await shown).toMatchObject({ phase: 'enter', status: 'finished' });
  const first = handle.hide(); driver.flush(100); driver.flush(150); driver.flush(160);
  const second = handle.hide(); driver.flush(170); driver.flush(200);
  expect(await first).toMatchObject({ status: 'cancelled' }); expect(handle.status.get()).toBe('exiting');
  driver.flush(250); expect(await second).toMatchObject({ phase: 'exit', status: 'finished' });
  expect(new Set(phases)).toEqual(new Set(['enter', 'exit']));
});

it('composes a transition inside a translated cached Layer with clipping and ordinary filters', async () => {
  const canvas = setup(); let handle!: CRCVisibilityTransition;
  function Content() { handle = useVisibilityTransition({ enter: fade(), duration: 100 }); return <Clip style={{ d: new Path2D('M0 0h40v60H0z') }}><Group style={{ filter: opacity({ amount: .5 }), transition: handle.binding }}><Rectangle style={{ width: 80, height: 80, fill: 'red' }} /></Group></Clip>; }
  function Scene() { return <Group style={{ translateX: 20, translateY: 30 }}><Layer style={{ width: 100, height: 100 }}><Content /></Layer></Group>; }
  roots.push(crc(canvas, <Scene />)); driver.flush(0);
  const hidden = handle.hide(); driver.flush(10); driver.flush(60);
  const c = canvas.getContext('2d')!;
  expect(c.getImageData(30, 40, 1, 1).data[3]).toBeCloseTo(64, -1);
  expect(c.getImageData(70, 40, 1, 1).data[3]).toBe(0);
  expect(c.getImageData(10, 10, 1, 1).data[3]).toBe(0);
  driver.flush(110); expect(await hidden).toMatchObject({ status: 'finished' });
  expect(c.getImageData(30, 40, 1, 1).data[3]).toBe(0);
});

it('disposes a pending request automatically when its renderer throws', async () => {
  const canvas = setup(); let handle!: CRCVisibilityTransition;
  const effect = defineTransition({ render() { throw new Error('effect failed'); } });
  function Scene() { handle = useVisibilityTransition({ initial: false, enter: effect, duration: 100 }); return <Rectangle style={{ width: 100, height: 100, transition: handle.binding }} />; }
  roots.push(crc(canvas, <Scene />)); driver.flush(0);
  const shown = handle.show(); driver.flush(10); expect(() => driver.flush(60)).toThrow('effect failed');
  expect(handle.status.get()).toBe('disposed'); expect(await shown).toMatchObject({ status: 'disposed' });
  expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
});

it('keeps mount-time configuration and stable controls across component rerenders', async () => {
  const canvas = setup(); const duration = signal(100); let handle!: CRCVisibilityTransition;
  function Scene() { handle = useVisibilityTransition({ enter: fade(), duration: duration.get() }); return <Rectangle style={{ width: 100, height: 100, fill: 'red', transition: handle.binding }} />; }
  roots.push(crc(canvas, <Scene />)); driver.flush(0); const original = handle;
  duration.set(1000); driver.flush(10); expect(handle).toBe(original);
  const hidden = handle.hide(); driver.flush(20); driver.flush(120);
  expect(handle.status.get()).toBe('hidden'); expect(await hidden).toMatchObject({ status: 'finished' });
});

it('rejects a controller binding attached to two receivers', () => {
  const canvas = setup();
  function Scene() { const handle = useVisibilityTransition({ enter: fade() }); return <Group><Rectangle style={{ width: 40, height: 40, transition: handle.binding }} /><Rectangle style={{ x: 50, width: 40, height: 40, transition: handle.binding }} /></Group>; }
  expect(() => { roots.push(crc(canvas, <Scene />)); driver.flush(0); }).toThrow(/one.*receiver/i);
});

it('rejects cross-root bindings without disposing the owning root', () => {
  const canvas = setup(); let handle!: CRCVisibilityTransition; const effect = fade();
  function Scene() { handle = useVisibilityTransition({ enter: effect }); return <Rectangle style={{ width: 40, height: 40, transition: handle.binding }} />; }
  roots.push(crc(canvas, <Scene />)); driver.flush(0);
  const other = document.createElement('canvas'); document.body.append(other);
  expect(() => { roots.push(crc(other, <Rectangle style={{ width: 40, height: 40, transition: handle.binding }} />)); driver.flush(10); }).toThrow(/root/i);
  expect(handle.status.get()).toBe('visible');
});


it('allows a binding to be reattached after its previous receiver is removed', () => {
  const canvas = setup(); const attached = signal(true); let handle!: CRCVisibilityTransition;
  function Scene() { handle = useVisibilityTransition({ enter: fade() }); return attached.get() ? <Rectangle style={{ width: 40, height: 40, transition: handle.binding }} /> : null; }
  roots.push(crc(canvas, <Scene />)); driver.flush(0);
  attached.set(false); driver.flush(10);
  attached.set(true); driver.flush(20);
  expect(handle.status.get()).toBe('visible');
});

it('composes custom capture with an outer transition, clip, and cached layer', () => {
  const canvas = setup(); let outer!: CRCVisibilityTransition; let inner!: CRCVisibilityTransition;
  const effect = defineTransition({ render({context, progress, drawSource}) { context.globalAlpha *= progress; drawSource(); } });
  function Content() { inner = useVisibilityTransition({ enter: effect, duration: 100 }); return <Rectangle style={{ width: 80, height: 80, fill: 'red', transition: inner.binding }} />; }
  function Scene() { outer = useVisibilityTransition({ enter: effect, duration: 100 }); return <Group style={{ translateX: 20, translateY: 30, transition: outer.binding }}><Clip style={{ d: new Path2D('M0 0h40v60H0z') }}><Layer style={{ width: 100, height: 100 }}><Content /></Layer></Clip></Group>; }
  roots.push(crc(canvas, <Scene />)); driver.flush(0);
  void outer.hide(); void inner.hide(); driver.flush(10); driver.flush(60);
  const c = canvas.getContext('2d')!;
  expect(c.getImageData(30, 40, 1, 1).data[3]).toBeCloseTo(64, -1);
  expect(c.getImageData(70, 40, 1, 1).data[3]).toBe(0);
});

it('settles only the latest request when reversed before the first animation frame', async () => {
  const canvas = setup(); let handle!: CRCVisibilityTransition;
  function Scene() { handle = useVisibilityTransition({ initial: false, enter: fade(), duration: 100 }); return <Rectangle style={{ width: 40, height: 40, transition: handle.binding }} />; }
  roots.push(crc(canvas, <Scene />)); driver.flush(0);
  const first = handle.show(); const second = handle.hide(); const third = handle.show();
  driver.flush(10); driver.flush(110);
  expect(await first).toMatchObject({ status: 'cancelled' });
  expect(await second).toMatchObject({ status: 'cancelled' });
  expect(await third).toMatchObject({ status: 'finished', phase: 'enter' });
  expect(handle.progress.get()).toBe(1);
});

it('retains a zero-duration effect tail and disposes queued commands with the owner', async () => {
  const canvas = setup(); let handle!: CRCVisibilityTransition;
  const effect = defineTransition({ linger: 50, render({context, progress, drawSource}) { context.globalAlpha = progress; drawSource(); } });
  function Scene() { handle = useVisibilityTransition({ enter: effect, duration: 0 }); return <Rectangle style={{ width: 40, height: 40, transition: handle.binding }} />; }
  const root = crc(canvas, <Scene />); roots.push(root); driver.flush(0);
  const hidden = handle.hide(); driver.flush(10); driver.flush(20);
  expect(handle.progress.get()).toBe(0); expect(handle.status.get()).toBe('exiting');
  driver.flush(70); expect(await hidden).toMatchObject({ status: 'finished' });
  const shown = handle.show(); root.dispose(); if (driver.pendingHostFrames) driver.flush(80);
  expect(await shown).toMatchObject({ status: 'disposed' });
  expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
});

it('allows keyed replacement of the sole receiver within the same render', () => {
  const canvas = setup(); const key = signal('first'); let handle!: CRCVisibilityTransition;
  function Scene() { handle = useVisibilityTransition({ enter: fade() }); return <Rectangle key={key.get()} style={{ width: 40, height: 40, fill: 'red', transition: handle.binding }} />; }
  roots.push(crc(canvas, <Scene />)); driver.flush(0);
  key.set('second'); driver.flush(10);
  expect(handle.status.get()).toBe('visible');
  expect(canvas.getContext('2d')!.getImageData(20, 20, 1, 1).data[3]).toBe(255);
});
