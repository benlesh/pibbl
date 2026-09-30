import { expect, it, vi } from 'vitest';
import { bendPathAlongArc, bendPathAlongPath, Clip, Path, PathGeometry, Rectangle, toPath2D, toSvgPathData } from '@crc/core';
import mount from '../../scenarios/src/learning/drawing/path-bending.example';
import mountPath from '../../scenarios/src/learning/drawing/along-path.example';
import { componentTest, TestCanvas } from '../src/lib/test-utils/component-test';

it('uses bent public geometry for Clip, paint, targeting, and independent native/SVG snapshots', async () => {
  const source = new PathGeometry(); source.rect(0, -10, 80, 20);
  const guide = new PathGeometry(); guide.arc(100, 100, 60, -Math.PI / 2, 0);
  const options = { source: { x: 0, y: -10, width: 80, height: 20 }, baseline: 0, tolerance: 0.1 };
  const schedule = vi.spyOn(window, 'requestAnimationFrame');
  const bent = bendPathAlongPath(source, guide, options);
  const analytic = bendPathAlongArc(source, { ...options, arc: { cx: 100, cy: 100, radius: 60, startAngle: -Math.PI / 2, sweep: Math.PI / 2 } });
  expect(schedule).not.toHaveBeenCalled(); schedule.mockRestore();
  const click = vi.fn();
  const canvas = await componentTest(<Clip style={{ d: bent }}>
    <Rectangle style={{ width: 220, height: 180, fill: '#ff0000' }} pointerEvents="none" />
    <Path style={{ d: bent, fill: '#0000ff' }} onClick={click} />
  </Clip>);
  const position = { x: 100 + 60 * Math.sin(2 / 3), y: 100 - 60 * Math.cos(2 / 3) };
  const ctx = canvas.element.getContext('2d')!;
  expect(ctx.getImageData(position.x, position.y, 1, 1).data[2]).toBe(255);
  expect(ctx.getImageData(100, 100, 1, 1).data[3]).toBe(0);
  await canvas.click({ position }); await canvas.click({ position: { x: 100, y: 100 } });
  expect(click).toHaveBeenCalledTimes(1);
  const native = toPath2D(bent), svg = toSvgPathData(bent);
  expect(ctx.isPointInPath(native, position.x, position.y)).toBe(true);
  expect(ctx.isPointInPath(toPath2D(analytic), position.x, position.y)).toBe(true);
  source.clear(); guide.clear();
  expect(toSvgPathData(bent)).toBe(svg); expect(svg).toContain(' Z');
  expect(svg).toMatch(/^M .* L /); expect(svg).not.toMatch(/[QCA]/);
  expect(toPath2D(bent)).not.toBe(native);
});

it('changes baseline, fitting, and tangent extension in the public Arc example and resets the preview', async () => {
  const text = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');
  const element = document.createElement('canvas');
  element.width = 800; element.height = 620;
  document.body.appendChild(element);
  const canvas = new TestCanvas(element, mount(element));
  const drawn = (label: string) => text.mock.calls.some(call => call[0] === label);
  try {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(drawn('Baseline: center')).toBe(true);
    const before = element.getContext('2d')!.getImageData(0, 200, 800, 260).data.slice();
    await canvas.click({ position: { x: 125, y: 475 } });
    expect(drawn('Baseline: bottom (above)')).toBe(true);
    expect(element.getContext('2d')!.getImageData(0, 200, 800, 260).data).not.toEqual(before);
    await canvas.click({ position: { x: 365, y: 475 } });
    expect(drawn('Fit: stretch')).toBe(true);
    const lastValid = element.getContext('2d')!.getImageData(0, 220, 800, 180).data.slice();
    await canvas.click({ position: { x: 250, y: 519 } });
    expect(drawn('Cannot bend — showing the last valid preview.')).toBe(false);
    expect(element.getContext('2d')!.getImageData(0, 220, 800, 180).data).not.toEqual(lastValid);
    await canvas.click({ position: { x: 714, y: 560 } });
    expect(element.getContext('2d')!.getImageData(0, 200, 800, 260).data).toEqual(before);
  } finally {
    canvas.dispose(); element.remove(); text.mockRestore();
  }
});

it('opens Along Path and bends the outline when a cubic guide handle is dragged', async () => {
  const text = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');
  const element = document.createElement('canvas'); element.width = 800; element.height = 620;
  document.body.appendChild(element);
  const canvas = new TestCanvas(element, mountPath(element));
  try {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    
    expect(text.mock.calls.some(call => call[0] === 'ALONG PATH')).toBe(true);
    const before = element.getContext('2d')!.getImageData(170, 220, 470, 185).data.slice();
    await canvas.mouseDown({ position: { x: 280, y: 230 } });
    await canvas.mouseMove({ position: { x: 310, y: 280 } });
    await canvas.mouseUp({ position: { x: 310, y: 280 } });
    const after = element.getContext('2d')!.getImageData(170, 220, 470, 185).data.slice();
    expect(after).not.toEqual(before);
    await canvas.mouseMove({ position: { x: 340, y: 310 } });
    expect(element.getContext('2d')!.getImageData(170, 220, 470, 185).data).toEqual(after);
    expect(text.mock.calls.some(call => String(call[0]).includes('showing the last valid preview'))).toBe(false);
  } finally { canvas.dispose(); element.remove(); text.mockRestore(); }
});

function bentPixels(element: HTMLCanvasElement) {
  const pixels = element.getContext('2d')!.getImageData(0, 190, 800, 260).data;
  return Array.from({ length: pixels.length / 4 }, (_, i) => pixels[i * 4] === 36 && pixels[i * 4 + 1] === 119 && pixels[i * 4 + 2] === 96 ? i : -1).filter(i => i >= 0);
}

it('continuously updates the actual green bent outline throughout a captured guide drag', async () => {
  const element = document.createElement('canvas'); element.width = 800; element.height = 620;
  document.body.appendChild(element);
  const canvas = new TestCanvas(element, mountPath(element));
  try {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    
    await canvas.mouseDown({ position: { x: 280, y: 230 } });
    let previous = bentPixels(element);
    for (const position of [{ x: 300, y: 270 }, { x: 320, y: 320 }, { x: 340, y: 380 }]) {
      await canvas.mouseMove({ position });
      const current = bentPixels(element);
      expect(current.length).toBeGreaterThan(1000);
      expect(current).not.toEqual(previous);
      previous = current;
    }
    await canvas.mouseUp({ position: { x: 340, y: 380 } });
    await canvas.mouseMove({ position: { x: 260, y: 240 } });
    expect(bentPixels(element)).toEqual(previous);
  } finally { canvas.dispose(); element.remove(); }
});

it('drags the arc radius on canvas and releases capture after the gesture', async () => {
  const element = document.createElement('canvas'); element.width = 800; element.height = 620;
  document.body.appendChild(element);
  const canvas = new TestCanvas(element, mount(element));
  try {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const before = bentPixels(element);
    await canvas.mouseDown({ position: { x: 400, y: 240 } });
    await canvas.mouseMove({ position: { x: 400, y: 280 } });
    const during = bentPixels(element);
    expect(during).not.toEqual(before);
    await canvas.mouseMove({ position: { x: 400, y: 260 } });
    const after = bentPixels(element);
    expect(after).not.toEqual(during);
    await canvas.mouseUp({ position: { x: 400, y: 260 } });
    await canvas.mouseMove({ position: { x: 400, y: 240 } });
    expect(bentPixels(element)).toEqual(after);
  } finally { canvas.dispose(); element.remove(); }
});

for (const gesture of [
  { name: 'center', start: { x: 400, y: 430 }, end: { x: 435, y: 400 } },
  { name: 'sweep', start: { x: 581, y: 371 }, end: { x: 550, y: 300 } },
]) it(`drags the arc ${gesture.name} and stops after pointer cancellation`, async () => {
  const element = document.createElement('canvas'); element.width = 800; element.height = 620;
  document.body.appendChild(element);
  const canvas = new TestCanvas(element, mount(element));
  try {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const before = bentPixels(element);
    await canvas.mouseDown({ position: gesture.start });
    await canvas.mouseMove({ position: gesture.end });
    const after = bentPixels(element);
    expect(after).not.toEqual(before);
    element.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));
    await canvas.mouseMove({ position: gesture.start });
    expect(bentPixels(element)).toEqual(after);
    await canvas.mouseUp({ position: gesture.start });
  } finally { canvas.dispose(); element.remove(); }
});
