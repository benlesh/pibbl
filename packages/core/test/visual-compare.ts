import { commands, page } from 'vitest/browser';

interface IgnoreRegion {
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

async function decodePng(base64: string): Promise<DecodedImage> {
  const response = await fetch(`data:image/png;base64,${base64}`);
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create a 2D context for visual comparison.');
  }
  context.drawImage(bitmap, 0, 0);
  const image = context.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();
  return {
    width: image.width,
    height: image.height,
    data: image.data,
  };
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

function createDiff(
  expected: DecodedImage,
  actual: DecodedImage,
  ignoreRegions: readonly IgnoreRegion[],
): { base64: string; differentPixels: number; maxChannelDelta: number } {
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

  for (let y = 0; y < expected.height; y++) {
    for (let x = 0; x < expected.width; x++) {
      const offset = (y * expected.width + x) * 4;
      if (isIgnored(x, y, ignoreRegions)) {
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
  };
}

export async function expectVisualMatch(
  options: VisualComparisonOptions,
): Promise<void> {
  const actualCapture = await page.screenshot({
    element: options.element,
    path: options.actualPath,
    base64: true,
  });

  let expectedBase64: string;
  try {
    expectedBase64 = await commands.readFile(options.expectedPath, 'base64');
  } catch (error) {
    throw new Error(
      `Missing visual baseline "${options.expectedPath}". Inspect candidate "${actualCapture.path}".`,
      { cause: error },
    );
  }
  await commands.writeFile(options.expectedArtifactPath, expectedBase64, 'base64');

  const [expected, actual] = await Promise.all([
    decodePng(expectedBase64),
    decodePng(actualCapture.base64),
  ]);
  if (expected.width !== actual.width || expected.height !== actual.height) {
    throw new Error(
      `Visual dimensions differ: expected ${expected.width}×${expected.height}, actual ${actual.width}×${actual.height}.`,
    );
  }

  const diff = createDiff(expected, actual, options.ignoreRegions ?? []);
  await commands.writeFile(options.diffPath, diff.base64, 'base64');
  if (diff.differentPixels > 0) {
    throw new Error(
      `Visual mismatch: ${diff.differentPixels} pixels differ (max channel delta ${diff.maxChannelDelta}). ` +
      `Inspect expected "${options.expectedArtifactPath}", actual "${options.actualPath}", and diff "${options.diffPath}".`,
    );
  }
}
