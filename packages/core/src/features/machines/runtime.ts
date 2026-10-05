import { assertDirectSignalWriteAllowed, signal } from '../../lib/signals/graph.js';
import { assignmentOf } from './assign.js';
import type {
  CreateMachineOptions,
  MachineAction,
  MachineActionContext,
  MachineActions,
  MachineActor,
  MachineDefinition,
  MachineEvent,
  MachineInvocation,
  MachineSnapshot,
  MachineState,
  MachineStatus,
  MachineTaskDoneEvent,
  MachineTaskErrorEvent,
  MachineTransition,
  MachineTransitionConfig,
} from './types.js';

interface CompiledMachine {
  readonly states: ReadonlyMap<string, CompiledState>;
  readonly on: ReadonlyMap<string, unknown>;
}

interface CompiledState {
  readonly definition: MachineState<object, MachineEvent, unknown, string>;
  readonly on: ReadonlyMap<string, unknown>;
}

const compiledMachines = new WeakMap<object, CompiledMachine>();

/**
 * Validates and records a reusable flat machine definition. Calling this function performs no
 * work and creates no actor; use {@link createMachine} or `useMachine` to execute it.
 * @param definition - Reusable machine behavior to validate and normalize.
 * @returns The supplied definition, suitable for actor creation.
 * @see {@link MachineDefinition}
 */
export function defineMachine<Context, Event extends MachineEvent, Input = undefined, State extends string = string>(
  definition: MachineDefinition<Context, Event, Input, State>,
): MachineDefinition<Context, Event, Input, State> {
  compile(definition);
  return definition;
}

/**
 * Creates an explicitly owned, initially idle machine actor. Call `start()` when ownership begins
 * and `stop()` when it ends. The actor has no renderer, scheduler, or animation dependency.
 * @param definition - Reusable behavior previously authored with {@link defineMachine}.
 * @param options - Immutable input supplied to this actor.
 * @returns An idle actor that owns no task until it starts.
 * @see {@link MachineActor}
 */
export function createMachine<Context, Event extends MachineEvent, Input, State extends string = string>(
  definition: MachineDefinition<Context, Event, Input, State>,
  options: CreateMachineOptions<Input>,
): MachineActor<Context, Event, Input, State> {
  const compiled = compile(definition);
  const input = options.input;
  const context = typeof definition.context === 'function'
    ? (definition.context as (value: Readonly<{ input: Input }>) => Context)({ input })
    : definition.context;
  let currentContext = context;
  let value = definition.initial;
  let status: MachineStatus = 'not-started';
  let error: unknown | undefined;
  let activeEntry: StateEntry<Context, Event, Input, State> | undefined;
  let entryGeneration = 0;
  const initial = snapshot(value, currentContext, status, error);
  const writableSnapshot = signal(initial, { debugName: 'machine.snapshot' });
  const publicSnapshot = writableSnapshot.asReadonly();
  const queue: QueueItem<Context, Event, Input, State>[] = [];
  let queueHead = 0;
  let processing = false;

  const actor: MachineActor<Context, Event, Input, State> = {
    snapshot: publicSnapshot,
    start(): void {
      if (status !== 'not-started') return;
      assertDirectSignalWriteAllowed(writableSnapshot);
      status = 'active';
      // Entry actions may send events. Keep those queued until the initial entry has published
      // and started its owned work, just like an ordinary transition.
      processing = true;
      try {
        runActions(stateDefinition().entry as unknown as MachineActions<Context, Event, Input>, undefined);
        if (status !== 'active') return;
        publish();
        startInvocations(undefined);
      } catch (cause) {
        fail(cause);
      } finally {
        processing = false;
      }
      drain();
    },
    send(event: Event): void {
      if (status !== 'active') return;
      assertDirectSignalWriteAllowed(writableSnapshot);
      queue.push({ kind: 'event', event });
      if (!processing) drain();
    },
    stop(): void {
      if (status === 'stopped' || status === 'error') return;
      assertDirectSignalWriteAllowed(writableSnapshot);
      status = 'stopped';
      try {
        cancelEntry();
      } finally {
        releaseQueue();
        publish();
      }
    },
  };

  return actor;

  function stateDefinition(): MachineState<Context, Event, Input, State> {
    const state = compiled.states.get(value);
    if (!state) throw new Error(`Machine entered unknown state ${JSON.stringify(value)}.`);
    return state.definition as unknown as MachineState<Context, Event, Input, State>;
  }

  function drain(): void {
    if (processing || status !== 'active') return;
    processing = true;
    try {
      while (status === 'active' && queueHead < queue.length) {
        const item = queue[queueHead];
        queue[queueHead++] = undefined as never;
        if (item.kind === 'event') processEvent(item.event);
        else processInvocation(item);
      }
    } catch (cause) {
      fail(cause);
    } finally {
      processing = false;
      if (queueHead === queue.length) releaseQueue();
    }
  }

  function processEvent(event: Event): void {
    const compiledState = compiled.states.get(value)!;
    const local = compiledState.on;
    // Local declaration intentionally shadows the machine fallback even if every guard rejects.
    const source = local.has(event.type) ? local.get(event.type) : compiled.on.get(event.type);
    if (source === undefined) return;
    const selected = selectTransition(source as MachineTransition<Context, Event, Input, State, Event>, event);
    if (selected !== undefined) applyTransition(selected, event);
  }

  function processInvocation(item: InvocationQueueItem<Context, Event, Input, State>): void {
    if (!item.entry.active || activeEntry !== item.entry || status !== 'active') return;
    const source = item.kind === 'done' ? item.invocation.onDone : item.invocation.onError;
    if (source === undefined) {
      if (item.kind === 'error') fail(item.error);
      return;
    }
    const event = item.kind === 'done'
      ? { type: '@pibbl/machine.done', output: item.output } as MachineTaskDoneEvent
      : { type: '@pibbl/machine.error', error: item.error } as MachineTaskErrorEvent;
    const selected = selectTransition<MachineEvent>(
      source as unknown as MachineTransition<Context, MachineEvent, Input, State, Event>,
      event,
    );
    if (selected !== undefined) applyTransition<MachineEvent>(selected, event);
  }

  function selectTransition<SelectedEvent extends MachineEvent>(
    source: MachineTransition<Context, SelectedEvent, Input, State, Event>,
    event: SelectedEvent,
  ): MachineTransitionConfig<Context, SelectedEvent, Input, State, Event> | undefined {
    if (typeof source === 'string') return { target: source };
    const candidates = Array.isArray(source as unknown) ? source as readonly MachineTransitionConfig<Context, SelectedEvent, Input, State, Event>[] : undefined;
    if (!candidates) {
      const candidate = source as MachineTransitionConfig<Context, SelectedEvent, Input, State, Event>;
      return !candidate.guard || candidate.guard(actionContext(event)) ? candidate : undefined;
    }
    for (const candidate of candidates) {
      if (!candidate.guard || candidate.guard(actionContext(event))) return candidate;
    }
    return undefined;
  }

  function applyTransition<SelectedEvent extends MachineEvent>(
    transition: MachineTransitionConfig<Context, SelectedEvent, Input, State, Event>,
    event: SelectedEvent,
  ): void {
    const target = transition.target ?? value;
    const changesState = target !== value || transition.reenter === true;
    if (changesState) {
      cancelEntry();
      runActions(stateDefinition().exit, event as unknown as Event);
      if (status !== 'active') return;
    }
    const contextChanged = runActions(transition.actions, event);
    if (status !== 'active') return;
    if (changesState) {
      value = target;
      runActions(stateDefinition().entry as unknown as MachineActions<Context, Event, Input>, event as unknown as Event);
    }
    // Empty handlers and no-op action handlers preserve snapshot identity.
    if (changesState || contextChanged) publish();
    if (changesState) startInvocations(event as unknown as Event);
  }

  function actionContext<SelectedEvent extends MachineEvent>(event: SelectedEvent | undefined): MachineActionContext<Context, SelectedEvent, Input, Event> {
    return {
      get context() { return currentContext; },
      event: event as SelectedEvent,
      input,
      send: actor.send,
    };
  }

  function runActions<SelectedEvent extends MachineEvent>(
    actions: MachineAction<Context, SelectedEvent, Input, Event> | readonly MachineAction<Context, SelectedEvent, Input, Event>[] | undefined,
    event: SelectedEvent | undefined,
  ): boolean {
    if (actions === undefined) return false;
    const list = Array.isArray(actions) ? actions : [actions];
    let changed = false;
    for (const action of list) {
      const contextForAction = actionContext(event);
      const assignment = assignmentOf(action);
      if (assignment) {
        const patch = assignment(contextForAction as unknown as MachineActionContext<object, MachineEvent, unknown>);
        if (patch === null || typeof patch !== 'object') throw new TypeError('assign() must return a context object patch.');
        if (patchChangesContext(currentContext, patch)) {
          currentContext = Object.assign({}, currentContext as object, patch) as Context;
          changed = true;
        }
      } else {
        action(contextForAction);
      }
      if (status !== 'active') return changed;
    }
    return changed;
  }

  function startInvocations(event: Event | undefined): void {
    const definitions = stateDefinition().invoke;
    if (!definitions) return;
    const entry: StateEntry<Context, Event, Input, State> = {
      active: true,
      generation: ++entryGeneration,
      controllers: [],
    };
    activeEntry = entry;
    const list = Array.isArray(definitions) ? definitions : [definitions];
    for (const invocation of list) {
      startInvocation(entry, invocation, event);
      if (status !== 'active' || !entry.active || activeEntry !== entry) break;
    }
  }

  function startInvocation(
    entry: StateEntry<Context, Event, Input, State>,
    invocation: MachineInvocation<Context, Event, Input, State>,
    event: Event | undefined,
  ): void {
    const controller = new AbortController();
    const owned: OwnedInvocation<Context, Event, Input, State> = { controller, invocation, cleanup: undefined };
    entry.controllers.push(owned);
    let returned: void | (() => void) | Promise<unknown>;
    try {
      returned = invocation.task({
        context: currentContext,
        event,
        input,
        signal: controller.signal,
        send(queuedEvent: Event): void {
          if (status !== 'active' || !entry.active || activeEntry !== entry || controller.signal.aborted) return;
          actor.send(queuedEvent);
        },
      });
    } catch (cause) {
      queueInvocation({ kind: 'error', entry, invocation, error: cause });
      return;
    }
    if (typeof returned === 'function') {
      owned.cleanup = returned;
    } else if (returned && typeof (returned as Promise<unknown>).then === 'function') {
      Promise.resolve(returned).then(
        output => queueInvocation({ kind: 'done', entry, invocation, output }),
        cause => queueInvocation({ kind: 'error', entry, invocation, error: cause }),
      );
    }
  }

  function queueInvocation(item: InvocationQueueItem<Context, Event, Input, State>): void {
    if (status !== 'active' || !item.entry.active || activeEntry !== item.entry) return;
    queue.push(item);
    if (!processing) drain();
  }

  function cancelEntry(): void {
    const entry = activeEntry;
    activeEntry = undefined;
    if (!entry) return;
    entry.active = false;
    const failures: unknown[] = [];
    for (const owned of entry.controllers) {
      try { owned.controller.abort(); } catch (cause) { failures.push(cause); }
      const cleanup = owned.cleanup;
      owned.cleanup = undefined;
      if (cleanup) {
        try { cleanup(); } catch (cause) { failures.push(cause); }
      }
    }
    entry.controllers.length = 0;
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, 'Machine state task cleanup failed.');
  }

  function fail(cause: unknown): void {
    if (status === 'error' || status === 'stopped') return;
    status = 'error';
    error = cause;
    try { cancelEntry(); } catch (cleanupCause) { error = new AggregateError([cause, cleanupCause], 'Machine failed while cleaning up a state task.'); }
    releaseQueue();
    publish();
  }

  function releaseQueue(): void {
    for (let index = queueHead; index < queue.length; index++) queue[index] = undefined as never;
    queue.length = 0;
    queueHead = 0;
  }

  function publish(): void {
    writableSnapshot.set(snapshot(value, currentContext, status, error));
  }
}

function snapshot<Context, State extends string>(
  value: State,
  context: Context,
  status: MachineStatus,
  error: unknown | undefined,
): MachineSnapshot<Context, State> {
  return Object.freeze({ value, context, status, error, matches: (candidate: State) => candidate === value });
}

/** Avoid replacing context or publishing a snapshot for an assignment that changes no own key. */
function patchChangesContext(context: unknown, patch: object): boolean {
  if (context === null || typeof context !== 'object') return true;
  for (const key of Reflect.ownKeys(patch)) {
    if (!Object.is((context as Record<PropertyKey, unknown>)[key], (patch as Record<PropertyKey, unknown>)[key])) return true;
  }
  return false;
}

function compile<Context, Event extends MachineEvent, Input, State extends string>(
  definition: MachineDefinition<Context, Event, Input, State>,
): CompiledMachine {
  const known = compiledMachines.get(definition);
  if (known) return known;
  if (!definition || typeof definition !== 'object') throw new TypeError('Machine definition must be an object.');
  if (!definition.states || typeof definition.states !== 'object') throw new TypeError('Machine definition requires a states object.');
  if (!Object.prototype.hasOwnProperty.call(definition.states, definition.initial)) throw new RangeError(`Machine initial state ${JSON.stringify(definition.initial)} is not declared.`);
  const names = new Set(Object.keys(definition.states));
  const states = new Map<string, CompiledState>();
  for (const [name, rawValue] of Object.entries(definition.states)) {
    const raw = rawValue as MachineState<Context, Event, Input, State>;
    if (!raw || typeof raw !== 'object') throw new TypeError(`Machine state ${JSON.stringify(name)} must be an object.`);
    validateHandlers(raw.on, names, `state ${JSON.stringify(name)}`);
    validateInvocations(raw.invoke, names, `state ${JSON.stringify(name)}`);
    const normalized = normalizeState(raw);
    states.set(name, { definition: normalized as unknown as MachineState<object, MachineEvent, unknown, string>, on: new Map(Object.entries(normalized.on ?? {})) });
  }
  validateHandlers(definition.on, names, 'machine');
  const compiled: CompiledMachine = { states, on: normalizeHandlers(definition.on) };
  compiledMachines.set(definition, compiled);
  return compiled;
}

function normalizeState<Context, Event extends MachineEvent, Input, State extends string>(
  state: MachineState<Context, Event, Input, State>,
): MachineState<Context, Event, Input, State> {
  const invocations = state.invoke === undefined ? undefined : (Array.isArray(state.invoke)
    ? state.invoke.map(invocation => normalizeInvocation(invocation))
    : normalizeInvocation(state.invoke));
  return Object.freeze({
    entry: normalizeActions(state.entry),
    exit: normalizeActions(state.exit),
    invoke: invocations === undefined ? undefined : Object.freeze(Array.isArray(invocations) ? invocations : [invocations]),
    on: Object.freeze(Object.fromEntries(normalizeHandlers(state.on))),
  }) as unknown as MachineState<Context, Event, Input, State>;
}

function normalizeHandlers(handlers: object | undefined): Map<string, unknown> {
  if (!handlers) return new Map();
  return new Map(Object.entries(handlers).map(([type, transition]) => [type, normalizeTransition(transition)]));
}

function normalizeInvocation(invocation: unknown): object {
  const source = invocation as { id?: string; task: unknown; onDone?: unknown; onError?: unknown };
  return Object.freeze({
    id: source.id,
    task: source.task,
    onDone: normalizeTransition(source.onDone),
    onError: normalizeTransition(source.onError),
  });
}

function normalizeTransition(transition: unknown): unknown {
  if (transition === undefined || typeof transition === 'string') return transition;
  if (Array.isArray(transition)) return Object.freeze(transition.map(candidate => normalizeTransition(candidate)));
  const source = transition as { target?: string; guard?: unknown; actions?: unknown; reenter?: boolean };
  return Object.freeze({
    target: source.target,
    guard: source.guard,
    actions: normalizeActions(source.actions),
    reenter: source.reenter,
  });
}

function normalizeActions(actions: unknown): unknown {
  return Array.isArray(actions) ? Object.freeze([...actions]) : actions;
}

function validateHandlers(handlers: object | undefined, names: ReadonlySet<string>, label: string): void {
  if (handlers === undefined) return;
  if (!handlers || typeof handlers !== 'object') throw new TypeError(`Handlers for ${label} must be an object.`);
  for (const transition of Object.values(handlers)) validateTransition(transition, names, label);
}

function validateInvocations(invocations: unknown, names: ReadonlySet<string>, label: string): void {
  if (invocations === undefined) return;
  const list = Array.isArray(invocations) ? invocations : [invocations];
  for (const invocation of list) {
    if (!invocation || typeof invocation !== 'object' || typeof (invocation as { task?: unknown }).task !== 'function') throw new TypeError(`Each invocation in ${label} requires a task function.`);
    const typed = invocation as { onDone?: unknown; onError?: unknown };
    validateTransition(typed.onDone, names, label);
    validateTransition(typed.onError, names, label);
  }
}

function validateTransition(transition: unknown, names: ReadonlySet<string>, label: string): void {
  if (transition === undefined) return;
  const list = Array.isArray(transition) ? transition : [transition];
  for (const candidate of list) {
    if (typeof candidate === 'string') {
      if (!names.has(candidate)) throw new RangeError(`Transition in ${label} targets undeclared state ${JSON.stringify(candidate)}.`);
      continue;
    }
    if (!candidate || typeof candidate !== 'object') throw new TypeError(`Transition in ${label} must be a state name or object.`);
    const config = candidate as { target?: unknown; guard?: unknown; actions?: unknown };
    if (config.target !== undefined && (typeof config.target !== 'string' || !names.has(config.target))) throw new RangeError(`Transition in ${label} targets an undeclared state.`);
    if (config.guard !== undefined && typeof config.guard !== 'function') throw new TypeError(`Transition guard in ${label} must be a function.`);
    if (config.actions !== undefined && typeof config.actions !== 'function' && (!Array.isArray(config.actions) || config.actions.some(action => typeof action !== 'function'))) throw new TypeError(`Transition actions in ${label} must be functions.`);
  }
}

interface StateEntry<Context, Event extends MachineEvent, Input, State extends string> {
  active: boolean;
  readonly generation: number;
  readonly controllers: OwnedInvocation<Context, Event, Input, State>[];
}
interface OwnedInvocation<Context, Event extends MachineEvent, Input, State extends string> {
  readonly controller: AbortController;
  readonly invocation: MachineInvocation<Context, Event, Input, State>;
  cleanup: (() => void) | undefined;
}
type EventQueueItem<Event extends MachineEvent> = { readonly kind: 'event'; readonly event: Event };
type InvocationQueueItem<Context, Event extends MachineEvent, Input, State extends string> =
  | { readonly kind: 'done'; readonly entry: StateEntry<Context, Event, Input, State>; readonly invocation: MachineInvocation<Context, Event, Input, State>; readonly output: unknown }
  | { readonly kind: 'error'; readonly entry: StateEntry<Context, Event, Input, State>; readonly invocation: MachineInvocation<Context, Event, Input, State>; readonly error: unknown };
type QueueItem<Context, Event extends MachineEvent, Input, State extends string> = EventQueueItem<Event> | InvocationQueueItem<Context, Event, Input, State>;
