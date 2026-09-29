import type { StyleResolutionContext, SystemStyle } from '../types.js';
import { resolveLocalOffset } from './resolve-built-in.js';
import type { Length } from './types.js';

export interface PositioningStyle extends SystemStyle {
  left?: Exclude<Length, 'auto'>;
  top?: Exclude<Length, 'auto'>;
}

export interface ResolvedPosition {
  left: number;
  top: number;
}

export function resolveStandalonePosition(
  style: Readonly<PositioningStyle>,
  context: Readonly<StyleResolutionContext>,
): ResolvedPosition {
  return {
    left: resolveLocalOffset(style.left, context.percentageBasis.width, 'left', context),
    top: resolveLocalOffset(style.top, context.percentageBasis.height, 'top', context),
  };
}
