import { commands, page } from 'vitest/browser';

interface IgnoreRegion {
  reason: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface VisualComparisonOptions {
  element: Element;
  expectedPath: string;
  expectedArtifactPath: string;
  actualPath: string;
  diffPath: string;
  ignoreRegions?: readonly IgnoreRegion[];
}

interface DecodedImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export async function decodePng(base64: string): Promise<DecodedImage> {
  const response = await fetch(`data:image/png;base64,${base64}`);
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to create a 2D context for visual comparison.');
    }
    context.drawImage(bitmap, 0, 0);
    const image = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return {
      width: image.width,
      height: image.height,
      data: image.data,
    };
  } finally {
    bitmap.close();
  }
}

function isIgnored(
  x: number,
  y: number,
  regions: readonly IgnoreRegion[],
): boolean {
  return regions.some(region =>
    region.x <= x && x < region.x + region.width &&
    region.y <= y && y < region.y + region.height,
  );
}

export function createDiff(
  expected: DecodedImage,
  actual: DecodedImage,
  ignoreRegions: readonly IgnoreRegion[],
) {
  for (const [index, region] of ignoreRegions.entries()) {
    if (typeof region.reason !== 'string' || !region.reason.trim() ||
      ![region.x, region.y, region.width, region.height].every(Number.isSafeInteger) ||
      region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0 ||
      region.x + region.width > expected.width || region.y + region.height > expected.height) {
      throw new Error(`Invalid visual mask ${index}: require a reason and a nonempty integer rectangle inside the image.`);
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = expected.width;
  canvas.height = expected.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create a 2D context for visual diff output.');
  }
  const diff = context.createImageData(expected.width, expected.height);
  let differentPixels = 0;
  let maxChannelDelta = 0;
  let ignoredPixels = 0;
  let minX = expected.width, minY = expected.height, maxX = -1, maxY = -1;

  for (let y = 0; y < expected.height; y++) {
    for (let x = 0; x < expected.width; x++) {
      const offset = (y * expected.width + x) * 4;
      if (isIgnored(x, y, ignoreRegions)) {
        ignoredPixels++;
        diff.data[offset] = actual.data[offset];
        diff.data[offset + 1] = actual.data[offset + 1];
        diff.data[offset + 2] = actual.data[offset + 2];
        diff.data[offset + 3] = 80;
        continue;
      }

      let pixelDiffers = false;
      for (let channel = 0; channel < 4; channel++) {
        const delta = Math.abs(expected.data[offset + channel] - actual.data[offset + channel]);
        maxChannelDelta = Math.max(maxChannelDelta, delta);
        pixelDiffers ||= delta > 0;
      }

      if (pixelDiffers) {
        differentPixels++;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        diff.data[offset] = 239;
        diff.data[offset + 1] = 68;
        diff.data[offset + 2] = 68;
        diff.data[offset + 3] = 255;
      } else {
        const gray = Math.round(
          expected.data[offset] * 0.2126 +
          expected.data[offset + 1] * 0.7152 +
          expected.data[offset + 2] * 0.0722,
        );
        diff.data[offset] = gray;
        diff.data[offset + 1] = gray;
        diff.data[offset + 2] = gray;
        diff.data[offset + 3] = 72;
      }
    }
  }

  context.putImageData(diff, 0, 0);
  return {
    base64: canvas.toDataURL('image/png').split(',')[1],
    differentPixels,
    maxChannelDelta,
    ignoredPixels,
    comparedPixels: expected.width * expected.height - ignoredPixels,
    changedBounds: differentPixels ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null,
  };
}

/** Passive point-in-time observation; does not wait for or certify readiness. */
export function observeVisualCaptureContext(element: Element) {
  const document = element.ownerDocument;
  const view = document.defaultView;
  if (!view) throw new Error('Visual capture context unavailable: element has no browsing context.');
  const bounds = element.getBoundingClientRect();
  const canvas = element.namespaceURI === 'http://www.w3.org/1999/xhtml' && element.localName === 'canvas'
    ? element as HTMLCanvasElement : null;
  return {
    observedAt: view.performance.timeOrigin + view.performance.now(),
    coordinateSpace: 'element-owner-document-client-css-pixels',
    viewport: { width: view.innerWidth, height: view.innerHeight },
    scroll: { x: view.scrollX, y: view.scrollY },
    devicePixelRatio: view.devicePixelRatio,
    elementBounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    canvasBacking: canvas ? { width: canvas.width, height: canvas.height } : null,
    fontSetStatus: document.fonts?.status ?? 'unsupported',
  };
}

/** The JSON sidecar uses raster image pixels, not Canvas logical coordinates. */
export async function expectVisualMatch(
  options: VisualComparisonOptions,
): Promise<void> {
  const comparisonId = crypto.randomUUID();
  const artifactDirectory = `${options.diffPath}.runs/${comparisonId}`;
  const report: {
    schema: string;
    comparisonId: string;
    reportPath: string;
    status: 'unavailable' | 'match' | 'mismatch';
    stage: string;
    coordinateSpace: string;
    capture: {
      surface: 'browser-element-composition';
      renderGeneration: 'unknown';
      assetReadiness: 'unknown';
      atomicFrameObservation: false;
      before: ReturnType<typeof observeVisualCaptureContext> | null;
      after: ReturnType<typeof observeVisualCaptureContext> | null;
    };
    artifacts: { expected: string | null; actual: string | null; diff: string | null };
    dimensions: { expected: { width: number; height: number }; actual: { width: number; height: number } } | null;
    comparison: Omit<ReturnType<typeof createDiff>, 'base64'> | null;
    ignoreRegions: readonly IgnoreRegion[];
    error?: string;
  } = {
    comparisonId, reportPath: `${artifactDirectory}/report.json`,
    schema: 'crc-visual-comparison/1', status: 'unavailable', stage: 'capture',
    coordinateSpace: 'image-pixels',
    capture: { surface: 'browser-element-composition', renderGeneration: 'unknown', assetReadiness: 'unknown', atomicFrameObservation: false, before: null, after: null },
    artifacts: { expected: null, actual: null, diff: null },
    dimensions: null, comparison: null, ignoreRegions: options.ignoreRegions ?? [],
  };
  let comparisonFailure: { error: unknown } | undefined;
  try {
    report.capture.before = observeVisualCaptureContext(options.element);
    const actualCapture = await page.screenshot({ element: options.element, path: options.actualPath, base64: true });
    report.capture.after = observeVisualCaptureContext(options.element);
    report.stage = 'actual-retain';
    await commands.writeFile(`${artifactDirectory}/actual.png`, actualCapture.base64, 'base64');
    report.artifacts.actual = `${artifactDirectory}/actual.png`;
    report.stage = 'baseline-read';
    let expectedBase64: string;
    try {
      expectedBase64 = await commands.readFile(options.expectedPath, 'base64');
    } catch (error) {
      throw new Error(`Missing visual baseline "${options.expectedPath}". Inspect candidate "${actualCapture.path}".`, { cause: error });
    }
    await commands.writeFile(options.expectedArtifactPath, expectedBase64, 'base64');
    await commands.writeFile(`${artifactDirectory}/expected.png`, expectedBase64, 'base64');
    report.artifacts.expected = `${artifactDirectory}/expected.png`;
    report.stage = 'decode';
    const [expected, actual] = await Promise.all([decodePng(expectedBase64), decodePng(actualCapture.base64)]);
    report.dimensions = {
      expected: { width: expected.width, height: expected.height },
      actual: { width: actual.width, height: actual.height },
    };
    if (expected.width !== actual.width || expected.height !== actual.height) {
      report.status = 'mismatch';
      report.stage = 'dimensions';
      throw new Error(`Visual dimensions differ: expected ${expected.width}×${expected.height}, actual ${actual.width}×${actual.height}.`);
    }
    report.stage = 'compare';
    const { base64, ...comparison } = createDiff(expected, actual, report.ignoreRegions);
    report.comparison = comparison;
    if (comparison.comparedPixels === 0) throw new Error('Visual comparison unavailable: no unmasked pixels.');
    report.stage = 'diff-write';
    await commands.writeFile(options.diffPath, base64, 'base64');
    await commands.writeFile(`${artifactDirectory}/diff.png`, base64, 'base64');
    report.artifacts.diff = `${artifactDirectory}/diff.png`;
    report.stage = 'complete';
    report.status = comparison.differentPixels > 0 ? 'mismatch' : 'match';
    if (comparison.differentPixels > 0) {
      throw new Error(
        `Visual mismatch: ${comparison.differentPixels} pixels differ (max channel delta ${comparison.maxChannelDelta}). ` +
        `Inspect expected "${report.artifacts.expected}", actual "${report.artifacts.actual}", and diff "${report.artifacts.diff}". Report "${report.reportPath}".`,
      );
    }
  } catch (error) {
    comparisonFailure = { error };
    report.error = error instanceof Error ? error.message : String(error);
  }
  let persistenceFailure: { error: unknown } | undefined;
  try {
    const serialized = JSON.stringify(report, null, 2);
    await commands.writeFile(report.reportPath, serialized);
    // Compatibility/latest pointer only; retained evidence never uses these aliases.
    await commands.writeFile(`${options.diffPath}.json`, serialized);
  } catch (error) {
    persistenceFailure = { error };
  }
  if (comparisonFailure && persistenceFailure) {
    throw new AggregateError(
      [comparisonFailure.error, persistenceFailure.error],
      'Visual comparison failed and its report could not be fully persisted.',
      { cause: comparisonFailure.error },
    );
  }
  if (comparisonFailure) throw comparisonFailure.error;
  if (persistenceFailure) throw persistenceFailure.error;
}
