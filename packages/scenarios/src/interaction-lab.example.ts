import type { CRCMouseEvent } from '@crc/core';
import type { EventTraceInput, TraceEventType } from './event-trace';
import { defineComp, layer, rect, text } from '@crc/core';

export const INTERACTION_LAB_SOURCE_ID = 'interaction-trace-lab-example';

export type InteractionLabAction =
  | 'mount'
  | 'rerender-100'
  | 'replace-handler'
  | 'remove-subtree'
  | 'add-layer'
  | 'remove-layer'
  | 'reset';

export interface InteractionLabState {
  revision: number;
  handlerGeneration: number;
  subtreeVisible: boolean;
  layerVisible: boolean;
  lastAction: InteractionLabAction;
  trace: readonly import('./event-trace').EventTraceEntry[];
}

interface InteractionLabSceneProps {
  state: Readonly<InteractionLabState>;
  record: (input: EventTraceInput) => void;
}

type TraceHandlers = {
  onClick: (event: CRCMouseEvent) => void;
  onContextMenu: (event: CRCMouseEvent) => void;
  onDblClick: (event: CRCMouseEvent) => void;
  onMouseDown: (event: CRCMouseEvent) => void;
  onMouseMove: (event: CRCMouseEvent) => void;
  onMouseOut: (event: CRCMouseEvent) => void;
  onMouseOver: (event: CRCMouseEvent) => void;
  onMouseUp: (event: CRCMouseEvent) => void;
};

function traceHandlers(
  target: string,
  record: InteractionLabSceneProps['record'],
): TraceHandlers {
  const handler = (type: TraceEventType) => (event: CRCMouseEvent) => {
    record({
      source: 'crc',
      type,
      target,
      x: Math.round(event.x),
      y: Math.round(event.y),
      event: event.originalEvent,
      relatedTarget: null,
    });
  };
  return {
    onClick: handler('click'),
    onContextMenu: handler('contextmenu'),
    onDblClick: handler('dblclick'),
    onMouseDown: handler('mousedown'),
    onMouseMove: handler('mousemove'),
    onMouseOut: handler('mouseout'),
    onMouseOver: handler('mouseover'),
    onMouseUp: handler('mouseup'),
  };
}

const LayerScene = defineComp<Pick<InteractionLabSceneProps, 'record'>>(({ record }) => rect({
  key: 'layer-region',
  x: 170,
  y: 132,
  width: 140,
  height: 62,
  fillStyle: '#f59e0b',
  strokeStyle: '#78350f',
  lineWidth: 2,
  ...traceHandlers('layer', record),
}));

const InteractionLabScene = defineComp<InteractionLabSceneProps>(({ state, record }) => [
  rect({
    key: 'background',
    x: 0,
    y: 0,
    width: 480,
    height: 240,
    fillStyle: '#f8fafc',
  }),
  rect({
    key: 'left-region',
    x: 28,
    y: 54,
    width: 184,
    height: 108,
    fillStyle: '#2563eb',
    strokeStyle: '#172554',
    lineWidth: 2,
    ...traceHandlers('left', record),
  }),
  state.subtreeVisible && rect({
    key: 'right-region',
    x: 268,
    y: 54,
    width: 184,
    height: 108,
    fillStyle: '#7c3aed',
    strokeStyle: '#3b0764',
    lineWidth: 2,
    ...traceHandlers('right', record),
  }),
  text({
    key: 'left-label',
    x: 52,
    y: 82,
    text: `left · handler ${state.handlerGeneration}`,
    font: '700 15px Arial',
    fillStyle: '#ffffff',
  }),
  state.subtreeVisible && text({
    key: 'right-label',
    x: 292,
    y: 82,
    text: 'right · removable',
    font: '700 15px Arial',
    fillStyle: '#ffffff',
  }),
  state.layerVisible && layer({
    key: 'nested-layer',
    render: LayerScene({ record }),
  }),
  text({
    key: 'status',
    x: 28,
    y: 216,
    text: `revision ${state.revision} · trace ${state.trace.length} · ${state.lastAction}`,
    font: '13px Arial',
    fillStyle: '#334155',
  }),
]);

export function createInteractionLabScene(
  props: InteractionLabSceneProps,
): ReturnType<typeof InteractionLabScene> {
  return InteractionLabScene(props);
}
