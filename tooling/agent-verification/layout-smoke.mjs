/** Focused source-Studio smoke, not a version-attested general replay. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const [url, output] = process.argv.slice(2);
assert.ok(url && output, 'Provide source Studio URL and a new report path.');
const report = { schema: 'crc-layout-studio-smoke/1', status: 'incomplete', provenance: 'controlled-local-studio-no-served-build-attestation', steps: [], errors: [] };
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => { if (report.errors.length < 16) report.errors.push(error.message.slice(0, 1000)); });
  await page.goto(url);
  const evidence = page.getByTestId('agent-layout-placement-evidence');
  const canvas = page.getByTestId('scenario-canvas');
  for (const [action, x, expectedClicks, assertion] of [['clipped', 300, 0, 'fail'], ['overflow-visible', 300, 1, 'pass'], ['repaired', 120, 2, 'pass'], ['overlap-allowed', 120, 3, 'pass'], ['overlap-prohibited', 120, 4, 'fail']]) {
    await page.locator(`[data-scenario-action="${action}"]`).click();
    await page.waitForFunction(action => {
      const el = document.querySelector('[data-testid="agent-layout-placement-evidence"]');
      if (!el?.textContent) return false;
      const state = JSON.parse(el.textContent).state;
      return state.status === 'ready' && state.mode === action;
    }, action);
    const before = JSON.parse(await evidence.textContent()).state;
    assert.equal(before.assertion, assertion);
    assert.deepEqual(before.allocation, { x: 0, y: 0, width: 20, height: 20 });
    assert.deepEqual(before.observed.center, { x, y: 90 });
    const overlaps = action.startsWith('overlap-');
    if (overlaps) {
      assert.deepEqual(before.relations.overlap, { relation: 'overlap', area: 200 });
      assert.equal(before.relations.assertions.separation, action === 'overlap-prohibited' ? 'fail' : 'not-requested');
    }
    await canvas.scrollIntoViewIfNeeded();
    const bounds = await canvas.boundingBox(); assert.ok(bounds);
    const scale = Math.min(bounds.width / 400, bounds.height / 240);
    await page.mouse.click(bounds.x + (bounds.width - 400 * scale) / 2 + (overlaps ? 130 : x) * scale, bounds.y + (bounds.height - 240 * scale) / 2 + 90 * scale);
    if (expectedClicks) await page.waitForFunction(count => JSON.parse(document.querySelector('[data-testid="agent-layout-placement-evidence"]').textContent).state.clicks === count, expectedClicks);
    const after = JSON.parse(await evidence.textContent()).state;
    assert.equal(after.clicks, expectedClicks);
    if (overlaps) assert.equal(after.lastActivated, 'peer');
    report.steps.push({ action, before, after });
  }
  assert.deepEqual(report.errors, []);
  report.status = 'pass';
} catch (error) { report.status = 'fail'; report.error = String(error).slice(0, 2000); process.exitCode = 1; }
finally { await browser.close(); await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); }
process.stdout.write(`${report.status}\n`);
