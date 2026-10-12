import assert from 'node:assert/strict';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { sourceIdentity } from './identity.mjs';

const origin = process.argv[2] ?? 'http://127.0.0.1:5199';
const output = resolve(process.argv[3] ?? '/tmp/pibbl-chart-application');
await mkdir(output, { recursive: false });
const repository = resolve(import.meta.dirname, '../..');
const report = { schema: 'pibbl-viz-replay/1', status: 'incomplete', scope: 'One cooperating application reusing hover-comparison; not the fixed native viz replay or requirement closure.', node: process.version, steps: [], checks: [], errors: [], provenance: 'Source development; application-owned snapshots plus source-only prototype inspection. No build attestation.' };
report.identity = await sourceIdentity(repository, 'viz');
report.files = {};
for (const path of ['tooling/agent-verification/chart-application.ts', 'tooling/agent-verification/chart-application-replay.mjs']) report.files[path] = createHash('sha256').update(await readFile(resolve(repository, path))).digest('hex');
let browser;
try {
  browser = await chromium.launch({ headless: !process.argv.includes('--headed') });
  report.browser = browser.version();
  const page = await browser.newPage({ viewport: { width: 1200, height: 850 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.errors.push(error.message));
  report.url = `${origin}/#/examples/composition/viz-hover-comparison`;
  await page.goto(report.url);
  await page.evaluate(async root => {
    const { mountChartApplication } = await import(`/@fs${root}/tooling/agent-verification/chart-application.ts`);
    const { createSignalInspector } = await import(`/@fs${root}/tooling/agent-verification/signals.ts`);
    const { createTargetingInspector } = await import(`/@fs${root}/tooling/agent-verification/targeting.ts`);
    document.body.replaceChildren();
    const canvas = document.createElement('canvas');
    canvas.width = 1000; canvas.height = 620;
    canvas.style.cssText = 'width:1000px;height:620px;display:block';
    document.body.style.cssText = 'margin:0;background:white';
    const controls = document.createElement('div'); document.body.append(controls, canvas);
    const app = mountChartApplication(canvas);
    const signals = createSignalInspector(canvas); signals.register(app.data); signals.register(app.domain);
    const targeting = createTargetingInspector(canvas);
    const panel = document.createElement('pre'); document.body.append(panel);
    const keys = { s: 'seed', r: 'repair', z: 'zoom', p: 'pan', h: 'reset' };
    document.addEventListener('keydown', async event => { if (keys[event.key]) { app[keys[event.key]](); await settle(); capture(); } });
    for (const action of ['seed', 'repair', 'zoom', 'pan', 'reset']) {
      const button = document.createElement('button'); button.textContent = action; button.dataset.action = action;
      button.onclick = async () => { app[action](); await settle(); capture(); }; controls.append(button);
    }
    const settle = async () => {
      const deadline = performance.now() + 5000;
      for (let i = 0; ; i++) {
        await new Promise(requestAnimationFrame);
        const s = targeting.snapshot();
        if (i >= 2 && s.status === 'ready' && s.generation.requested === s.generation.completed && !s.pendingRealmWork) return;
        if (performance.now() > deadline) throw new Error('Chart did not settle within five seconds');
      }
    };
    const capture = () => {
      const scene = targeting.snapshot();
      const pixelCount = (x, y) => {
        const bytes = canvas.getContext('2d').getImageData(Math.round(x)-3, Math.round(y)-3, 7, 7).data;
        let count = 0;
        for (let i = 0; i < bytes.length; i += 4) if (bytes[i+2] > bytes[i]+60 && bytes[i+2] > bytes[i+1]+20) count++;
        return count;
      };
      const state = { application: app.state(), signals: signals.snapshot(), committed: scene,
        targeting: { inside: targeting.probe(scene.generation, 513.5, 362.5), outside: targeting.probe(scene.generation, 40, 362.5) },
        pixels: { initialSegment: pixelCount(284.25, 409.375), repairedSegment: pixelCount(284.25, 362.5) } };
      panel.textContent = JSON.stringify(state.application, null, 2);
      return state;
    };
    window.chartExercise = { app, settle, capture, dispose() { signals.dispose(); targeting.dispose(); app.dispose(); } };
  }, repository);
  const capture = async actionId => {
    await page.evaluate(() => window.chartExercise.settle());
    const state = await page.evaluate(() => window.chartExercise.capture());
    report.steps.push({ actionId, status: 'pass', state });
    await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
    return state;
  };
  const check = (id, actionId, test) => {
    try { test(); report.checks.push({ checkId: id, actionId, status: 'pass', required: true }); }
    catch (error) { report.steps.find(step => step.actionId === actionId).status = 'fail'; report.checks.push({ checkId: id, actionId, status: 'fail', required: true, reason: error.message }); throw error; }
  };
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  await page.mouse.move(bounds.x + 513.5, bounds.y + 362.5);
  const initial = await capture('initial');
  check('initial.geometry', 'initial', () => assert.deepEqual(initial.application.rendered.plot, { x: 55, y: 175, width: 917, height: 375 }));
  check('initial.identity', 'initial', () => assert.deepEqual(initial.application.rendered.results[0].provenance, { kind: 'recorded', index: 1, id: 'middle' }));
  check('initial.value', 'initial', () => assert.equal(initial.application.rendered.results[0].y, 20));
  check('initial.pixels', 'initial', () => assert.ok(initial.pixels.initialSegment > 0 && initial.pixels.repairedSegment === 0));
  await page.keyboard.press('s');
  const failure = await capture('same-reference-bug');
  check('bug.source', 'same-reference-bug', () => assert.equal(failure.application.source[1].y, 30));
  check('bug.stale-result', 'same-reference-bug', () => assert.equal(failure.application.rendered.results[0].y, 20));
  check('bug.signal-version', 'same-reference-bug', () => assert.equal(failure.signals.records[0].version, initial.signals.records[0].version));
  check('bug.render-generation', 'same-reference-bug', () => assert.deepEqual(failure.committed.generation, initial.committed.generation));
  check('bug.pixels', 'same-reference-bug', () => assert.deepEqual(failure.pixels, initial.pixels));
  report.steps.at(-1).diagnosis = 'Source row changed from 20 to 30; signal version and completed generation did not advance; retained hover and pixels still represent 20. Object.is same-reference publication is the application cause.';
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ ...report, status: 'fail', checks: [...report.checks, { checkId: 'application.reading-agreement', actionId: 'same-reference-bug', status: 'fail', required: true, reason: 'Independent update intent: 30; actual retained hover: 20. Controlled expected failure.' }] }, null, 2));
  await page.keyboard.press('r');
  const repaired = await capture('immutable-repair');
  check('repair.value', 'immutable-repair', () => assert.equal(repaired.application.rendered.results[0].y, 30));
  check('repair.identity', 'immutable-repair', () => assert.equal(repaired.application.rendered.results[0].provenance.id, 'middle'));
  check('repair.publication', 'immutable-repair', () => assert.equal(repaired.signals.records[0].version, failure.signals.records[0].version + 1));
  check('repair.render', 'immutable-repair', () => assert.ok(repaired.committed.generation.completed > failure.committed.generation.completed));
  check('repair.pixels', 'immutable-repair', () => assert.ok(repaired.pixels.repairedSegment > 0 && repaired.pixels.initialSegment === 0));
  await page.keyboard.press('z');
  await page.mouse.move(bounds.x + 513.5, bounds.y + 362.5);
  const zoom = await capture('zoom');
  check('zoom.domain', 'zoom', () => assert.deepEqual(zoom.application.domain, [2.5, 7.5]));
  check('zoom.mapping', 'zoom', () => assert.equal(zoom.application.rendered.inspection, 5));
  await page.keyboard.press('p');
  await page.evaluate(() => window.chartExercise.settle());
  await page.mouse.move(bounds.x + 513.5 + 1, bounds.y + 362.5);
  const pan = await capture('pan');
  check('pan.domain', 'pan', () => assert.deepEqual(pan.application.domain, [3.5, 8.5]));
  check('pan.mapping', 'pan', () => assert.ok(Math.abs(pan.application.rendered.inspection - (6 + 5/917)) < 1e-8));
  check('pan.identity', 'pan', () => assert.equal(pan.application.rendered.results[0].provenance.id, 'middle'));
  check('pan.anchor', 'pan', () => assert.ok(Math.abs(pan.application.rendered.results[0].anchor.x - 275.1) < 1e-8));
  check('target.inside', 'pan', () => assert.equal(pan.targeting.inside.status, 'target'));
  check('target.outside', 'pan', () => assert.equal(pan.targeting.outside.targetId, null));
  // This existing example has no Clip. Record that limit rather than inventing clipping evidence.
  check('clip.scope', 'pan', () => assert.ok(pan.committed.records.every(record => record.clipCount === 0)));
  await page.mouse.move(bounds.x + 40, bounds.y + 362.5);
  const outside = await capture('outside-plot');
  check('outside.actual-hover', 'outside-plot', () => assert.equal(outside.application.rendered.inspection, null));
  await page.keyboard.press('h');
  await page.mouse.move(bounds.x + 513.5, bounds.y + 362.5);
  const reset = await capture('reset');
  check('reset.value', 'reset', () => assert.equal(reset.application.rendered.results[0].y, 20));
  check('page.errors', 'reset', () => assert.deepEqual(report.errors, []));
  report.status = 'pass';
  if (process.argv.includes('--headed')) { process.stdout.write('Manual controls ready. Keys: s seed, r repair, z zoom, p pan, h reset. Close the browser to finish.\n'); await page.waitForEvent('close', { timeout: 0 }); }
  else await page.evaluate(() => window.chartExercise.dispose());
} catch (error) {
  report.status = 'fail'; report.errors.push(error.message); process.exitCode = 1;
} finally {
  await browser?.close();
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ status: report.status, checks: report.checks.length, next: ['node', 'tooling/agent-verification/evidence-reader.mjs', resolve(output, 'report.json'), '--action', report.status === 'pass' ? 'immutable-repair' : report.checks.at(-1)?.actionId ?? 'initial'] }) + '\n');
}
