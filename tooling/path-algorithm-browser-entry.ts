import { flattenPath, simplifyPath } from '../packages/core/src/lib/geometry/path-utilities.js';
import { flattenPathWang } from '../packages/core/src/lib/geometry/path-wang.js';
import { simplifyPathRadial } from '../packages/core/src/lib/geometry/path-radial.js';
import { PathGeometry } from '../packages/core/src/lib/geometry/path-geometry.js';

export function runPathAlgorithmBrowserBenchmark() {
  const curves = cubicPath(200);
  const denseTrace = denseTracePath(10_000);
  const cases: Array<readonly [string, () => PathGeometry]> = [
    ['adaptive flatten', () => flattenPath(curves, { tolerance: 0.25 })],
    ['Wang flatten', () => flattenPathWang(curves, { tolerance: 0.25 })],
    ['Douglas--Peucker dense trace', () => simplifyPath(denseTrace, { tolerance: 0.5 })],
    ['radial + Douglas--Peucker dense trace', () => simplifyPathRadial(denseTrace, { tolerance: 0.5 })],
  ];
  return cases.map(([name, action]) => run(name, action));
}

function run(name: string, action: () => PathGeometry) {
  for (let index = 0; index < 20; index++) action();
  const samples: number[] = [];
  let result = action();
  for (let sample = 0; sample < 31; sample++) {
    const started = performance.now();
    for (let repeat = 0; repeat < 10; repeat++) result = action();
    samples.push((performance.now() - started) / 10);
  }
  samples.sort((a, b) => a - b);
  return {
    name,
    milliseconds: { median: round(samples[Math.floor(samples.length / 2)]), p95: round(samples[Math.floor(samples.length * 0.95)]) },
    outputSegments: result.segmentCount,
  };
}

function cubicPath(count: number): PathGeometry {
  const path = new PathGeometry();
  path.moveTo(0, 0);
  for (let index = 0; index < count; index++) {
    const x = index * 10;
    path.bezierCurveTo(x + 2, index % 2 ? -30 : 30, x + 8, index % 2 ? 30 : -30, x + 10, 0);
  }
  return path;
}
function denseTracePath(count: number): PathGeometry {
  const path = new PathGeometry();
  path.moveTo(0, 0);
  for (let index = 1; index <= count; index++) {
    const x = index / 100;
    path.lineTo(x, Math.sin(x * 2.3) * 1.5 + Math.sin(x * 13.7) * 0.08);
  }
  return path;
}
function round(value: number): number { return Math.round(value * 1000) / 1000; }
