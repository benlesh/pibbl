import { signal } from '../signals/graph.js';
import type { Signal } from '../signals/types.js';
import { drive } from '../animation/program.js';
import { defineAnimation, tween } from '../animation/definition.js';
import type { PibblPlayback } from '../animation/types.js';
import { createTransitionBinding, type PibblTransitionBinding } from '../transitions/binding.js';
import { createTransitionRuntime, transitionEffectSampler, transitionEffectTail, type PibblTransitionEffect } from '../transitions/fade.js';
import { useHookSlot } from './hook-slot.js';
import { queueBeginCommand } from '../scheduler/realm-scheduler.js';
import type { PibblBeginCommandHandle } from '../scheduler/types.js';
import { usePlayback } from './use-playback.js';

/**
 * The current hidden, entering, visible, exiting, or disposed transition state.
 *
 * @see {@link PibblVisibilityTransition}
 */
export type PibblVisibilityTransitionStatus = 'hidden' | 'entering' | 'visible' | 'exiting' | 'disposed';
/**
 * Settlement of one show or hide request, including its request identifier, phase, and outcome.
 *
 * @see {@link PibblVisibilityTransition}
 */
export interface PibblVisibilityTransitionResult {
  /**
   * Monotonic identifier of the visibility request that produced this result. See
   * {@link PibblVisibilityTransitionResult}.
   */
  readonly requestId: number;
  /** Selects `"enter"`, `"exit"` for phase. See {@link PibblVisibilityTransitionResult}. */
  readonly phase: 'enter' | 'exit';
  /** How this specific show or hide request settled. See {@link PibblVisibilityTransitionResult}. */
  readonly status: 'finished' | 'cancelled' | 'disposed';
}
/**
 * Enter and exit effects and lifecycle configuration for visibility transitions.
 *
 * @see {@link PibblTransitionEffect}
 * @see {@link useVisibilityTransition}
 */
export interface PibblVisibilityTransitionOptions {
  /** Mount-time options in the first slice. */
  readonly initial?: boolean;
  /** Effect used when moving toward visible. See {@link PibblTransitionEffect}. */
  readonly enter: PibblTransitionEffect;
  /**
   * Effect used when moving toward hidden; defaults to the enter effect. See
   * {@link PibblTransitionEffect}.
   */
  readonly exit?: PibblTransitionEffect;
  /**
   * Transition duration in milliseconds; defaults to 300. See
   * {@link PibblVisibilityTransitionOptions}.
   */
  readonly duration?: number;
}
/**
 * Mount-owned visibility controls, reactive progress and status, and a primitive presentation binding.
 *
 * @see {@link PibblTransitionBinding}
 * @see {@link Signal}
 * @see {@link PibblVisibilityTransitionStatus}
 * @see {@link PibblVisibilityTransitionResult}
 * @see {@link useVisibilityTransition}
 */
export interface PibblVisibilityTransition {
  /**
   * Presentation binding to assign to the receiving primitive's style.transition. See
   * {@link PibblTransitionBinding}.
   */
  readonly binding: PibblTransitionBinding;
  /** Readonly view of the requested visibility target. See {@link Signal}. */
  readonly visible: Signal<boolean>;
  /** Normalized progress through the current animation or transition. See {@link Signal}. */
  readonly progress: Signal<number>;
  /**
   * Reactive visibility-transition lifecycle state. See {@link Signal},
   * {@link PibblVisibilityTransitionStatus}.
   */
  readonly status: Signal<PibblVisibilityTransitionStatus>;
  /**
   * Requests entry and resolves with the request's finished, cancelled, or disposed outcome. See
   * {@link PibblVisibilityTransitionResult}.
   * @returns A promise settling with the request's completion or interruption result. See
   * {@link PibblVisibilityTransitionResult} .
   */
  show(): Promise<PibblVisibilityTransitionResult>;
  /**
   * Requests exit and resolves with the request's finished, cancelled, or disposed outcome. See
   * {@link PibblVisibilityTransitionResult}.
   * @returns A promise settling with the request's completion or interruption result. See
   * {@link PibblVisibilityTransitionResult} .
   */
  hide(): Promise<PibblVisibilityTransitionResult>;
  /**
   * Forces the currently requested transition to its endpoint. See {@link PibblVisibilityTransition}
   * .
   */
  finish(): void;
}

/**
 * Explicitly controlled visibility. It does not retain unmounted content or alter targeting.
 *
 * @param options - Visibility signal, effect, timing, and lifecycle options. See
 * {@link PibblVisibilityTransitionOptions} .
 * @returns Stable mount-owned controls for visibility and transition completion. See
 * {@link PibblVisibilityTransition} .
 *
 * @see {@link PibblVisibilityTransitionOptions}
 * @see {@link PibblVisibilityTransition}
 */
export function useVisibilityTransition(options: PibblVisibilityTransitionOptions): PibblVisibilityTransition {
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
    const status = signal<PibblVisibilityTransitionStatus>(visible.get() ? 'visible' : 'hidden');
    let disposed = false, serial = 0;
    let pending: { id: number; target: boolean; resolve: (result: PibblVisibilityTransitionResult) => void } | undefined;
    const elapsed = signal(0), tailTime = signal(0);
    const maxTail = Math.max(enterTail, exitTail);
    let playback!: PibblPlayback, clock!: PibblPlayback, tail!: PibblPlayback;
    let tailRunning = false;
    const forced = signal(false);
    let runStart = 0, runInitial = progress.get();
    const historyCommands = new Set<PibblBeginCommandHandle>();
    let history: { time: number; progress: number; direction: number }[] = [];
    const progressAt = (time: number) => {
      if (!Number.isFinite(time)) throw new RangeError('progressAt requires a finite time.');
      if (time < 0) return runInitial;
      const segment = history.findLast(value => value.time <= time);
      if (!segment) return runInitial;
      return Math.max(0, Math.min(1, segment.progress + segment.direction * (duration === 0 ? 1 : (time - segment.time) / duration)));
    };
    let direction: 'enter' | 'exit' = 'enter';
    const settle = (outcome: PibblVisibilityTransitionResult['status']) => {
      const request = pending; pending = undefined;
      request?.resolve(Object.freeze({ requestId: request.id, phase: request.target ? 'enter' : 'exit', status: outcome }));
    };
    const request = (target: boolean): Promise<PibblVisibilityTransitionResult> => {
      const id = ++serial, phase = target ? 'enter' : 'exit';
      if (disposed) return Promise.resolve({ requestId: id, phase, status: 'disposed' });
      // The signal write also enforces Pibbl's prohibition on commands during rendering.
      visible.set(target);
      const wasActive = pending !== undefined;
      const wasTailing = tailRunning;
      tailRunning = false; forced.set(false); if (wasTailing) tail.cancel();
      settle('cancelled');
      if (!wasActive && progress.get() === Number(target) && playback.status.get() !== 'running') {
        status.set(target ? 'visible' : 'hidden');
        return Promise.resolve({ requestId: id, phase, status: 'finished' });
      }
      const promise = new Promise<PibblVisibilityTransitionResult>(resolve => { pending = { id, target, resolve }; });
      status.set(target ? 'entering' : 'exiting');
      if (!wasActive) clock.play();
      if (!wasActive || wasTailing || direction !== phase) {
        const at = wasActive ? elapsed.get() : 0, from = progress.get();
        let command!: PibblBeginCommandHandle;
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
    const handle: PibblVisibilityTransition = Object.freeze({
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
      setPlayback(value: PibblPlayback, clockValue: PibblPlayback, tailValue: PibblPlayback) { playback = value; clock = clockValue; tail = tailValue; },
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
