import { useReaction, Image, Layer, Rectangle } from '@crc/core';
export const CLEANUP_STRESS_SOURCE_ID = 'runtime-cleanup-stress-example';
/**
 * Named image assets used to exercise image ownership and cleanup.
 *
 * @see {@link CleanupImageMode}
 */
export const CLEANUP_IMAGE_SOURCES = {
  /**
   * Intentionally invalid image source for failure and cleanup checks. See
   * {@link CLEANUP_IMAGE_SOURCES}.
   */
  broken: 'data:image/png;base64,not-a-valid-image',
  /**
   * Primary image asset for deterministic drawing and ownership checks. See
   * {@link CLEANUP_IMAGE_SOURCES}.
   */
  primary: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="130" height="80">
      <rect width="130" height="80" fill="#0ea5e9"/>
      <circle cx="65" cy="40" r="22" fill="#e0f2fe"/>
    </svg>
  `)}`,
  /** Alternate image asset for source replacement checks. See {@link CLEANUP_IMAGE_SOURCES}. */
  secondary: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="130" height="80">
      <rect width="130" height="80" fill="#ec4899"/>
      <path d="M35 58 L65 18 L95 58 Z" fill="#fce7f3"/>
    </svg>
  `)}`,
} as const;
/**
 * Supported cleanup runtime status values: `"aborted"`, `"disposed"`, `"mounted"`.
 *
 * @see {@link CleanupStressState}
 */
export type CleanupRuntimeStatus = 'aborted' | 'disposed' | 'mounted';
/**
 * Supported cleanup image mode values: `"broken"`, `"hidden"`, `"primary"`, `"secondary"`.
 *
 * @see {@link CLEANUP_IMAGE_SOURCES}
 * @see {@link CleanupStressState}
 */
export type CleanupImageMode = 'broken' | 'hidden' | 'primary' | 'secondary';
/**
 * Supported cleanup layer mode values: `"hidden"`, `"nested"`, `"single"`.
 *
 * @see {@link CleanupStressState}
 */
export type CleanupLayerMode = 'hidden' | 'nested' | 'single';
/**
 * Supported cleanup root variant values: `"a"`, `"b"`.
 *
 * @see {@link CleanupStressState}
 */
export type CleanupRootVariant = 'a' | 'b';
/**
 * Actions supported by the cleanup stress scenario's public controller.
 *
 * @see {@link CleanupStressState}
 */
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
/**
 * Deterministic ownership and work measurements exposed by the cleanup stress scenario.
 *
 * @see {@link CleanupStressState}
 */
export interface CleanupStressMetrics {
  /**
   * Completed renders recorded or configured by this scenario. See {@link CleanupStressMetrics}.
   */
  completedRenders: number;
  /**
   * Hook acquisitions recorded or configured by this scenario. See {@link CleanupStressMetrics}.
   */
  hookAcquisitions: number;
  /** Hook cleanups recorded or configured by this scenario. See {@link CleanupStressMetrics}. */
  hookCleanups: number;
}
/**
 * Observable state exposed by the cleanup stress scenario for controls and assertions.
 *
 * @see {@link CleanupImageMode}
 * @see {@link CleanupStressAction}
 * @see {@link CleanupLayerMode}
 * @see {@link CleanupRootVariant}
 * @see {@link CleanupRuntimeStatus}
 */
export interface CleanupStressState {
  /** Cleanup requests recorded or configured by this scenario. See {@link CleanupStressState}. */
  cleanupRequests: number;
  /** Completed renders recorded or configured by this scenario. See {@link CleanupStressState}. */
  completedRenders: number;
  /** Component key recorded or configured by this scenario. See {@link CleanupStressState}. */
  componentKey: number;
  /** Component visible recorded or configured by this scenario. See {@link CleanupStressState}. */
  componentVisible: boolean;
  /** Frame disposals recorded or configured by this scenario. See {@link CleanupStressState}. */
  frameDisposals: number;
  /** Frame requests recorded or configured by this scenario. See {@link CleanupStressState}. */
  frameRequests: number;
  /** Hook acquisitions recorded or configured by this scenario. See {@link CleanupStressState}. */
  hookAcquisitions: number;
  /** Hook cleanups recorded or configured by this scenario. See {@link CleanupStressState}. */
  hookCleanups: number;
  /** Hook dependency recorded or configured by this scenario. See {@link CleanupStressState}. */
  hookDependency: number;
  /** Image mode recorded or configured by this scenario. See {@link CleanupImageMode}. */
  imageMode: CleanupImageMode;
  /** Last action recorded or configured by this scenario. See {@link CleanupStressAction}. */
  lastAction: CleanupStressAction;
  /** Layer mode recorded or configured by this scenario. See {@link CleanupLayerMode}. */
  layerMode: CleanupLayerMode;
  /** Mount cycles recorded or configured by this scenario. See {@link CleanupStressState}. */
  mountCycles: number;
  /** Mount generation recorded or configured by this scenario. See {@link CleanupStressState}. */
  mountGeneration: number;
  /** Revision recorded or configured by this scenario. See {@link CleanupStressState}. */
  revision: number;
  /** Root variant recorded or configured by this scenario. See {@link CleanupRootVariant}. */
  rootVariant: CleanupRootVariant;
  /** Runtime recorded or configured by this scenario. See {@link CleanupRuntimeStatus}. */
  runtime: CleanupRuntimeStatus;
}
export interface CleanupStressSceneProps {
  metrics: CleanupStressMetrics;
  state: Readonly<CleanupStressState>;
}
const HookProbe = ({ metrics, state }: CleanupStressSceneProps) => {
  useReaction(() => {
    metrics.hookAcquisitions++;
    return () => {
      metrics.hookCleanups++;
    };
  }, [state.hookDependency]);
  return (
    <Rectangle
      key={`hook-fill-${state.hookDependency}`}
      pointerEvents="none"
      style={{
        left: 20,
        top: 30,
        width: 130,
        height: 80,
        fill: state.hookDependency % 2 === 0 ? '#2563eb' : '#7c3aed',
      }}
    />
  );
};
const SingleLayerScene = () => (
  <Rectangle
    key="single-layer-fill"
    pointerEvents="none"
    style={{
      left: 170,
      top: 30,
      width: 130,
      height: 80,
      fill: '#f59e0b',
    }}
  />
);
const NestedLayerScene = () => (
  <Layer key="inner-cleanup-layer">
    <Rectangle
      key="nested-layer-fill"
      pointerEvents="none"
      style={{
        left: 320,
        top: 30,
        width: 130,
        height: 80,
        fill: '#10b981',
      }}
    />
  </Layer>
);
function imageNode(state: Readonly<CleanupStressState>) {
  if (state.imageMode === 'hidden') {
    return undefined;
  }
  return (
    <Image
      key="cleanup-image"
      pointerEvents="none"
      style={{
        src: CLEANUP_IMAGE_SOURCES[state.imageMode],
        left: 170,
        top: 130,
        width: 130,
        height: 80,
      }}
    />
  );
}
function sceneNodes({ metrics, state }: CleanupStressSceneProps) {
  metrics.completedRenders++;
  return [
    <Rectangle
      key="cleanup-background"
      pointerEvents="none"
      style={{
        left: 0,
        top: 0,
        width: 480,
        height: 240,
        fill: state.rootVariant === 'a' ? '#f8fafc' : '#eef2ff',
      }}
    />,
    state.componentVisible && (
      <HookProbe
        key={`hook-probe-${state.componentKey}`}
        metrics={metrics}
        state={state}
      />
    ),
    state.layerMode === 'single' && (
      <Layer key="single-cleanup-layer">
        <SingleLayerScene />
      </Layer>
    ),
    state.layerMode === 'nested' && (
      <Layer key="outer-cleanup-layer">
        <NestedLayerScene />
      </Layer>
    ),
    imageNode(state),
  ];
}
const CleanupRootA = (props: CleanupStressSceneProps) => sceneNodes(props);
const CleanupRootB = (props: CleanupStressSceneProps) => sceneNodes(props);
export function createCleanupStressScene(props: CleanupStressSceneProps) {
  return props.state.rootVariant === 'a' ? (
    <CleanupRootA {...props} />
  ) : (
    <CleanupRootB {...props} />
  );
}
