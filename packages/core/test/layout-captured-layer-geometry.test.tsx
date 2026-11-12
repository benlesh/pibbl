import { expect, it } from 'vitest';
import { Group, Layer as ManagedLayer, HtmlBox, defineRenderLayer, createElement, signal } from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing.js';

it('composes committed managed-Layer bridges for captured external input without repainting clean children', () => {
  const wrapper = document.createElement('div'); wrapper.style.cssText = 'position:relative;width:100px;height:40px;isolation:isolate';
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 40;
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  const overlay = document.createElement('div'); overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1';
  wrapper.append(canvas, overlay); document.body.append(wrapper);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const translateX = signal(20), points: number[] = [];
  let renders = 0;
  const Renderer = defineRenderLayer<{}, {}, object>({
    create(context) { context.canvas.getContext('2d'); return {}; }, render() { renders++; },
    interaction: { settle() { return { targets: [], hitTest: () => ({ kind: 'block' }), onInput(input) {
      if (input.type === 'pointerdown') input.setPointerCapture((input.originalEvent as PointerEvent).pointerId);
      if (input.type === 'pointermove') points.push(input.point.x);
    } }; } },
  });
  const pointer = (type: string) => {
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 11, pointerType: 'mouse', button: 0, buttons: 1,
      clientX: rect.left + 25, clientY: rect.top + 5 }));
  };
  const scene = createElement(Group, { children: [
    createElement(Group, { style: { translateX }, children: createElement(ManagedLayer, { style: { width: 20, height: 20 },
      children: createElement(Renderer, { style: { width: 20, height: 20 } }) }) }),
    createElement(HtmlBox, { mount: () => () => pointer('pointermove'), data: 0, style: { left: 80, width: 10, height: 10 } }),
  ] });
  const controller = pibblSync(canvas, scene, { htmlOverlay: overlay });
  try {
    driver.flush(1); pointer('pointerdown'); pointer('pointermove');
    expect(points).toEqual([5]);
    translateX.set(60); driver.flush(2);
    expect(points).toEqual([5, 5]); expect(renders).toBe(1);
    pointer('pointermove'); expect(points).toEqual([5, 5, -35]);
  } finally { controller.dispose(); restore(); wrapper.remove(); }
});
