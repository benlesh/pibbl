import { describe, expect, it } from 'vitest';
import { assign } from './assign.js';
import { fromCallback } from './callback.js';
import { createMachine, defineMachine } from './runtime.js';
import { computed } from '../../lib/signals/graph.js';

type CounterEvent =
  | { readonly type: 'ADD'; readonly amount: number }
  | { readonly type: 'GO' }
  | { readonly type: 'BACK' };

describe('machine actors', () => {
  it('publishes one coherent signal snapshot after guarded actions and serial nested sends', () => {
    const seen: string[] = [];
    const machine = defineMachine<{ count: number }, CounterEvent, { readonly limit: number }>({
      initial: 'idle',
      context: () => ({ count: 0 }),
      states: {
        idle: {
          on: {
            ADD: {
              guard: ({ context, event, input }) => context.count + event.amount <= input.limit,
              actions: [
                assign(({ context, event }) => ({ count: context.count + event.amount })),
                ({ send }) => {
                  send({ type: 'GO' });
                  // @ts-expect-error invalid events are rejected even though this handler receives ADD.
                  send({ type: 'MISSING' });
                },
              ],
            },
            GO: { target: 'active', actions: ({ send }) => send({ type: 'ADD', amount: 1 }) },
          },
        },
        active: { on: { BACK: 'idle' } },
      },
    });
    const actor = createMachine(machine, { input: { limit: 2 } });
    actor.start();
    const before = actor.snapshot.get();
    actor.send({ type: 'ADD', amount: 3 });
    expect(actor.snapshot.get()).toBe(before);
    actor.send({ type: 'ADD', amount: 2 });
    expect(actor.snapshot.get()).toMatchObject({ value: 'active', context: { count: 2 }, status: 'active' });
    expect(actor.snapshot.get().matches('active')).toBe(true);
    expect(seen).toEqual([]);
  });

  it('cancels callback work on exit and rejects late task completion from an old entry', async () => {
    let cleanupCount = 0;
    let finish!: () => void;
    const completion = new Promise<void>(resolve => { finish = resolve; });
    const machine = defineMachine<{ readonly value: number }, { readonly type: 'LEAVE' }, undefined>({
      initial: 'working',
      context: { value: 1 },
      states: {
        working: {
          invoke: [
            { task: fromCallback(() => () => { cleanupCount++; }) },
            { task: () => completion, onDone: 'done' },
          ],
          on: { LEAVE: 'other' },
        },
        other: {},
        done: {},
      },
    });
    const actor = createMachine(machine, { input: undefined });
    actor.start();
    actor.send({ type: 'LEAVE' });
    expect(cleanupCount).toBe(1);
    finish();
    await Promise.resolve();
    expect(actor.snapshot.get().value).toBe('other');
    actor.stop();
    expect(cleanupCount).toBe(1);
  });

  it('releases every task even when one cleanup throws', () => {
    const released: string[] = [];
    const machine = defineMachine<object, { readonly type: 'STOP' }>({
      initial: 'active',
      context: {},
      states: {
        active: {
          invoke: [
            { task: () => () => { released.push('first'); throw new Error('first cleanup'); } },
            { task: () => () => { released.push('second'); } },
          ],
          on: { STOP: 'done' },
        },
        done: {},
      },
    });
    const actor = createMachine(machine, { input: undefined });
    actor.start();
    actor.send({ type: 'STOP' });
    expect(released).toEqual(['first', 'second']);
    expect(actor.snapshot.get().status).toBe('error');
  });

  it('keeps its normalized definition and snapshot identity for no-op effects', () => {
    const definition = defineMachine<{ readonly value: number }, { readonly type: 'GO' }>({
      initial: 'idle',
      context: { value: 1 },
      states: {
        idle: { on: { GO: { actions: () => {} } } },
      },
    });
    const actor = createMachine(definition, { input: undefined });
    actor.start();
    const before = actor.snapshot.get();
    (definition.states.idle.on as { GO: unknown }).GO = 'unknown-state';
    actor.send({ type: 'GO' });
    expect(actor.snapshot.get()).toBe(before);
  });

  it('ignores sends retained by a task after that task state exits', () => {
    let lateSend!: (event: { readonly type: 'FINISH' }) => void;
    const machine = defineMachine<object, { readonly type: 'LEAVE' } | { readonly type: 'FINISH' }>({
      initial: 'working',
      context: {},
      states: {
        working: {
          invoke: { task: ({ send }) => { lateSend = send; } },
          on: { LEAVE: 'other' },
        },
        other: { on: { FINISH: 'done' } },
        done: {},
      },
    });
    const actor = createMachine(machine, { input: undefined });
    actor.start();
    actor.send({ type: 'LEAVE' });
    lateSend({ type: 'FINISH' });
    expect(actor.snapshot.get().value).toBe('other');
  });

  it('does not start later invocations when a task stops its actor', () => {
    let actor!: ReturnType<typeof createMachine<object, { readonly type: 'STOP' }, undefined>>;
    let secondStarted = 0;
    const machine = defineMachine<object, { readonly type: 'STOP' }>({
      initial: 'active', context: {}, states: {
        active: { invoke: [
          { task: () => { actor.stop(); } },
          { task: () => { secondStarted++; } },
        ] },
      },
    });
    actor = createMachine(machine, { input: undefined });
    actor.start();
    expect(actor.snapshot.get().status).toBe('stopped');
    expect(secondStarted).toBe(0);
  });

  it('rejects sends during computed evaluation before effects or task cleanup run', () => {
    let cleanupCount = 0;
    const machine = defineMachine<object, { readonly type: 'LEAVE' }>({
      initial: 'working', context: {}, states: {
        working: {
          invoke: { task: () => () => { cleanupCount++; } },
          on: { LEAVE: 'other' },
        },
        other: {},
      },
    });
    const actor = createMachine(machine, { input: undefined });
    actor.start();
    const illegalSend = computed(() => {
      actor.send({ type: 'LEAVE' });
      return 1;
    });
    expect(() => illegalSend.get()).toThrow('Cannot write to a signal while evaluating a computed signal.');
    expect(actor.snapshot.get().value).toBe('working');
    expect(cleanupCount).toBe(0);
  });
});
