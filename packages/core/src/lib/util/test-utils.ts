import type { BrowserPage } from '@vitest/browser/context';
import { expect } from 'vitest';

export function getScreenshotPath(name: string) {
  return `__screenshots__/${name}`;
}

export async function takeScreenshot(
  page: BrowserPage,
  nameOrOptions?: string | Omit<Parameters<BrowserPage['screenshot']>[0], 'path'>,
  options: Omit<Parameters<BrowserPage['screenshot']>[0], 'path'> = {},
) {
  // Get current test name from Vitest
  const testName = expect.getState().currentTestName ?? 'unknown-test';

  // Generate timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');

  // Handle overloaded parameters
  const [name, screenshotOptions] = typeof nameOrOptions === 'string' ?
      [nameOrOptions, options] :
      [`${testName}_${timestamp}.png`, nameOrOptions ?? {}];

  await page.screenshot({
    ...screenshotOptions,
    path: getScreenshotPath(name),
  });
}
