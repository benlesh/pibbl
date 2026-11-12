import { expect, it, vi } from 'vitest';
import { Flex, Rectangle, HtmlBox, defineRenderLayer, FocusManagement, Clip, PathGeometry, useEventTarget, createElement, signal, type BoxStyle, type FlexItemStyle } from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { GLOBAL_STATE } from '../src/lib/global-state.js';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing.js';
import { snapshotLayoutGeometry } from '../src/lib/layout/geometry-publication.js';
import type { PibblFocusManager } from '../src/lib/focus/focus-manager.js';

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


it('keeps hit, focus and HTML geometry on the committed generation during fallible publication', () => {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;width:100px;height:40px;isolation:isolate';
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 40;
  canvas.style.cssText = 'display:block;width:100%;height:100%;border:0;padding:0';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1';
  wrapper.append(canvas, overlay); document.body.append(wrapper);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const width = signal(20);
  let fail = false, hits = 0;
  const observed: { candidatePixelAlpha: number; htmlX: number; oldHit: number; newHit: number; focusX: number | undefined; generation: number }[] = [];
  const click = (x: number) => {
    const bounds = canvas.getBoundingClientRect();
    for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, {
      bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + 5,
    }));
  };
  const mount = (content: HTMLDivElement) => () => {
    const before = hits; click(25); const oldHit = hits - before;
    const afterOld = hits; click(65); const newHit = hits - afterOld;
    observed.push({ candidatePixelAlpha: canvas.getContext('2d')!.getImageData(65, 5, 1, 1).data[3]!, htmlX: new DOMMatrix(content.parentElement!.style.transform).e,
      oldHit, newHit, focusX: (owner.eventRoot.focusPolicy as PibblFocusManager).candidates[0]?.rootBounds?.x, generation: snapshotLayoutGeometry(owner).generation });
    if (fail) throw new Error('late HTML publication failure');
  };
  const scene = createElement(FocusManagement, { children: createElement(Flex, {
    style: { width: 100, height: 40, alignItems: 'flex-start' }, children: [
      createElement(Rectangle, { style: { width, height: 10, minWidth: 0, flexShrink: 0 } }),
      createElement(Rectangle, { keyboardFocusable: true, onClick: () => hits++, style: { width: 10, height: 10, minWidth: 0, flexShrink: 0, fill: '#426b61' } }),
      createElement(HtmlBox, { mount, data: 0, style: { width: 10, height: 10, minWidth: 0, flexShrink: 0 } }),
    ],
  }) });
  const controller = pibblSync(canvas, scene, { htmlOverlay: overlay });
  const owner = GLOBAL_STATE.pibblInstances.get(canvas)!;
  try {
    driver.flush(1);
    const initialHits = hits; click(25); expect(hits).toBe(initialHits + 1);
    const first = snapshotLayoutGeometry(owner);
    width.set(60); driver.flush(2);
    expect(observed).toEqual([{ candidatePixelAlpha: 255, htmlX: 30, oldHit: 1, newHit: 0, focusX: 20, generation: first.generation }]);
    expect(new DOMMatrix(overlay.querySelector<HTMLElement>('[data-pibbl-html-box]')!.style.transform).e).toBe(70);
    const before = hits; click(65); expect(hits).toBe(before + 1);
    fail = true; width.set(40);
    expect(() => driver.flush(3)).toThrow('late HTML publication failure');
    expect(snapshotLayoutGeometry(owner).boxes).toHaveLength(0);
    expect(overlay.childNodes).toHaveLength(0);
    const failedHits = hits; click(45); click(65); expect(hits).toBe(failedHits);
    fail = false; pibblSync(canvas, scene); driver.flush(4);
    expect(overlay.querySelectorAll('[data-pibbl-html-box]')).toHaveLength(1);
    const recoveredHits = hits; click(45); expect(hits).toBe(recoveredHits + 1);
  } finally { controller.dispose(); restore(); wrapper.remove(); }
});


it('owns immutable native paths until the next successful geometry adoption', () => {
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 20;
  document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const path = new Path2D(); path.rect(0, 0, 10, 10);
  let hits = 0;
  function Target() { useEventTarget({ onClick: () => hits++ }, { path, fill: true }); return null; }
  const scene = createElement(Target, {});
  const controller = pibblSync(canvas, scene);
  const click = (x: number) => {
    const bounds = canvas.getBoundingClientRect();
    for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, {
      bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + 5,
    }));
  };
  try {
    driver.flush(1); click(5); expect(hits).toBe(1);
    path.rect(40, 0, 10, 10);
    click(45); expect(hits).toBe(1);
    pibblSync(canvas, scene); driver.flush(2);
    click(45); expect(hits).toBe(2);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});


it('does not mix focus, hit and HTML generations while deactivating a focused clipped host', () => {
  const wrapper = document.createElement('div'); wrapper.style.cssText = 'position:relative;width:100px;height:40px;isolation:isolate';
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 40;
  canvas.style.cssText = 'display:block;width:100%;height:100%;border:0;padding:0';
  const overlay = document.createElement('div'); overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1';
  wrapper.append(canvas, overlay); document.body.append(wrapper);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const width = signal(20), height = signal(10);
  const initialClip = new PathGeometry(); initialClip.rect(0, 0, 100, 40);
  const clip = signal(initialClip);
  let input!: HTMLInputElement;
  const observations: { generation: number; htmlX: number; focusX: number | undefined }[] = [];
  const mount = (content: HTMLDivElement) => {
    input = document.createElement('input'); content.append(input);
    input.addEventListener('blur', () => observations.push({
      generation: snapshotLayoutGeometry(owner).generation,
      htmlX: new DOMMatrix(content.parentElement!.style.transform).e,
      focusX: (owner.eventRoot.focusPolicy as PibblFocusManager).candidates[0]?.rootBounds?.x,
    }));
    return () => {};
  };
  const controller = pibblSync(canvas, createElement(FocusManagement, { children: createElement(Clip, {
    style: { d: clip }, children: createElement(Flex, { style: { width: 100, height: 40 }, children: [
      createElement(Rectangle, { style: { width, height: 10, minWidth: 0, flexShrink: 0 } }),
      createElement(Rectangle, { keyboardFocusable: true, onClick: () => {}, style: { width: 10, height: 10, minWidth: 0, flexShrink: 0, fill: '#426b61' } }),
      createElement(HtmlBox, { mount, data: 0, style: { width: 10, height, minWidth: 0, flexShrink: 0 } }),
    ] }),
  }) }), { htmlOverlay: overlay });
  const owner = GLOBAL_STATE.pibblInstances.get(canvas)!;
  try {
    driver.flush(1); input.focus(); expect(document.activeElement).toBe(input);
    const first = snapshotLayoutGeometry(owner).generation;
    const nextClip = new PathGeometry(); nextClip.rect(0, 0, 90, 40);
    width.set(60); height.set(0); clip.set(nextClip); driver.flush(2);
    expect(observations.length).toBeGreaterThan(0);
    for (const observed of observations) {
      if (observed.generation === first) expect(observed).toEqual({ generation: first, htmlX: 30, focusX: 20 });
      else expect(observed).toEqual({ generation: snapshotLayoutGeometry(owner).generation, htmlX: 70, focusX: 60 });
    }
    expect((owner.eventRoot.focusPolicy as PibblFocusManager).candidates[0]?.rootBounds?.x).toBe(60);
    expect(overlay.querySelector<HTMLElement>('[data-pibbl-html-box]')!.style.visibility).toBe('hidden');
  } finally { controller.dispose(); restore(); wrapper.remove(); }
});


it('keeps captured external input in the committed coordinate frame through placement-only publication', () => {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;width:100px;height:40px;isolation:isolate';
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 40;
  canvas.style.cssText = 'display:block;width:100%;height:100%;border:0;padding:0';
  const overlay = document.createElement('div'); overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1';
  wrapper.append(canvas, overlay); document.body.append(wrapper);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const width = signal(20);
  const points: number[] = [];
  let renders = 0;
  const Layer = defineRenderLayer<{}, {}, object>({
    create(context) { context.canvas.getContext('2d'); return {}; },
    render() { renders++; },
    interaction: { settle() { return {
      targets: [], hitTest: () => ({ kind: 'block' }),
      onInput(input) {
        if (input.type === 'pointerdown') input.setPointerCapture((input.originalEvent as PointerEvent).pointerId);
        if (input.type === 'pointermove') points.push(input.point.x);
      },
    }; } },
  });
  const pointer = (type: string) => {
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 9, pointerType: 'mouse', button: 0, buttons: 1,
      clientX: rect.left + 25, clientY: rect.top + 5 }));
  };
  const scene = createElement(Flex, { style: { width: 100, height: 40, alignItems: 'flex-start' }, children: [
    createElement(Rectangle, { style: { width, height: 10, minWidth: 0, flexShrink: 0 } }),
    createElement(Layer, { style: { width: 10, height: 10, minWidth: 0, flexShrink: 0 } }),
    createElement(HtmlBox, { mount: () => () => pointer('pointermove'), data: 0, style: { width: 10, height: 10, minWidth: 0, flexShrink: 0 } }),
  ] });
  const controller = pibblSync(canvas, scene, { htmlOverlay: overlay });
  try {
    driver.flush(1); pointer('pointerdown');
    width.set(60); driver.flush(2);
    expect(points).toEqual([5]);
    expect(renders).toBe(1);
    pointer('pointermove'); expect(points).toEqual([5, -35]);
  } finally { controller.dispose(); restore(); wrapper.remove(); }
});


it('releases unadopted clean renderer registrations when an HTML updater disposes the controller', () => {
  const wrapper = document.createElement('div'); wrapper.style.cssText = 'position:relative;width:100px;height:40px;isolation:isolate';
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 40;
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  const overlay = document.createElement('div'); overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1';
  wrapper.append(canvas, overlay); document.body.append(wrapper);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  let renders = 0;
  const target = {};
  const Layer = defineRenderLayer<{}, {}, object>({
    create(context) { context.canvas.getContext('2d'); return {}; }, render() { renders++; },
    interaction: { settle() { return { targets: [{ target, handlers: { onClick: () => {} } }],
      hitTest: () => ({ kind: 'target', target }) }; } },
  });
  let disposeDuringUpdate = false;
  const mount = () => () => {
    if (disposeDuringUpdate) {
      const refs = Array.from(GLOBAL_STATE.pibblInstances.get(canvas)!.refs.values()).find(refs => refs.element.type === Layer);
      expect(refs).toBeDefined();
      refs!.teardowns.execute();
    }
  };
  const scene = (enabled: boolean) => createElement(Flex, { style: { width: 100, height: 40 }, children: [
    createElement(Layer, { pointerEvents: enabled ? 'auto' : 'none', style: { width: 20, height: 20, minWidth: 0, flexShrink: 0 } }),
    createElement(HtmlBox, { mount, data: 0, style: { width: 10, height: 10, minWidth: 0, flexShrink: 0 } }),
  ] });
  const controller = pibblSync(canvas, scene(false), { htmlOverlay: overlay });
  const hub = GLOBAL_STATE.pibblInstances.get(canvas)!.eventRoot.nativeListeners!;
  const releases: ReturnType<typeof vi.fn>[] = [];
  let spy: ReturnType<typeof vi.spyOn> | undefined;
  try {
    driver.flush(1);
    const acquire = hub.acquire.bind(hub);
    spy = vi.spyOn(hub, 'acquire').mockImplementation(type => {
      const release = vi.fn(acquire(type)); releases.push(release); return release;
    });
    disposeDuringUpdate = true; pibblSync(canvas, scene(true)); driver.flush(2);
    expect(renders).toBe(1);
    expect(releases.length).toBeGreaterThan(0);
    for (const release of releases) expect(release).toHaveBeenCalledTimes(1);
  } finally { spy?.mockRestore(); controller.dispose(); restore(); wrapper.remove(); }
});
