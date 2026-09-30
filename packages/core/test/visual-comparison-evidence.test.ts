import { expect, it, vi } from 'vitest';
import { commands } from 'vitest/browser';
import { decodePng, createDiff, expectVisualMatch, observeVisualCaptureContext } from './visual-compare';

it('reports exact unmasked changed bounds in image pixels, counting overlapping masks once', () => {
  const expected = { width: 5, height: 4, data: new Uint8ClampedArray(80) };
  const actual = { ...expected, data: expected.data.slice() };
  actual.data[(1 * 5 + 1) * 4] = 10;
  actual.data[(2 * 5 + 3) * 4 + 3] = 90;
  actual.data[(0 * 5 + 4) * 4] = 255;
  const result = createDiff(expected, actual, [
    { x: 4, y: 0, width: 1, height: 1, reason: 'Synthetic mask exercises exclusion accounting.' },
    { x: 4, y: 0, width: 1, height: 2, reason: 'Synthetic mask exercises exclusion accounting.' },
  ]);
  expect(result.differentPixels).toBe(2);
  expect(result.maxChannelDelta).toBe(90);
  expect(result.ignoredPixels).toBe(2);
  expect(result.comparedPixels).toBe(18);
  expect(result.changedBounds).toEqual({ x: 1, y: 1, width: 3, height: 2 });
});

it('reports null changed bounds for a match and distinguishes wholly masked evidence', () => {
  const image = { width: 2, height: 2, data: new Uint8ClampedArray(16) };
  const match = createDiff(image, image, []);
  expect(match.changedBounds).toBeNull();
  expect(match.comparedPixels).toBe(4);
  const masked = createDiff(image, image, [{ x: 0, y: 0, width: 2, height: 2, reason: 'Synthetic mask exercises exclusion accounting.' }]);
  expect(masked.comparedPixels).toBe(0);
  expect(masked.ignoredPixels).toBe(4);
});


it.each(['match', 'dimensions', 'masked', 'missing', 'decode'] as const)(
  'writes truthful machine evidence for %s', async kind => {
    const canvas = document.createElement('canvas');
    canvas.width = 4; canvas.height = 4;
    canvas.style.cssText = 'display:block;width:4px;height:4px;';
    canvas.getContext('2d')!.fillRect(0, 0, 4, 4);
    document.body.append(canvas);
    const prefix = `test-screenshots/visual-evidence/${kind}`;
    const expected = document.createElement('canvas');
    expected.width = kind === 'dimensions' ? 3 : 4; expected.height = 4;
    expected.getContext('2d')!.fillRect(0, 0, 4, 4);
    const expectedPath = `${prefix}.baseline.png`;
    if (kind !== 'missing') await commands.writeFile(expectedPath,
      kind === 'decode' ? btoa('not a PNG') : expected.toDataURL().split(',')[1], 'base64');
    try {
      const comparison = expectVisualMatch({ element: canvas,
        expectedPath: kind === 'missing' ? `${prefix}.never-exists.png` : expectedPath,
        expectedArtifactPath: `${prefix}.expected.png`, actualPath: `${prefix}.actual.png`, diffPath: `${prefix}.diff.png`,
        ignoreRegions: kind === 'masked' ? [{ x: 0, y: 0, width: 4, height: 4, reason: 'Synthetic mask exercises exclusion accounting.' }] : [],
      });
      if (kind === 'match') await comparison;
      else await expect(comparison).rejects.toThrow();
      const report = JSON.parse(await commands.readFile(`${prefix}.diff.png.json`, 'utf8'));
      expect(report.schema).toBe('crc-visual-comparison/1');
      expect(report.coordinateSpace).toBe('image-pixels');
      expect(report.capture.surface).toBe('browser-element-composition');
      expect(report.capture.renderGeneration).toBe('unknown');
      expect(report.capture.assetReadiness).toBe('unknown');
      for (const observed of [report.capture.before, report.capture.after]) {
        expect(observed.canvasBacking).toEqual({ width: 4, height: 4 });
        expect(observed.elementBounds.width).toBe(4);
        expect(observed.elementBounds.height).toBe(4);
        expect(observed.devicePixelRatio).toBe(window.devicePixelRatio);
        expect(observed.viewport).toEqual({ width: window.innerWidth, height: window.innerHeight });
        expect(['loading', 'loaded', 'unsupported']).toContain(observed.fontSetStatus);
      }
      expect(report.capture.after.observedAt).toBeGreaterThanOrEqual(report.capture.before.observedAt);
      expect(report.status).toBe(kind === 'match' ? 'match' : kind === 'dimensions' ? 'mismatch' : 'unavailable');
      expect(report.artifacts.diff).toBe(kind === 'match' ? `${prefix}.diff.png.runs/${report.comparisonId}/diff.png` : null);
      if (kind === 'match') {
        expect(report.comparison.comparedPixels).toBe(16);
        expect(report.comparison.differentPixels).toBe(0);
        expect(report.comparison.changedBounds).toBeNull();
      } else {
        expect(report.stage).toBe({ dimensions: 'dimensions', masked: 'compare', missing: 'baseline-read', decode: 'decode' }[kind]);
      }
    } finally { canvas.remove(); }
  },
);

it('retains a failed comparison and all its images after a successful rerun', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 4; canvas.height = 4;
  canvas.style.cssText = 'display:block;width:4px;height:4px;';
  const context = canvas.getContext('2d')!;
  context.fillRect(0, 0, 4, 4);
  document.body.append(canvas);
  const prefix = 'test-screenshots/visual-evidence/retention';
  const options = { element: canvas, expectedPath: `${prefix}.baseline.png`,
    expectedArtifactPath: `${prefix}.expected.png`, actualPath: `${prefix}.actual.png`, diffPath: `${prefix}.diff.png` };
  await commands.writeFile(options.expectedPath, canvas.toDataURL().split(',')[1], 'base64');
  try {
    context.fillStyle = 'red'; context.fillRect(1, 1, 1, 1);
    await expect(expectVisualMatch(options)).rejects.toThrow('Visual mismatch');
    const failed = JSON.parse(await commands.readFile(`${options.diffPath}.json`, 'utf8'));
    expect(failed.reportPath).toBeTypeOf('string');
    const failedReport = await commands.readFile(failed.reportPath, 'utf8');
    const images: Record<string, string> = {};
    for (const path of Object.values(failed.artifacts) as string[]) images[path] = await commands.readFile(path, 'base64');
    context.fillStyle = 'black'; context.fillRect(0, 0, 4, 4);
    await expectVisualMatch(options);
    const recovered = JSON.parse(await commands.readFile(`${options.diffPath}.json`, 'utf8'));
    expect(recovered.status).toBe('match');
    expect(recovered.comparisonId).not.toBe(failed.comparisonId);
    expect(recovered.reportPath).not.toBe(failed.reportPath);
    expect(await commands.readFile(failed.reportPath, 'utf8')).toBe(failedReport);
    for (const [path, bytes] of Object.entries(images)) expect(await commands.readFile(path, 'base64')).toBe(bytes);
    expect(JSON.parse(failedReport).comparison.changedBounds).toEqual({ x: 1, y: 1, width: 1, height: 1 });
  } finally { canvas.remove(); }
});

it('rejects undocumented, nonfinite, fractional, empty and out-of-image masks', () => {
  const image = { width: 4, height: 4, data: new Uint8ClampedArray(64) };
  const valid = { x: 1, y: 1, width: 1, height: 1, reason: 'Synthetic mask for validation test.' };
  for (const change of [
    { reason: undefined }, { reason: '  ' }, { x: NaN }, { y: Infinity },
    { width: -1 }, { height: 0 }, { x: -1 }, { x: 0.5 },
    { x: 4 }, { width: 4 },
  ]) {
    expect(() => createDiff(image, image, [{ ...valid, ...change } as never])).toThrow(/mask/i);
  }
});


it('distinguishes transformed CSS bounds from Canvas backing pixels and DOM composition', () => {
  const host = document.createElement('div');
  const canvas = document.createElement('canvas');
  canvas.width = 160; canvas.height = 80;
  canvas.style.cssText = 'width:80px;height:40px;transform:scale(1.5);transform-origin:top left;';
  host.append(canvas); document.body.append(host);
  try {
    const before = observeVisualCaptureContext(canvas);
    expect(before.canvasBacking).toEqual({ width: 160, height: 80 });
    expect(before.elementBounds).toMatchObject({ width: 120, height: 60 });
    expect(observeVisualCaptureContext(host).canvasBacking).toBeNull();
    canvas.style.width = '100px';
    expect(observeVisualCaptureContext(canvas).elementBounds.width).toBe(150);
    expect(before.elementBounds.width).toBe(120);
  } finally { host.remove(); }
});

it.each([
  { name: 'overlay', scale: 1, left: 10, changed: { x: 10, y: 10, width: 10, height: 10 }, pixels: 100 },
  { name: 'scaled-clipped-overlay', scale: 2, left: 35, changed: { x: 70, y: 20, width: 10, height: 20 }, pixels: 200 },
])('captures $name as browser composition rather than raw Canvas output', async ({ name, scale, left, changed, pixels }) => {
  const host = document.createElement('div');
  host.style.cssText = `position:relative;width:40px;height:40px;overflow:hidden;transform:scale(${scale});transform-origin:top left;`;
  const canvas = document.createElement('canvas');
  canvas.width = 40; canvas.height = 40;
  canvas.style.cssText = 'display:block;width:40px;height:40px;';
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#ff0000'; context.fillRect(0, 0, 40, 40);
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:absolute;left:${left}px;top:10px;width:10px;height:10px;background:#0000ff;`;
  host.append(canvas, overlay); document.body.append(host);
  const baseline = document.createElement('canvas');
  baseline.width = baseline.height = 40 * scale;
  const baselineContext = baseline.getContext('2d')!;
  baselineContext.fillStyle = '#ff0000'; baselineContext.fillRect(0, 0, baseline.width, baseline.height);
  const prefix = `test-screenshots/visual-evidence/${name}`;
  const options = { element: canvas, expectedPath: `${prefix}.baseline.png`,
    expectedArtifactPath: `${prefix}.expected.png`, actualPath: `${prefix}.actual.png`, diffPath: `${prefix}.diff.png` };
  await commands.writeFile(options.expectedPath, baseline.toDataURL().split(',')[1], 'base64');
  try {
    // Native Canvas readback cannot see its sibling DOM overlay.
    expect(Array.from(context.getImageData(left + 1, 11, 1, 1).data)).toEqual([255, 0, 0, 255]);
    await expect(expectVisualMatch(options)).rejects.toThrow('Visual mismatch');
    const report = JSON.parse(await commands.readFile(`${options.diffPath}.json`, 'utf8'));
    expect(report.capture.surface).toBe('browser-element-composition');
    expect(report.capture.before.canvasBacking).toEqual({ width: 40, height: 40 });
    expect(report.capture.before.elementBounds).toMatchObject({ width: 40 * scale, height: 40 * scale });
    expect(report.dimensions.actual).toEqual({ width: 40 * scale, height: 40 * scale });
    expect(report.comparison.differentPixels).toBe(pixels);
    expect(report.comparison.changedBounds).toEqual(changed);
    overlay.remove();
    await expectVisualMatch(options);
    expect(Array.from(context.getImageData(left + 1, 11, 1, 1).data)).toEqual([255, 0, 0, 255]);
  } finally { host.remove(); }
});


it.each(['drawImage', 'getImageData'] as const)('closes decoded bitmaps when %s fails', async stage => {
  const source = document.createElement('canvas'); source.width = source.height = 2;
  const png = source.toDataURL().split(',')[1];
  const failure = new DOMException('Injected readback failure', 'SecurityError');
  const close = vi.spyOn(ImageBitmap.prototype, 'close');
  if (stage === 'drawImage') vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage').mockImplementation(() => { throw failure; });
  else vi.spyOn(CanvasRenderingContext2D.prototype, 'getImageData').mockImplementation(() => { throw failure; });
  try {
    await expect(decodePng(png)).rejects.toBe(failure);
    expect(close).toHaveBeenCalledTimes(1);
  } finally { vi.restoreAllMocks(); }
});

it.each(['match', 'mismatch'] as const)('report persistence failure cannot hide %s outcome', async outcome => {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 4;
  canvas.style.cssText = 'display:block;width:4px;height:4px;';
  const context = canvas.getContext('2d')!;
  context.fillRect(0, 0, 4, 4);
  document.body.append(canvas);
  const prefix = 'test-screenshots/visual-evidence/report-write-failure';
  const expectedPath = `${prefix}.baseline.png`;
  await commands.writeFile(expectedPath, canvas.toDataURL().split(',')[1], 'base64');
  if (outcome === 'mismatch') { context.fillStyle = 'red'; context.fillRect(0, 0, 4, 4); }
  const originalWrite = commands.writeFile.bind(commands);
  const persistenceFailure = new Error('Injected report storage failure');
  vi.spyOn(commands, 'writeFile').mockImplementation(async (...args) => {
    if (args[0].endsWith('/report.json')) throw persistenceFailure;
    return originalWrite(...args);
  });
  try {
    const failure = await expectVisualMatch({ element: canvas, expectedPath,
      expectedArtifactPath: `${prefix}.expected.png`, actualPath: `${prefix}.actual.png`, diffPath: `${prefix}.diff.png` }).then(
        () => { throw new Error('Comparison unexpectedly passed'); }, error => error,
      );
    if (outcome === 'match') { expect(failure).toBe(persistenceFailure); return; }
    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure.errors).toHaveLength(2);
    expect(failure.errors[0].message).toContain('Visual mismatch: 16 pixels');
    expect(failure.errors[1]).toBe(persistenceFailure);
    expect(failure.cause).toBe(failure.errors[0]);
  } finally { vi.restoreAllMocks(); canvas.remove(); }
});
