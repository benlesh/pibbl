import { defineComp, layer, rect, text } from '@crc/core';

export const LIFECYCLE_LAB_SOURCE_ID = 'event-lifecycle-lab-example';

export type LifecycleLabRuntime = 'mounted' | 'aborted' | 'disposed';

export type LifecycleLabTarget = 'primary' | 'subtree' | 'throwing' | 'safe' | 'layer';

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

export type LifecycleLabLastAction = LifecycleLabAction | `click-${LifecycleLabTarget}`;

export interface LifecycleLabState {
  runtime: LifecycleLabRuntime;
  mountGeneration: number;
  revision: number;
  handlerGeneration: number;
  handlerRemoved: boolean;
  subtreeVisible: boolean;
  layerVisible: boolean;
  calls: number;
  targetCalls: Readonly<Record<LifecycleLabTarget, number>>;
  lastTarget: LifecycleLabTarget | null;
  lastHandlerGeneration: number | null;
  cleanupRequests: number;
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
    rect({
      key,
      x,
      y,
      width,
      height,
      fillStyle,
      strokeStyle: '#0f172a',
      lineWidth: 2,
      cursor: interactive ? cursor : undefined,
      onClick: interactive ? onClick : undefined,
      ...lifecycleEvents,
    }),
    text({
      key: `${key}-label`,
      x: x + 10,
      y: y + 18,
      text: label,
      font: '700 12px Arial',
      fillStyle: '#ffffff',
    }),
  ];
}

const LayerRegion = defineComp<Pick<LifecycleLabSceneProps, 'recordCall'>>(({ recordCall }) =>
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
  }),
);

const LifecycleLabScene = defineComp<LifecycleLabSceneProps>(({ state, recordCall }) => [
  rect({
    key: 'background',
    x: 0,
    y: 0,
    width: 480,
    height: 240,
    fillStyle: state.runtime === 'mounted' ? '#f8fafc' : '#e2e8f0',
  }),
  ...region({
    key: 'primary-region',
    label: state.handlerRemoved ? 'primary · no handler' : `primary · h${state.handlerGeneration}`,
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
  state.layerVisible &&
    layer({
      key: 'lifecycle-layer',
      render: LayerRegion({ recordCall }),
    }),
  text({
    key: 'runtime-status',
    x: 18,
    y: 24,
    text: `runtime ${state.runtime} · mount ${state.mountGeneration} · revision ${state.revision}`,
    font: '700 14px Arial',
    fillStyle: '#0f172a',
  }),
  text({
    key: 'call-status',
    x: 18,
    y: 143,
    text: `calls ${state.calls} · last ${state.lastTarget ?? 'none'} · handler ${state.lastHandlerGeneration ?? 'none'}`,
    font: '13px Arial',
    fillStyle: '#334155',
  }),
  text({
    key: 'cleanup-status',
    x: 18,
    y: 224,
    text: `cleanup requests ${state.cleanupRequests} · ${state.lastAction}`,
    font: '13px Arial',
    fillStyle: '#475569',
  }),
]);

export function createLifecycleLabScene(props: LifecycleLabSceneProps): ReturnType<typeof LifecycleLabScene> {
  return LifecycleLabScene(props);
}
