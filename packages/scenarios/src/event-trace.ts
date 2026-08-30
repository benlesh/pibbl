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

export type EventTraceField = boolean | number | string | null;
export type EventTraceFields = Readonly<Record<string, EventTraceField>>;

export interface EventTraceEntry {
  order: number;
  source: 'crc' | 'native';
  type: TraceEventType;
  target: string;
  currentTarget: string;
  x: number;
  y: number;
  button: number;
  buttons: number;
  canceled: boolean;
  fields: EventTraceFields;
  phase: 1 | 2 | 3 | null;
  transition: TraceTransition;
  relatedTarget: string | null;
}

export interface EventTraceInput extends Omit<
  EventTraceEntry,
  'button' | 'buttons' | 'canceled' | 'currentTarget' | 'fields' | 'order' | 'phase' | 'transition'
> {
  canceled?: boolean;
  currentTarget?: string;
  event?: Partial<Pick<MouseEvent, 'button' | 'buttons'>>;
  fields?: EventTraceFields;
  phase?: 1 | 2 | 3;
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

export class EventTraceRecorder {
  private entries: EventTraceEntry[] = [];

  constructor(private readonly onEntry?: (entry: Readonly<EventTraceEntry>) => void) {}

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

  getEntries(): readonly EventTraceEntry[] {
    return this.entries.map(entry => ({
      ...entry,
      fields: { ...entry.fields },
    }));
  }

  reset(): void {
    this.entries = [];
  }
}
