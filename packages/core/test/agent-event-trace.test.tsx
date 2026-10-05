import { Rectangle, pibbl, useEventListener, type PibblController, type PibblEvent } from '@pibbl/core';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createEventTrace } from '../../../tooling/agent-verification/events';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing';
import { clickMouse } from './support/mouse-input';

let driver: ManualSchedulerDriver;
let restore: () => void;
let controller: PibblController | undefined;
beforeEach(() => { driver = new ManualSchedulerDriver(); restore = installSchedulerDriverForTest(driver); });
afterEach(() => { controller?.dispose(); controller = undefined; restore(); document.body.replaceChildren(); });
function host() {
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100;
  canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas); return canvas;
}

it('records native capture, target and bubble invocations without changing application delivery', async () => {
  const trace = createEventTrace(); const canvas = host(); let selections = 0;
  function Scene() {
    useEventListener({ onClickCapture: trace.wrap('parent-capture', () => undefined), onClick: trace.wrap('parent-bubble', () => undefined) });
    return <Rectangle style={{ width: 80, height: 80, fill: '#00f' }}
      onClickCapture={trace.wrap('target-capture', () => undefined)}
      onClick={trace.wrap('target-click', event => { event.preventDefault(); selections++; })} />;
  }
  controller = pibbl(canvas, <Scene />, { pixelRatio: 1 }); driver.flush(1);
  await clickMouse(canvas, { x: 20, y: 20 });
  const snapshot = trace.snapshot();
  expect(selections).toBe(1);
  expect(snapshot).toMatchObject({ status: 'recording', scope: 'wrapped-handlers-only', dropped: 0 });
  const entries = snapshot.records.filter(record => record.stage === 'enter');
  expect(entries.map(record => [record.label, record.phase])).toEqual([
    ['parent-capture', 1], ['target-capture', 2], ['target-click', 2], ['parent-bubble', 3],
  ]);
  expect(new Set(entries.map(record => record.eventId)).size).toBe(1);
  expect(new Set(entries.map(record => record.invocationId)).size).toBe(4);
  expect(entries.every(record => record.type === 'click' && record.original.isTrusted)).toBe(true);
  expect(entries[0].targetId).toBe(entries[2].currentTargetId);
  expect(entries[0].currentTargetId).toBe(entries[3].currentTargetId);
  expect(entries[0].path).toEqual({ order: 'root-to-target', completeness: 'complete', total: 2, ids: [entries[0].currentTargetId, entries[0].targetId] });
  expect(snapshot.records.filter(record => record.stage === 'return').map(record => record.defaultPrevented)).toEqual([false, false, true, true]);
  expect(Object.isFrozen(snapshot.records[0].path.ids)).toBe(true);
  trace.stop(); await clickMouse(canvas, { x: 20, y: 20 });
  expect(selections).toBe(2); expect(trace.snapshot().records).toEqual(snapshot.records);
  trace.dispose(); expect(trace.snapshot()).toMatchObject({ status: 'disposed', records: [] });
  expect(snapshot.records).toHaveLength(8);
});

it('keeps bounded history explicit and never invents handlers skipped by propagation', async () => {
  const trace = createEventTrace({ capacity: 3, pathLimit: 1 }); const canvas = host();
  function Scene() {
    useEventListener({ onClickCapture: trace.wrap('capture-stop', event => event.stopPropagation()), onClick: trace.wrap('unreached', () => undefined) });
    return <Rectangle style={{ width: 80, height: 80, fill: '#00f' }} onClick={trace.wrap('unreached-target', () => undefined)} />;
  }
  controller = pibbl(canvas, <Scene />); driver.flush(1);
  await clickMouse(canvas, { x: 20, y: 20 }); await clickMouse(canvas, { x: 20, y: 20 });
  const snapshot = trace.snapshot();
  expect(snapshot).toMatchObject({ dropped: 1, capacity: 3, completeness: 'truncated-history' });
  expect(snapshot.records.map(record => record.label)).toEqual(['capture-stop', 'capture-stop', 'capture-stop']);
  expect(snapshot.records[0]).toMatchObject({ sequence: 2, stage: 'return', path: { completeness: 'truncated', total: 2 } });
  expect(snapshot.records[0].path.ids).toHaveLength(1);
  expect(snapshot.records[0].eventId).not.toBe(snapshot.records[1].eventId);
  trace.dispose();
});

it('preserves handler return values and thrown identity without serializing event payloads or errors', async () => {
  const trace = createEventTrace(); const canvas = host(); let delivered: PibblEvent | undefined;
  controller = pibbl(canvas, <Rectangle style={{ width: 80, height: 80, fill: '#00f' }} onClick={event => { delivered = event; }} />); driver.flush(1);
  await clickMouse(canvas, { x: 20, y: 20 });
  const secret = { get privateValue() { throw new Error('must not read'); } };
  expect(trace.wrap('return', () => secret)(delivered!)).toBe(secret);
  expect(() => trace.wrap('throw', () => { throw secret; })(delivered!)).toThrow();
  try { trace.wrap('identity', () => { throw secret; })(delivered!); } catch (error) { expect(error).toBe(secret); }
  expect(trace.snapshot().records.map(record => record.stage)).toEqual(['enter', 'return', 'enter', 'throw', 'enter', 'throw']);
  expect(JSON.stringify(trace.snapshot())).not.toContain('privateValue');
  expect(() => createEventTrace({ capacity: 0 })).toThrow(RangeError);
  expect(() => createEventTrace({ pathLimit: 65 })).toThrow(RangeError);
  expect(() => trace.wrap('x'.repeat(65), () => undefined)).toThrow(RangeError);
  trace.dispose();
});
