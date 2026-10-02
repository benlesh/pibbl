import { Clip, Group, Rectangle, crc, type CRCController } from '@crc/core';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createTargetingInspector } from '../../../tooling/agent-verification/targeting';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing';
import { clickMouse } from './support/mouse-input';

let driver: ManualSchedulerDriver; let restore: () => void; let controller: CRCController | undefined;
beforeEach(() => { driver = new ManualSchedulerDriver(); restore = installSchedulerDriverForTest(driver); });
afterEach(() => { controller?.dispose(); restore(); document.body.replaceChildren(); });

it('probes transformed clipped targets using the current targeting inspector contract', async () => {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 200; canvas.style.cssText = 'width:200px;height:200px'; document.body.append(canvas);
  let clicks = 0; const clip = new Path2D(); clip.rect(0, 0, 90, 90);
  controller = crc(canvas, <Group style={{ translateX: 20, translateY: 20 }}>
    <Clip style={{ d: clip }}><Rectangle style={{ width: 120, height: 120, fill: '#00f' }} onClick={() => clicks++} /></Clip>
    <Rectangle style={{ left: 40, width: 80, height: 120, fill: '#f00' }} />
  </Group>, { pixelRatio: 1 });
  driver.flush(1);
  const inspector = createTargetingInspector(canvas); const snapshot = inspector.snapshot();
  const target = inspector.probe(snapshot.generation!, 30, 30).targetId;
  expect(target).toBeDefined();
  expect(inspector.probe(snapshot.generation!, 80, 80).targetId).not.toBe(target);
  await clickMouse(canvas, { x: 30, y: 30 }); expect(clicks).toBe(1); inspector.dispose();
});
