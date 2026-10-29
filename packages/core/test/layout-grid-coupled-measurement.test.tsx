import { beforeAll, expect, it } from 'vitest';
import { Grid, Text, Rectangle, createElement, measureElement, type CanvasMeasurementService } from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded.js';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing.js';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region.js';

beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
const words = 'aa bb cc dd ee ff gg hh ii jj';
function text(width: number | 'auto') { return createElement(Text, { children: words, style: { width, height: 'auto', wrap: true, font: '10px monospace', lineHeight: 10, gridColumnStart: 1, gridRowStart: 1, fill: '#19375b' } }); }
function service(context: CanvasRenderingContext2D): CanvasMeasurementService { return { measureText: (value, font) => { context.font = font; return context.measureText(value); } }; }
function naturalHeight(context: CanvasRenderingContext2D): number { const result = measureElement(text(100), { minWidth: 100, maxWidth: 100, minHeight: 0, maxHeight: 1000 }, service(context)); expect(result.status).toBe('measured'); if (result.status !== 'measured') throw new Error(result.reason); expect(result.size.height).toBe(20); return result.size.height; }

it.runIf(nativeLayout)('measures automatic Grid rows at the declared column width', () => {
  const context = document.createElement('canvas').getContext('2d')!, expected = naturalHeight(context);
  const grid = createElement(Grid, { style: { width: 100, height: 'auto', gridTemplateColumns: [100], gridTemplateRows: ['auto', 10] }, children: [text('auto'), createElement(Rectangle, { style: { width: 100, height: 10, gridColumnStart: 1, gridRowStart: 2 } })] });
  expect(measureElement(grid, { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight: 1000 }, service(context))).toEqual({ status: 'measured', size: { width: 100, height: expected + 10 } });
});

it.runIf(nativeLayout)('publishes the following target after final-column Text wrapping instead of word-width height', () => {
  const before = snapshotWasmLayoutDiagnostics(), canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 160; document.body.append(canvas);
  const context = canvas.getContext('2d')!, expected = naturalHeight(context); let hits = 0;
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Grid, { style: { width: 100, height: 160, gridTemplateColumns: [100], gridTemplateRows: ['auto', 10] }, children: [text('auto'), createElement(Rectangle, { onClick: () => hits++, style: { width: 100, height: 10, gridColumnStart: 1, gridRowStart: 2, fill: '#426b61' } })] }));
  try {
    driver.flush(1);
    expect([...context.getImageData(5, expected + 4, 1, 1).data]).toEqual([66, 107, 97, 255]);
    const bounds = canvas.getBoundingClientRect(); for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left + 5, clientY: bounds.top + expected + 4 }));
    expect(hits).toBe(1);
    controller.dispose(); const after = snapshotWasmLayoutDiagnostics();
    expect([after.activeNodes, after.activeArenas, after.activeGridArenas, after.activeWasmInstances]).toEqual([before.activeNodes, before.activeArenas, before.activeGridArenas, before.activeWasmInstances]);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});
