import { expect, it } from 'vitest';
import { Grid, Rectangle, createElement, signal, type GridTrack } from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing.js';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region.js';

it.runIf(nativeLayout)('owns and releases the additional native Grid arena exactly across removal and root disposal', () => {
  const diagnostics = () => snapshotWasmLayoutDiagnostics() as unknown as Record<string, number>;
  const before = diagnostics();
  expect(before.activeGridArenas).toBe(0);
  const shown = signal(true), fill = signal('#426b61');
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100; document.body.append(canvas);
  function Scene() { return shown.get() ? createElement(Grid, { style: { width: 100, height: 100, gridTemplateColumns: ['1fr'] as readonly GridTrack[], gridTemplateRows: [100] }, children: createElement(Rectangle, { style: { width: 100, height: 100, fill } }) }) : null; }
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Scene, {}));
  try {
    driver.flush(1);
    const mounted = diagnostics(); expect(mounted.activeGridArenas).toBe(1);
    fill.set('#19375b'); driver.flush(2);
    expect(diagnostics().gridArenaCreates).toBe(mounted.gridArenaCreates);
    shown.set(false); driver.flush(3); expect(diagnostics().activeGridArenas).toBe(0);
    shown.set(true); driver.flush(4); expect(diagnostics().activeGridArenas).toBe(1);
    controller.dispose(); expect(diagnostics().activeGridArenas).toBe(0);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});
