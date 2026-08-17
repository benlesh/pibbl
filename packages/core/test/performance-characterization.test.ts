import { crc, defineComp, rect } from '@crc/core';
import { afterEach, describe, expect, it } from 'vitest';
import { clearSharedState, getCRCInstance } from '../src/lib/global-state';

interface PerformanceObservation {
  regions: number;
  dispatchesPerSample: number;
  hitTests: number;
  medianMs: number;
  p95Ms: number;
}

const WORKLOADS = [
  { regions: 0, dispatchesPerSample: 1_000 },
  { regions: 100, dispatchesPerSample: 100 },
  { regions: 1_000, dispatchesPerSample: 10 },
  { regions: 10_000, dispatchesPerSample: 1 },
] as const;
const WARMUP_BATCHES = 5;
const MEASURED_BATCHES = 41;

const PerformanceScene = defineComp<{ onHit: () => void; regions: number }>(({ onHit, regions }) => {
  const columns = 100;
  return Array.from({ length: regions }, (_, index) => rect({
    key: `region-${index}`,
    style: {
      x: (index % columns) * 8,
      y: Math.floor(index / columns) * 8,
      width: 6,
      height: 6,
      fill: '#2563eb',
    },
    onMouseMove: onHit,
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

async function observeWorkload(
  regions: number,
  dispatchesPerSample: number,
): Promise<PerformanceObservation> {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 800;
  canvas.style.cssText = 'display:block; width:800px; height:800px';
  document.body.replaceChildren(canvas);
  const abortController = new AbortController();
  let callbacks = 0;
  try {
    crc(canvas, PerformanceScene({
      regions,
      onHit: () => callbacks++,
    }), { signal: abortController.signal });
    await nextFrame();

    expect([...getCRCInstance(canvas).regions].filter(region => region.handlers.mousemove).length).toBe(regions);

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Performance Canvas has no 2D context.');
    }
    const originalIsPointInPath = context.isPointInPath.bind(context);
    const missEvent = new MouseEvent('mousemove', { clientX: -20, clientY: -20 });
    const dispatchMiss = () => canvas.dispatchEvent(missEvent);
    let hitTests = 0;
    let hitTestsPerDispatch = 0;
    try {
      context.isPointInPath = ((...args: Parameters<CanvasRenderingContext2D['isPointInPath']>) => {
        hitTests++;
        return originalIsPointInPath(...args);
      }) as CanvasRenderingContext2D['isPointInPath'];
      dispatchMiss();
      expect(hitTests).toBe(regions);
      expect(callbacks).toBe(0);
      hitTestsPerDispatch = hitTests;
    } finally {
      context.isPointInPath = originalIsPointInPath;
    }

    const dispatchBatch = () => {
      for (let index = 0; index < dispatchesPerSample; index++) {
        dispatchMiss();
      }
    };
    for (let index = 0; index < WARMUP_BATCHES; index++) {
      dispatchBatch();
    }

    const samples: number[] = [];
    for (let index = 0; index < MEASURED_BATCHES; index++) {
      const start = performance.now();
      dispatchBatch();
      samples.push((performance.now() - start) / dispatchesPerSample);
    }

    expect(samples).toHaveLength(MEASURED_BATCHES);
    expect(samples.every(sample => Number.isFinite(sample) && sample >= 0)).toBe(true);

    return {
      regions,
      dispatchesPerSample,
      hitTests: hitTestsPerDispatch,
      medianMs: round(percentile(samples, 0.5)),
      p95Ms: round(percentile(samples, 0.95)),
    };
  } finally {
    abortController.abort();
  }
}

afterEach(() => {
  clearSharedState();
  document.body.replaceChildren();
});

describe('dispatch performance characterization', () => {
  it('records median, p95, and exact miss hit-test counts without imposing machine-speed budgets', async () => {
    const observations: PerformanceObservation[] = [];
    for (const workload of WORKLOADS) {
      observations.push(await observeWorkload(workload.regions, workload.dispatchesPerSample));
    }

    expect(observations.map(observation => observation.regions)).toEqual(WORKLOADS.map(workload => workload.regions));
    expect(observations.map(observation => observation.hitTests)).toEqual(WORKLOADS.map(workload => workload.regions));
    expect(observations.every(observation =>
      Number.isFinite(observation.medianMs) &&
      Number.isFinite(observation.p95Ms) &&
      observation.medianMs <= observation.p95Ms,
    )).toBe(true);
    if (import.meta.env.VITE_CRC_REPORT_PERF === '1') {
      console.warn('TFC-01 dispatch observations', JSON.stringify({
        environment: {
          userAgent: navigator.userAgent,
          devicePixelRatio: window.devicePixelRatio,
          hardwareConcurrency: navigator.hardwareConcurrency,
        },
        measuredBatches: MEASURED_BATCHES,
        observations,
      }));
    }
  });
});
