import type { MouseContractTraceEvent } from './mouse-contract.js';
/**
 * The category of a semantic event recorded by a scenario.
 *
 * @see {@link EventTraceEntry}
 * @see {@link MouseContractTraceEvent}
 */
export type TraceEventType =
  | 'click'
  | 'compositionend'
  | 'compositionstart'
  | 'compositionupdate'
  | 'contextmenu'
  | 'dblclick'
  | 'dragenter'
  | 'dragleave'
  | 'dragover'
  | 'drop'
  | 'gotpointercapture'
  | 'keydown'
  | 'lostpointercapture'
  | 'mousedown'
  | 'mousemove'
  | 'mouseout'
  | 'mouseover'
  | 'mouseup'
  | 'paste'
  | 'pointerdown'
  | 'pointermove'
  | 'pointerup'
  | 'touchend'
  | 'touchmove'
  | 'touchstart'
  | 'wheel';

/**
 * A before/after state transition represented in an event trace.
 *
 * @see {@link EventTraceEntry}
 * @see {@link EventTraceInput}
 */
export type TraceTransition =
  | 'activate'
  | 'capture'
  | 'compose'
  | 'drop'
  | 'enter'
  | 'key'
  | 'leave'
  | 'move'
  | 'observe'
  | 'press'
  | 'release';

/**
 * A supported scalar field value in a semantic event trace.
 *
 * @see {@link EventTraceFields}
 */
export type EventTraceField = boolean | number | string | null;
/**
 * Named semantic values attached to an event trace entry.
 *
 * @see {@link EventTraceField}
 * @see {@link EventTraceEntry}
 * @see {@link EventTraceInput}
 */
export type EventTraceFields = Readonly<Record<string, EventTraceField>>;

/**
 * An ordered recorded event with its semantic fields.
 *
 * @see {@link TraceEventType}
 * @see {@link EventTraceFields}
 * @see {@link TraceTransition}
 * @see {@link EventTraceRecorder}
 * @see {@link EventTraceInput}
 */
export interface EventTraceEntry {
  /** Order recorded or configured by this scenario. See {@link EventTraceEntry}. */
  order: number;
  /** Source recorded or configured by this scenario. See {@link EventTraceEntry}. */
  source: 'pibbl' | 'native';
  /** Type recorded or configured by this scenario. See {@link TraceEventType}. */
  type: TraceEventType;
  /** Target recorded or configured by this scenario. See {@link EventTraceEntry}. */
  target: string;
  /** Current target recorded or configured by this scenario. See {@link EventTraceEntry}. */
  currentTarget: string;
  /** X recorded or configured by this scenario. See {@link EventTraceEntry}. */
  x: number;
  /** Y recorded or configured by this scenario. See {@link EventTraceEntry}. */
  y: number;
  /** Button recorded or configured by this scenario. See {@link EventTraceEntry}. */
  button: number;
  /** Buttons recorded or configured by this scenario. See {@link EventTraceEntry}. */
  buttons: number;
  /** Canceled recorded or configured by this scenario. See {@link EventTraceEntry}. */
  canceled: boolean;
  /** Fields recorded or configured by this scenario. See {@link EventTraceFields}. */
  fields: EventTraceFields;
  /** Phase recorded or configured by this scenario. See {@link EventTraceEntry}. */
  phase: 1 | 2 | 3 | null;
  /** Transition recorded or configured by this scenario. See {@link TraceTransition}. */
  transition: TraceTransition;
  /** Related target recorded or configured by this scenario. See {@link EventTraceEntry}. */
  relatedTarget: string | null;
}

/**
 * An event and fields supplied to a scenario trace recorder.
 *
 * @see {@link EventTraceEntry}
 * @see {@link EventTraceFields}
 * @see {@link TraceTransition}
 * @see {@link EventTraceRecorder}
 */
export interface EventTraceInput extends Omit<
  EventTraceEntry,
  | 'button'
  | 'buttons'
  | 'canceled'
  | 'currentTarget'
  | 'fields'
  | 'order'
  | 'phase'
  | 'transition'
> {
  /** Canceled recorded or configured by this scenario. See {@link EventTraceInput}. */
  canceled?: boolean;
  /** Current target recorded or configured by this scenario. See {@link EventTraceInput}. */
  currentTarget?: string;
  /** Event recorded or configured by this scenario. See {@link EventTraceInput}. */
  event?: Partial<Pick<MouseEvent, 'button' | 'buttons'>>;
  /** Fields recorded or configured by this scenario. See {@link EventTraceFields}. */
  fields?: EventTraceFields;
  /** Phase recorded or configured by this scenario. See {@link EventTraceInput}. */
  phase?: 1 | 2 | 3;
  /** Transition recorded or configured by this scenario. See {@link TraceTransition}. */
  transition?: TraceTransition;
}

const TRANSITIONS: Readonly<Partial<Record<TraceEventType, TraceTransition>>> = {
  click: 'activate',
  compositionend: 'compose',
  compositionstart: 'compose',
  compositionupdate: 'compose',
  contextmenu: 'activate',
  dblclick: 'activate',
  dragenter: 'enter',
  dragleave: 'leave',
  dragover: 'move',
  drop: 'drop',
  gotpointercapture: 'capture',
  keydown: 'key',
  lostpointercapture: 'release',
  mousedown: 'press',
  mousemove: 'move',
  mouseout: 'leave',
  mouseover: 'enter',
  mouseup: 'release',
  paste: 'observe',
  pointerdown: 'press',
  pointermove: 'move',
  pointerup: 'release',
  touchend: 'release',
  touchmove: 'move',
  touchstart: 'press',
  wheel: 'move',
};

/**
 * Records ordered semantic events and state transitions for scenario assertions.
 *
 * @see {@link EventTraceEntry}
 * @see {@link EventTraceInput}
 */
export class EventTraceRecorder {
  private entries: EventTraceEntry[] = [];

  /**
   * Creates an empty recorder with its initial sequence state. See {@link EventTraceRecorder}.
   * @param onEntry - Optional callback invoked for each recorded trace entry. See
   * {@link EventTraceEntry} .
   */
  constructor(private readonly onEntry?: (entry: Readonly<EventTraceEntry>) => void) {}

  /**
   * Appends a semantic event to the ordered trace. See {@link EventTraceEntry}.
   * @param input - Event details to append to the trace. See {@link EventTraceInput}.
   * @returns The recorded entry with its assigned ordering metadata. See {@link EventTraceEntry}.
   */
  record(input: EventTraceInput): EventTraceEntry {
    const entry: EventTraceEntry = {
      order: this.entries.length + 1,
      source: input.source,
      type: input.type,
      target: input.target,
      currentTarget: input.currentTarget ?? input.target,
      x: input.x,
      y: input.y,
      button: input.event?.button ?? 0,
      buttons: input.event?.buttons ?? 0,
      canceled: input.canceled ?? false,
      fields: { ...input.fields },
      phase: input.phase ?? null,
      transition: input.transition ?? TRANSITIONS[input.type] ?? 'observe',
      relatedTarget: input.relatedTarget,
    };
    this.entries.push(entry);
    this.onEntry?.(entry);
    return entry;
  }

  /**
   * Returns the recorded semantic event entries. See {@link EventTraceEntry}.
   * @returns The currently recorded trace entries in order. See {@link EventTraceEntry}.
   */
  getEntries(): readonly EventTraceEntry[] {
    return this.entries.map(entry => ({
      ...entry,
      fields: { ...entry.fields },
    }));
  }

  /** Clears the recorder for another deterministic exercise. See {@link EventTraceRecorder}. */
  reset(): void {
    this.entries = [];
  }
}
