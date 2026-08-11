export type TraceEventType =
  | 'click'
  | 'contextmenu'
  | 'dblclick'
  | 'mousedown'
  | 'mousemove'
  | 'mouseout'
  | 'mouseover'
  | 'mouseup';

export type TraceTransition = 'activate' | 'enter' | 'leave' | 'move' | 'press' | 'release';

export interface EventTraceEntry {
  order: number;
  source: 'crc' | 'native';
  type: TraceEventType;
  target: string;
  x: number;
  y: number;
  button: number;
  buttons: number;
  transition: TraceTransition;
  relatedTarget: string | null;
}

export interface EventTraceInput extends Omit<EventTraceEntry, 'button' | 'buttons' | 'order' | 'transition'> {
  event: Pick<MouseEvent, 'button' | 'buttons'>;
  transition?: TraceTransition;
}

const TRANSITIONS: Readonly<Record<TraceEventType, TraceTransition>> = {
  click: 'activate',
  contextmenu: 'activate',
  dblclick: 'activate',
  mousedown: 'press',
  mousemove: 'move',
  mouseout: 'leave',
  mouseover: 'enter',
  mouseup: 'release',
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
      x: input.x,
      y: input.y,
      button: input.event.button,
      buttons: input.event.buttons,
      transition: input.transition ?? TRANSITIONS[input.type],
      relatedTarget: input.relatedTarget,
    };
    this.entries.push(entry);
    this.onEntry?.(entry);
    return entry;
  }

  getEntries(): readonly EventTraceEntry[] {
    return this.entries.map(entry => ({ ...entry }));
  }

  reset(): void {
    this.entries = [];
  }
}
