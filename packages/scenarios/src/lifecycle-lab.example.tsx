import type { lifecycleLabScenarioEntry } from './catalog.js';
import { Layer, Rectangle, Text } from '@pibbl/core';
export const LIFECYCLE_LAB_SOURCE_ID = 'event-lifecycle-lab-example';
/**
 * Supported lifecycle lab runtime values: `"mounted"`, `"aborted"`, `"disposed"`.
 *
 * @see {@link LifecycleLabState}
 */
export type LifecycleLabRuntime = 'mounted' | 'aborted' | 'disposed';
/**
 * Supported lifecycle lab target values: `"primary"`, `"subtree"`, `"throwing"`, `"safe"`, `"layer"`.
 *
 * @see {@link LifecycleLabLastAction}
 * @see {@link LifecycleLabState}
 */
export type LifecycleLabTarget =
  'primary' | 'subtree' | 'throwing' | 'safe' | 'layer';
/**
 * Actions supported by the lifecycle lab scenario's public controller.
 *
 * @see {@link LifecycleLabLastAction}
 */
export type LifecycleLabAction =
  | 'mount'
  | 'rerender-1000'
  | 'replace-handler'
  | 'remove-handler'
  | 'remove-subtree'
  | 'add-layer'
  | 'remove-layer'
  | 'abort-runtime'
  | 'dispose-runtime'
  | 'cleanup-again'
  | 'remount-runtime'
  | 'cleanup-stale'
  | 'reset';
/**
 * Actions supported by the lifecycle lab last scenario's public controller.
 *
 * @see {@link LifecycleLabAction}
 * @see {@link LifecycleLabTarget}
 * @see {@link LifecycleLabState}
 */
export type LifecycleLabLastAction =
  LifecycleLabAction | `click-${LifecycleLabTarget}`;
/**
 * Observable state exposed by the lifecycle lab scenario for controls and assertions.
 *
 * @see {@link LifecycleLabRuntime}
 * @see {@link LifecycleLabTarget}
 * @see {@link LifecycleLabLastAction}
 * @see {@link lifecycleLabScenarioEntry}
 */
export interface LifecycleLabState {
  /** Runtime recorded or configured by this scenario. See {@link LifecycleLabRuntime}. */
  runtime: LifecycleLabRuntime;
  /** Mount generation recorded or configured by this scenario. See {@link LifecycleLabState}. */
  mountGeneration: number;
  /** Revision recorded or configured by this scenario. See {@link LifecycleLabState}. */
  revision: number;
  /** Handler generation recorded or configured by this scenario. See {@link LifecycleLabState}. */
  handlerGeneration: number;
  /** Handler removed recorded or configured by this scenario. See {@link LifecycleLabState}. */
  handlerRemoved: boolean;
  /** Subtree visible recorded or configured by this scenario. See {@link LifecycleLabState}. */
  subtreeVisible: boolean;
  /** Layer visible recorded or configured by this scenario. See {@link LifecycleLabState}. */
  layerVisible: boolean;
  /** Calls recorded or configured by this scenario. See {@link LifecycleLabState}. */
  calls: number;
  /** Target calls recorded or configured by this scenario. See {@link LifecycleLabTarget}. */
  targetCalls: Readonly<Record<LifecycleLabTarget, number>>;
  /** Last target recorded or configured by this scenario. See {@link LifecycleLabTarget}. */
  lastTarget: LifecycleLabTarget | null;
  /**
   * Last handler generation recorded or configured by this scenario. See {@link LifecycleLabState}
   * .
   */
  lastHandlerGeneration: number | null;
  /** Cleanup requests recorded or configured by this scenario. See {@link LifecycleLabState}. */
  cleanupRequests: number;
  /** Last action recorded or configured by this scenario. See {@link LifecycleLabLastAction}. */
  lastAction: LifecycleLabLastAction;
}
interface LifecycleLabSceneProps {
  state: Readonly<LifecycleLabState>;
  recordCall: (target: LifecycleLabTarget, handlerGeneration: number) => void;
}
interface RegionOptions {
  key: string;
  label: string;
  target: LifecycleLabTarget;
  handlerGeneration: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fillStyle: string;
  recordCall: LifecycleLabSceneProps['recordCall'];
  allMouseEvents?: boolean;
  cursor?: string;
  interactive?: boolean;
  throws?: boolean;
}
function region({
  key,
  label,
  target,
  handlerGeneration,
  x,
  y,
  width,
  height,
  fillStyle,
  recordCall,
  allMouseEvents = false,
  cursor,
  interactive = true,
  throws = false,
}: RegionOptions) {
  const onClick = () => {
    recordCall(target, handlerGeneration);
    if (throws) {
      throw new Error('Lifecycle laboratory throwing handler.');
    }
  };
  const lifecycleEvents =
    interactive && allMouseEvents
      ? {
          onContextMenu: () => undefined,
          onDblClick: () => undefined,
          onMouseDown: () => undefined,
          onMouseMove: () => undefined,
          onMouseOut: () => undefined,
          onMouseOver: () => undefined,
          onMouseUp: () => undefined,
        }
      : {};
  return [
    <Rectangle
      key={key}
      style={{
        left: x,
        top: y,
        width,
        height,
        fill: fillStyle,
        stroke: '#0f172a',
        strokeWidth: 2,
        cursor: interactive ? cursor : undefined,
      }}
      onClick={interactive ? onClick : undefined}
      {...lifecycleEvents}
    />,
    <Text
      pointerEvents="none"
      style={{
        left: x + 10,
        top: y + 18,
        font: '700 12px Arial',
        fill: '#ffffff',
      }}
      key={`${key}-label`}
    >
      {label}
    </Text>,
  ];
}
const LayerRegion = ({
  recordCall,
}: Pick<LifecycleLabSceneProps, 'recordCall'>) =>
  region({
    key: 'lifecycle-layer-region',
    label: 'layer',
    target: 'layer',
    handlerGeneration: 1,
    x: 170,
    y: 150,
    width: 140,
    height: 52,
    fillStyle: '#d97706',
    recordCall,
    cursor: 'pointer',
  });
const LifecycleLabScene = ({ state, recordCall }: LifecycleLabSceneProps) => [
  <Rectangle
    key="background"
    style={{
      left: 0,
      top: 0,
      width: 480,
      height: 240,
      fill: state.runtime === 'mounted' ? '#f8fafc' : '#e2e8f0',
    }}
  />,
  ...region({
    key: 'primary-region',
    label: state.handlerRemoved
      ? 'primary · no handler'
      : `primary · h${state.handlerGeneration}`,
    target: 'primary',
    handlerGeneration: state.handlerGeneration,
    x: 18,
    y: 52,
    width: 126,
    height: 72,
    fillStyle: state.handlerRemoved ? '#64748b' : '#2563eb',
    recordCall,
    allMouseEvents: true,
    interactive: !state.handlerRemoved,
  }),
  ...(state.subtreeVisible
    ? region({
        key: 'subtree-region',
        label: 'subtree',
        target: 'subtree',
        handlerGeneration: 1,
        x: 158,
        y: 52,
        width: 106,
        height: 72,
        fillStyle: '#7c3aed',
        recordCall,
        cursor: 'pointer',
      })
    : []),
  ...region({
    key: 'throwing-region',
    label: 'throws',
    target: 'throwing',
    handlerGeneration: 1,
    x: 278,
    y: 52,
    width: 86,
    height: 72,
    fillStyle: '#dc2626',
    recordCall,
    throws: true,
  }),
  ...region({
    key: 'safe-region',
    label: 'safe',
    target: 'safe',
    handlerGeneration: 1,
    x: 378,
    y: 52,
    width: 84,
    height: 72,
    fillStyle: '#059669',
    recordCall,
  }),
  state.layerVisible && (
    <Layer key="lifecycle-layer">
      <LayerRegion recordCall={recordCall} />
    </Layer>
  ),
  <Text
    pointerEvents="none"
    style={{
      left: 18,
      top: 24,
      font: '700 14px Arial',
      fill: '#0f172a',
    }}
    key="runtime-status"
  >{`runtime ${state.runtime} · mount ${state.mountGeneration} · revision ${state.revision}`}</Text>,
  <Text
    pointerEvents="none"
    style={{
      left: 18,
      top: 143,
      font: '13px Arial',
      fill: '#334155',
    }}
    key="call-status"
  >{`calls ${state.calls} · last ${state.lastTarget ?? 'none'} · handler ${state.lastHandlerGeneration ?? 'none'}`}</Text>,
  <Text
    pointerEvents="none"
    style={{
      left: 18,
      top: 224,
      font: '13px Arial',
      fill: '#475569',
    }}
    key="cleanup-status"
  >{`cleanup requests ${state.cleanupRequests} · ${state.lastAction}`}</Text>,
];
export function createLifecycleLabScene(props: LifecycleLabSceneProps) {
  return <LifecycleLabScene {...props} />;
}
