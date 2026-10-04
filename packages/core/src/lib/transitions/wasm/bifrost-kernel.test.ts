import { expect, it } from 'vitest';
import { bifrostKernel } from './bifrost-kernel';

it('preserves JS descriptor equations and isolates interleaved seeded definitions', () => {
  const seeds = [0, 8, 43, -3.5];
  const kernels = seeds.map(bifrostKernel);
  for (let frame = 0; frame < 40; frame++) for (let s = 0; s < seeds.length; s++) {
    const seed = seeds[s]!, sample = kernels[s]!;
    const seconds = frame / 137, flow = frame % 2 ? 1 : -1;
    const power = .7, width = 300, distance = 600, ex = 400, ey = 0, dx = 90, dy = 590;
    const actual = sample(seconds, flow, power, width, distance, ex, ey, dx, dy);
    const noise = (n: number) => { const v = Math.sin(n * 127.1 + seed * 31.7) * 43758.5453; return v - Math.floor(v); };
    const angle = Math.atan2(dy, dx);
    for (let i = 0; i < 56; i++) {
      const n = (j: number) => noise(i * 11 + j);
      const position = n(2) * 1.8 + flow * seconds * (1.6 + n(1) * 2.8);
      const t = ((position % 1.8) + 1.8) % 1.8 - .4;
      const lateral = (n(3) - .5) * width * .95 + Math.sin(seconds * 3 + n(4) * 20) * width * .035;
      const expected = [ex + dx * t - Math.sin(angle) * lateral, ey + dy * t + Math.cos(angle) * lateral, Math.max(20, distance * (.13 + n(5) * .28)), Math.max(4, width * (.045 + n(6) * .13)), n(7) * 360, power * (.14 + n(8) * .22)];
      expected.forEach((value, j) => expect(actual[i * 6 + j]).toBeCloseTo(value, 5));
    }
    expect(sample(seconds, flow, power, width, distance, ex, ey, dx, dy)).toBe(actual);
  }
});
