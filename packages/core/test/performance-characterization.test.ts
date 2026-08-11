import { crc, defineComp, rect } from '@crc/core';
import { afterEach, describe, expect, it } from 'vitest';
import { clearSharedState, getCRCInstance } from '../src/lib/global-state';

interface PerformanceObservation {
  regions: number;
  hitTests: number;
  medianMs: number;
  p95Ms: number;
}

const WORKLOADS = [0, 100, 1_000, 10_000] as const;
const WARMUP_SAMPLES = 3;
const MEASURED_SAMPLES = 25;

const PerformanceScene = defineComp<{ regions: number }>(({ regions }) => {
  const columns = 100;
  return Array.from({ length: regions }, (_, index) => rect({
    key: `region-${index}`,
    x: (index % columns) * 8,
    y: Math.floor(index / columns) * 8,
    width: 6,
    height: 6,
    fillStyle: '#2563eb',
    onClick: () => undefined,
  }));
});

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function percentile(samples: readonly number[], percentileValue: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * percentileValue) - 1);
  return sorted[index];
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

async function observeWorkload(regions: number): Promise<PerformanceObservation> {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 800;
  canvas.style.cssText = 'display:block; width:800px; height:800px';
  document.body.replaceChildren(canvas);
  const abortController = new AbortController();
  crc(canvas, PerformanceScene({ regions }), { signal: abortController.signal });
  await nextFrame();

  expect(getCRCInstance(canvas).events.click.size).toBe(regions);

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Performance Canvas has no 2D context.');
  }
  const originalIsPointInPath = context.isPointInPath.bind(context);
  let hitTests = 0;
  context.isPointInPath = ((...args: Parameters<CanvasRenderingContext2D['isPointInPath']>) => {
    hitTests++;
    return originalIsPointInPath(...args);
  }) as CanvasRenderingContext2D['isPointInPath'];

  const dispatchMiss = () => {
    canvas.dispatchEvent(new MouseEvent('click', {
      clientX: -20,
      clientY: -20,
    }));
  };

  for (let index = 0; index < WARMUP_SAMPLES; index++) {
    dispatchMiss();
  }
  hitTests = 0;
  dispatchMiss();
  expect(hitTests).toBe(regions);
  const hitTestsPerDispatch = hitTests;

  const samples: number[] = [];
  for (let index = 0; index < MEASURED_SAMPLES; index++) {
    const start = performance.now();
    dispatchMiss();
    samples.push(performance.now() - start);
  }

  context.isPointInPath = originalIsPointInPath;
  abortController.abort();
  expect(samples).toHaveLength(MEASURED_SAMPLES);
  expect(samples.every(sample => Number.isFinite(sample) && sample >= 0)).toBe(true);

  return {
    regions,
    hitTests: hitTestsPerDispatch,
    medianMs: round(percentile(samples, 0.5)),
    p95Ms: round(percentile(samples, 0.95)),
  };
}

afterEach(() => {
  clearSharedState();
  document.body.replaceChildren();
});

describe('dispatch performance characterization', () => {
  it('records median, p95, and exact miss hit-test counts without imposing machine-speed budgets', async () => {
    const observations: PerformanceObservation[] = [];
    for (const regions of WORKLOADS) {
      observations.push(await observeWorkload(regions));
    }

    expect(observations.map(observation => observation.regions)).toEqual(WORKLOADS);
    expect(observations.map(observation => observation.hitTests)).toEqual(WORKLOADS);
    expect(observations.every(observation =>
      Number.isFinite(observation.medianMs) && Number.isFinite(observation.p95Ms),
    )).toBe(true);
  });
});
