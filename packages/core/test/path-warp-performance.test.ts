import { expect, it } from 'vitest';
import { emitSpan, type WarpSpan } from '../src/lib/geometry/path-warp-bezier';

it('reuses bounded subdivision storage across all spans in one warp', () => {
  const work = { remaining: 100_000, pool: [] as WarpSpan[], depths: [] as number[], scratch: [] as number[] };
  const curve = { x: [0, 1, 0, 1], y: [0, 1, -1, 0], w: [1, 1, 1, 1] };
  let count = 0;
  const emit = () => { count++; };
  emitSpan(curve, 0.0001, work, emit);
  const allocated = work.pool.length, frames = [...work.pool], buffers = frames.flatMap(frame => [frame.x, frame.y, frame.w]);
  expect(allocated).toBeGreaterThan(0);
  expect(allocated).toBeLessThanOrEqual(53);
  for (let i = 0; i < 100; i++) emitSpan(curve, 0.0001, work, emit);
  expect(count).toBeGreaterThan(10_000);
  expect(work.pool).toHaveLength(allocated);
  work.pool.forEach((frame, i) => {
    expect(frame).toBe(frames[i]);
    expect(frame.x).toBe(buffers[i * 3]); expect(frame.y).toBe(buffers[i * 3 + 1]); expect(frame.w).toBe(buffers[i * 3 + 2]);
  });
  expect(curve).toEqual({ x: [0, 1, 0, 1], y: [0, 1, -1, 0], w: [1, 1, 1, 1] });
});

it('bounds adversarial subdivision work even before any segment is emitted', () => {
  const work = { remaining: 2, pool: [] as WarpSpan[], depths: [] as number[], scratch: [] as number[] };
  let emitted = 0;
  expect(() => emitSpan({ x: [0, 1, 2], y: [0, 3, 0], w: [1, -0.99, 1] }, Number.MIN_VALUE, work, () => emitted++)).toThrow(/work limit/);
  expect(emitted).toBe(0);
  expect(work.pool.length).toBeLessThanOrEqual(3);
});
