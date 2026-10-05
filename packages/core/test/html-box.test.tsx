import { afterEach, describe, expect, it } from 'vitest';
import { pibbl, HtmlBox, Group, Clip, PathGeometry } from '@pibbl/core';
import { clearSharedState } from '../src/lib/global-state.js';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing.js';

afterEach(() => { clearSharedState(); document.body.replaceChildren(); });

export function htmlSurface() {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;width:400px;height:300px;isolation:isolate';
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 300;
  canvas.style.cssText = 'display:block;width:100%;height:100%;border:0;padding:0';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1';
  wrapper.append(canvas, overlay); document.body.append(wrapper);
  return { wrapper, canvas, overlay };
}

describe('HtmlBox public lifecycle and projection', () => {
  it('mounts once after render, updates persistent native content and aborts before removal', () => {
    const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
    const { canvas, overlay } = htmlSurface();
    const calls: string[] = []; let input: HTMLInputElement | undefined;
    const mount = (element: HTMLDivElement, initial: string, signal: AbortSignal) => {
      expect(element.isConnected).toBe(true); expect(signal.aborted).toBe(false);
      calls.push(`mount:${initial}`); input = document.createElement('input'); element.append(input);
      signal.addEventListener('abort', () => calls.push(`abort:${element.isConnected}`));
      return (next: string) => { calls.push(`update:${next}`); };
    };
    const clip = new PathGeometry(); clip.rect(0, 0, 100, 80);
    const scene = (x: number, data: string) => <Group style={{ translateX: x, translateY: 20, rotationDegrees: 15 }}><Clip style={{ d: clip }}><HtmlBox data={data} mount={mount} style={{ width: 100, height: 80 }} /></Clip></Group>;
    const controller = pibbl(canvas, scene(30, 'first'), { htmlOverlay: overlay, pixelRatio: 2 });
    try {
      expect(calls).toEqual([]); driver.flush(10); expect(calls).toEqual(['mount:first']);
      input!.value = 'keep me'; const first = input;
      const shell = overlay.querySelector<HTMLElement>('[data-pibbl-html-box]')!;
      const matrix = new DOMMatrix(shell.style.transform);
      const expected = new DOMMatrix().rotate(15).translate(30, 20);
      expect(matrix.e).toBeCloseTo(expected.e); expect(matrix.f).toBeCloseTo(expected.f);
      pibbl(canvas, scene(60, 'second')); driver.flush(20);
      expect(input).toBe(first); expect(input!.value).toBe('keep me');
      expect(calls).toEqual(['mount:first', 'update:second']);
      expect(overlay.querySelectorAll('clipPath').length).toBeGreaterThan(0);
      controller.dispose(); controller.dispose();
      expect(calls).toEqual(['mount:first', 'update:second', 'abort:true']);
      expect(overlay.childNodes.length).toBe(0);
    } finally { controller.dispose(); restore(); }
  });
});
