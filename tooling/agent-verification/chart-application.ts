import { signal, type WritableSignal } from '@pibbl/core';
import mountChart from '../../packages/scenarios/src/learning/composition/viz-hover-comparison.example';

type Row = { id: string; x: number; y: number };

// Application update contract: replace data, preserving stable record IDs.
export function replaceReading(data: WritableSignal<readonly Row[]>, { value }: { value: number }) {
  data.set(data.get().map((row) => row.id === "middle" ? { ...row, y: value } : row));
}

export function mountChartApplication(canvas: HTMLCanvasElement) {
  const initial = () => [{ id: 'start', x: 0, y: 10 }, { id: 'middle', x: 5, y: 20 }, { id: 'end', x: 10, y: 30 }];
  const data = signal<readonly Row[]>(initial());
  const domain = signal<readonly [number, number]>([0, 10]);
  const inspection = signal<number | null>(5);
  const mode = signal<'nearest-per-line'>('nearest-per-line');
  let rendered: unknown = null;
  let evaluations = 0;
  const controller = mountChart(canvas, {
    first: data, second: [], yDomain: [0, 40], mode, inspection,
    // Explicit application signal read during the existing Scene evaluation.
    get xDomain() { return domain.get(); },
    onSnapshot(snapshot) { rendered = structuredClone(snapshot); evaluations++; },
  });
  return {
    data, domain, inspection,
    state: () => ({ source: structuredClone(data.get()), domain: [...domain.get()], rendered, evaluations }),
    seed() { const rows = data.get(); rows[1].y = 30; data.set(rows); },
    repair() { replaceReading(data, { value: 30 }); },
    zoom() { const [a, b] = domain.get(); const middle = (a + b) / 2; domain.set([middle - (b-a)/4, middle + (b-a)/4]); },
    pan() { const [a, b] = domain.get(); domain.set([a + 1, b + 1]); },
    reset() { data.set(initial()); domain.set([0, 10]); inspection.set(5); },
    dispose: () => controller.dispose(),
  };
}
