import { GLOBAL_STATE } from '../global-state.js';
import {
  getCurrentPaintTransform,
  getCurrentWorldTransform,
  withRenderTarget,
} from '../render-target.js';
import {
  assertNativeFilter,
  assertNativeFilterColors,
  compileFilterList,
  type ResolvedFilterList,
} from '../style/filter.js';
import { copyFilterSourceState } from './canvas-state.js';
import { resolveFilterWindows } from './filter-region.js';
import {
  enterPrimitivePresentation,
  type PrimitivePresentation,
} from '../primitive-presentation.js';

export interface RenderFilterBoundaryInput {
  readonly component: string;
  readonly filters: ResolvedFilterList;
  readonly presentation?: Readonly<PrimitivePresentation>;
}

export function renderFilterBoundary(
  input: Readonly<RenderFilterBoundaryInput>,
  renderSubtree: () => void,
): void {
  const parent = GLOBAL_STATE.renderContext;
  const parentTarget = GLOBAL_STATE.renderTarget;
  const instance = GLOBAL_STATE.currentCRCInstance;
  if (!parent || !parentTarget || !instance) {
    throw new Error('Filter rendering requires an active CRC render target.');
  }

  const parentPaintTransform = getCurrentPaintTransform();
  const parentWorld = getCurrentWorldTransform();
  const boundaryPaintTransform = input.presentation?.transform ?
    parentPaintTransform.multiply(input.presentation.transform) :
    parentPaintTransform;
  const windows = resolveFilterWindows(
    parentTarget,
    boundaryPaintTransform,
    input.filters,
  );
  if (windows === 'discard') {
    const releasePresentation = enterPrimitivePresentation(input.presentation);
    try {
      renderSubtree();
    } finally {
      releasePresentation();
    }
    return;
  }

  const pair = instance.filterSurfacePool.checkoutPair(windows);
  try {
    const { source, result } = pair;
    result.context.setTransform(1, 0, 0, 1, 0, 0);
    const cssText = compileFilterList(input.filters, windows.density);
    assertNativeFilterColors(result.context, input.filters, input.component);
    assertNativeFilter(result.context, cssText, input.component);

    copyFilterSourceState(parent, source.context);
    source.context.setTransform(windows.source.renderTransform);
    withRenderTarget(
      source.context,
      source.target,
      parentWorld,
      () => {
        const releasePresentation = enterPrimitivePresentation(
          input.presentation,
          { deferPaint: true },
        );
        try {
          renderSubtree();
        } finally {
          releasePresentation();
        }
      },
    );

    result.context.drawImage(
      source.canvas,
      windows.sourceToOutputX,
      windows.sourceToOutputY,
    );
    parent.save();
    let releasePresentation: (() => void) | undefined;
    try {
      releasePresentation = enterPrimitivePresentation(input.presentation);
      parent.drawImage(
        result.canvas,
        0,
        0,
        windows.output.backingWidth,
        windows.output.backingHeight,
        windows.output.logicalBounds.x,
        windows.output.logicalBounds.y,
        windows.output.logicalBounds.width,
        windows.output.logicalBounds.height,
      );
    } finally {
      try {
        releasePresentation?.();
      } finally {
        parent.restore();
      }
    }
  } finally {
    pair.release();
  }
}
