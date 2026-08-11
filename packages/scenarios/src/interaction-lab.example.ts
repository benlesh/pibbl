import type { CRCMouseEvent } from '@crc/core';
import type { EventTraceInput, TraceEventType } from './event-trace';
import {
  crcEvent,
  defineComp,
  g,
  line,
  path as crcPath,
  rect,
  text,
} from '@crc/core';

export const INTERACTION_LAB_SOURCE_ID = 'interaction-trace-lab-example';

export type InteractionLabFixture =
  | 'fill'
  | 'fill-stroke'
  | 'interaction-width'
  | 'nested'
  | 'no-hit'
  | 'observer'
  | 'overlap'
  | 'remove-during-transition'
  | 'regions'
  | 'stroke'
  | 'throwing'
  | 'transparent';

export type InteractionLabAction =
  | 'clear-trace'
  | 'mount'
  | 'remove-handler'
  | 'remove-top'
  | 'reorder-overlap'
  | 'replace-handler'
  | 'reset'
  | `show-${InteractionLabFixture}`;

export interface InteractionLabState {
  fixture: InteractionLabFixture;
  handlerGeneration: number;
  lastAction: InteractionLabAction;
  lastHandlerGeneration: number | null;
  leftHandlerEnabled: boolean;
  topPaintedLast: boolean;
  topVisible: boolean;
  trace: readonly import('./event-trace').EventTraceEntry[];
}

export interface InteractionLabRecord {
  (input: EventTraceInput, handlerGeneration?: number): void;
}

interface InteractionLabSceneProps {
  state: Readonly<InteractionLabState>;
  record: InteractionLabRecord;
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

function recordEvent(
  record: InteractionLabRecord,
  type: TraceEventType,
  target: string,
  event: CRCMouseEvent,
  handlerGeneration?: number,
): void {
  record({
    source: 'crc',
    type,
    target,
    x: Math.round(event.x),
    y: Math.round(event.y),
    event: event.originalEvent,
    relatedTarget: null,
  }, handlerGeneration);
}

function traceHandlers(
  target: string,
  record: InteractionLabRecord,
  handlerGeneration?: number,
): TraceHandlers {
  const handler = (type: TraceEventType) => (event: CRCMouseEvent) => {
    recordEvent(record, type, target, event, handlerGeneration);
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

function region(
  target: string,
  record: InteractionLabRecord,
  geometry: { x: number; y: number; width: number; height: number },
  options: {
    cursor?: string;
    fillStyle: string;
    handlerGeneration?: number;
    interactive?: boolean;
  },
) {
  return rect({
    key: `region-${target}`,
    ...geometry,
    fillStyle: options.fillStyle,
    strokeStyle: '#334155',
    lineWidth: 2,
    cursor: options.interactive === false ? undefined : options.cursor,
    ...(options.interactive === false ? {} : traceHandlers(
      target,
      record,
      options.handlerGeneration,
    )),
  });
}

function rectanglePath(x: number, y: number, width: number, height: number): Path2D {
  const result = new Path2D();
  result.rect(x, y, width, height);
  return result;
}

function basicRegions(state: Readonly<InteractionLabState>, record: InteractionLabRecord) {
  return [
    region('left', record, { x: 28, y: 54, width: 184, height: 108 }, {
      cursor: 'crosshair',
      fillStyle: '#2563eb',
      handlerGeneration: state.handlerGeneration,
      interactive: state.leftHandlerEnabled,
    }),
    region('right', record, { x: 268, y: 54, width: 184, height: 108 }, {
      cursor: 'pointer',
      fillStyle: '#7c3aed',
    }),
  ];
}

function overlapRegions(state: Readonly<InteractionLabState>, record: InteractionLabRecord) {
  const lower = region('lower', record, { x: 60, y: 58, width: 240, height: 132 }, {
    cursor: 'crosshair',
    fillStyle: '#2563eb',
  });
  const top = region('top', record, { x: 180, y: 88, width: 220, height: 110 }, {
    cursor: 'pointer',
    fillStyle: '#7c3aed',
  });
  if (!state.topVisible) {
    return [lower];
  }
  return state.topPaintedLast ? [lower, top] : [top, lower];
}

function caseVisual(state: Readonly<InteractionLabState>, record: InteractionLabRecord) {
  const geometry = rectanglePath(90, 66, 220, 124);
  switch (state.fixture) {
    case 'regions':
    case 'remove-during-transition':
      return basicRegions(state, record);
    case 'overlap':
      return overlapRegions(state, record);
    case 'nested':
      return [g({
        key: 'untransformed-nested-group',
        children: [
          region('parent', record, { x: 70, y: 52, width: 300, height: 148 }, {
            cursor: 'crosshair',
            fillStyle: '#93c5fd',
          }),
          region('child', record, { x: 170, y: 88, width: 130, height: 82 }, {
            cursor: 'pointer',
            fillStyle: '#2563eb',
          }),
        ],
      })];
    case 'fill':
      return [crcPath({
        key: 'fill-region',
        path: geometry,
        fillStyle: '#2563eb',
        cursor: 'pointer',
        ...traceHandlers('a', record),
      })];
    case 'stroke':
      return [crcPath({
        key: 'stroke-region',
        path: geometry,
        strokeStyle: '#2563eb',
        lineWidth: 6,
        lineInteractionWidth: 6,
        cursor: 'pointer',
        ...traceHandlers('a', record),
      })];
    case 'fill-stroke':
      return [crcPath({
        key: 'fill-stroke-region',
        path: geometry,
        fillStyle: '#93c5fd',
        strokeStyle: '#1d4ed8',
        lineWidth: 6,
        lineInteractionWidth: 6,
        cursor: 'pointer',
        ...traceHandlers('a', record),
      })];
    case 'transparent':
      return [
        rect({
          key: 'transparent-guide',
          x: 90,
          y: 66,
          width: 220,
          height: 124,
          fillStyle: '#e2e8f0',
          strokeStyle: '#94a3b8',
          lineWidth: 2,
        }),
        crcPath({
          key: 'transparent-region',
          path: geometry,
          fillStyle: 'rgba(37, 99, 235, 0)',
          cursor: 'pointer',
          ...traceHandlers('a', record),
        }),
      ];
    case 'interaction-width':
      return [
        line({
          key: 'expanded-line',
          coords: [[90, 126], [390, 126]],
          strokeStyle: '#2563eb',
          lineWidth: 2,
          lineInteractionWidth: 24,
          cursor: 'pointer',
          ...traceHandlers('a', record),
        }),
        line({
          key: 'interaction-top-guide',
          coords: [[90, 114], [390, 114]],
          strokeStyle: '#bfdbfe',
          lineWidth: 1,
        }),
        line({
          key: 'interaction-bottom-guide',
          coords: [[90, 138], [390, 138]],
          strokeStyle: '#bfdbfe',
          lineWidth: 1,
        }),
      ];
    case 'no-hit':
      return [
        rect({
          key: 'no-hit-guide',
          x: 90,
          y: 66,
          width: 220,
          height: 124,
          strokeStyle: '#94a3b8',
          lineWidth: 2,
        }),
        crcPath({
          key: 'no-hit-region',
          path: geometry,
          lineInteractionWidth: 0,
          cursor: 'pointer',
          ...traceHandlers('a', record),
        }),
      ];
    case 'observer':
      return [region('a', record, { x: 90, y: 66, width: 220, height: 124 }, {
        cursor: 'pointer',
        fillStyle: '#2563eb',
      })];
    case 'throwing': {
      const throwingHandlers = traceHandlers('left', record);
      throwingHandlers.onMouseOut = (event) => {
        recordEvent(record, 'mouseout', 'left', event);
        throw new Error('Deliberate ordering-lab mouseout failure');
      };
      return [
        rect({
          key: 'throwing-left',
          x: 28,
          y: 54,
          width: 184,
          height: 108,
          fillStyle: '#dc2626',
          cursor: 'crosshair',
          ...throwingHandlers,
        }),
        region('right', record, { x: 268, y: 54, width: 184, height: 108 }, {
          cursor: 'pointer',
          fillStyle: '#7c3aed',
        }),
      ];
    }
  }
}

const InteractionLabScene = defineComp<InteractionLabSceneProps>(({ state, record }) => {
  crcEvent(
    'mousemove',
    state.fixture === 'observer' ?
      event => recordEvent(record, 'mousemove', 'canvas-observer', event) :
      undefined,
  );

  return [
    rect({
      key: 'background',
      x: 0,
      y: 0,
      width: 480,
      height: 240,
      fillStyle: '#f8fafc',
    }),
    text({
      key: 'title',
      x: 24,
      y: 28,
      text: `Ordering lab · ${state.fixture}`,
      font: '700 17px Arial',
      fillStyle: '#0f172a',
    }),
    ...caseVisual(state, record),
    text({
      key: 'status',
      x: 24,
      y: 226,
      text: `trace ${state.trace.length} · handler ${state.handlerGeneration} · ${state.lastAction}`,
      font: '13px Arial',
      fillStyle: '#334155',
    }),
  ];
});

export function createInteractionLabScene(
  props: InteractionLabSceneProps,
): ReturnType<typeof InteractionLabScene> {
  return InteractionLabScene(props);
}
