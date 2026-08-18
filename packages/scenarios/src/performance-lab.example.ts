import {
  clip,
  defineComp,
  g,
  layer,
  rect,
} from '@crc/core';

export const PERFORMANCE_LAB_SOURCE_ID = 'event-performance-lab-example';

export interface PerformancePoint {
  x: number;
  y: number;
}

export type PerformanceCounterName =
  | 'getContext'
  | 'matrixMultiply'
  | 'pathTests'
  | 'restore'
  | 'save'
  | 'setTransform'
  | 'strokeTests';

export type PerformanceCounters = Record<PerformanceCounterName, number>;

export type PerformanceWorkloadKind =
  | 'clipped'
  | 'cursor'
  | 'dense'
  | 'layered'
  | 'miss'
  | 'sparse'
  | 'transformed'
  | 'zero';

export interface PerformanceWorkload {
  id: string;
  title: string;
  kind: PerformanceWorkloadKind;
  regionCount: number;
  probe: PerformancePoint;
  expectedTarget: string | null;
}

const SPARSE_PROBE = { x: 21.5, y: 21 } as const;

export const PERFORMANCE_WORKLOADS = [
  {
    id: 'zero',
    title: '0 regions',
    kind: 'zero',
    regionCount: 0,
    probe: { x: 240, y: 120 },
    expectedTarget: null,
  },
  {
    id: 'sparse-100',
    title: 'Sparse hit · 100 regions',
    kind: 'sparse',
    regionCount: 100,
    probe: SPARSE_PROBE,
    expectedTarget: 'region-0',
  },
  {
    id: 'sparse-1000',
    title: 'Sparse hit · 1,000 regions',
    kind: 'sparse',
    regionCount: 1_000,
    probe: SPARSE_PROBE,
    expectedTarget: 'region-0',
  },
  {
    id: 'sparse-10000',
    title: 'Sparse hit · 10,000 regions',
    kind: 'sparse',
    regionCount: 10_000,
    probe: SPARSE_PROBE,
    expectedTarget: 'region-0',
  },
  {
    id: 'miss-100',
    title: 'All miss · 100 regions',
    kind: 'miss',
    regionCount: 100,
    probe: { x: 470, y: 230 },
    expectedTarget: null,
  },
  {
    id: 'miss-1000',
    title: 'All miss · 1,000 regions',
    kind: 'miss',
    regionCount: 1_000,
    probe: { x: 470, y: 230 },
    expectedTarget: null,
  },
  {
    id: 'miss-10000',
    title: 'All miss · 10,000 regions',
    kind: 'miss',
    regionCount: 10_000,
    probe: { x: 470, y: 230 },
    expectedTarget: null,
  },
  {
    id: 'dense-1000',
    title: 'Dense overlap · 1,000 regions',
    kind: 'dense',
    regionCount: 1_000,
    probe: { x: 240, y: 120 },
    expectedTarget: 'region-999',
  },
  {
    id: 'dense-10000',
    title: 'Dense overlap · 10,000 regions',
    kind: 'dense',
    regionCount: 10_000,
    probe: { x: 240, y: 120 },
    expectedTarget: 'region-9999',
  },
  {
    id: 'clipped-1000',
    title: 'Clipped sparse hit · 1,000 regions',
    kind: 'clipped',
    regionCount: 1_000,
    probe: SPARSE_PROBE,
    expectedTarget: 'region-0',
  },
  {
    id: 'transformed-1000',
    title: 'Transformed sparse hit · 1,000 regions',
    kind: 'transformed',
    regionCount: 1_000,
    probe: { x: 33.5, y: 29 },
    expectedTarget: 'region-0',
  },
  {
    id: 'layered-1000',
    title: 'Four layers · 1,000 regions',
    kind: 'layered',
    regionCount: 1_000,
    probe: SPARSE_PROBE,
    expectedTarget: 'layer-0-region-0',
  },
  {
    id: 'cursor-1000',
    title: 'Cursor sparse hit · 1,000 regions',
    kind: 'cursor',
    regionCount: 1_000,
    probe: SPARSE_PROBE,
    expectedTarget: 'region-0',
  },
] as const satisfies readonly PerformanceWorkload[];

export type PerformanceWorkloadId = (typeof PERFORMANCE_WORKLOADS)[number]['id'];

export type PerformanceLabAction =
  | 'mount'
  | 'reset'
  | 'rerender-25'
  | `show-${PerformanceWorkloadId}`;

export interface PerformanceLabState {
  callbacks: number;
  completedRenders: number;
  counters: PerformanceCounters;
  dispatches: number;
  lastAction: PerformanceLabAction;
  lastDurationMs: number;
  lastSettleLatencyMs: number;
  lastTarget: string | null;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  regionCount: number;
  revision: number;
  renderedRevision: number;
  sampleCount: number;
  workloadId: PerformanceWorkloadId;
}

export interface PerformanceSceneProps {
  recordHit: (target: string) => void;
  recordRender: (revision: number) => void;
  revision: number;
  workloadId: PerformanceWorkloadId;
}

type PerformanceNode =
  | ReturnType<typeof clip>
  | ReturnType<typeof g>
  | ReturnType<typeof layer>
  | ReturnType<typeof rect>;

interface RegionFactoryOptions {
  count: number;
  cursor?: string;
  keyPrefix?: string;
  recordHit: (target: string) => void;
  xOffset?: number;
}

function sparseRegions(options: RegionFactoryOptions): PerformanceNode[] {
  const nodes: PerformanceNode[] = [];
  const keyPrefix = options.keyPrefix ?? 'region';
  const xOffset = options.xOffset ?? 0;
  for (let index = 0; index < options.count; index++) {
    const target = `${keyPrefix}-${index}`;
    nodes.push(rect({
      key: target,
      style: {
        x: 20 + xOffset + (index % 100) * 4,
        y: 20 + Math.floor(index / 100) * 2,
        width: 3,
        height: 2,
        fill: index === 0 ? '#16a34a' : '#2563eb',
        cursor: options.cursor,
      },
      onMouseMove: () => options.recordHit(target),
    }));
  }
  return nodes;
}

function denseRegions(options: RegionFactoryOptions): PerformanceNode[] {
  const nodes: PerformanceNode[] = [];
  for (let index = 0; index < options.count; index++) {
    const target = `region-${index}`;
    nodes.push(rect({
      key: target,
      style: {
        x: 120,
        y: 60,
        width: 240,
        height: 120,
        fill: index === options.count - 1 ? '#16a34a' : '#2563eb',
      },
      onMouseMove: () => options.recordHit(target),
    }));
  }
  return nodes;
}

const PerformanceLayerScene = defineComp<RegionFactoryOptions>((props) =>
  sparseRegions(props));

function layeredRegions(options: RegionFactoryOptions): PerformanceNode[] {
  const nodes: PerformanceNode[] = [];
  const layerCount = 4;
  const regionsPerLayer = options.count / layerCount;
  for (let layerIndex = 0; layerIndex < layerCount; layerIndex++) {
    nodes.push(layer({
      key: `layer-${layerIndex}`,
      render: PerformanceLayerScene({
        count: regionsPerLayer,
        keyPrefix: `layer-${layerIndex}-region`,
        recordHit: options.recordHit,
        xOffset: layerIndex * 40,
      }),
    }));
  }
  return nodes;
}

function workloadNodes(
  workload: PerformanceWorkload,
  recordHit: (target: string) => void,
): PerformanceNode[] {
  switch (workload.kind) {
    case 'zero':
      return [];
    case 'sparse':
    case 'miss':
      return sparseRegions({ count: workload.regionCount, recordHit });
    case 'cursor':
      return sparseRegions({
        count: workload.regionCount,
        cursor: 'pointer',
        recordHit,
      });
    case 'dense':
      return denseRegions({ count: workload.regionCount, recordHit });
    case 'clipped': {
      const clipPath = new Path2D();
      clipPath.rect(0, 0, 440, 230);
      return [clip({
        style: {
          d: clipPath
        },
        children: sparseRegions({
          count: workload.regionCount,
          recordHit
        })
      })];
    }
    case 'transformed':
      return [g({
        style: {
          translateX: 12,
          translateY: 8
        },
        key: 'performance-transform',
        children: sparseRegions({
          count: workload.regionCount,
          recordHit
        })
      })];
    case 'layered':
      return layeredRegions({ count: workload.regionCount, recordHit });
  }
}

export function getPerformanceWorkload(workloadId: PerformanceWorkloadId): PerformanceWorkload {
  const workload = PERFORMANCE_WORKLOADS.find(candidate => candidate.id === workloadId);
  if (!workload) {
    throw new Error(`Unknown performance workload "${workloadId}".`);
  }
  return workload;
}

export const PerformanceScene = defineComp<PerformanceSceneProps>((props) => {
  const workload = getPerformanceWorkload(props.workloadId);
  props.recordRender(props.revision);
  return [
    rect({
      key: `background-${props.revision}`,
      style: {
        x: 0,
        y: 0,
        width: 480,
        height: 240,
        fill: '#f8fafc',
      },
    }),
    ...workloadNodes(workload, props.recordHit),
  ];
});

export function createPerformanceScene(props: PerformanceSceneProps) {
  return PerformanceScene(props);
}
