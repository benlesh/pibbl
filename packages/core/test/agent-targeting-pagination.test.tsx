import { Layer, Rectangle, pibbl, signal } from '@pibbl/core';
import { expect, it } from 'vitest';
import { createTargetingInspector } from '../../../tooling/agent-verification/targeting';
import { ManualSchedulerDriver, installSchedulerDriverForTest, snapshotRealmScheduler } from '../src/lib/scheduler/testing';

it('pages one bounded scene generation and expires continuations on updates, replacement and disposal', () => {
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 240; document.body.append(canvas);
  const color = signal('red'); let renders = 0;
  function Scene() { renders++; return Array.from({ length: 100 }, (_, i) => <Rectangle style={{ left: i, top: 0, width: 1, height: 1, fill: color.get() }} onClick={() => undefined} />); }
  const controller = pibbl(canvas, <Scene />); driver.flush(1);
  const inspector = createTargetingInspector(canvas);
  try {
    expect(inspector.snapshot().records).toHaveLength(64);
    const scheduler = snapshotRealmScheduler(); const rendered = renders;
    const first = inspector.page();
    expect(first.status).toBe('ready'); expect(first.totalRecords).toBe(100);
    const records = [...first.records]; let next = first.nextCursor;
    while (next) { const page = inspector.page(next); expect(page.generation).toEqual(first.generation); records.push(...page.records); next = page.nextCursor; }
    expect(records.map(record => record.order)).toEqual(Array.from({ length: 100 }, (_, i) => i));
    expect(new Set(records.map(record => record.targetId)).size).toBe(100);
    expect(renders).toBe(rendered); expect(snapshotRealmScheduler()).toEqual(scheduler);
    expect(Object.isFrozen(first.records)).toBe(true); expect(Object.isFrozen(first.records[0])).toBe(true);
    color.set('blue');
    expect(inspector.page(first.nextCursor!).status).toBe('cursor-expired');
    driver.flush(2);
    const refreshed = inspector.page(); expect(refreshed.generation).not.toEqual(first.generation);
    inspector.page(); // At most one retained expansion per inspector.
    expect(inspector.page(refreshed.nextCursor!).status).toBe('cursor-expired');
    expect(inspector.page('invalid').status).toBe('invalid');
    const last = inspector.page(); inspector.dispose();
    expect(inspector.page(last.nextCursor!).status).toBe('cursor-expired');
    expect(inspector.page().status).toBe('unavailable');
    expect(first.records).toHaveLength(32);
  } finally { inspector.dispose(); controller.dispose(); restore(); canvas.remove(); }
});

it('reports bounded expansion truncation rather than implying the last page is the whole scene', () => {
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); document.body.append(canvas);
  function Scene() { return Array.from({ length: 300 }, (_, i) => <Rectangle style={{ left: i, top: 0, width: 1, height: 1, fill: 'red' }} onClick={() => undefined} />); }
  const controller = pibbl(canvas, <Scene />); driver.flush(1); const inspector = createTargetingInspector(canvas);
  try {
    let page = inspector.page(); let count = page.records.length;
    while (page.nextCursor) { page = inspector.page(page.nextCursor); count += page.records.length; }
    expect(count).toBe(256); expect(page.completeness).toBe('truncated'); expect(page.totalRecords).toBeNull();
    expect(page.retainedRecords).toBe(256); expect(page.remaining).toBe(0);
  } finally { inspector.dispose(); controller.dispose(); restore(); canvas.remove(); }
});

it('expires a cursor when a nested Layer beyond the first page changes', () => {
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 240; document.body.append(canvas);
  const offset = signal(1);
  function Child() { return <Rectangle style={{ left: offset.get(), top: 0, width: 10, height: 10, fill: 'red' }} onClick={() => undefined} />; }
  function Scene() { return <>
    {Array.from({ length: 70 }, (_, i) => <Rectangle style={{ left: i, top: 0, width: 1, height: 1, fill: 'red' }} onClick={() => undefined} />)}
    <Layer style={{ width: 100, height: 100 }}><Child /></Layer>
  </>; }
  const controller = pibbl(canvas, <Scene />); driver.flush(1); const inspector = createTargetingInspector(canvas);
  try {
    const first = inspector.page(); expect(first.totalRecords).toBeGreaterThan(70);
    offset.set(20);
    expect(inspector.page(first.nextCursor!).status).toBe('cursor-expired');
    driver.flush(2);
    const fresh = inspector.page(); expect(fresh.status).toBe('ready');
    const records = [...fresh.records]; let next = fresh.nextCursor;
    while (next) { const page = inspector.page(next); records.push(...page.records); next = page.nextCursor; }
    expect(records.some(record => record.surfacePath.length > 0)).toBe(true);
    controller.dispose();
    expect(inspector.page(fresh.nextCursor!).status).toBe('cursor-expired');
  } finally { inspector.dispose(); controller.dispose(); restore(); canvas.remove(); }
});

it('rejects malformed and foreign cursors without destroying a valid expansion and prevents remount reuse', () => {
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); document.body.append(canvas);
  function Scene() { return Array.from({ length: 70 }, (_, i) => <Rectangle style={{ left: i, top: 0, width: 1, height: 1, fill: 'red' }} onClick={() => undefined} />); }
  let controller = pibbl(canvas, <Scene />); driver.flush(1);
  const inspector = createTargetingInspector(canvas); const other = createTargetingInspector(canvas);
  try {
    const first = inspector.page(); const cursor = first.nextCursor!;
    for (const invalid of [cursor + '\n', '0' + cursor, cursor.replace(/\d+$/, '33'), cursor.replace(/\d+$/, '9999999999999999999999999'), 'x'.repeat(97)]) {
      expect(inspector.page(invalid).status).toBe('invalid');
    }
    expect(other.page(cursor).status).toBe('cursor-expired');
    const resumed = inspector.page(cursor);
    expect(resumed.status).toBe('ready'); expect(resumed.records[0].order).toBe(32);
    expect(inspector.page(cursor)).toEqual(resumed); // Re-reading does not consume a cursor.
    expect(inspector.page(cursor.replace(/\d+$/, '96')).status).toBe('invalid');
    controller.dispose(); controller = pibbl(canvas, <Scene />); driver.flush(2);
    expect(inspector.page(cursor)).toMatchObject({ status: 'cursor-expired', records: [] });
    expect(inspector.page().status).toBe('unavailable');
    const replacement = createTargetingInspector(canvas);
    try { expect(replacement.page(cursor).status).toBe('cursor-expired'); expect(replacement.page().status).toBe('ready'); }
    finally { replacement.dispose(); }
  } finally { inspector.dispose(); other.dispose(); controller.dispose(); restore(); canvas.remove(); }
});
