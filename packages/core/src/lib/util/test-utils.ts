import type { BrowserPage } from 'vitest/browser';
import { expect } from 'vitest';

function sanitizeFileName(name: string): string {
  // Replace invalid characters with underscores
  return name.replace(/[":<>|*?\r\n]/g, '_');
}

export function getScreenshotPath(name: string) {
  return `__screenshots__/${sanitizeFileName(name)}`;
}

export async function takeScreenshot(
  page: BrowserPage,
  nameOrOptions?: string | Omit<Parameters<BrowserPage['screenshot']>[0], 'path'>,
  options: Omit<Parameters<BrowserPage['screenshot']>[0], 'path'> = {},
) {
  const testName = expect.getState().currentTestName ?? 'unknown-test';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');

  // Handle overloaded parameters and sanitize the filename
  const [name, screenshotOptions] = typeof nameOrOptions === 'string' ?
      [nameOrOptions, options] :
      [`${testName}_${timestamp}.png`, nameOrOptions ?? {}];

  await page.screenshot({
    ...screenshotOptions,
    path: getScreenshotPath(name),
  });
}
