import { signal } from '../signals/graph.js';
import type { Signal } from '../signals/types.js';
import { drive } from '../animation/program.js';
import { defineAnimation, tween } from '../animation/definition.js';
import type { CRCPlayback } from '../animation/types.js';
import { createTransitionBinding, type CRCTransitionBinding } from '../transitions/binding.js';
import { createTransitionRuntime, transitionEffectSampler, transitionEffectTail, type CRCTransitionEffect } from '../transitions/fade.js';
import { useHookSlot } from './hook-slot.js';
import { queueBeginCommand } from '../scheduler/realm-scheduler.js';
import type { CRCBeginCommandHandle } from '../scheduler/types.js';
import { usePlayback } from './use-playback.js';

export type CRCVisibilityTransitionStatus = 'hidden' | 'entering' | 'visible' | 'exiting' | 'disposed';
export interface CRCVisibilityTransitionResult {
  readonly requestId: number;
  readonly phase: 'enter' | 'exit';
  readonly status: 'finished' | 'cancelled' | 'disposed';
}
export interface CRCVisibilityTransitionOptions {
  /** Mount-time options in the first slice. */
  readonly initial?: boolean;
  readonly enter: CRCTransitionEffect;
  readonly exit?: CRCTransitionEffect;
  readonly duration?: number;
}
export interface CRCVisibilityTransition {
  readonly binding: CRCTransitionBinding;
  readonly visible: Signal<boolean>;
  readonly progress: Signal<number>;
  readonly status: Signal<CRCVisibilityTransitionStatus>;
  show(): Promise<CRCVisibilityTransitionResult>;
  hide(): Promise<CRCVisibilityTransitionResult>;
  finish(): void;
}

/** Explicitly controlled visibility. It does not retain unmounted content or alter targeting. */
export function useVisibilityTransition(options: CRCVisibilityTransitionOptions): CRCVisibilityTransition {
  const duration = options.duration ?? 300;
  if (!Number.isFinite(duration) || duration < 0) throw new RangeError('Visibility transition duration must be finite and nonnegative.');
  if (options.initial !== undefined && typeof options.initial !== 'boolean') throw new TypeError('Visibility transition initial must be boolean.');
  transitionEffectSampler(options.enter);
  transitionEffectSampler(options.exit ?? options.enter);
  const enterTail = transitionEffectTail(options.enter), exitTail = transitionEffectTail(options.exit ?? options.enter);
  const state = useHookSlot('visibility-transition', teardowns => {
    const enterRuntime = createTransitionRuntime(options.enter);
    const exitRuntime = options.exit && options.exit !== options.enter ? createTransitionRuntime(options.exit) : enterRuntime;
    const runtimes = [...new Set([enterRuntime, exitRuntime])];
    const enter = enterRuntime.sample, exit = exitRuntime.sample;
    const visible = signal(options.initial ?? true);
    const progress = signal(visible.get() ? 1 : 0);
    const status = signal<CRCVisibilityTransitionStatus>(visible.get() ? 'visible' : 'hidden');
    let disposed = false, serial = 0;
    let pending: { id: number; target: boolean; resolve: (result: CRCVisibilityTransitionResult) => void } | undefined;
    const elapsed = signal(0), tailTime = signal(0);
    const maxTail = Math.max(enterTail, exitTail);
    let playback!: CRCPlayback, clock!: CRCPlayback, tail!: CRCPlayback;
    let tailRunning = false;
    const forced = signal(false);
    let runStart = 0, runInitial = progress.get();
    const historyCommands = new Set<CRCBeginCommandHandle>();
    let history: { time: number; progress: number; direction: number }[] = [];
    const progressAt = (time: number) => {
      if (!Number.isFinite(time)) throw new RangeError('progressAt requires a finite time.');
      if (time < 0) return runInitial;
      const segment = history.findLast(value => value.time <= time);
      if (!segment) return runInitial;
      return Math.max(0, Math.min(1, segment.progress + segment.direction * (duration === 0 ? 1 : (time - segment.time) / duration)));
    };
    let direction: 'enter' | 'exit' = 'enter';
    const settle = (outcome: CRCVisibilityTransitionResult['status']) => {
      const request = pending; pending = undefined;
      request?.resolve(Object.freeze({ requestId: request.id, phase: request.target ? 'enter' : 'exit', status: outcome }));
    };
    const request = (target: boolean): Promise<CRCVisibilityTransitionResult> => {
      const id = ++serial, phase = target ? 'enter' : 'exit';
      if (disposed) return Promise.resolve({ requestId: id, phase, status: 'disposed' });
      // The signal write also enforces CRC's prohibition on commands during rendering.
      visible.set(target);
      const wasActive = pending !== undefined;
      const wasTailing = tailRunning;
      tailRunning = false; forced.set(false); if (wasTailing) tail.cancel();
      settle('cancelled');
      if (!wasActive && progress.get() === Number(target) && playback.status.get() !== 'running') {
        status.set(target ? 'visible' : 'hidden');
        return Promise.resolve({ requestId: id, phase, status: 'finished' });
      }
      const promise = new Promise<CRCVisibilityTransitionResult>(resolve => { pending = { id, target, resolve }; });
      status.set(target ? 'entering' : 'exiting');
      if (!wasActive) clock.play();
      if (!wasActive || wasTailing || direction !== phase) {
        const at = wasActive ? elapsed.get() : 0, from = progress.get();
        let command!: CRCBeginCommandHandle;
        command = queueBeginCommand(snapshot => {
          historyCommands.delete(command);
          if (disposed) return;
          if (!wasActive) { history = []; runInitial = from; runStart = snapshot.logicalTime; for (const runtime of runtimes) runtime.reset?.(); }
          const append = (time: number, slope: number) => {
            if (history.at(-1)?.time === time) history.pop();
            history.push({ time, progress: from, direction: slope });
          };
          // Playback changes direction in Begin, holding the last committed value
          // until that frame. Keep that hold and all earlier run segments.
          append(at, 0);
          append(snapshot.logicalTime - runStart, target ? 1 : -1);
        });
        historyCommands.add(command);
      }
      if (wasTailing && progress.get() === Number(target)) { startTail(); return promise; }
      if ((wasActive && !wasTailing) || playback.status.get() === 'running' || playback.status.get() === 'paused' || playback.status.get() === 'scheduled') {
        if (direction !== phase) playback.reverse();
        playback.resume();
      } else if (target) playback.play();
      else playback.reverse();
      direction = phase;
      return promise;
    };
    const complete = () => {
      if (disposed || !pending || progress.get() !== Number(pending.target)) return;
      tailRunning = false; clock.pause();
      status.set(pending.target ? 'visible' : 'hidden'); settle('finished');
    };
    const startTail = () => {
      if (disposed || !pending || progress.get() !== Number(pending.target)) return;
      const length = pending.target ? enterTail : exitTail;
      if (!length || forced.get()) { complete(); return; }
      tailRunning = true; tail.play(); tail.setPlaybackRate(maxTail / length);
    };
    const binding = createTransitionBinding(() => {
      const active = (status.get() === 'entering' || status.get() === 'exiting') && !forced.get();
      return (visible.get() ? enter : exit)(progress.get(), visible.get() ? 'enter' : 'exit', {
        active, elapsed: active ? elapsed.get() : 0, progressAt,
      });
    });
    const handle: CRCVisibilityTransition = Object.freeze({
      binding, visible: visible.asReadonly(), progress: progress.asReadonly(), status: status.asReadonly(),
      show: () => request(true), hide: () => request(false), finish: () => { if (!disposed && pending) { forced.set(true); if (tailRunning) tail.finish(); else if (pending.target) playback.finish(); else playback.seek(0); } },
    });
    teardowns.add(() => { disposed = true; for (const runtime of runtimes) runtime.dispose?.(); history = []; for (const command of historyCommands) command.cancel(); historyCommands.clear(); status.set('disposed'); settle('disposed'); });
    return {
      handle, program: drive(progress, duration === 0 ? defineAnimation({ duration: 0, sample: () => Number(visible.get()) }) : tween({ from: 0, to: 1, duration })),
      clockProgram: drive(elapsed, defineAnimation({ duration: 1e12, sample: ({ localTime }) => {
        if (pending && !forced.get()) (visible.get() ? enterRuntime : exitRuntime).advance?.(localTime, progressAt);
        return localTime;
      } })),
      tailProgram: drive(tailTime, tween({ from: 0, to: 1, duration: maxTail })),
      setPlayback(value: CRCPlayback, clockValue: CRCPlayback, tailValue: CRCPlayback) { playback = value; clock = clockValue; tail = tailValue; },
      fail() { disposed = true; for (const runtime of runtimes) runtime.dispose?.(); forced.set(true); status.set('disposed'); settle('disposed'); playback.cancel(); clock.cancel(); tail.cancel(); },
      startTail,
      completeTail() { if (tailRunning) complete(); },
    };
  }).value;
  const playback = usePlayback(state.program, { onEvent: event => { if (event.type === 'finish') state.startTail(); } });
  const clock = usePlayback(state.clockProgram, { onError: error => { state.fail(); throw error; } });
  const tail = usePlayback(state.tailProgram, { onEvent: event => { if (event.type === 'finish') state.completeTail(); } });
  state.setPlayback(playback, clock, tail);
  return state.handle;
}
