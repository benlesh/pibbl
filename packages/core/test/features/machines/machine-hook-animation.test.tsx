import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { drive, pibbl, signal, tween } from '@pibbl/core';
import {
  defineMachine,
  fromCallback,
  useMachine,
  type MachineActor,
} from '@pibbl/core/machines';
import { playAnimation } from '@pibbl/core/machines/animation';
import { clearSharedState } from '../../../src/lib/global-state.js';
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from '../../../src/lib/scheduler/testing.js';

let driver: ManualSchedulerDriver;
let restoreDriver: () => void;
const roots = new Set<ReturnType<typeof pibbl>>();

beforeEach(() => {
  document.body.replaceChildren();
  driver = new ManualSchedulerDriver();
  restoreDriver = installSchedulerDriverForTest(driver);
});

afterEach(() => {
  for (const root of roots) root.dispose();
  roots.clear();
  clearSharedState();
  restoreDriver();
  document.body.replaceChildren();
});

function mount(node: Parameters<typeof pibbl>[1]): ReturnType<typeof pibbl> {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const root = pibbl(canvas, node);
  roots.add(root);
  return root;
}

describe('machine mount and animation integration', () => {
  it('starts a hook-owned actor after mount and stops its state-owned work on unmount', () => {
    type Event = { readonly type: 'NEXT' };
    let starts = 0;
    let cleanups = 0;
    const machine = defineMachine<{ readonly label: string }, Event, { readonly amount: number }>({
      initial: 'idle',
      context: { label: 'ready' },
      states: {
        idle: {
          invoke: {
            task: fromCallback(({ input }) => {
              starts += input.amount;
              return () => { cleanups++; };
            }),
          },
          on: { NEXT: 'done' },
        },
        done: {},
      },
    });
    let actor!: MachineActor<{ readonly label: string }, Event, { readonly amount: number }>;

    function Probe() {
      actor = useMachine(machine, { input: { amount: 2 } });
      return null;
    }

    const root = mount(<Probe />);
    driver.flush(0);
    expect(actor.snapshot.get()).toMatchObject({ value: 'idle', status: 'active' });
    expect(starts).toBe(2);

    actor.send({ type: 'NEXT' });
    expect(actor.snapshot.get().value).toBe('done');
    expect(cleanups).toBe(1);

    root.dispose();
    expect(actor.snapshot.get().status).toBe('stopped');
    expect(cleanups).toBe(1);
  });

  it('completes a finite state-owned animation and enters its onDone state', async () => {
    type Event = { readonly type: 'UNUSED' };
    const output = signal(0);
    const machine = defineMachine<{}, Event, {}>({
      initial: 'animating',
      context: {},
      states: {
        animating: {
          invoke: {
            task: playAnimation(() => drive(output, tween({ from: 0, to: 10, duration: 100 }))),
            onDone: 'done',
          },
        },
        done: {},
      },
    });
    let actor!: MachineActor<{}, Event, {}>;

    function Probe() {
      actor = useMachine(machine, { input: {} });
      return null;
    }

    mount(<Probe />);
    driver.flush(0);
    driver.flush(1);
    expect(actor.snapshot.get().value).toBe('animating');
    driver.flush(101);

    expect(output.get()).toBe(10);
    await Promise.resolve();
    expect(actor.snapshot.get()).toMatchObject({ value: 'done', status: 'active' });
  });
});
