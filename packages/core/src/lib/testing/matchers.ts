import type { Assertion } from 'vitest';
import { expect } from 'vitest';

interface ToMatchScreenshotOptions {
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

function compareImages(actual: ImageData, expected: ImageData): { diffCount: number; diffImageData: ImageData } {
  const diffImageData = new ImageData(actual.width, actual.height);
  let diffCount = 0;

  // First check dimensions
  if (actual.width !== expected.width || actual.height !== expected.height) {
    diffCount = Math.max(actual.width * actual.height, expected.width * expected.height);
    return { diffCount, diffImageData };
  }

  // Create a white background
  for (let i = 0; i < diffImageData.data.length; i += 4) {
    diffImageData.data[i] = 255;
    diffImageData.data[i + 1] = 255;
    diffImageData.data[i + 2] = 255;
    diffImageData.data[i + 3] = 255;
  }

  for (let i = 0; i < actual.data.length; i += 4) {
    if (actual.data[i] !== expected.data[i] ||
        actual.data[i + 1] !== expected.data[i + 1] ||
        actual.data[i + 2] !== expected.data[i + 2] ||
        actual.data[i + 3] !== expected.data[i + 3]) {
      diffCount++;
      
      // Mark differences in bright magenta
      diffImageData.data[i] = 255;
      diffImageData.data[i + 1] = 0;
      diffImageData.data[i + 2] = 255;
      diffImageData.data[i + 3] = 255;

      // Draw a highlight box around the diff pixel
      const x = (i / 4) % actual.width;
      const y = Math.floor((i / 4) / actual.width);
      
      // Draw a 3x3 highlight box
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < actual.width && ny >= 0 && ny < actual.height) {
            const idx = (ny * actual.width + nx) * 4;
            // Only highlight if not already a diff pixel
            if (diffImageData.data[idx + 3] !== 255) {
              diffImageData.data[idx] = 255;
              diffImageData.data[idx + 1] = 255;
              diffImageData.data[idx + 2] = 0;
              diffImageData.data[idx + 3] = 128;
            }
          }
        }
      }
    } else {
      // Copy unchanged pixels with slight transparency
      diffImageData.data[i] = actual.data[i];
      diffImageData.data[i + 1] = actual.data[i + 1];
      diffImageData.data[i + 2] = actual.data[i + 2];
      diffImageData.data[i + 3] = 64;
    }
  }

  return { diffCount, diffImageData };
}

function showVisualOverlay(
  actual: ImageData,
  expected: ImageData,
  diff: ImageData,
  stats: { diffCount: number; totalPixels: number }
) {
  const doc = window.top!.document;
  
  // Create overlay container
  const overlay = doc.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.padding = '20px';
  overlay.style.boxSizing = 'border-box';
  overlay.style.color = 'white';
  overlay.style.fontFamily = 'monospace';

  // Add header with stats
  const header = doc.createElement('div');
  header.style.marginBottom = '20px';
  header.innerHTML = `
    <div style="font-size: 16px; margin-bottom: 10px;">
      Visual Regression Test Results
    </div>
    <div>
      Dimensions: ${actual.width}x${actual.height}
      | Different Pixels: ${stats.diffCount}
      | Difference: ${((stats.diffCount / stats.totalPixels) * 100).toFixed(2)}%
    </div>
  `;
  overlay.appendChild(header);

  // Create image comparison container
  const comparisonContainer = doc.createElement('div');
  comparisonContainer.style.display = 'flex';
  comparisonContainer.style.gap = '20px';
  comparisonContainer.style.justifyContent = 'center';
  comparisonContainer.style.flex = '1';
  comparisonContainer.style.minHeight = '0';

  function createPreview(imageData: ImageData, label: string, borderColor: string) {
    const container = doc.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';

    const labelEl = doc.createElement('div');
    labelEl.textContent = label;
    labelEl.style.marginBottom = '10px';
    container.appendChild(labelEl);

    const canvas = doc.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    canvas.style.border = `2px solid ${borderColor}`;
    canvas.style.maxHeight = 'calc(100vh - 150px)';
    canvas.style.objectFit = 'contain';

    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);
    container.appendChild(canvas);

    return container;
  }

  comparisonContainer.appendChild(createPreview(actual, 'Actual', '#ff5f5f'));
  comparisonContainer.appendChild(createPreview(expected, 'Expected', '#5fff5f'));
  comparisonContainer.appendChild(createPreview(diff, 'Difference', '#5f5fff'));
  overlay.appendChild(comparisonContainer);

  // Add close button
  const closeButton = doc.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.style.position = 'absolute';
  closeButton.style.top = '10px';
  closeButton.style.right = '10px';
  closeButton.style.padding = '5px 10px';
  closeButton.style.cursor = 'pointer';
  closeButton.onclick = () => doc.body.removeChild(overlay);
  overlay.appendChild(closeButton);

  doc.body.appendChild(overlay);
}

expect.extend({
  async toMatchScreenshot(
    received: { base64: string },
    options: ToMatchScreenshotOptions = {},
  ) {
    const { failureThreshold = 0 } = options;
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
      const { diffCount, diffImageData } = compareImages(actualImageData, expectedImageData);

      const totalPixels = actualImageData.width * actualImageData.height;
      const diffPercentage = (diffCount / totalPixels) * 100;
      const pass = diffPercentage <= failureThreshold;

      if (!pass) {
        showVisualOverlay(actualImageData, expectedImageData, diffImageData, {
          diffCount,
          totalPixels,
        });
      }

      return {
        pass,
        message: () => `Screenshot differs by ${diffCount} pixels (${diffPercentage.toFixed(2)}%).
Dimensions: ${actualImageData.width}x${actualImageData.height}`,
      };
    } catch (error) {
      return {
        pass: false,
        message: () => `Failed to compare images: ${error instanceof Error ? error.message : 'Unknown error'}
Actual length: ${received.base64.length}
Expected length: ${matchResult.expected.length}`,
      };
    }
  },
});
