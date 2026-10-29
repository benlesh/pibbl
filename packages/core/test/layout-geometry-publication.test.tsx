import { expect, it } from 'vitest';
import { Flex, Rectangle, createElement, signal, type BoxStyle, type FlexItemStyle } from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { GLOBAL_STATE } from '../src/lib/global-state.js';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing.js';
import { snapshotLayoutGeometry } from '../src/lib/layout/geometry-publication.js';

it('publishes immutable matching geometry batches and clears failed generations', () => {
  const width = signal(20), broken = signal(false);
  let hits = 0;
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 40;
  document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  function Child(_props: { readonly style: BoxStyle & FlexItemStyle }) {
    if (broken.get()) throw new Error('geometry failure');
    return createElement(Rectangle, { onClick: () => hits++, style: { width: 20, height: 10, fill: '#426b61' } });
  }
  const controller = pibblSync(canvas, createElement(Flex, { style: { width: 100, height: 40 }, children: [
    createElement(Rectangle, { key: 'sized', style: { width, height: 10, minWidth: 0, flexShrink: 0 } }),
    createElement(Child, { key: 'child', style: { width: 20, height: 10, minWidth: 0, flexShrink: 0 } }),
  ] }));
  const owner = GLOBAL_STATE.pibblInstances.get(canvas)!;
  try {
    expect(snapshotLayoutGeometry(owner).boxes).toHaveLength(0);
    driver.flush(1);
    const first = snapshotLayoutGeometry(owner);
    expect(first.boxes.some(box => box.x === 20 && box.width === 20)).toBe(true);
    expect(Object.isFrozen(first.boxes)).toBe(true);
    expect(Object.isFrozen(first.boxes[0])).toBe(true);
    expect(first.boxes.every(box => Number.isSafeInteger(box.nodeId))).toBe(true);
    expect(first.boxes.every(box => !('component' in box))).toBe(true);
    width.set(30); driver.flush(2);
    const second = snapshotLayoutGeometry(owner);
    expect(second.generation).toBeGreaterThan(first.generation);
    expect(second.boxes.some(box => box.x === 30 && box.width === 20)).toBe(true);
    expect(second.changed.some(change => change.previous?.x === 20 && change.current?.x === 30)).toBe(true);
    const click = () => {
      const bounds = canvas.getBoundingClientRect();
      for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left + 35, clientY: bounds.top + 5 }));
    };
    click(); expect(hits).toBe(1);
    expect(first.boxes.some(box => box.width === 20)).toBe(true);
    broken.set(true);
    expect(() => driver.flush(3)).toThrow('geometry failure');
    expect(snapshotLayoutGeometry(owner).boxes).toHaveLength(0);
    click(); expect(hits).toBe(1);
  } finally { controller.dispose(); restore(); canvas.remove(); }
  expect(snapshotLayoutGeometry(owner).boxes).toHaveLength(0);
});
