import { affineTransform, composeTransforms, envelopeTransform, PathGeometry, transformPath } from '@crc/core';
import { expect, it } from 'vitest';

it('composes a text-envelope mapping left to right, snapshots guides, and preserves closing edges', () => {
  const top = new PathGeometry(); top.moveTo(0, 0); top.lineTo(100, 0);
  const bottom = new PathGeometry(); bottom.moveTo(0, 100); bottom.lineTo(200, 100);
  const source = new PathGeometry(); source.moveTo(0, 0); source.lineTo(1, 1); source.closePath();
  const envelope = envelopeTransform({ source: { x: 0, y: 0, width: 1, height: 1 }, top, bottom });
  const mapping = composeTransforms(envelope, affineTransform({ a: 2, d: 2, e: 10, f: 20 }));
  top.clear(); bottom.clear();
  expect(mapping.mapPoint({ x: 0.5, y: 0.5 })).toEqual({ x: 160, y: 120 });
  const result = transformPath(source, mapping, { tolerance: 0.01 });
  const points = Array.from(result);
  expect(points[0]).toEqual({ type: 'move', x: 10, y: 20 });
  expect(points.at(-1)).toEqual({ type: 'close' });
  expect(points.filter(p => p.type === 'line' && p.x === 160 && p.y === 120)).toHaveLength(2);
  expect(source.segmentCount).toBe(3);
  let previous = 0;
  for (const p of points) {
    if (p.type !== 'line') continue;
    const t = (p.y - 20) / 200;
    // F(t)=(10+200t+200t²,20+200t): exact maximum chord error.
    expect(200 * (t - previous) ** 2 / 4).toBeLessThanOrEqual(0.01);
    previous = t;
  }
});

it('tracks curved arc-length guides and supports intermediate guide creases', () => {
  const top = new PathGeometry(); top.moveTo(0, 0); top.quadraticCurveTo(50, -50, 100, 0);
  const middle = new PathGeometry(); middle.moveTo(0, 40); middle.lineTo(100, 80);
  const bottom = new PathGeometry(); bottom.moveTo(0, 100); bottom.lineTo(100, 100);
  const mapping = envelopeTransform({ source: { x: 0, y: 0, width: 1, height: 1 }, guides: [{at:0,path:top},{at:0.4,path:middle},{at:1,path:bottom}] });
  const mid = mapping.mapPoint({x:0.5,y:0});
  expect(mid.x).toBeCloseTo(50, 8); expect(mid.y).toBeCloseTo(-25, 8);
  expect(mapping.mapPoint({x:0.5,y:0.4})).toEqual({x:50,y:60});
  const shape = new PathGeometry(); shape.rect(0,0,1,1);
  const result = transformPath(shape,mapping,{tolerance:0.2});
  expect(result.segmentCount).toBeGreaterThan(10);
  expect(Array.from(result).filter(s => s.type === 'close')).toHaveLength(1);
  expect(Array.from(result).at(-1)).toEqual({type:'move',x:0,y:0});
  expect(() => mapping.mapPoint({x:2,y:0})).toThrow(RangeError);
});
