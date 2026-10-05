import { opacity } from '../../filters/native.js';
import { withSignalWriteForbidden } from '../signals/graph.js';
import { captureTransition, finite, type TransitionRegion } from './capture.js';
import { defineTransitionEffect, type PibblTransitionEffect } from './fade.js';

/**
 * Progress, geometry, and drawing context supplied to a custom transition renderer.
 *
 * @see {@link PibblTransitionDefinition}
 */
export interface PibblTransitionRenderFrame {
  /** Borrowed for this synchronous callback only. Coordinates are receiver-local. */
  readonly context: OffscreenCanvasRenderingContext2D;
  /** Captured source pixels available during this synchronous rendering callback. See {@link PibblTransitionRenderFrame}. */
  readonly source: OffscreenCanvas;
  /** Bounds of the source pixels supplied to the transition. See {@link TransitionRegion}. */
  readonly sourceBounds: Readonly<TransitionRegion>;
  /**
   * Normalized progress through the current animation or transition. See
   * {@link PibblTransitionRenderFrame}.
   */
  readonly progress: number;
  /** Selects `"enter"`, `"exit"` for phase. See {@link PibblTransitionRenderFrame}. */
  readonly phase: 'enter' | 'exit';
  /** Forward milliseconds since this run began, unaffected by reversals. */
  readonly elapsed: number;
  /**
   * Material progress at an earlier time in this run (useful for particle births).
   * @param elapsed - Elapsed transition time in milliseconds.
   * @returns Transition progress at the requested time.
   */
  readonly progressAt: (elapsed: number) => number;
  /**
   * Draws the captured source into the transition's current rendering context. See
   * {@link PibblTransitionRenderFrame}.
   */
  readonly drawSource: () => void;
}
/**
 * Synchronous transition rendering callback and optional post-transition linger duration.
 *
 * @see {@link PibblTransitionRenderFrame}
 * @see {@link defineTransition}
 */
export interface PibblTransitionDefinition {
  /**
   * Renders the current data or resources using the supplied context. See
   * {@link PibblTransitionRenderFrame}.
   * @param frame - Captured source, presentation context, progress, and timing services. See
   * {@link PibblTransitionRenderFrame} .
   */
  readonly render: (frame: Readonly<PibblTransitionRenderFrame>) => void;
  /** Additional milliseconds after material reaches its target. Default zero. */
  readonly linger?: number;
}
/**
 * Inert custom definition. The callback may call synchronous JS or WASM kernels.
 *
 * @param definition - Renderer and metadata defining the effect. See
 * {@link PibblTransitionDefinition} .
 * @returns A transition effect usable by the visibility transition hook. See
 * {@link PibblTransitionEffect} .
 *
 * @see {@link PibblTransitionDefinition}
 * @see {@link PibblTransitionEffect}
 */
export function defineTransition(definition: PibblTransitionDefinition): PibblTransitionEffect {
  const render = definition.render, linger = finite(definition.linger ?? 0, 'linger', 0);
  if (typeof render !== 'function') throw new TypeError('defineTransition requires a synchronous render callback.');
  return defineTransitionEffect((progress, phase, frame) => {
    if (!frame.active || !linger) {
      if (progress === 1) return [];
      if (progress === 0) return [opacity({ amount: 0 })];
    }
    return [captureTransition(({ context, source, windows, drawSource }) => {
      const result: unknown = withSignalWriteForbidden('Transition render callbacks cannot write to signals.', () => render(Object.freeze({ context, source,
        sourceBounds: Object.freeze({ ...windows.source.logicalBounds }), progress, phase,
        elapsed: frame.elapsed, progressAt: frame.progressAt, drawSource,
      })));
      if (result && typeof (result as { then?: unknown }).then === 'function') throw new TypeError('Transition render callbacks must be synchronous.');
    })];
  }, linger);
}
