import { PathGeometry, toSvgPathData, type BendTransformOptions, type TransformPathOptions, transformPath, pathBendTransform, arcBendTransform } from '@pibbl/core';

import { describe, expect, it } from 'vitest';

describe('public path bending', () => {
  it('bounds a curved, nonmonotonic source against an independently inverted analytic guide', () => {
    const length = (t: number) => 50 * t * Math.sqrt(1 + 4 * t * t) + 25 * Math.asinh(2 * t);
    const guide = point(0, 0); guide.quadraticCurveTo(50, 0, 100, 100);
    const controls = [[length(0.2), -10], [length(0.9), 80], [length(0.1), -80], [length(0.8), 10]];
    const source = point(controls[0][0], controls[0][1]);
    source.bezierCurveTo(controls[1][0], controls[1][1], controls[2][0], controls[2][1], controls[3][0], controls[3][1]);
    const result = transformPath(source, pathBendTransform({ ...{ source: frame, baseline: 0 }, guide }), { tolerance: 0.1 });
    const vertices = Array.from(result).flatMap(s => s.type === 'move' || s.type === 'line' ? [[s.x, s.y] as const] : []);
    for (let i = 0; i <= 200; i++) {
      const t = i / 200, u = 1 - t, weights = [u ** 3, 3 * t * u * u, 3 * t * t * u, t ** 3];
      const distance = controls.reduce((sum, p, j) => sum + weights[j] * p[0], 0);
      const normal = controls.reduce((sum, p, j) => sum + weights[j] * p[1], 0);
      let low = 0, high = 1;
      for (let k = 0; k < 50; k++) { const mid = (low + high) / 2; if (length(mid) < distance) low = mid; else high = mid; }
      const g = (low + high) / 2, speed = Math.hypot(1, 2 * g);
      const x = 100 * g - normal * 2 * g / speed, y = 100 * g * g + normal / speed;
      const error = Math.min(...vertices.slice(1).map((b, j) => {
        const a = vertices[j], dx = b[0] - a[0], dy = b[1] - a[1];
        const q = dx || dy ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
        return Math.hypot(x - a[0] - q * dx, y - a[1] - q * dy);
      }));
      expect(error).toBeLessThanOrEqual(0.1);
    }
  });
  it('uses guide distance for a quadratic and bends the source closing edge with independent normal displacement', () => {
    // B(t)=(100t,100t²), whose arc length has a closed form.
    const length = (t: number) => 50 * t * Math.sqrt(1 + 4 * t * t) + 25 * Math.asinh(2 * t);
    const guide = new PathGeometry();
    guide.moveTo(0, 0); guide.quadraticCurveTo(50, 0, 100, 100);
    const source = new PathGeometry();
    const x0 = length(0.2), x1 = length(0.8);
    source.moveTo(x0, -8); source.lineTo(x0, 8);
    source.lineTo(x1, 8); source.lineTo(x1, -8); source.closePath();
    const revision = guide.revision, sourceRevision = source.revision;
    const result = transformPath(source, pathBendTransform({ ...{ source: { x: 0, y: -8, width: length(1), height: 16 }, baseline: 0 }, guide }), { tolerance: 0.05 });
    const vertices = Array.from(result).flatMap(s => s.type === 'move' || s.type === 'line' ? [[s.x, s.y] as const] : []);
    const expected = (t: number, d: number) => {
      const speed = Math.hypot(1, 2 * t);
      return [100 * t - d * 2 * t / speed, 100 * t * t + d / speed] as const;
    };
    expect(Math.hypot(vertices[0][0] - expected(0.2, -8)[0], vertices[0][1] - expected(0.2, -8)[1])).toBeLessThan(0.05);
    // Independent analytic positions along both long edges, including Close.
    for (const d of [-8, 8]) for (let i = 0; i <= 100; i++) {
      const point = expected(0.2 + 0.6 * i / 100, d);
      const distance = Math.min(...vertices.slice(1).map((end, index) => {
        const start = vertices[index], dx = end[0] - start[0], dy = end[1] - start[1];
        const u = dx || dy ? Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy))) : 0;
        return Math.hypot(point[0] - start[0] - u * dx, point[1] - start[1] - u * dy);
      }));
      expect(distance).toBeLessThanOrEqual(0.05);
    }
    expect(result.getSegment(result.segmentCount - 1)).toEqual({ type: 'close' });
    expect(guide.revision).toBe(revision); expect(source.revision).toBe(sourceRevision);
  });
  it('bends a rectangle and its closing edge into an aligned annular sector within tolerance', () => {
    const source = new PathGeometry();
    source.moveTo(0, -10);
    source.lineTo(0, 10);
    source.lineTo(100, 10);
    source.lineTo(100, -10);
    source.closePath();
    const before = Array.from(source);
    const revision = source.revision;
    const tolerance = 0.05;
    const bent = transformPath(source, arcBendTransform({ source: { x: 0, y: -10, width: 100, height: 20 }, arc: { cx: 200, cy: 200, radius: 100, startAngle: 0, sweep: Math.PI / 2 }, align: 'center', baseline: 0 }), { tolerance });
    expect(bent).not.toBe(source);
    expect(source.revision).toBe(revision);
    expect(Array.from(source)).toEqual(before);
    const segments = Array.from(bent);
    expect(segments.at(-1)).toEqual({ type: 'close' });
    expect(segments.every(s => s.type === 'move' || s.type === 'line' || s.type === 'close')).toBe(true);
    const vertices = segments.flatMap(s => s.type === 'move' || s.type === 'line' ? [{ x: s.x, y: s.y }] : []);
    const firstAngle = (100 * Math.PI / 2 - 100) / 200;
    expect(vertices[0].x).toBeCloseTo(200 + 110 * Math.cos(firstAngle), 10);
    expect(vertices[0].y).toBeCloseTo(200 + 110 * Math.sin(firstAngle), 10);
    // The final source edge is Close, not Line. It must gain intermediate
    // vertices on the outer radius, not become a chord between its endpoints.
    let innerEdges = 0, outerEdges = 0;
    for (let i = 1; i < vertices.length; i++) {
      const a = vertices[i - 1], b = vertices[i];
      const ra = Math.hypot(a.x - 200, a.y - 200);
      const rb = Math.hypot(b.x - 200, b.y - 200);
      if (Math.abs(ra - rb) > 1e-8) continue;
      const midpointRadius = Math.hypot((a.x + b.x) / 2 - 200, (a.y + b.y) / 2 - 200);
      expect(ra - midpointRadius).toBeLessThanOrEqual(tolerance + 1e-10);
      if (Math.abs(ra - 90) < 1e-8) innerEdges++;
      if (Math.abs(ra - 110) < 1e-8) outerEdges++;
    }
    expect(innerEdges).toBeGreaterThan(2);
    expect(outerEdges).toBeGreaterThan(2);
    expect(vertices.at(-1)!.x).toBeCloseTo(vertices[0].x, 10);
    expect(vertices.at(-1)!.y).toBeCloseTo(vertices[0].y, 10);
  });
});

const frame = { x: 0, y: -10, width: 100, height: 20 };
const arc = { cx: 100, cy: 100, radius: 100, startAngle: 0, sweep: Math.PI * 2 };
function point(x: number, y: number) { const p = new PathGeometry(); p.moveTo(x, y); return p; }
function first(p: PathGeometry) {
  const s = p.getSegment(0); if (s.type !== 'move') throw new Error('Expected Move.'); return [s.x, s.y] as const;
}
function closeTo(actual: readonly number[], expected: readonly number[], tolerance = 0.01) {
  expect(Math.hypot(actual[0] - expected[0], actual[1] - expected[1])).toBeLessThanOrEqual(tolerance);
}
function lineGuide() { const p = new PathGeometry(); p.moveTo(30, 40); p.lineTo(130, 40); return p; }
const options: (BendTransformOptions & TransformPathOptions) = { source: frame, tolerance: 0.01, baseline: 0 };

describe('path bending boundaries', () => {
  it('places start, center, end, baselines, fitting, and signed offsets in guide distance', () => {
    const guide = lineGuide();
    for (const [align, x] of [['start', 30], ['center', 55], ['end', 80]] as const) {
      closeTo(first(transformPath(point(10, 20), pathBendTransform({ ...{ source: { x: 10, y: 20, width: 50, height: 20 }, align, baseline: 'top' }, guide }), { tolerance: 0.01 })), [x, 40]);
    }
    for (const [baseline, y] of [['top', 50], ['center', 40], ['bottom', 30]] as const) {
      closeTo(first(transformPath(point(0, 0), pathBendTransform({ ...{ ...options, baseline }, guide }), { ...options })), [30, y]);
    }
    closeTo(first(transformPath(point(25, 5), pathBendTransform({ ...{ ...options, source: { x: 0, y: 0, width: 50, height: 0 }, fit: 'stretch', offset: 8, normalOffset: -2 }, guide }), { ...options })), [88, 43]);
  });

  it('follows vertical and reversed guide direction without an automatic upright flip', () => {
    const guide = new PathGeometry(); guide.moveTo(50, 100); guide.lineTo(50, 0);
    closeTo(first(transformPath(point(25, 10), pathBendTransform({ ...options, guide }), options)), [60, 75]);
  });

  it('measures uneven straight Béziers, stationary endpoints, and a removable interior stationary point', () => {
    for (const controls of [[0, 0, 100], [10, 15, 100], [90, -120, 370]]) {
      const guide = new PathGeometry(); guide.moveTo(0, 0); guide.bezierCurveTo(controls[0], 0, controls[1], 0, controls[2], 0);
      closeTo(first(transformPath(point(50, 7), pathBendTransform({ ...options, guide }), options)), [50, 7]);
    }
    const curved = new PathGeometry(); curved.moveTo(0, 0); curved.bezierCurveTo(0, 0, 100, 0, 100, 100);
    closeTo(first(transformPath(point(0, 7), pathBendTransform({ ...options, guide: curved }), options)), [0, 7]);
  });

  it('agrees with analytic circles for both directions and negative/multiple wrapped laps', () => {
    for (const direction of [1, -1]) {
      const guide = new PathGeometry(); guide.arc(100, 100, 100, 0, direction * Math.PI * 2, direction < 0); guide.closePath();
      for (const x of [-750, -100, 0, 40, 710]) {
        const source = point(x, 15);
        const common = { ...options, overflow: 'wrap' as const, tolerance: 0.1 };
        const expected = first(transformPath(source, arcBendTransform({ ...common, arc: { ...arc, sweep: direction * Math.PI * 2 } }), { ...common }));
        closeTo(first(transformPath(source, pathBendTransform({ ...common, guide }), common)), expected, 0.1);
      }
    }
  });

  it('retains multiple complete laps when wrapped source endpoints coincide', () => {
    const guide = new PathGeometry(); guide.arc(0, 0, 20, 0, Math.PI * 2); guide.closePath();
    const source = point(0, 0), circumference = Math.PI * 40;
    source.lineTo(circumference * 3, 0);
    const common = { source: { x: 0, y: 0, width: circumference * 3, height: 0 }, baseline: 0, overflow: 'wrap' as const, tolerance: 0.05 };
    for (const result of [transformPath(source, pathBendTransform({ ...common, guide }), common), transformPath(source, arcBendTransform({ ...common, arc: { cx: 0, cy: 0, radius: 20, startAngle: 0, sweep: Math.PI * 2 } }), { ...common })]) {
      const vertices = Array.from(result).flatMap(s => s.type === 'move' || s.type === 'line' ? [[s.x, s.y] as const] : []);
      let turn = 0;
      for (let i = 1; i < vertices.length; i++) {
        const [ax, ay] = vertices[i - 1], [bx, by] = vertices[i];
        turn += Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
      }
      expect(turn).toBeCloseTo(Math.PI * 6, 3);
    }
  });

  it('bends all source segment kinds, separate contours, implicit arc connections, and continuation after Close', () => {
    const source = new PathGeometry();
    source.moveTo(0, 0); source.quadraticCurveTo(10, 20, 20, 0); source.bezierCurveTo(25, -10, 35, 20, 40, 0);
    source.ellipse(55, 8, 10, 5, 0.3, 0, Math.PI * 2); source.closePath(); source.lineTo(30, 10);
    source.moveTo(70, 0); source.lineTo(90, 0); source.closePath(); source.closePath();
    // The builder treats repeated Close as a no-op; canonical editing can retain it.
    source.spliceSegments(source.segmentCount, 0, [{ type: 'close' }]);
    const before = toSvgPathData(source), revision = source.revision;
    const bent = transformPath(source, pathBendTransform({ ...options, guide: lineGuide() }), options);
    expect(Array.from(bent).filter(s => s.type === 'move')).toHaveLength(2);
    expect(Array.from(bent).filter(s => s.type === 'close')).toHaveLength(3);
    expect(Array.from(bent).every(s => ['move', 'line', 'close'].includes(s.type))).toBe(true);
    expect(toSvgPathData(source)).toBe(before); expect(source.revision).toBe(revision);
    expect(toSvgPathData(bent)).toContain('L 60 50');
  });

  it('preserves a source reversal that touches the guide boundary without rejecting its outside control point', () => {
    const source = point(0, 0); source.quadraticCurveTo(200, 0, 0, 0);
    const result = transformPath(source, pathBendTransform({ ...options, guide: lineGuide() }), options);
    const xs = Array.from(result).flatMap(s => s.type === 'move' || s.type === 'line' ? [s.x] : []);
    expect(Math.max(...xs)).toBeCloseTo(130, 10); expect(xs.at(-1)).toBe(30);
  });

  it('accepts a curved source extremum at a non-dyadic parameter on the guide boundary', () => {
    const source = point(0, 0); source.quadraticCurveTo(150, 10, 75, 20); // max X=100 at t=2/3
    expect(transformPath(source, pathBendTransform({ ...options, guide: lineGuide() }), options).segmentCount).toBeGreaterThan(2);
    expect(transformPath(source, arcBendTransform({ ...options, arc: { cx: 0, cy: 0, radius: 100, startAngle: 0, sweep: 1 } }), { ...options }).segmentCount).toBeGreaterThan(2);
  });

  it('fails explicitly when huge unwrapped angles cannot support the requested output accuracy', () => {
    expect(() => transformPath(point(1e9, 100), arcBendTransform({ ...options, arc: { cx: 0, cy: 0, radius: 1e-10, startAngle: 0, sweep: Math.PI * 2 }, overflow: 'wrap' }), { ...options })).toThrow(RangeError);
  });

  it('supports smooth line/curve joins and rejects corners even in unused guide portions', () => {
    const guide = new PathGeometry(); guide.moveTo(0, 0); guide.lineTo(100, 0); guide.quadraticCurveTo(150, 0, 180, 80);
    closeTo(first(transformPath(point(50, 3), pathBendTransform({ ...options, guide }), options)), [50, 3]);
    guide.lineTo(190, -40);
    expect(() => transformPath(point(10, 0), pathBendTransform({ ...options, guide }), options)).toThrow(/smooth|corner|cusp/);
  });

  it('supports a general affine ellipse guide and a collapsed monotonic arc', () => {
    const guide = new PathGeometry(); guide.ellipse(10, 20, 70, 30, 0.5, 0, Math.PI);
    const p = first(transformPath(point(0, 0), pathBendTransform({ ...options, guide }), options));
    closeTo(p, [10 + 70 * Math.cos(0.5), 20 + 70 * Math.sin(0.5)]);
    const flat = new PathGeometry(); flat.ellipse(0, 0, 100, 0, 0, 0, Math.PI);
    closeTo(first(transformPath(point(50, 10), pathBendTransform({ ...options, guide: flat }), options)), [50, -10]);
  });

  it('continues endpoint tangents and rejects unsupported wrapping or default overflow', () => {
    const guide = lineGuide();
    closeTo(first(transformPath(point(-20, 8), pathBendTransform({ ...{ ...options, overflow: 'extend' }, guide }), { ...options })), [10, 48]);
    closeTo(first(transformPath(point(130, -8), pathBendTransform({ ...{ ...options, overflow: 'extend' }, guide }), { ...options })), [160, 32]);
    expect(() => transformPath(point(-1, 0), pathBendTransform({ ...options, guide }), options)).toThrow(RangeError);
    expect(() => transformPath(point(101, 0), pathBendTransform({ ...options, guide }), options)).toThrow(RangeError);
    expect(() => transformPath(point(0, 0), pathBendTransform({ ...{ ...options, overflow: 'wrap' }, guide }), { ...options })).toThrow(/closed/);
    closeTo(first(transformPath(point(-20, 5), arcBendTransform({ ...options, arc: { ...arc, sweep: Math.PI }, overflow: 'extend' }), { ...options })), [195, 80]);
  });

  it('allows folds, circle-center collapse, self-intersections, and a source equal to its guide', () => {
    closeTo(first(transformPath(point(30, 100), arcBendTransform({ ...options, arc }), { ...options })), [100, 100]);
    const guide = new PathGeometry(); guide.moveTo(0, 0); guide.bezierCurveTo(200, 200, -100, 200, 100, 0);
    expect(transformPath(point(20, 200), pathBendTransform({ ...options, guide }), options).segmentCount).toBe(1);
    const same = new PathGeometry(); same.moveTo(0, 0); same.lineTo(100, 0);
    expect(toSvgPathData(transformPath(same, pathBendTransform({ ...options, guide: same }), options))).toBe('M 0 0 L 100 0');
  });

  it('rejects multiple contours, reversals, empty guides, and sharp closed seams', () => {
    const multi = lineGuide(); multi.moveTo(100, 0);
    const reversal = new PathGeometry(); reversal.moveTo(0, 0); reversal.bezierCurveTo(100, 0, -100, 0, 10, 0);
    const seam = new PathGeometry(); seam.moveTo(0, 0); seam.lineTo(100, 0); seam.lineTo(100, 100); seam.closePath();
    for (const guide of [multi, reversal, seam, new PathGeometry(), point(0, 0)]) {
      expect(() => transformPath(new PathGeometry(), pathBendTransform({ ...options, guide }), options)).toThrow(RangeError);
    }
  });

  it('rejects a cusp inside one guide segment even when adaptive halves are individually regular', () => {
    const quadratic = point(0, 0); quadratic.quadraticCurveTo(100, 100, 0, 0);
    const cubic = point(0, 0); cubic.bezierCurveTo(100, 100, 0, 100, 100, 0);
    for (const guide of [quadratic, cubic]) expect(() => transformPath(point(1, 0), pathBendTransform({ ...options, guide }), options)).toThrow(RangeError);
  });

  it('validates even empty input and leaves geometry/revisions unchanged on budget failures', () => {
    const source = point(0, 0); source.lineTo(100, 0);
    const guide = lineGuide(), revision = source.revision, guideRevision = guide.revision;
    expect(() => transformPath(source, pathBendTransform({ ...{ ...options }, guide }), { ...options, maxSegments: 1 })).toThrow(/maxSegments/);
    expect(source.revision).toBe(revision); expect(guide.revision).toBe(guideRevision);
    const empty = new PathGeometry();
    expect(transformPath(empty, pathBendTransform({ ...options, guide }), options)).not.toBe(empty);
    expect(() => transformPath(empty, pathBendTransform({ ...{ ...options }, guide }), { ...options, tolerance: 0 })).toThrow(RangeError);
    expect(() => transformPath(empty, arcBendTransform({ ...options, arc: { ...arc, radius: 0 } }), { ...options })).toThrow(RangeError);
    expect(() => transformPath(source, pathBendTransform({ ...{ ...options }, guide }), { ...options, tolerance: 1e-20 })).toThrow(RangeError);
  });

  it('rejects explicit null numeric options instead of silently applying defaults', () => {
    for (const key of ['baseline', 'offset', 'normalOffset', 'maxSegments']) {
      const invalid = { ...options, [key]: null } as unknown as (BendTransformOptions & TransformPathOptions);
      expect(() => transformPath(point(0, 0), pathBendTransform({ ...invalid, guide: lineGuide() }), invalid)).toThrow();
      expect(() => transformPath(point(0, 0), arcBendTransform({ ...invalid, arc }), { ...invalid })).toThrow();
    }
  });
});

it('accepts smooth cubic guides at fractional coordinates produced by scaled pointer drags', () => {
  const source = new PathGeometry(); source.rect(0, -28, 280, 56);
  for (let i = 1; i <= 10; i++) {
    const guide = new PathGeometry(); guide.moveTo(180, 330);
    guide.bezierCurveTo(280 + i * 6.01357, 230 + i * 15.01793, 520, 390, 620, 310);
    expect(() => transformPath(source, pathBendTransform({ ...{ source: { x: 0, y: -28, width: 280, height: 56 }, fit: 'stretch', overflow: 'extend' }, guide }), { tolerance: 0.15 })).not.toThrow();
  }
});
