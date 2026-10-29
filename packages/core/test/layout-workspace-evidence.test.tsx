import { expect, it } from 'vitest';
import { createElement } from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { WasmLayoutWorkspaceExample } from '../../scenarios/src/learning/layout/wasm-layout-workspace.example.js';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing.js';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region.js';

it.runIf(nativeLayout)('reflows the public workspace while preserving card and hidden-sidebar state', () => {
  const before = snapshotWasmLayoutDiagnostics();
  const canvas = document.createElement('canvas'); canvas.width = 760; canvas.height = 500; document.body.append(canvas);
  const context = canvas.getContext('2d')!, nativeFillText = context.fillText;
  let labels: string[] = [];
  context.fillText = function(text, x, y, maxWidth) { labels.push(text); if (maxWidth === undefined) nativeFillText.call(this, text, x, y); else nativeFillText.call(this, text, x, y, maxWidth); };
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(WasmLayoutWorkspaceExample, {}));
  let frame = 0;
  const render = () => { labels = []; driver.flush(++frame); };
  const click = (x: number, y: number) => { const bounds = canvas.getBoundingClientRect(); for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + y })); render(); };
  try {
    render(); expect(labels).toContain('A workspace that reflows');
    const sidebarIdentity = labels.find(text => text.startsWith('Identity ')); expect(sidebarIdentity).toBeDefined();
    click(200, 160); const cardIdentity = labels.find(text => text.startsWith('Clicks 1')); expect(cardIdentity).toBeDefined();
    click(50, 205); expect(labels).toContain('Visits 1');
    click(50, 70); expect(labels).toContain(cardIdentity); expect(labels).toContain(sidebarIdentity);
    click(220, 70); expect(labels).not.toContain(sidebarIdentity); expect(labels).toContain(cardIdentity);
    click(220, 70); expect(labels).toContain(sidebarIdentity); expect(labels).toContain('Visits 1'); expect(labels).toContain(cardIdentity);
    controller.dispose(); const after = snapshotWasmLayoutDiagnostics();
    expect([after.activeNodes, after.activeArenas, after.activeGridArenas, after.activeWasmInstances, after.cachedMeasurements]).toEqual([before.activeNodes, before.activeArenas, before.activeGridArenas, before.activeWasmInstances, before.cachedMeasurements]);
  } finally { controller.dispose(); restore(); context.fillText = nativeFillText; canvas.remove(); }
});
