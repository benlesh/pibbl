import type { CRCLogicalMouseEvent, CRCMouseEvent } from '@crc/core';
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
  | 'observer-remove'
  | 'observer-replace'
  | 'observer-throwing'
  | 'overlap'
  | 'remove-target-after-transition'
  | 'regions'
  | 'stroke'
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
  observerGeneration: number;
  observerMutationComplete: boolean;
  rightVisible: boolean;
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

type TraceMouseCoordinates = Pick<
  CRCMouseEvent,
  'x' | 'y' | 'originalEvent'
>;

type TraceHandlers = {
  onClick: (event: CRCLogicalMouseEvent) => void;
  onContextMenu: (event: CRCLogicalMouseEvent) => void;
  onDblClick: (event: CRCLogicalMouseEvent) => void;
  onMouseDown: (event: CRCLogicalMouseEvent) => void;
  onMouseMove: (event: CRCLogicalMouseEvent) => void;
  onMouseOut: (event: CRCLogicalMouseEvent) => void;
  onMouseOver: (event: CRCLogicalMouseEvent) => void;
  onMouseUp: (event: CRCLogicalMouseEvent) => void;
};

function recordEvent(
  record: InteractionLabRecord,
  type: TraceEventType,
  target: string,
  event: TraceMouseCoordinates,
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
  const handler = (type: TraceEventType) => (
    event: CRCLogicalMouseEvent,
  ) => {
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
    style: {
      ...geometry,
      fill: options.fillStyle,
      stroke: '#334155',
      strokeWidth: 2,
      cursor: options.interactive === false ? undefined : options.cursor,
    },
    ...(options.interactive === false
      ? {}
      : traceHandlers(target, record, options.handlerGeneration)),
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

interface NestedAncestorProps {
  record: InteractionLabRecord;
}

const NestedChild = defineComp<NestedAncestorProps>(({ record }) => region(
  'child',
  record,
  { x: 170, y: 88, width: 130, height: 82 },
  { cursor: 'pointer', fillStyle: '#2563eb' },
));

const NestedInteractiveAncestor = defineComp<NestedAncestorProps>(({ record }) => {
  const parentPath = rectanglePath(70, 52, 300, 148);
  crcEvent(
    'mousemove',
    event => recordEvent(record, 'mousemove', 'ancestor', event),
    parentPath,
    true,
  );

  return [
    rect({
      key: 'ancestor-guide',
      style: {
        x: 70,
        y: 52,
        width: 300,
        height: 148,
        fill: '#93c5fd',
        stroke: '#334155',
        strokeWidth: 2,
      },
    }),
    NestedChild({ record }),
  ];
});

function caseVisual(state: Readonly<InteractionLabState>, record: InteractionLabRecord) {
  const geometry = rectanglePath(90, 66, 220, 124);
  switch (state.fixture) {
    case 'regions':
      return basicRegions(state, record);
    case 'remove-target-after-transition': {
      const regions = basicRegions(state, record);
      return state.rightVisible ? regions : regions.slice(0, 1);
    }
    case 'overlap':
      return overlapRegions(state, record);
    case 'nested':
      return [g({
        key: 'untransformed-nested-group',
        children: [NestedInteractiveAncestor({ record })],
      })];
    case 'fill':
      return [crcPath({
        key: 'fill-region',
        style: {
          d: geometry,
          fill: '#2563eb',
          cursor: 'pointer',
        },
        ...traceHandlers('a', record),
      })];
    case 'stroke':
      return [crcPath({
        key: 'stroke-region',
        style: {
          d: geometry,
          stroke: '#2563eb',
          strokeWidth: 6,
          lineInteractionWidth: 6,
          cursor: 'pointer',
        },
        ...traceHandlers('a', record),
      })];
    case 'fill-stroke':
      return [crcPath({
        key: 'fill-stroke-region',
        style: {
          d: geometry,
          fill: '#93c5fd',
          stroke: '#1d4ed8',
          strokeWidth: 6,
          lineInteractionWidth: 6,
          cursor: 'pointer',
        },
        ...traceHandlers('a', record),
      })];
    case 'transparent':
      return [
        rect({
          key: 'transparent-guide',
          style: {
            x: 90,
            y: 66,
            width: 220,
            height: 124,
            fill: '#e2e8f0',
            stroke: '#94a3b8',
            strokeWidth: 2,
          },
        }),
        crcPath({
          key: 'transparent-region',
          style: {
            d: geometry,
            fill: 'rgba(37, 99, 235, 0)',
            cursor: 'pointer',
          },
          ...traceHandlers('a', record),
        }),
      ];
    case 'interaction-width':
      return [
        line({
          key: 'expanded-line',
          style: {
            coords: [[90, 126], [390, 126]],
            stroke: '#2563eb',
            strokeWidth: 2,
            lineInteractionWidth: 24,
            cursor: 'pointer',
          },
          ...traceHandlers('a', record),
        }),
        line({
          key: 'interaction-top-guide',
          style: {
            coords: [[90, 114], [390, 114]],
            stroke: '#bfdbfe',
            strokeWidth: 1,
          },
        }),
        line({
          key: 'interaction-bottom-guide',
          style: {
            coords: [[90, 138], [390, 138]],
            stroke: '#bfdbfe',
            strokeWidth: 1,
          },
        }),
      ];
    case 'no-hit':
      return [
        rect({
          key: 'no-hit-guide',
          style: {
            x: 90,
            y: 66,
            width: 220,
            height: 124,
            stroke: '#94a3b8',
            strokeWidth: 2,
          },
        }),
        crcPath({
          key: 'no-hit-region',
          style: {
            d: geometry,
            lineInteractionWidth: 0,
            cursor: 'pointer',
          },
          ...traceHandlers('a', record),
        }),
      ];
    case 'observer':
    case 'observer-remove':
    case 'observer-replace':
    case 'observer-throwing':
      return [region('a', record, { x: 90, y: 66, width: 220, height: 124 }, {
        cursor: 'pointer',
        fillStyle: '#2563eb',
      })];
  }
}

const InteractionLabScene = defineComp<InteractionLabSceneProps>(({ state, record }) => {
  crcEvent(
    'mousemove',
    state.fixture === 'observer' ? event => {
      recordEvent(record, 'mousemove', 'canvas-observer', event);
    } :
    state.fixture === 'observer-remove' || state.fixture === 'observer-replace' ? event => {
      recordEvent(record, 'mousemove', 'observer-mutator', event);
    } :
    state.fixture === 'observer-throwing' ? event => {
      recordEvent(record, 'mousemove', 'observer-throws', event);
      throw new Error('Deliberate ordering-lab observer failure');
    } : undefined,
  );
  crcEvent(
    'mousemove',
    state.fixture === 'observer-replace' ? event => {
      recordEvent(
        record,
        'mousemove',
        `observer-generation-${state.observerGeneration}`,
        event,
        state.observerGeneration,
      );
    } :
    state.fixture === 'observer-remove' && !state.observerMutationComplete ? event => {
      recordEvent(record, 'mousemove', 'observer-removable', event);
    } :
    state.fixture === 'observer-throwing' ? event => {
      recordEvent(record, 'mousemove', 'observer-safe', event);
    } : undefined,
  );

  return [
    rect({
      key: 'background',
      style: {
        x: 0,
        y: 0,
        width: 480,
        height: 240,
        fill: '#f8fafc',
      },
    }),
    text({
      style: {
        x: 24,
        y: 28,
        text: `Ordering lab · ${state.fixture}`,
        font: '700 17px Arial',
        fill: '#0f172a',
      },
      key: 'title',
    }),
    ...caseVisual(state, record),
    text({
      style: {
        x: 24,
        y: 226,
        text: `trace ${state.trace.length} · handler ${state.handlerGeneration} · ${state.lastAction}`,
        font: '13px Arial',
        fill: '#334155',
      },
      key: 'status',
    }),
  ];
});

export function createInteractionLabScene(
  props: InteractionLabSceneProps,
): ReturnType<typeof InteractionLabScene> {
  return InteractionLabScene(props);
}
