import type { Assertion } from 'vitest';
import { expect } from 'vitest';

interface ToMatchScreenshotOptions {
  threshold?: number;
  failureThreshold?: number;
}

interface CustomMatchers<R = unknown> {
  toMatchScreenshot: (options?: ToMatchScreenshotOptions) => Promise<R>;
}

declare module 'vitest' {
  interface Assertion extends CustomMatchers {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

function stripQuotes(str: string): string {
  return str.replace(/^["']|["']$/g, '');
}

async function base64ToImageData(base64: string): Promise<ImageData> {
  const img = new Image();
  return new Promise((resolve, reject) => {
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, img.width, img.height));
    };
    img.onerror = () => reject(new Error(`Failed to load image from base64 string (length: ${base64.length})`));
    const cleanBase64 = stripQuotes(base64);
    img.src = cleanBase64.startsWith('data:') ? cleanBase64 : `data:image/png;base64,${cleanBase64}`;
  });
}

function compareImages(actual: ImageData, expected: ImageData, threshold: number = 0): { diffCount: number; diffImageData: ImageData } {
  const diffImageData = new ImageData(actual.width, actual.height);
  let diffCount = 0;

  // First check dimensions
  if (actual.width !== expected.width || actual.height !== expected.height) {
    diffCount = Math.max(actual.width * actual.height, expected.width * expected.height);
    return { diffCount, diffImageData };
  }

  for (let i = 0; i < actual.data.length; i += 4) {
    const rDiff = Math.abs(actual.data[i] - expected.data[i]);
    const gDiff = Math.abs(actual.data[i + 1] - expected.data[i + 1]);
    const bDiff = Math.abs(actual.data[i + 2] - expected.data[i + 2]);
    const aDiff = Math.abs(actual.data[i + 3] - expected.data[i + 3]);

    if (rDiff > threshold || gDiff > threshold || bDiff > threshold || aDiff > threshold) {
      diffCount++;
      diffImageData.data[i] = 255; // R
      diffImageData.data[i + 1] = 0; // G
      diffImageData.data[i + 2] = 0; // B
      diffImageData.data[i + 3] = 255; // A
    }
  }

  return { diffCount, diffImageData };
}

expect.extend({
  async toMatchScreenshot(
    received: { base64: string },
    options: ToMatchScreenshotOptions = {},
  ) {
    const { threshold = 0, failureThreshold = 0 } = options;
    const snapshotState = (expect as any).getState().snapshotState;
    const testName = (expect as any).getState().currentTestName;

    const matchResult = snapshotState.match({
      testName,
      received: received.base64,
      isInline: false,
    });

    if (!matchResult.expected) {
      return { pass: true, message: () => 'First snapshot created' };
    }

    try {
      const actualImageData = await base64ToImageData(received.base64);
      const expectedImageData = await base64ToImageData(matchResult.expected);
      const { diffCount } = compareImages(actualImageData, expectedImageData, threshold);

      const totalPixels = actualImageData.width * actualImageData.height;
      const diffPercentage = (diffCount / totalPixels) * 100;

      const pass = diffPercentage <= failureThreshold;
      return {
        pass,
        message: () => `Screenshot differs by ${diffCount} pixels (${diffPercentage.toFixed(2)}%).
Dimensions: ${actualImageData.width}x${actualImageData.height} vs ${expectedImageData.width}x${expectedImageData.height}`,
      };
    } catch (error) {
      return {
        pass: false,
        message: () => `Failed to compare images: ${error instanceof Error ? error.message : 'Unknown error'}
Actual length: ${received.base64.length}
Expected length: ${matchResult.expected.length}
Actual starts with: ${received.base64.substring(0, 20)}
Expected starts with: ${matchResult.expected.substring(0, 20)}`,
      };
    }
  },
});
