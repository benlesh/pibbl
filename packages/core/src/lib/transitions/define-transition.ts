import { opacity } from '../../filters/native.js';
import { withSignalWriteForbidden } from '../signals/graph.js';
import { captureTransition, finite, type TransitionRegion } from './capture.js';
import { defineTransitionEffect, type CRCTransitionEffect } from './fade.js';

export interface CRCTransitionRenderFrame {
  /** Borrowed for this synchronous callback only. Coordinates are receiver-local. */
  readonly context: OffscreenCanvasRenderingContext2D;
  readonly source: OffscreenCanvas;
  readonly sourceBounds: Readonly<TransitionRegion>;
  readonly progress: number;
  readonly phase: 'enter' | 'exit';
  /** Forward milliseconds since this run began, unaffected by reversals. */
  readonly elapsed: number;
  /** Material progress at an earlier time in this run (useful for particle births). */
  readonly progressAt: (elapsed: number) => number;
  readonly drawSource: () => void;
}
export interface CRCTransitionDefinition {
  readonly render: (frame: Readonly<CRCTransitionRenderFrame>) => void;
  /** Additional milliseconds after material reaches its target. Default zero. */
  readonly linger?: number;
}
/** Inert custom definition. The callback may call synchronous JS or WASM kernels. */
export function defineTransition(definition: CRCTransitionDefinition): CRCTransitionEffect {
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
