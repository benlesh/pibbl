import type {
  CRCClipboardEvent,
  CRCCompositionEvent,
  CRCDragEvent,
  CRCEvent,
  CRCKeyboardEvent,
  CRCLogicalMouseEvent,
  CRCMouseEvent,
  CRCPointerEvent,
  CRCTouchEvent,
} from '@crc/core';
import type { EventTraceInput, TraceEventType } from './event-trace';
import {
  crcEvent,
  crcEventListener,
  crcEventTarget,
  defineComp,
  g,
  line,
  path as crcPath,
  rect,
  text,
} from '@crc/core';

export const INTERACTION_LAB_SOURCE_ID = 'interaction-trace-lab-example';

export type InteractionLabFixture =
  | 'clipboard'
  | 'composition'
  | 'drag-drop'
  | 'fill'
  | 'fill-stroke'
  | 'interaction-width'
  | 'keyboard-fields'
  | 'nested'
  | 'no-hit'
  | 'observer'
  | 'observer-remove'
  | 'observer-replace'
  | 'observer-throwing'
  | 'overlap'
  | 'pointer-capture'
  | 'propagation'
  | 'remove-target-after-transition'
  | 'regions'
  | 'stroke'
  | 'touch-retention'
  | 'transparent'
  | 'wheel-cancellation';

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

type TraceLogicalEvent = Pick<
  CRCEvent,
  'defaultPrevented' | 'eventPhase' | 'originalEvent' | 'relatedTarget'
> & Partial<Pick<CRCLogicalMouseEvent, 'x' | 'y'>>;

function recordLogicalEvent(
  record: InteractionLabRecord,
  type: TraceEventType,
  target: string,
  event: TraceLogicalEvent,
  fields: EventTraceInput['fields'],
): void {
  record({
    source: 'crc',
    type,
    target,
    x: Math.round(event.x ?? 0),
    y: Math.round(event.y ?? 0),
    event: event.originalEvent instanceof MouseEvent ? event.originalEvent : undefined,
    relatedTarget: event.relatedTarget ? 'other' : null,
    phase: event.eventPhase,
    canceled: event.defaultPrevented,
    fields,
  });
}

function pointerFields(event: CRCPointerEvent) {
  return {
    pointerId: event.pointerId,
    pointerType: event.pointerType,
  } as const;
}

function captureFields(event: CRCPointerEvent) {
  return {
    captured: event.currentTarget.hasPointerCapture(event.pointerId),
    pointerId: event.pointerId,
    x: Math.round(event.x),
    y: Math.round(event.y),
  } as const;
}

function touchFields(event: CRCTouchEvent) {
  const identifiers = (touches: TouchList) =>
    Array.from(touches, touch => touch.identifier).join(',');
  return {
    changed: identifiers(event.changedTouches),
    touches: identifiers(event.touches),
    x: Math.round(event.x),
    y: Math.round(event.y),
  } as const;
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

const PropagationTarget = defineComp<NestedAncestorProps>(({ record }) => rect({
  key: 'propagation-target',
  style: {
    x: 120,
    y: 72,
    width: 240,
    height: 112,
    fill: '#2563eb',
    stroke: '#1e3a8a',
    strokeWidth: 2,
    cursor: 'pointer',
  },
  onPointerDownCapture: event => recordLogicalEvent(
    record,
    'pointerdown',
    'target-capture',
    event,
    pointerFields(event),
  ),
  onPointerDown: event => recordLogicalEvent(
    record,
    'pointerdown',
    'target',
    event,
    pointerFields(event),
  ),
}));

const PropagationFixture = defineComp<NestedAncestorProps>(({ record }) => {
  crcEventListener({
    onPointerDownCapture: event => recordLogicalEvent(
      record,
      'pointerdown',
      'parent-capture',
      event,
      pointerFields(event),
    ),
    onPointerDown: event => recordLogicalEvent(
      record,
      'pointerdown',
      'parent-bubble',
      event,
      pointerFields(event),
    ),
  });
  return PropagationTarget({ record });
});

const CustomPointerCapture = defineComp<NestedAncestorProps>(({ record }) => {
  const geometry = rectanglePath(120, 72, 240, 112);
  const trace = (
    type: 'gotpointercapture' | 'lostpointercapture' | 'pointerdown' | 'pointermove' | 'pointerup',
  ) => (event: CRCPointerEvent) => {
    if (type === 'pointerdown') {
      event.currentTarget.setPointerCapture(event.pointerId);
    } else if (type === 'pointerup') {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    recordLogicalEvent(record, type, 'custom-capture', event, captureFields(event));
  };
  crcEventTarget({
    onGotPointerCapture: trace('gotpointercapture'),
    onLostPointerCapture: trace('lostpointercapture'),
    onPointerDown: trace('pointerdown'),
    onPointerMove: trace('pointermove'),
    onPointerUp: trace('pointerup'),
  }, {
    path: geometry,
    fill: true,
    cursor: 'grab',
  });
  return crcPath({
    key: 'custom-capture-art',
    style: {
      d: geometry,
      fill: '#0f766e',
      stroke: '#134e4a',
      strokeWidth: 2,
    },
  });
});

function touchRetention(record: InteractionLabRecord) {
  const trace = (type: 'touchend' | 'touchmove' | 'touchstart') =>
    (event: CRCTouchEvent) => recordLogicalEvent(
      record,
      type,
      'touch-owner',
      event,
      touchFields(event),
    );
  return rect({
    key: 'touch-owner',
    style: {
      x: 120,
      y: 72,
      width: 240,
      height: 112,
      fill: '#7c3aed',
      stroke: '#581c87',
      strokeWidth: 2,
    },
    onTouchStart: trace('touchstart'),
    onTouchMove: trace('touchmove'),
    onTouchEnd: trace('touchend'),
  });
}

function wheelCancellation(record: InteractionLabRecord) {
  return rect({
    key: 'wheel-target',
    style: {
      x: 120,
      y: 72,
      width: 240,
      height: 112,
      fill: '#c2410c',
      stroke: '#7c2d12',
      strokeWidth: 2,
    },
    onWheel: event => {
      event.preventDefault();
      recordLogicalEvent(record, 'wheel', 'wheel-target', event, {
        deltaMode: event.deltaMode,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
      });
    },
  });
}

function keyboardFields(record: InteractionLabRecord) {
  return rect({
    key: 'keyboard-target',
    style: {
      x: 120,
      y: 72,
      width: 240,
      height: 112,
      fill: '#0369a1',
      stroke: '#0c4a6e',
      strokeWidth: 2,
    },
    onKeyDown: (event: CRCKeyboardEvent) => recordLogicalEvent(
      record,
      'keydown',
      'keyboard-target',
      event,
      {
        code: event.code,
        isComposing: event.isComposing,
        key: event.key,
        repeat: event.repeat,
        shiftKey: event.shiftKey,
      },
    ),
  });
}

function composition(record: InteractionLabRecord) {
  const trace = (
    type: 'compositionend' | 'compositionstart' | 'compositionupdate',
  ) => (event: CRCCompositionEvent) => recordLogicalEvent(
    record,
    type,
    'composition-target',
    event,
    { data: event.data },
  );
  return rect({
    key: 'composition-target',
    style: {
      x: 120,
      y: 72,
      width: 240,
      height: 112,
      fill: '#be185d',
      stroke: '#831843',
      strokeWidth: 2,
    },
    onCompositionStart: trace('compositionstart'),
    onCompositionUpdate: trace('compositionupdate'),
    onCompositionEnd: trace('compositionend'),
  });
}

function clipboard(record: InteractionLabRecord) {
  return rect({
    key: 'clipboard-target',
    style: {
      x: 120,
      y: 72,
      width: 240,
      height: 112,
      fill: '#4f46e5',
      stroke: '#312e81',
      strokeWidth: 2,
    },
    onPaste: (event: CRCClipboardEvent) => recordLogicalEvent(
      record,
      'paste',
      'clipboard-target',
      event,
      { text: event.clipboardData?.getData('text/plain') ?? '' },
    ),
  });
}

function dragDrop(record: InteractionLabRecord) {
  const region = (target: 'drag-a' | 'drag-b', x: number, fill: string) => {
    const trace = (
      type: 'dragenter' | 'dragleave' | 'dragover' | 'drop',
    ) => (event: CRCDragEvent) => recordLogicalEvent(
      record,
      type,
      target,
      event,
      { text: event.dataTransfer?.getData('text/plain') ?? '' },
    );
    return rect({
      key: target,
      style: {
        x,
        y: 72,
        width: 180,
        height: 112,
        fill,
        stroke: '#334155',
        strokeWidth: 2,
      },
      onDragEnter: trace('dragenter'),
      onDragLeave: trace('dragleave'),
      onDragOver: trace('dragover'),
      onDrop: trace('drop'),
    });
  };
  return [
    region('drag-a', 38, '#2563eb'),
    region('drag-b', 262, '#7c3aed'),
  ];
}

function caseVisual(state: Readonly<InteractionLabState>, record: InteractionLabRecord) {
  const geometry = rectanglePath(90, 66, 220, 124);
  switch (state.fixture) {
    case 'propagation':
      return [PropagationFixture({ record })];
    case 'pointer-capture':
      return [CustomPointerCapture({ record })];
    case 'touch-retention':
      return [touchRetention(record)];
    case 'wheel-cancellation':
      return [wheelCancellation(record)];
    case 'keyboard-fields':
      return [keyboardFields(record)];
    case 'composition':
      return [composition(record)];
    case 'clipboard':
      return [clipboard(record)];
    case 'drag-drop':
      return dragDrop(record);
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
