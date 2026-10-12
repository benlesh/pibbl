import {
  createAnimationPlaybackController,
  type AnimationPlaybackController,
} from '../../lib/animation/playback.js';
import type {
  PibblAnimationProgram,
  PibblPlaybackOptions,
} from '../../lib/animation/types.js';
import type {
  MachineTask,
  MachineTaskContext,
  MachineEvent,
} from './types.js';

/**
 * Playback options owned by a machine animation task.
 *
 * Lifecycle callbacks are deliberately omitted: task completion and failure
 * become the invocation's `onDone` and `onError` transitions instead.
 *
 * @see {@link playAnimation}
 */
export interface MachineAnimationOptions {
  /**
   * Selects the existing writer-conflict policy for this state-owned playback.
   * Defaults to the animation runtime's explicit-error policy.
   */
  readonly conflict?: PibblPlaybackOptions['conflict'];
  /** Optional label included in animation scheduler diagnostics. */
  readonly debugName?: string;
}

/**
 * Builds the animation program for one state entry.
 *
 * The callback runs once when the invocation starts. It receives the entry's
 * immutable context and event, the machine input, the cancellation signal, and
 * `send` for application-defined machine events.
 *
 * @typeParam Context - Context captured when this state entry began.
 * @typeParam Event - Event type accepted by the owning machine.
 * @typeParam Input - Input captured by the owning machine actor.
 * @param context - Immutable state-entry values used to create this program.
 * @returns The program that the machine invocation owns until it finishes or is cancelled.
 * @see {@link MachineTaskContext}
 */
export type MachineAnimationProgramFactory<Context, Event extends MachineEvent, Input> = (
  context: MachineTaskContext<Context, Event, Input>,
) => PibblAnimationProgram;

/**
 * Adapts a Pibbl animation program into state-owned cancelable machine work.
 *
 * A finite program resolves the state invocation after the animation scheduler
 * delivers its `finish` event, allowing the invocation's `onDone` transition to
 * run. Repeating programs remain active until their state exits or the actor
 * stops. Cancellation disposes only this adapter's playback and never sends a
 * completion or error transition.
 *
 * @typeParam Context - Context captured when this state entry began.
 * @typeParam Event - Event type accepted by the owning machine.
 * @typeParam Input - Input captured by the owning machine actor.
 * @param program - Factory that creates the program for this state entry.
 * @param options - Playback conflict policy and diagnostic label.
 * @returns A task suitable for a state's `invoke.task` field.
 *
 * @example
 * ```ts
 * running: {
 *   invoke: {
 *     task: playAnimation(({ input }) =>
 *       repeat(drive(input.frame, input.animations.run), { iterations: Infinity }),
 *     ),
 *   },
 * }
 * ```
 *
 * @see {@link MachineAnimationOptions}
 */
export function playAnimation<Context, Event extends MachineEvent, Input>(
  program: MachineAnimationProgramFactory<Context, Event, Input>,
  options: MachineAnimationOptions = {},
): MachineTask<Context, Event, Input, void> {
  return taskContext => {
    if (taskContext.signal.aborted) return;

    const animation = program(taskContext);
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let controller!: AnimationPlaybackController;
      controller = createAnimationPlaybackController(animation, {
        conflict: options.conflict,
        debugName: options.debugName,
        onEvent(event): void {
          if (event.type !== 'finish' || settled) return;
          settled = true;
          detachAbort();
          controller.dispose();
          resolve();
        },
        onError(error): void {
          if (settled) return;
          settled = true;
          detachAbort();
          controller.dispose();
          reject(error);
        },
      });

      const abort = (): void => {
        if (settled) return;
        settled = true;
        detachAbort();
        controller.dispose();
      };
      const detachAbort = (): void => {
        taskContext.signal.removeEventListener('abort', abort);
      };

      taskContext.signal.addEventListener('abort', abort, { once: true });
      if (taskContext.signal.aborted) {
        abort();
        return;
      }
      try {
        controller.handle.play();
      } catch (error) {
        abort();
        reject(error);
      }
    });
  };
}
