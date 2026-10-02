import { crc } from '@crc/core';
import { expect, it } from 'vitest';
import { AgentLayoutPlacementScene } from '../../scenarios/src/agent-layout-placement.example';
import { createTargetingInspector } from '../../../tooling/agent-verification/targeting';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing';

it('separates parent placement, shape-local offsets and intentional clipping through nested transforms', () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 240;
  canvas.style.cssText = 'width:400px;height:240px'; document.body.append(canvas);
  try {
    for (const [mode, localX, rootX, expected] of [
      ['clipped', 90, 300, 'miss'], ['overflow-visible', 90, 300, 'target'], ['repaired', 0, 120, 'target'],
    ] as const) {
      let allocation: unknown;
      const mount = crc(canvas, <AgentLayoutPlacementScene mode={mode} onAllocation={box => { allocation = box; }} />, { pixelRatio: 1 });
      let inspector: ReturnType<typeof createTargetingInspector> | undefined;
      try {
        driver.flush(1);
        inspector = createTargetingInspector(canvas);
        const snapshot = inspector.snapshot();
        expect(snapshot.status).toBe('ready');
        expect(allocation).toEqual({ x: 0, y: 0, width: 20, height: 20 });
        expect(snapshot.records).toHaveLength(1);
        const entry = snapshot.records[0];
        // Group translation (40,30), scale 2, then parent placement (30,20).
        // The shape's x remains a separate coordinate in this placed space.
        expect(entry.transform).toEqual([2, 0, 0, 2, 100, 70]);
        expect(inspector.convert(snapshot.generation!, 'entry-local', 'root-logical', { x: localX + 10, y: 10 }, 'point', entry.order)).toMatchObject({ status: 'mapped', value: { x: rootX, y: 90 } });
        const probe = inspector.probe(snapshot.generation!, rootX, 90);
        expect(probe.status).toBe(expected);
        expect(probe.candidates[0]).toMatchObject({ geometry: 'hit', outcome: mode === 'clipped' ? 'clip-excluded' : 'hit' });
        const pixel = canvas.getContext('2d')!.getImageData(rootX, 90, 1, 1).data;
        expect([...pixel]).toEqual(mode === 'clipped' ? [0, 0, 0, 0] : [37, 99, 235, 255]);
      } finally { inspector?.dispose(); mount.dispose(); }
    }
  } finally { canvas.remove(); restore(); }
});
