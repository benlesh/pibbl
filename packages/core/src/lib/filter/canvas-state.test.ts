import { describe, expect, it } from 'vitest';
import { copyFilterSourceState } from './canvas-state.js';

describe('filter Canvas state', () => {
  it('copies only the drawing state allowed inside a filter source', () => {
    const parent = document.createElement('canvas').getContext('2d')!;
    const source = new OffscreenCanvas(32, 32).getContext('2d')!;

    parent.direction = 'rtl';
    parent.fillStyle = '#123456';
    parent.font = 'italic 17px serif';
    setIfPresent(parent, 'fontKerning', 'none');
    setIfPresent(parent, 'fontStretch', 'expanded');
    setIfPresent(parent, 'fontVariantCaps', 'small-caps');
    parent.imageSmoothingEnabled = false;
    parent.imageSmoothingQuality = 'high';
    setIfPresent(parent, 'letterSpacing', '3px');
    parent.lineCap = 'round';
    parent.setLineDash([3, 5]);
    parent.lineDashOffset = 2;
    parent.lineJoin = 'bevel';
    parent.lineWidth = 7;
    parent.miterLimit = 4;
    parent.strokeStyle = '#654321';
    parent.textAlign = 'center';
    parent.textBaseline = 'middle';
    setIfPresent(parent, 'textRendering', 'optimizeLegibility');
    setIfPresent(parent, 'wordSpacing', '4px');

    parent.globalAlpha = 0.25;
    parent.globalCompositeOperation = 'multiply';
    parent.filter = 'blur(2px)';
    parent.shadowBlur = 6;
    parent.shadowColor = 'red';
    parent.shadowOffsetX = 8;
    parent.shadowOffsetY = 9;
    parent.setTransform(2, 0, 0, 3, 11, 13);

    copyFilterSourceState(parent, source);

    expect(source.direction).toBe('rtl');
    expect(source.fillStyle).toBe('#123456');
    expect(source.font).toBe('italic small-caps 17px serif');
    expectIfPresent(source, parent, 'fontKerning');
    expectIfPresent(source, parent, 'fontStretch');
    expectIfPresent(source, parent, 'fontVariantCaps');
    expect(source.imageSmoothingEnabled).toBe(false);
    expect(source.imageSmoothingQuality).toBe('high');
    expectIfPresent(source, parent, 'letterSpacing');
    expect(source.lineCap).toBe('round');
    expect(source.getLineDash()).toEqual([3, 5]);
    expect(source.lineDashOffset).toBe(2);
    expect(source.lineJoin).toBe('bevel');
    expect(source.lineWidth).toBe(7);
    expect(source.miterLimit).toBe(4);
    expect(source.strokeStyle).toBe('#654321');
    expect(source.textAlign).toBe('center');
    expect(source.textBaseline).toBe('middle');
    expectIfPresent(source, parent, 'textRendering');
    expectIfPresent(source, parent, 'wordSpacing');

    expect(source.globalAlpha).toBe(1);
    expect(source.globalCompositeOperation).toBe('source-over');
    expect(source.filter).toBe('none');
    expect(source.shadowBlur).toBe(0);
    expect(source.shadowColor).toBe('rgba(0, 0, 0, 0)');
    expect(source.shadowOffsetX).toBe(0);
    expect(source.shadowOffsetY).toBe(0);
    expect(source.getTransform()).toEqual(new DOMMatrix());
  });

  it('does not transfer the parent current path or active clip', () => {
    const parent = document.createElement('canvas').getContext('2d')!;
    const source = new OffscreenCanvas(8, 8).getContext('2d')!;
    parent.beginPath();
    parent.rect(0, 0, 2, 2);
    parent.clip();
    parent.beginPath();
    parent.rect(3, 3, 2, 2);

    copyFilterSourceState(parent, source);
    source.stroke();

    expect(source.getImageData(3, 3, 1, 1).data[3]).toBe(0);
    source.fillRect(0, 0, 8, 8);
    expect(source.getImageData(7, 7, 1, 1).data[3]).toBe(255);
  });
});

function setIfPresent(
  context: CanvasRenderingContext2D,
  property: string,
  value: string,
): void {
  if (property in context) {
    (context as unknown as Record<string, unknown>)[property] = value;
  }
}

function expectIfPresent(
  source: OffscreenCanvasRenderingContext2D,
  parent: CanvasRenderingContext2D,
  property: string,
): void {
  if (property in source && property in parent) {
    expect((source as unknown as Record<string, unknown>)[property])
      .toBe((parent as unknown as Record<string, unknown>)[property]);
  }
}
