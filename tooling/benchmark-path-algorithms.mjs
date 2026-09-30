// Run with: node --import tsx tooling/benchmark-path-algorithms.mjs
// This is a characterization tool, not a performance gate. Compare results on
// the same machine and runtime; its output deliberately makes no speed claim.
import { flattenPath, simplifyPath, subdividePath } from '../packages/core/src/lib/geometry/path-utilities.ts';
import { flattenPathWang } from '../packages/core/src/lib/geometry/path-wang.ts';
import { simplifyPathRadial } from '../packages/core/src/lib/geometry/path-radial.ts';
import { PathGeometry } from '../packages/core/src/lib/geometry/path-geometry.ts';

const WARMUP = 20;
const SAMPLES = 31;
const REPEATS = 10;

const curves = cubicPath(200);
const linework = noisyLine(10_000);
const denseTrace = denseTracePath(10_000);

const cases = [
  ['adaptive flatten', () => flattenPath(curves, { tolerance: 0.25 })],
  ['Wang flatten', () => flattenPathWang(curves, { tolerance: 0.25 })],
  ['Douglas--Peucker', () => simplifyPath(linework, { tolerance: 0.5 })],
  ['radial + Douglas--Peucker', () => simplifyPathRadial(linework, { tolerance: 0.5 })],
  ['Douglas--Peucker dense trace', () => simplifyPath(denseTrace, { tolerance: 0.5 })],
  ['radial + Douglas--Peucker dense trace', () => simplifyPathRadial(denseTrace, { tolerance: 0.5 })],
  ['de Casteljau subdivision', () => subdividePath(curves, { divisions: 8 })],
  ['direct subdivision prototype', () => subdivideCubicsDirect(curves, 8)],
];

const direct = subdivideCubicsDirect(curves, 8);
const reference = subdividePath(curves, { divisions: 8 });
if (!sameCubicsAtSamples(direct, reference)) throw new Error('Direct subdivision prototype changed cubic geometry.');

for (const [name, action] of cases) {
  for (let i = 0; i < WARMUP; i++) action();
  const samples = [];
  let result;
  for (let sample = 0; sample < SAMPLES; sample++) {
    const start = performance.now();
    for (let repeat = 0; repeat < REPEATS; repeat++) result = action();
    samples.push((performance.now() - start) / REPEATS);
  }
  samples.sort((a, b) => a - b);
  console.log(JSON.stringify({
    name,
    milliseconds: { median: round(samples[Math.floor(samples.length / 2)]), p95: round(samples[Math.floor(samples.length * 0.95)]) },
    outputSegments: result.segmentCount,
  }));
}

function cubicPath(count) {
  const path = new PathGeometry();
  path.moveTo(0, 0);
  for (let index = 0; index < count; index++) {
    const x = index * 10;
    path.bezierCurveTo(x + 2, index % 2 ? -30 : 30, x + 8, index % 2 ? 30 : -30, x + 10, 0);
  }
  return path;
}

function noisyLine(count) {
  const path = new PathGeometry();
  path.moveTo(0, 0);
  for (let index = 1; index <= count; index++) path.lineTo(index, Math.sin(index / 30) * 0.1);
  return path;
}

function denseTracePath(count) {
  const path = new PathGeometry();
  path.moveTo(0, 0);
  for (let index = 1; index <= count; index++) {
    const x = index / 100;
    path.lineTo(x, Math.sin(x * 2.3) * 1.5 + Math.sin(x * 13.7) * 0.08);
  }
  return path;
}

// Exact fixed-degree subsegments from endpoint derivatives. This isolates the
// repeated-remainder choice in subdividePath; it is intentionally not public.
function subdivideCubicsDirect(path, divisions) {
  const result = new PathGeometry();
  let current = [0, 0];
  for (const segment of path) {
    if (segment.type === 'move') {
      current = [segment.x, segment.y];
      result.moveTo(...current);
    } else if (segment.type === 'cubic') {
      const controls = [current, [segment.cp1x, segment.cp1y], [segment.cp2x, segment.cp2y], [segment.x, segment.y]];
      for (let index = 0; index < divisions; index++) {
        const from = index / divisions;
        const to = (index + 1) / divisions;
        const width = to - from;
        const a = cubic(controls, from);
        const b = cubic(controls, to);
        const da = derivative(controls, from);
        const db = derivative(controls, to);
        result.bezierCurveTo(a[0] + width * da[0] / 3, a[1] + width * da[1] / 3, b[0] - width * db[0] / 3, b[1] - width * db[1] / 3, b[0], b[1]);
      }
      current = [segment.x, segment.y];
    }
  }
  return result;
}

function cubic([a, b, c, d], t) {
  const ab = lerp(a, b, t), bc = lerp(b, c, t), cd = lerp(c, d, t);
  return lerp(lerp(ab, bc, t), lerp(bc, cd, t), t);
}
function derivative([a, b, c, d], t) {
  const ab = [3 * (b[0] - a[0]), 3 * (b[1] - a[1])];
  const bc = [3 * (c[0] - b[0]), 3 * (c[1] - b[1])];
  const cd = [3 * (d[0] - c[0]), 3 * (d[1] - c[1])];
  return lerp(lerp(ab, bc, t), lerp(bc, cd, t), t);
}
function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
function sameCubicsAtSamples(left, right) {
  const leftSegments = Array.from(left).filter(segment => segment.type === 'cubic');
  const rightSegments = Array.from(right).filter(segment => segment.type === 'cubic');
  if (leftSegments.length !== rightSegments.length) return false;
  let leftStart = [0, 0], rightStart = [0, 0];
  for (let index = 0; index < leftSegments.length; index++) {
    const a = leftSegments[index], b = rightSegments[index];
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const p = cubic([leftStart, [a.cp1x, a.cp1y], [a.cp2x, a.cp2y], [a.x, a.y]], t);
      const q = cubic([rightStart, [b.cp1x, b.cp1y], [b.cp2x, b.cp2y], [b.x, b.y]], t);
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-10) return false;
    }
    leftStart = [a.x, a.y];
    rightStart = [b.x, b.y];
  }
  return true;
}
function round(value) { return Math.round(value * 1000) / 1000; }
