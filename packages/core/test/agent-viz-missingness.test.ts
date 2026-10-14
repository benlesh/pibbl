import { expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { getScenarioBySlug, loadScenario } from '@crc/scenarios';
import { moveMouse } from './support/mouse-input';
import { createTextRecorder } from '../../../tooling/agent-verification/text';

it.each([1000, 375])('preserves zero and distinct missing/invalid categories in a %i-pixel shared plot', async width => {
  const originalViewport = { width: window.innerWidth, height: window.innerHeight };
  await page.viewport(1200, 900);
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = 620;
  canvas.style.cssText = `width:${width}px;height:620px`;
  const host = document.createElement('div'); document.body.append(canvas, host);
  const controller = await (await loadScenario(getScenarioBySlug('viz-hover-lab')!)).mount({ canvas, referenceHost: host });
  let text = createTextRecorder(canvas.getContext('2d')!, { capacity: 256, fixtureText: ['0.00 ppm · recorded', '25.00 ppm · estimated'] });
  const drawnLabels = () => text.snapshot().records.flatMap(record => record.content.status === 'fixture' ? [record.content.value] : []);
  const restartText = () => {
    text.dispose();
    text = createTextRecorder(canvas.getContext('2d')!, { capacity: 256, fixtureText: ['0.00 ppm · recorded', '25.00 ppm · estimated'] });
  };
  try {
    await controller.perform('zero-missing-invalid');
    const zero = controller.getState();
    expect(zero.missingness).toMatchObject({ policy: 'finite-including-zero;missing-and-invalid-break-segments', counts: { input: 10, finite: 5, zero: 1, missing: 2, invalid: 3 } });
    expect(zero.missingness.rows.map((row: any) => row.value.kind)).toEqual(['number', 'number', 'number', 'missing-null', 'missing-undefined', 'invalid-nan', 'invalid-positive-infinity', 'invalid-negative-infinity', 'number', 'number']);
    expect(zero.results.find((value: any) => value.series === 'monthly')).toMatchObject({ kind: 'exact', x: 1, y: 0 });
    expect(drawnLabels()).toContain('0.00 ppm · recorded');
    expect(text.snapshot().observationFailures).toBe(0);
    const top = width < 650 ? 235 : 175;
    expect(zero.plot).toEqual({ x: 55, y: top, width: width - 83, height: 620 - top - 70 });
    for (const x of [2.5, 3, 4, 5, 6, 7, 7.5]) {
      restartText();
      await moveMouse(canvas, { x: 55 + (width - 83) * x / 10, y: top + (620 - top - 70) / 2 });
      await controller.settled();
      expect(controller.getState().results.some((value: any) => value.series === 'monthly')).toBe(false);
      expect(drawnLabels()).not.toContain('0.00 ppm · recorded');
      expect(text.snapshot().total).toBeGreaterThan(0);
      expect(text.snapshot().dropped).toBe(0);
      expect(text.snapshot().observationFailures).toBe(0);
    }
    restartText();
    await moveMouse(canvas, { x: 55 + (width - 83) * 9 / 10, y: top + (620 - top - 70) / 2 });
    await controller.settled();
    expect(drawnLabels()).toContain('25.00 ppm · estimated');
    expect(drawnLabels()).not.toContain('0.00 ppm · recorded');
    expect(text.snapshot().observationFailures).toBe(0);
    const after = controller.getState();
    expect(after.results.find((value: any) => value.series === 'monthly').y).toBeCloseTo(25, 5);
    // Independent numeric points distinguish the zero-connected V from a dropped
    // zero, and an explicit gap from a line that incorrectly bridges invalid rows.
    const hasBlueNear = (x: number, y: number) => {
      const px = (55 + (width - 83) * x / 10) * canvas.width / canvas.clientWidth;
      const py = (top + (620 - top - 70) * (1 - y / 40)) * canvas.height / canvas.clientHeight;
      const rgba = canvas.getContext('2d')!.getImageData(Math.floor(px) - 2, Math.floor(py) - 2, 5, 5).data;
      for (let i = 0; i < rgba.length; i += 4) if (Math.abs(rgba[i] - 40) < 10 && Math.abs(rgba[i + 1] - 120) < 10 && Math.abs(rgba[i + 2] - 181) < 10 && rgba[i + 3] > 240) return true;
      return false;
    };
    expect(hasBlueNear(0.5, 5)).toBe(true);
    expect(hasBlueNear(4, 40 / 3)).toBe(false);
    expect(after.missingness.generation).toBe(after.generation);
    expect(JSON.parse(host.textContent!).state.missingness).toEqual(after.missingness);
    await controller.perform('update-data');
    expect(controller.getState().missingness).toBeNull();
    expect(zero.missingness.counts.zero).toBe(1);
  } finally { text.dispose(); await controller.dispose(); canvas.remove(); host.remove(); await page.viewport(originalViewport.width, originalViewport.height); }
});
