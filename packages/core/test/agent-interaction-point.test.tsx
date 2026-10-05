import { Clip, Group, Rectangle, pibbl, signal, type PibblController } from '@pibbl/core';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createTargetingInspector } from '../../../tooling/agent-verification/targeting';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing';
import { clickMouse } from './support/mouse-input';

let driver: ManualSchedulerDriver;
let restore: () => void;
let controller: PibblController | undefined;
beforeEach(() => { driver = new ManualSchedulerDriver(); restore = installSchedulerDriverForTest(driver); });
afterEach(() => { controller?.dispose(); controller = undefined; restore(); document.body.replaceChildren(); });
function host() {
  const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 200;
  canvas.style.cssText = 'width:200px;height:200px'; document.body.append(canvas); return canvas;
}

it('finds an uncovered clipped interaction point and delivers native input there', async () => {
  const canvas = host(); let selections = 0;
  const clip = new Path2D(); clip.rect(0, 0, 90, 90);
  controller = pibbl(canvas, <Group style={{ translateX: 20, translateY: 20 }}>
    <Clip style={{ d: clip }}><Rectangle style={{ width: 120, height: 120, fill: '#00f' }} onClick={() => selections++} /></Clip>
    <Rectangle style={{ left: 40, width: 80, height: 120, fill: '#f00' }} onClick={() => undefined} />
  </Group>, { pixelRatio: 1 }); driver.flush(1);
  const inspector = createTargetingInspector(canvas); const snapshot = inspector.snapshot();
  const target = inspector.probe(snapshot.generation!, 30, 30).targetId!;
  expect(inspector.probe(snapshot.generation!, 80, 80).targetId).not.toBe(target);
  const context = canvas.getContext('2d')!; context.lineWidth = 19; context.setTransform(2, 0, 0, 2, 3, 4);
  const result = inspector.findInteractionPoint(snapshot.generation!, target, { x: 20, y: 20, width: 120, height: 120 });
  expect(result).toMatchObject({ status: 'verified-geometry', targetId: target, routing: 'geometry-only', hostOcclusion: 'not-observed' });
  expect(result.point).toEqual({ x: 40, y: 40 });
  expect(result.attempts).toBe(2); expect(result.nativeCalls).toBeLessThanOrEqual(9 * 128);
  expect(Object.isFrozen(result.point)).toBe(true);
  expect(context.getTransform().toString()).toBe('matrix(2, 0, 0, 2, 3, 4)'); expect(context.lineWidth).toBe(19);
  await clickMouse(canvas, result.point!); expect(selections).toBe(1);
  inspector.dispose();
});

it('reports no verified point without proving absence for thin or fully covered targets', () => {
  const canvas = host(); const covered = signal(false);
  function Scene() { return <>
    <Rectangle style={{ left: 1, top: 1, width: 1, height: 1, fill: '#00f' }} onClick={() => undefined} />
    {covered.get() ? <Rectangle style={{ width: 100, height: 100, fill: '#f00' }} onClick={() => undefined} /> : null}
  </>; }
  controller = pibbl(canvas, <Scene />, { pixelRatio: 1 }); driver.flush(1);
  const inspector = createTargetingInspector(canvas); const initial = inspector.snapshot();
  const target = inspector.probe(initial.generation!, 1.5, 1.5).targetId!;
  const bounds = { x: 0, y: 0, width: 100, height: 100 };
  expect(inspector.findInteractionPoint(initial.generation!, target, bounds)).toMatchObject({ status: 'no-verified-point', point: null, attempts: 9, completeness: 'sampled' });
  covered.set(true); driver.flush(2);
  expect(inspector.findInteractionPoint(inspector.snapshot().generation!, target, bounds)).toMatchObject({ status: 'no-verified-point', point: null, attempts: 9 });
  expect(inspector.findInteractionPoint(initial.generation!, target, bounds)).toMatchObject({ status: 'stale', point: null, attempts: 0 });
  inspector.dispose();
});

it('rejects invalid bounds and target handles without geometry work', () => {
  const canvas = host(); controller = pibbl(canvas, <Rectangle style={{ width: 100, height: 100, fill: '#00f' }} onClick={() => undefined} />); driver.flush(1);
  const inspector = createTargetingInspector(canvas); const snapshot = inspector.snapshot();
  const target = inspector.probe(snapshot.generation!, 5, 5).targetId!;
  for (const bounds of [{ x: NaN, y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: 0, height: 1 }, { x: Number.MAX_VALUE, y: 0, width: Number.MAX_VALUE, height: 1 }]) {
    expect(inspector.findInteractionPoint(snapshot.generation!, target, bounds)).toMatchObject({ status: 'invalid', attempts: 0, nativeCalls: 0 });
  }
  expect(inspector.findInteractionPoint(snapshot.generation!, 99999, { x: 0, y: 0, width: 100, height: 100 })).toMatchObject({ status: 'unknown-target', attempts: 0 });
  inspector.dispose();
  expect(inspector.findInteractionPoint(snapshot.generation!, target, { x: 0, y: 0, width: 100, height: 100 })).toMatchObject({ status: 'unavailable', attempts: 0 });
});
