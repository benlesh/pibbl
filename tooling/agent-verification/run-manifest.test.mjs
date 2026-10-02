import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
<<<<<<< HEAD
import { capturePageEnvironment, createReplayManifest } from './run-manifest.mjs';
=======
import { createReplayManifest } from './run-manifest.mjs';
>>>>>>> origin/main

test('records an executable rerun recipe without reusing evidence or copying ambient secrets', () => {
  const manifest = createReplayManifest({ runId: 'fixture-run', repository: '/tmp/crc fixture', kind: 'viz', url: 'http://127.0.0.1:5195/#/testing/viz-hover-lab', density: 2 });
  assert.equal(manifest.runId, 'fixture-run');
  assert.equal(manifest.rerun.executable, process.execPath);
  assert.deepEqual(manifest.rerun.arguments, [resolve('/tmp/crc fixture/tooling/agent-verification/viz-replay.mjs'), 'http://127.0.0.1:5195/#/testing/viz-hover-lab']);
  assert.deepEqual(manifest.rerun.environment, { CRC_VERIFY_DENSITY: '2' });
  assert.deepEqual(manifest.rerun.unsetEnvironment, ['CRC_VERIFY_BROWSER_ENDPOINT']);
  assert.equal(manifest.rerun.cwd, '/tmp/crc fixture');
  assert.equal(manifest.rerun.outputPolicy, 'fresh-default-directory');
  assert.equal(manifest.environment.node, process.version);
  assert.ok(Number.isFinite(Date.parse(manifest.startedAt)));
  assert.equal(manifest.clock, 'UTC-wall-clock');
});

test('targeting recipe keeps its fixed density and rejects invalid configurations', () => {
  const args = { runId: 'run', repository: '/tmp/crc', kind: 'targeting', url: 'http://localhost:5195/#/testing/agent-targeting-verification', density: 1 };
  const manifest = createReplayManifest(args);
  assert.ok(manifest.rerun.arguments[0].endsWith('/replay.mjs'));
  assert.deepEqual(manifest.rerun.environment, {});
  assert.throws(() => createReplayManifest({ ...args, kind: 'unknown' }), /kind/);
  assert.throws(() => createReplayManifest({ ...args, density: 2 }), /density/);
  assert.throws(() => createReplayManifest({ ...args, kind: 'viz', density: 3 }), /density/);
});
<<<<<<< HEAD


test('records observed page environment separately from requested options', { timeout: 15000 }, async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 2,
      locale: 'fr-FR', timezoneId: 'America/Chicago', colorScheme: 'dark', reducedMotion: 'reduce' });
    const first = await capturePageEnvironment(page);
    assert.equal(first.status, 'observed');
    assert.deepEqual(first.viewportCss, { width: 640, height: 480 });
    assert.equal(first.devicePixelRatio, 2);
    assert.equal(first.language, 'fr-FR');
    assert.equal(first.timezone, 'America/Chicago');
    assert.deepEqual(first.preferences, { dark: true, reducedMotion: true });
    assert.equal(first.browserZoom, 'unavailable');
    assert.deepEqual(await capturePageEnvironment(page), first);
    await page.setViewportSize({ width: 800, height: 600 });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
    const changed = await capturePageEnvironment(page);
    assert.deepEqual(changed.viewportCss, { width: 800, height: 600 });
    assert.deepEqual(changed.preferences, { dark: false, reducedMotion: false });
    assert.deepEqual(first.viewportCss, { width: 640, height: 480 });
    await page.close();
    const unavailable = await capturePageEnvironment(page);
    assert.equal(unavailable.status, 'unavailable');
    assert.equal(typeof unavailable.failure.message, 'string');
    assert.equal(unavailable.viewportCss, undefined);
  } finally { await browser.close(); }
});
=======
>>>>>>> origin/main
