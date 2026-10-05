import type { Signal } from '../../lib/signals/types.js';

/** An event accepted by a machine. The `type` selects the active state's handler. @see {@link MachineDefinition} */
export interface MachineEvent {
  /** Stable event discriminator. */
  readonly type: string;
}

/**
 * Maps each event discriminator to its narrowed event shape.
 * @property type - Handler selected for each event discriminator.
 * @see {@link MachineTransition}
 */
export type MachineEventRoutes<Context, Event extends MachineEvent, Input, State extends string> = {
  /** Handler selected for the corresponding event discriminator. */
  [type in Event['type']]?: MachineTransition<Context, Extract<Event, { /** Discriminator used to select this event variant. */ readonly type: type }>, Input, State, Event>;
};

/** Lifecycle state of a machine actor. @see {@link MachineActor} */
export type MachineStatus = 'not-started' | 'active' | 'stopped' | 'error';

/** Immutable state published by a running machine actor. @see {@link MachineActor} */
export interface MachineSnapshot<Context, State extends string = string> {
  /** Active flat state name. */
  readonly value: State;
  /** Application-owned immutable context for the active state. */
  readonly context: Readonly<Context>;
  /** Whether the actor may receive events. */
  readonly status: MachineStatus;
  /** Unexpected failure that stopped this actor, if any. */
  readonly error: unknown | undefined;
  /** Tests whether this flat machine currently occupies `state`.
   * @param state - State name to compare with the active value.
   * @returns True when this is the active state.
   */
  matches(state: State): boolean;
}

/** Cleanup called when a callback task's owning state exits or its actor stops. @see {@link MachineTask} */
export type MachineTaskCleanup = () => void;

/** Values given to state actions. Context reflects all preceding `assign` actions. @see {@link MachineAction} */
export interface MachineActionContext<Context, Event extends MachineEvent | undefined, Input, SentEvent extends MachineEvent = MachineEvent> {
  /** Context as it exists at this point in the transition. */
  readonly context: Readonly<Context>;
  /** Event which selected this transition. */
  readonly event: Event;
  /** Immutable actor input supplied at creation. */
  readonly input: Input;
  /** Queues an event after the current transition has completed.
   * @param event - Event to process after the active transition.
   */
  send(event: SentEvent): void;
}

/** A synchronous effect run during entry, exit, or a transition. @see {@link MachineActionContext} */
export type MachineAction<Context, Event extends MachineEvent | undefined, Input, SentEvent extends MachineEvent = MachineEvent> = {
  // Method bivariance lets a reusable event-specific action (such as assign()) run on an initial
  // entry as long as that action does not inspect an absent event.
  /** Executes one synchronous effect.
   * @param context - Current transition values.
   */
  action(context: MachineActionContext<Context, Event, Input, SentEvent>): void;
}['action'];

/** One action or actions run in source order. @see {@link MachineAction} */
export type MachineActions<Context, Event extends MachineEvent | undefined, Input, SentEvent extends MachineEvent = MachineEvent> =
  | MachineAction<Context, Event, Input, SentEvent>
  | readonly MachineAction<Context, Event, Input, SentEvent>[];

/** Values supplied to a state-owned task when that state is entered. @see {@link MachineTask} */
export interface MachineTaskContext<Context, Event extends MachineEvent, Input> {
  /** Context captured when this particular task starts. */
  readonly context: Readonly<Context>;
  /** Event that entered this state, or undefined for the initial state. */
  readonly event: Event | undefined;
  /** Immutable actor input supplied at creation. */
  readonly input: Input;
  /** Aborted synchronously when the owning state exits. */
  readonly signal: AbortSignal;
  /** Queues an event after the current transition, without re-entering the actor.
   * @param event - Event accepted by the owning actor.
   */
  send(event: Event): void;
}

/**
 * Cancelable work owned by a state entry. Return a cleanup for subscriptions or a promise for
 * finite work. A task is never started until its entry snapshot has been published.
 * @param context - State-entry values and cancellation signal.
 * @returns Optional cleanup or a promise for finite work.
 * @see {@link MachineInvocation}
 */
export type MachineTask<Context, Event extends MachineEvent, Input, Output = unknown> = (
  context: MachineTaskContext<Context, Event, Input>,
) => void | MachineTaskCleanup | Promise<Output>;

/** Completion data supplied to an invocation's `onDone` transition. @see {@link MachineInvocation} */
export interface MachineTaskDoneEvent<Output = unknown> extends MachineEvent {
  /** Internal completion discriminator. */ readonly type: '@pibbl/machine.done';
  /** Value resolved by the task promise. */ readonly output: Output;
}

/** Failure data supplied to an invocation's `onError` transition. @see {@link MachineInvocation} */
export interface MachineTaskErrorEvent extends MachineEvent {
  /** Internal failure discriminator. */ readonly type: '@pibbl/machine.error';
  /** Thrown or rejected task value. */ readonly error: unknown;
}

/** A transition selected by an invocation completion or failure. */
/** State-owned task and optional completion transitions. @see {@link MachineTask} */
export interface MachineInvocation<Context, Event extends MachineEvent, Input, State extends string> {
  /** Optional diagnostic identity; IDs are local to one state entry. */
  readonly id?: string;
  /** Work started after this state's snapshot publishes. */
  readonly task: MachineTask<Context, Event, Input>;
  /** Transition selected if a promise resolves before cancellation. */
  readonly onDone?: MachineTransition<Context, MachineTaskDoneEvent, Input, State, Event>;
  /** Transition selected if a task throws or a promise rejects before cancellation. */
  readonly onError?: MachineTransition<Context, MachineTaskErrorEvent, Input, State, Event>;
}

/** A conditional route considered in list order. @see {@link MachineTransition} */
export interface MachineTransitionConfig<Context, Event extends MachineEvent, Input, State extends string, SentEvent extends MachineEvent = Event> {
  /** Destination state. Omit to run actions without leaving the current state. */
  readonly target?: State;
  /** Only select this route when it returns true.
   * @param context - Current transition values.
   * @returns Whether this route may be selected.
   */
  readonly guard?: (context: MachineActionContext<Context, Event, Input, SentEvent>) => boolean;
  /** Effects run after exit and before entry. */
  readonly actions?: MachineActions<Context, Event, Input, SentEvent>;
  /** Restarts entry work when targeting the already active state. */
  readonly reenter?: boolean;
}

/** Shorthand state target, a configured route, or ordered guarded alternatives. @see {@link MachineTransitionConfig} */
export type MachineTransition<Context, Event extends MachineEvent, Input, State extends string, SentEvent extends MachineEvent = Event> =
  | State
  | MachineTransitionConfig<Context, Event, Input, State, SentEvent>
  | readonly MachineTransitionConfig<Context, Event, Input, State, SentEvent>[];

/** One flat state definition. Local event handlers shadow machine-level handlers. @see {@link MachineDefinition} */
export interface MachineState<Context, Event extends MachineEvent, Input, State extends string> {
  /** Effects run whenever this state is entered. The initial entry receives `undefined` as event. */
  readonly entry?: MachineActions<Context, Event | undefined, Input, Event>;
  /** Effects run whenever this state is exited. */
  readonly exit?: MachineActions<Context, Event, Input, Event>;
  /** State-owned work, canceled before exit effects. */
  readonly invoke?: MachineInvocation<Context, Event, Input, State> | readonly MachineInvocation<Context, Event, Input, State>[];
  /** Event routes local to this state. Declaring an event consumes machine-level handling. */
  readonly on?: MachineEventRoutes<Context, Event, Input, State>;
}

/** Declarative, reusable machine definition. Definitions create no actor or scheduled work. @see {@link MachineActor} */
export interface MachineDefinition<Context, Event extends MachineEvent, Input = undefined, State extends string = string> {
  /** State entered when an actor starts. */
  readonly initial: State;
  /** Initial context or a factory evaluated once for every actor.
   * @param context - Input used to create this actor's context.
   * @returns Initial context for the new actor.
   */
  readonly context: Context | ((context: Readonly<{ /** Input supplied when the actor is created. */ input: Input }>) => Context);
  /** State table. This initial implementation supports flat states only. */
  readonly states: Readonly<Record<State, MachineState<Context, Event, Input, State>>>;
  /** Fallback routes for events not declared by the active state. */
  readonly on?: MachineEventRoutes<Context, Event, Input, State>;
}

/** Options used to create an explicitly owned actor. @see {@link MachineActor} */
export interface CreateMachineOptions<Input> {
  /** Immutable application input available to context factories, actions, and tasks. */
  readonly input: Input;
}

/** Explicitly owned machine execution. Call `start` before sending events and `stop` to release it. @see {@link MachineDefinition} */
export interface MachineActor<Context, Event extends MachineEvent, _Input, State extends string = string> {
  /** Readonly, synchronous signal for the current state and context. */
  readonly snapshot: Signal<MachineSnapshot<Context, State>>;
  /** Starts the initial state once. Starting an active or stopped actor does nothing. */
  start(): void;
  /** Queues an event. Events sent during actions run after the current transition.
   * @param event - Event accepted by this actor.
   */
  send(event: Event): void;
  /** Terminal, idempotent cleanup. Cancels every task owned by the active state. */
  stop(): void;
}
