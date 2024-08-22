import { expect, test } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('http://localhost:5173/playground/');
  // make this not flaky
  await page.waitForSelector('canvas')
  await page.waitForTimeout(100)
  // await page.screenshot({ path: 'screenshot.png' });
  expect(await page.title()).toBe('Canvas Render Components');

  // Expect a title "to contain" a substring.
  // await expect(page).toHaveTitle(/Playwright/);
});
