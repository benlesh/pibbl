import { pibbl, Rectangle, Text, useComputed, type PibblController } from '@pibbl/core';
import { assign, defineMachine, useMachine } from '@pibbl/core/machines';

type Context = { attempts: number; message: string };
type Event = { type: 'LOAD' } | { type: 'CANCEL' } | { type: 'RESET' };

const loader = defineMachine<Context, Event>({
  initial: 'idle',
  context: () => ({ attempts: 0, message: 'Ready to load' }),
  states: {
    idle: { on: { LOAD: 'loading' } },
    loading: {
      entry: assign(({ context }) => ({ attempts: context.attempts + 1, message: 'Loading…' })),
      invoke: {
        task: ({ context, signal }) => new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => {
            signal.removeEventListener('abort', cancel);
            if (context.attempts === 1) reject(new Error('Try once more'));
            else resolve('Your level is ready');
          }, 800);
          const cancel = () => { clearTimeout(timer); reject(new Error('Canceled')); };
          signal.addEventListener('abort', cancel, { once: true });
        }),
        onDone: { target: 'ready', actions: assign(({ event }) => ({ message: String(event.output) })) },
        onError: { target: 'failed', actions: assign(() => ({ message: 'First attempt failed. Retry?' })) },
      },
      on: { CANCEL: { target: 'idle', actions: assign(() => ({ message: 'Canceled — no late result' })) } },
    },
    failed: { on: { LOAD: 'loading' } },
    ready: {},
  },
  on: { RESET: { target: 'idle', reenter: true, actions: assign(() => ({ attempts: 0, message: 'Ready to load' })) } },
});

function LoadingCard() {
  const actor = useMachine(loader, { input: undefined });
  const state = actor.snapshot.get();
  const message = useComputed(() => actor.snapshot.get().context.message);
  const attempts = useComputed(() => `ATTEMPTS ${actor.snapshot.get().context.attempts}`);
  const busy = state.matches('loading');
  return <>
    <Rectangle style={{ width: 720, height: 420, fill: '#edf3ef' }} />
    <Text style={{ left: 40, top: 50, fill: '#12392e', font: 'bold 26px sans-serif' }}>A loading flow, expressed as states</Text>
    <Text style={{ left: 40, top: 100, fill: '#356354', font: '16px monospace' }}>idle → loading → failed / ready</Text>
    <Rectangle style={{ left: 40, top: 145, width: 640, height: 100, fill: busy ? '#e7c77e' : '#d2e4d9' }} />
    <Text style={{ left: 60, top: 175, fill: '#12392e', font: 'bold 21px sans-serif' }}>{message}</Text>
    <Text style={{ left: 60, top: 210, fill: '#356354', font: '14px monospace' }}>{attempts}</Text>
    <Rectangle style={{ left: 40, top: 280, width: 300, height: 58, fill: '#175743', cursor: 'pointer' }} onClick={() => actor.send({ type: busy ? 'CANCEL' : 'LOAD' })} />
    <Text pointerEvents="none" style={{ left: 65, top: 299, fill: 'white', font: 'bold 18px sans-serif' }}>{busy ? 'Cancel loading' : state.matches('ready') ? 'Ready — reset to try again' : 'Load / retry'}</Text>
    <Rectangle style={{ left: 365, top: 280, width: 150, height: 58, fill: '#d2e4d9', cursor: 'pointer' }} onClick={() => actor.send({ type: 'RESET' })} />
    <Text pointerEvents="none" style={{ left: 392, top: 299, fill: '#12392e', font: 'bold 18px sans-serif' }}>Reset</Text>
    <Text style={{ left: 40, top: 375, fill: '#356354', font: '14px sans-serif' }}>The first attempt fails. Retry succeeds. Cancel releases the timer.</Text>
  </>;
}

export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <LoadingCard />);
}
