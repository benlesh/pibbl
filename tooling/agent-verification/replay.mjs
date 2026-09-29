/** Native browser counterpart to the manually runnable Studio task. */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const repository = resolve(import.meta.dirname, '../..');
const url = process.argv[2] ?? 'http://127.0.0.1:5193/#/testing/agent-targeting-verification';
const output = resolve(process.argv[3] ?? `${repository}/packages/core/test/out/agent-targeting`);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'UTC', reducedMotion: 'reduce', colorScheme: 'light' });
page.setDefaultTimeout(10_000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const sourceFiles = [
  'tooling/agent-verification/targeting.ts',
  'packages/scenarios/src/agent-targeting-verification.example.tsx',
  'packages/scenarios/src/agent-targeting-verification.ts',
];
const hash = createHash('sha256');
for (const file of sourceFiles) hash.update(file).update(await readFile(resolve(repository, file)));
const report = {
  schema: 'crc-targeting-replay/1', status: 'incomplete', url,
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim(),
  sourceMode: true, sourceFiles, fixtureAndToolingSha256: hash.digest('hex'),
  node: process.version, browser: browser.version(), timestamp: new Date().toISOString(),
  environment: { viewport: { width: 1280, height: 1000 }, density: 1, locale: 'en-US', timezone: 'UTC' },
  oracle: { point: { x: 144, y: 112 }, expectedColor: [37, 99, 235, 255], requiredSelection: 'item-a' },
  steps: [], errors,
};
const readEvidence = () => page.locator('.scenario-runner__state-row').evaluateAll(rows => Object.fromEntries(rows.map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent])));
const button = action => page.locator(`[data-scenario-action="${action}"]`);
const waitField = (label, prefix) => page.waitForFunction(({ label, prefix }) => {
  const rows = [...document.querySelectorAll('.scenario-runner__state-row')];
  return rows.some(row => row.querySelector('dt')?.textContent === label && row.querySelector('dd')?.textContent?.startsWith(prefix));
}, { label, prefix });
try {
  await page.goto(url);
  await page.getByRole('heading', { name: 'Agent targeting verification', exact: true }).waitFor();
  const canvas = page.getByTestId('scenario-canvas');
  await canvas.waitFor();
  for (const [mode, action, delivery, selected, requirement] of [
    ['seed', null, 'decoration', 'none', 'fail:'],
    ['repair', 'repair', 'action', 'item-a', 'pass:'],
    ['intentional-block', 'intentional-block', 'decoration', 'none', 'pass: intentional block'],
  ]) {
    if (action) { await button(action).click(); await waitField('Mode', mode); }
    await button('inspect').click();
    await waitField('Inspection snapshot', 'ready');
    const prediction = await readEvidence();
    assert.match(prediction.Probe, /^target/);
    // Independent pixel coordinate; never derived from CRC inspection geometry.
    const pixel = await canvas.evaluate(canvas => [...canvas.getContext('2d').getImageData(144, 112, 1, 1).data]);
    assert.deepEqual(pixel, report.oracle.expectedColor);
    // Playwright native pointer transport uses the browser's host box.
    await canvas.click({ position: { x: 144, y: 112 } });
    await waitField('Delivered to', delivery);
    await waitField('Independent requirement', requirement);
    const actual = await readEvidence();
    assert.equal(actual['Selected item'], selected);
    assert.equal(actual['Selection count'], mode === 'repair' ? '1' : '0');
    assert.equal(actual['Delivery generation'], prediction['Inspection snapshot'].match(/generation ([0-9/]+)/)?.[1]);
    const winner = prediction.Probe.match(/winner (\d+)/)?.[1];
    const delivered = actual['Delivered to'].match(/target (\d+)/)?.[1];
    assert.ok(winner); assert.equal(delivered, winner);
    const screenshot = `${mode}.png`;
    await page.locator('.scenario-runner__visual').screenshot({ path: resolve(output, screenshot) });
    report.steps.push({ mode, expectedApplicationOutcome: mode === 'seed' ? 'fail-selection-requirement' : 'satisfy-mode-requirement', prediction, actual, pixel, screenshot, status: 'pass', transport: 'native-playwright-pointer' });
  }
  assert.deepEqual(errors, []);
  report.status = 'pass';
} catch (error) {
  report.status = 'fail';
  report.failure = String(error);
  throw error;
} finally {
  await writeFile(resolve(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  process.stdout.write(`${report.status}: ${resolve(output, 'report.json')}\n`);
}
