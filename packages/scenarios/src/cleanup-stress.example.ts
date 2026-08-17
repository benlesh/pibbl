import {
  crcWhenChanged,
  defineComp,
  img,
  layer,
  rect,
} from '@crc/core';

export const CLEANUP_STRESS_SOURCE_ID = 'runtime-cleanup-stress-example';

export const CLEANUP_IMAGE_SOURCES = {
  broken: 'data:image/png;base64,not-a-valid-image',
  primary: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="130" height="80">
      <rect width="130" height="80" fill="#0ea5e9"/>
      <circle cx="65" cy="40" r="22" fill="#e0f2fe"/>
    </svg>
  `)}`,
  secondary: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="130" height="80">
      <rect width="130" height="80" fill="#ec4899"/>
      <path d="M35 58 L65 18 L95 58 Z" fill="#fce7f3"/>
    </svg>
  `)}`,
} as const;

export type CleanupRuntimeStatus = 'aborted' | 'disposed' | 'mounted';
export type CleanupImageMode = 'broken' | 'hidden' | 'primary' | 'secondary';
export type CleanupLayerMode = 'hidden' | 'nested' | 'single';
export type CleanupRootVariant = 'a' | 'b';

export type CleanupStressAction =
  | 'abort-runtime'
  | 'add-layer'
  | 'add-nested-layer'
  | 'change-hook-dependency'
  | 'change-image-source'
  | 'cleanup-again'
  | 'cycle-runtime-1000'
  | 'dispose-runtime'
  | 'dispose-with-frame'
  | 'mount'
  | 'queue-frame'
  | 'remove-component'
  | 'remove-image'
  | 'remove-layers'
  | 'remount-runtime'
  | 'replace-component-key'
  | 'replace-root'
  | 'reset'
  | 'restore-component'
  | 'show-broken-image'
  | 'show-image';

export interface CleanupStressMetrics {
  completedRenders: number;
  hookAcquisitions: number;
  hookCleanups: number;
}

export interface CleanupStressState {
  cleanupRequests: number;
  completedRenders: number;
  componentKey: number;
  componentVisible: boolean;
  frameDisposals: number;
  frameRequests: number;
  hookAcquisitions: number;
  hookCleanups: number;
  hookDependency: number;
  imageMode: CleanupImageMode;
  lastAction: CleanupStressAction;
  layerMode: CleanupLayerMode;
  mountCycles: number;
  mountGeneration: number;
  revision: number;
  rootVariant: CleanupRootVariant;
  runtime: CleanupRuntimeStatus;
}

export interface CleanupStressSceneProps {
  metrics: CleanupStressMetrics;
  state: Readonly<CleanupStressState>;
}

const HookProbe = defineComp<CleanupStressSceneProps>(({ metrics, state }) => {
  crcWhenChanged(() => {
    metrics.hookAcquisitions++;
    return () => {
      metrics.hookCleanups++;
    };
  }, [state.hookDependency]);

  return rect({
    key: `hook-fill-${state.hookDependency}`,
    style: {
      x: 20,
      y: 30,
      width: 130,
      height: 80,
      fill: state.hookDependency % 2 === 0 ? '#2563eb' : '#7c3aed',
    },
  });
});

const SingleLayerScene = defineComp(() => rect({
  key: 'single-layer-fill',
  style: {
    x: 170,
    y: 30,
    width: 130,
    height: 80,
    fill: '#f59e0b',
  },
}));

const NestedLayerScene = defineComp(() => layer({
  key: 'inner-cleanup-layer',
  render: rect({
    key: 'nested-layer-fill',
    style: {
      x: 320,
      y: 30,
      width: 130,
      height: 80,
      fill: '#10b981',
    },
  }),
}));

function imageNode(state: Readonly<CleanupStressState>) {
  if (state.imageMode === 'hidden') {
    return undefined;
  }
  return img({
    key: 'cleanup-image',
    src: CLEANUP_IMAGE_SOURCES[state.imageMode],
    x: 170,
    y: 130,
    width: 130,
    height: 80,
  });
}

function sceneNodes({ metrics, state }: CleanupStressSceneProps) {
  metrics.completedRenders++;
  return [
    rect({
      key: 'cleanup-background',
      style: {
        x: 0,
        y: 0,
        width: 480,
        height: 240,
        fill: state.rootVariant === 'a' ? '#f8fafc' : '#eef2ff',
      },
    }),
    state.componentVisible && HookProbe({
      key: `hook-probe-${state.componentKey}`,
      metrics,
      state,
    }),
    state.layerMode === 'single' && layer({
      key: 'single-cleanup-layer',
      render: SingleLayerScene({}),
    }),
    state.layerMode === 'nested' && layer({
      key: 'outer-cleanup-layer',
      render: NestedLayerScene({}),
    }),
    imageNode(state),
  ];
}

const CleanupRootA = defineComp<CleanupStressSceneProps>((props) => sceneNodes(props));
const CleanupRootB = defineComp<CleanupStressSceneProps>((props) => sceneNodes(props));

export function createCleanupStressScene(props: CleanupStressSceneProps) {
  return props.state.rootVariant === 'a' ? CleanupRootA(props) : CleanupRootB(props);
}
