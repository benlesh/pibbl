import type { INTERACTION_LAB_ACTION_IDS } from './interaction-lab.js';
import type { interactionLabScenarioEntry } from './catalog.js';
import type {
  CRCClipboardEvent,
  CRCCompositionEvent,
  CRCDragEvent,
  CRCEvent,
  CRCKeyboardEvent,
  CRCLogicalMouseEvent,
  CRCPointerEvent,
  CRCTouchEvent,
} from '@crc/core';
import type {
  EventTraceEntry,
  EventTraceInput,
  TraceEventType,
} from './event-trace';
import {
  useEventListener,
  useEventTarget,
  Group,
  Line,
  Path,
  Rectangle,
  Text,
} from '@crc/core';
export const INTERACTION_LAB_SOURCE_ID = 'interaction-trace-lab-example';
/**
 * Supported interaction lab fixture values: `"clipboard"`, `"composition"`, `"drag-drop"`,
 * `"fill"`, `"fill-stroke"`, `"interaction-width"`, `"keyboard-fields"`, `"nested"`, `"no-hit"`,
 * `"overlap"`, `"pointer-capture"`, `"propagation"`, `"remove-target-after-transition"`,
 * `"regions"`, `"stroke"`, `"touch-retention"`, `"transparent"`, `"wheel-cancellation"`.
 *
 * @see {@link InteractionLabAction}
 * @see {@link InteractionLabState}
 */
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
  | 'overlap'
  | 'pointer-capture'
  | 'propagation'
  | 'remove-target-after-transition'
  | 'regions'
  | 'stroke'
  | 'touch-retention'
  | 'transparent'
  | 'wheel-cancellation';
/**
 * Actions supported by the interaction lab scenario's public controller.
 *
 * @see {@link InteractionLabFixture}
 * @see {@link InteractionLabState}
 * @see {@link INTERACTION_LAB_ACTION_IDS}
 */
export type InteractionLabAction =
  | 'clear-trace'
  | 'mount'
  | 'remove-handler'
  | 'remove-top'
  | 'reorder-overlap'
  | 'replace-handler'
  | 'reset'
  | `show-${InteractionLabFixture}`;
/**
 * Observable state exposed by the interaction lab scenario for controls and assertions.
 *
 * @see {@link InteractionLabFixture}
 * @see {@link InteractionLabAction}
 * @see {@link EventTraceEntry}
 * @see {@link interactionLabScenarioEntry}
 */
export interface InteractionLabState {
  /** Fixture recorded or configured by this scenario. See {@link InteractionLabFixture}. */
  fixture: InteractionLabFixture;
  /**
   * Handler generation recorded or configured by this scenario. See {@link InteractionLabState}.
   */
  handlerGeneration: number;
  /** Last action recorded or configured by this scenario. See {@link InteractionLabAction}. */
  lastAction: InteractionLabAction;
  /**
   * Last handler generation recorded or configured by this scenario. See
   * {@link InteractionLabState}.
   */
  lastHandlerGeneration: number | null;
  /**
   * Left handler enabled recorded or configured by this scenario. See {@link InteractionLabState}
   * .
   */
  leftHandlerEnabled: boolean;
  /** Right visible recorded or configured by this scenario. See {@link InteractionLabState}. */
  rightVisible: boolean;
  /** Top painted last recorded or configured by this scenario. See {@link InteractionLabState}. */
  topPaintedLast: boolean;
  /** Top visible recorded or configured by this scenario. See {@link InteractionLabState}. */
  topVisible: boolean;
  /** Trace recorded or configured by this scenario. See {@link EventTraceEntry}. */
  trace: readonly EventTraceEntry[];
}
export interface InteractionLabRecord {
  (input: EventTraceInput, handlerGeneration?: number): void;
}
interface InteractionLabSceneProps {
  state: Readonly<InteractionLabState>;
  record: InteractionLabRecord;
}
type TraceMouseCoordinates = Pick<CRCLogicalMouseEvent, 'x' | 'y' | 'originalEvent'>;
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
  record(
    {
      source: 'crc',
      type,
      target,
      x: Math.round(event.x),
      y: Math.round(event.y),
      event: event.originalEvent,
      relatedTarget: null,
    },
    handlerGeneration,
  );
}
type TraceLogicalEvent = Pick<
  CRCEvent,
  | 'currentTarget'
  | 'defaultPrevented'
  | 'eventPhase'
  | 'originalEvent'
  | 'relatedTarget'
  | 'target'
> &
  Partial<Pick<CRCLogicalMouseEvent, 'x' | 'y'>>;
interface TraceTargetLabels {
  currentTarget: string;
  relatedTarget: string | null;
  target: string;
}
const logicalTargetLabels = new WeakMap<CRCEvent['target'], string>();
function stableTargetLabel(
  target: CRCEvent['target'] | null,
  label: string | null,
): string | null {
  if (!target) {
    if (label !== null) {
      throw new Error(`Missing logical event target for "${label}".`);
    }
    return null;
  }
  if (label === null) {
    throw new Error(
      'A logical event target is present without a symbolic label.',
    );
  }
  const existing = logicalTargetLabels.get(target);
  if (existing && existing !== label) {
    throw new Error(
      `Logical event target changed identity from "${existing}" to "${label}".`,
    );
  }
  logicalTargetLabels.set(target, label);
  return label;
}
function selfTargetLabels(target: string): TraceTargetLabels {
  return {
    currentTarget: target,
    relatedTarget: null,
    target,
  };
}
function recordLogicalEvent(
  record: InteractionLabRecord,
  type: TraceEventType,
  event: TraceLogicalEvent,
  labels: TraceTargetLabels,
  fields: EventTraceInput['fields'],
): void {
  record({
    source: 'crc',
    type,
    target: stableTargetLabel(event.target, labels.target)!,
    currentTarget: stableTargetLabel(
      event.currentTarget,
      labels.currentTarget,
    )!,
    x: Math.round(event.x ?? 0),
    y: Math.round(event.y ?? 0),
    event:
      event.originalEvent instanceof MouseEvent
        ? event.originalEvent
        : undefined,
    relatedTarget: stableTargetLabel(event.relatedTarget, labels.relatedTarget),
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
    Array.from(touches, (touch) => touch.identifier).join(',');
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
  const handler = (type: TraceEventType) => (event: CRCLogicalMouseEvent) => {
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
  geometry: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
  options: {
    cursor?: string;
    fillStyle: string;
    handlerGeneration?: number;
    interactive?: boolean;
  },
) {
  return (
    <Rectangle
      key={`region-${target}`}
      style={{
        left: geometry.x,
        top: geometry.y,
        width: geometry.width,
        height: geometry.height,
        fill: options.fillStyle,
        stroke: '#334155',
        strokeWidth: 2,
        cursor: options.interactive === false ? undefined : options.cursor,
      }}
      {...(options.interactive === false
        ? {}
        : traceHandlers(target, record, options.handlerGeneration))}
    />
  );
}
function rectanglePath(
  x: number,
  y: number,
  width: number,
  height: number,
): Path2D {
  const result = new Path2D();
  result.rect(x, y, width, height);
  return result;
}
function basicRegions(
  state: Readonly<InteractionLabState>,
  record: InteractionLabRecord,
) {
  return [
    region(
      'left',
      record,
      {
        x: 28,
        y: 54,
        width: 184,
        height: 108,
      },
      {
        cursor: 'crosshair',
        fillStyle: '#2563eb',
        handlerGeneration: state.handlerGeneration,
        interactive: state.leftHandlerEnabled,
      },
    ),
    region(
      'right',
      record,
      {
        x: 268,
        y: 54,
        width: 184,
        height: 108,
      },
      {
        cursor: 'pointer',
        fillStyle: '#7c3aed',
      },
    ),
  ];
}
function overlapRegions(
  state: Readonly<InteractionLabState>,
  record: InteractionLabRecord,
) {
  const lower = region(
    'lower',
    record,
    {
      x: 60,
      y: 58,
      width: 240,
      height: 132,
    },
    {
      cursor: 'crosshair',
      fillStyle: '#2563eb',
    },
  );
  const top = region(
    'top',
    record,
    {
      x: 180,
      y: 88,
      width: 220,
      height: 110,
    },
    {
      cursor: 'pointer',
      fillStyle: '#7c3aed',
    },
  );
  if (!state.topVisible) {
    return [lower];
  }
  return state.topPaintedLast ? [lower, top] : [top, lower];
}
interface NestedAncestorProps {
  record: InteractionLabRecord;
}
const NestedChild = ({ record }: NestedAncestorProps) =>
  region(
    'child',
    record,
    {
      x: 170,
      y: 88,
      width: 130,
      height: 82,
    },
    {
      cursor: 'pointer',
      fillStyle: '#2563eb',
    },
  );
const NestedInteractiveAncestor = ({ record }: NestedAncestorProps) => {
  const parentPath = rectanglePath(70, 52, 300, 148);
  useEventTarget(
    { onMouseMove: event => recordEvent(record, 'mousemove', 'ancestor', event) },
    { path: parentPath, fill: true },
  );
  return [
    <Rectangle
      key="ancestor-guide"
      pointerEvents="none"
      style={{
        left: 70,
        top: 52,
        width: 300,
        height: 148,
        fill: '#93c5fd',
        stroke: '#334155',
        strokeWidth: 2,
      }}
    />,
    <NestedChild record={record} />,
  ];
};
const PropagationTarget = ({ record }: NestedAncestorProps) => (
  <Rectangle
    key="propagation-target"
    style={{
      left: 120,
      top: 72,
      width: 240,
      height: 112,
      fill: '#2563eb',
      stroke: '#1e3a8a',
      strokeWidth: 2,
      cursor: 'pointer',
    }}
    onPointerDownCapture={(event) =>
      recordLogicalEvent(
        record,
        'pointerdown',
        event,
        selfTargetLabels('propagation-target'),
        {
          handler: 'target-capture',
          ...pointerFields(event),
        },
      )
    }
    onPointerDown={(event) =>
      recordLogicalEvent(
        record,
        'pointerdown',
        event,
        selfTargetLabels('propagation-target'),
        {
          handler: 'target',
          ...pointerFields(event),
        },
      )
    }
  />
);
const PropagationFixture = ({ record }: NestedAncestorProps) => {
  useEventListener({
    onPointerDownCapture: (event) =>
      recordLogicalEvent(
        record,
        'pointerdown',
        event,
        {
          currentTarget: 'propagation-parent',
          relatedTarget: null,
          target: 'propagation-target',
        },
        {
          handler: 'capture',
          ...pointerFields(event),
        },
      ),
    onPointerDown: (event) =>
      recordLogicalEvent(
        record,
        'pointerdown',
        event,
        {
          currentTarget: 'propagation-parent',
          relatedTarget: null,
          target: 'propagation-target',
        },
        {
          handler: 'bubble',
          ...pointerFields(event),
        },
      ),
  });
  return <PropagationTarget record={record} />;
};
const CustomPointerCapture = ({ record }: NestedAncestorProps) => {
  const geometry = rectanglePath(120, 72, 240, 112);
  const trace =
    (
      type:
        | 'gotpointercapture'
        | 'lostpointercapture'
        | 'pointerdown'
        | 'pointermove'
        | 'pointerup',
    ) =>
    (event: CRCPointerEvent) => {
      if (type === 'pointerdown') {
        event.currentTarget.setPointerCapture(event.pointerId);
      } else if (type === 'pointerup') {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      recordLogicalEvent(
        record,
        type,
        event,
        selfTargetLabels('custom-capture'),
        captureFields(event),
      );
    };
  useEventTarget(
    {
      onGotPointerCapture: trace('gotpointercapture'),
      onLostPointerCapture: trace('lostpointercapture'),
      onPointerDown: trace('pointerdown'),
      onPointerMove: trace('pointermove'),
      onPointerUp: trace('pointerup'),
    },
    {
      path: geometry,
      fill: true,
      cursor: 'grab',
    },
  );
  return (
    <Path
      key="custom-capture-art"
      pointerEvents="none"
      style={{
        d: geometry,
        fill: '#0f766e',
        stroke: '#134e4a',
        strokeWidth: 2,
      }}
    />
  );
};
function touchRetention(record: InteractionLabRecord) {
  const trace =
    (type: 'touchend' | 'touchmove' | 'touchstart') => (event: CRCTouchEvent) =>
      recordLogicalEvent(
        record,
        type,
        event,
        selfTargetLabels('touch-owner'),
        touchFields(event),
      );
  return (
    <Rectangle
      key="touch-owner"
      style={{
        left: 120,
        top: 72,
        width: 240,
        height: 112,
        fill: '#7c3aed',
        stroke: '#581c87',
        strokeWidth: 2,
      }}
      onTouchStart={trace('touchstart')}
      onTouchMove={trace('touchmove')}
      onTouchEnd={trace('touchend')}
    />
  );
}
function wheelCancellation(record: InteractionLabRecord) {
  return (
    <Rectangle
      key="wheel-target"
      style={{
        left: 120,
        top: 72,
        width: 240,
        height: 112,
        fill: '#c2410c',
        stroke: '#7c2d12',
        strokeWidth: 2,
      }}
      onWheel={(event) => {
        event.preventDefault();
        recordLogicalEvent(
          record,
          'wheel',
          event,
          selfTargetLabels('wheel-target'),
          {
            deltaMode: event.deltaMode,
            deltaX: event.deltaX,
            deltaY: event.deltaY,
          },
        );
      }}
    />
  );
}
function keyboardFields(record: InteractionLabRecord) {
  return (
    <Rectangle
      key="keyboard-target"
      style={{
        left: 120,
        top: 72,
        width: 240,
        height: 112,
        fill: '#0369a1',
        stroke: '#0c4a6e',
        strokeWidth: 2,
      }}
      onKeyDown={(event: CRCKeyboardEvent) =>
        recordLogicalEvent(
          record,
          'keydown',
          event,
          selfTargetLabels('keyboard-target'),
          {
            code: event.code,
            isComposing: event.isComposing,
            key: event.key,
            repeat: event.repeat,
            shiftKey: event.shiftKey,
          },
        )
      }
    />
  );
}
function composition(record: InteractionLabRecord) {
  const trace =
    (type: 'compositionend' | 'compositionstart' | 'compositionupdate') =>
    (event: CRCCompositionEvent) =>
      recordLogicalEvent(
        record,
        type,
        event,
        selfTargetLabels('composition-target'),
        {
          data: event.data,
        },
      );
  return (
    <Rectangle
      key="composition-target"
      style={{
        left: 120,
        top: 72,
        width: 240,
        height: 112,
        fill: '#be185d',
        stroke: '#831843',
        strokeWidth: 2,
      }}
      onCompositionStart={trace('compositionstart')}
      onCompositionUpdate={trace('compositionupdate')}
      onCompositionEnd={trace('compositionend')}
    />
  );
}
function clipboard(record: InteractionLabRecord) {
  return (
    <Rectangle
      key="clipboard-target"
      style={{
        left: 120,
        top: 72,
        width: 240,
        height: 112,
        fill: '#4f46e5',
        stroke: '#312e81',
        strokeWidth: 2,
      }}
      onPaste={(event: CRCClipboardEvent) =>
        recordLogicalEvent(
          record,
          'paste',
          event,
          selfTargetLabels('clipboard-target'),
          {
            text: event.clipboardData?.getData('text/plain') ?? '',
          },
        )
      }
    />
  );
}
function dragDrop(record: InteractionLabRecord) {
  type DragTargetLabel = 'drag-a' | 'drag-b';
  const labels: readonly DragTargetLabel[] = ['drag-a', 'drag-b'];
  const labelsByTarget = new WeakMap<CRCEvent['target'], DragTargetLabel>();
  const targetsByLabel = new Map<DragTargetLabel, CRCEvent['target']>();
  const bindTarget = (
    eventTarget: CRCEvent['target'],
    label: DragTargetLabel,
  ): DragTargetLabel => {
    const existingLabel = labelsByTarget.get(eventTarget);
    if (existingLabel && existingLabel !== label) {
      throw new Error(
        `Drag target changed identity from "${existingLabel}" to "${label}".`,
      );
    }
    const existingTarget = targetsByLabel.get(label);
    if (existingTarget && existingTarget !== eventTarget) {
      throw new Error(
        `Drag label "${label}" is already bound to another target.`,
      );
    }
    labelsByTarget.set(eventTarget, label);
    targetsByLabel.set(label, eventTarget);
    return label;
  };
  const resolveRelatedTarget = (
    eventTarget: CRCEvent['target'],
  ): DragTargetLabel => {
    const existingLabel = labelsByTarget.get(eventTarget);
    if (existingLabel) {
      return existingLabel;
    }
    const availableLabels = labels.filter(
      (label) => !targetsByLabel.has(label),
    );
    if (availableLabels.length !== 1) {
      throw new Error(
        'Unexpected drag related target: every fixture label is already bound.',
      );
    }
    return bindTarget(eventTarget, availableLabels[0]!);
  };
  const region = (target: DragTargetLabel, x: number, fill: string) => {
    const trace =
      (type: 'dragenter' | 'dragleave' | 'dragover' | 'drop') =>
      (event: CRCDragEvent) => {
        bindTarget(event.target, target);
        bindTarget(event.currentTarget, target);
        recordLogicalEvent(
          record,
          type,
          event,
          {
            currentTarget: target,
            relatedTarget: event.relatedTarget
              ? resolveRelatedTarget(event.relatedTarget)
              : null,
            target,
          },
          {
            text: event.dataTransfer?.getData('text/plain') ?? '',
          },
        );
      };
    return (
      <Rectangle
        key={target}
        style={{
          left: x,
          top: 72,
          width: 180,
          height: 112,
          fill,
          stroke: '#334155',
          strokeWidth: 2,
        }}
        onDragEnter={trace('dragenter')}
        onDragLeave={trace('dragleave')}
        onDragOver={trace('dragover')}
        onDrop={trace('drop')}
      />
    );
  };
  return [region('drag-a', 38, '#2563eb'), region('drag-b', 262, '#7c3aed')];
}
function caseVisual(
  state: Readonly<InteractionLabState>,
  record: InteractionLabRecord,
) {
  const geometry = rectanglePath(90, 66, 220, 124);
  switch (state.fixture) {
    case 'propagation':
      return [<PropagationFixture record={record} />];
    case 'pointer-capture':
      return [<CustomPointerCapture record={record} />];
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
      return [
        <Group key="untransformed-nested-group">
          <NestedInteractiveAncestor record={record} />
        </Group>,
      ];
    case 'fill':
      return [
        <Path
          key="fill-region"
          style={{
            d: geometry,
            fill: '#2563eb',
            cursor: 'pointer',
          }}
          {...traceHandlers('a', record)}
        />,
      ];
    case 'stroke':
      return [
        <Path
          key="stroke-region"
          style={{
            d: geometry,
            stroke: '#2563eb',
            strokeWidth: 6,
            lineInteractionWidth: 6,
            cursor: 'pointer',
          }}
          {...traceHandlers('a', record)}
        />,
      ];
    case 'fill-stroke':
      return [
        <Path
          key="fill-stroke-region"
          style={{
            d: geometry,
            fill: '#93c5fd',
            stroke: '#1d4ed8',
            strokeWidth: 6,
            lineInteractionWidth: 6,
            cursor: 'pointer',
          }}
          {...traceHandlers('a', record)}
        />,
      ];
    case 'transparent':
      return [
        <Rectangle
          key="transparent-guide"
          pointerEvents="none"
          style={{
            left: 90,
            top: 66,
            width: 220,
            height: 124,
            fill: '#e2e8f0',
            stroke: '#94a3b8',
            strokeWidth: 2,
          }}
        />,
        <Path
          key="transparent-region"
          style={{
            d: geometry,
            fill: 'rgba(37, 99, 235, 0)',
            cursor: 'pointer',
          }}
          {...traceHandlers('a', record)}
        />,
      ];
    case 'interaction-width':
      return [
        <Line
          key="expanded-line"
          style={{
            coords: [
              [90, 126],
              [390, 126],
            ],
            stroke: '#2563eb',
            strokeWidth: 2,
            lineInteractionWidth: 24,
            cursor: 'pointer',
          }}
          {...traceHandlers('a', record)}
        />,
        <Line
          key="interaction-top-guide"
          pointerEvents="none"
          style={{
            coords: [
              [90, 114],
              [390, 114],
            ],
            stroke: '#bfdbfe',
            strokeWidth: 1,
          }}
        />,
        <Line
          key="interaction-bottom-guide"
          pointerEvents="none"
          style={{
            coords: [
              [90, 138],
              [390, 138],
            ],
            stroke: '#bfdbfe',
            strokeWidth: 1,
          }}
        />,
      ];
    case 'no-hit':
      return [
        <Rectangle
          key="no-hit-guide"
          pointerEvents="none"
          style={{
            left: 90,
            top: 66,
            width: 220,
            height: 124,
            stroke: '#94a3b8',
            strokeWidth: 2,
          }}
        />,
        <Path
          key="no-hit-region"
          style={{
            d: geometry,
            lineInteractionWidth: 0,
            cursor: 'pointer',
          }}
          {...traceHandlers('a', record)}
        />,
      ];
  }
}
const InteractionLabScene = ({ state, record }: InteractionLabSceneProps) => {
  return [
    <Rectangle
      key="background"
      pointerEvents="none"
      style={{
        left: 0,
        top: 0,
        width: 480,
        height: 240,
        fill: '#f8fafc',
      }}
    />,
    <Text
      pointerEvents="none"
      style={{
        left: 24,
        top: 28,
        font: '700 17px Arial',
        fill: '#0f172a',
      }}
      key="title"
    >{`Ordering lab · ${state.fixture}`}</Text>,
    ...caseVisual(state, record),
    <Text
      pointerEvents="none"
      style={{
        left: 24,
        top: 226,
        font: '13px Arial',
        fill: '#334155',
      }}
      key="status"
    >{`trace ${state.trace.length} · handler ${state.handlerGeneration} · ${state.lastAction}`}</Text>,
  ];
};
export function createInteractionLabScene(props: InteractionLabSceneProps) {
  return <InteractionLabScene {...props} />;
}
