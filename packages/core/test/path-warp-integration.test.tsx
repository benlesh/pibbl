import { Clip, Path, PathGeometry, Rectangle, toPath2D, toSvgPathData, warpPath } from '@crc/core';
import { expect, it, vi } from 'vitest';
import { componentTest } from '../src/lib/test-utils/component-test';

it('uses warped geometry for paint, clipping, targeting, and independent native/SVG snapshots', async () => {
  const source = new PathGeometry(); source.rect(0, 0, 1, 1);
  const warped = warpPath(source, { source: { x: 0, y: 0, width: 1, height: 1 }, destination: {
    topLeft: { x: 10, y: 10 }, topRight: { x: 70, y: 10 }, bottomLeft: { x: 10, y: 70 }, bottomRight: { x: 50, y: 60 },
  }, mode: 'perspective', tolerance: 0.1 });
  const native = toPath2D(warped), svg = new Path2D(toSvgPathData(warped));
  const onClick = vi.fn();
  const canvas = await componentTest(<Clip style={{ d: warped }}>
    <Rectangle style={{ width: 100, height: 100, fill: '#0000ff' }} />
    <Path style={{ d: warped, fill: '#ff0000' }} onClick={onClick} />
  </Clip>);
  const context = canvas.element.getContext('2d')!;
  expect(Array.from(context.getImageData(20, 20, 1, 1).data)).toEqual([255, 0, 0, 255]);
  expect(context.getImageData(80, 80, 1, 1).data[3]).toBe(0);
  for (const [x, y, inside] of [[20, 20, true], [80, 80, false]] as const) {
    expect(context.isPointInPath(native, x, y)).toBe(inside);
    expect(context.isPointInPath(svg, x, y)).toBe(inside);
  }
  await canvas.click({ position: { x: 20, y: 20 } });
  await canvas.click({ position: { x: 80, y: 80 } });
  expect(onClick).toHaveBeenCalledTimes(1);
  warped.clear();
  expect(context.isPointInPath(native, 20, 20)).toBe(true);
  expect(context.isPointInPath(svg, 20, 20)).toBe(true);
});
