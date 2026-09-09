import { GLOBAL_STATE } from '../global-state.js';
import {
  getCurrentPaintTransform,
  getCurrentWorldTransform,
  type RenderTargetSnapshot,
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
import { layoutDiagnostic } from '../style/diagnostics.js';

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
    renderDiscardedBoundary(input, parent, parentWorld, renderSubtree);
    return;
  }

  const pair = instance.filterSurfacePool.checkoutPair(windows);
  try {
    const { source, result } = pair;
    result.context.setTransform(1, 0, 0, 1, 0, 0);
    const cssText = compileFilterList(input.filters, windows.density);
    assertFilterCapability(result.context, input.component);
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

function renderDiscardedBoundary(
  input: Readonly<RenderFilterBoundaryInput>,
  parent: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  parentWorld: DOMMatrix,
  renderSubtree: () => void,
): void {
  if (typeof OffscreenCanvas === 'undefined') {
    throw filterCapabilityError(
      input.component,
      'requires browser OffscreenCanvas support for its discard target',
    );
  }
  const canvas = new OffscreenCanvas(1, 1);
  const context = canvas.getContext('2d');
  if (!context) {
    throw filterCapabilityError(
      input.component,
      'could not acquire its discard OffscreenCanvas 2D context',
    );
  }
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, 1, 1);
  context.beginPath();
  copyFilterSourceState(parent, context);
  const target: RenderTargetSnapshot = {
    logicalBounds: Object.freeze({ x: 0, y: 0, width: 1, height: 1 }),
    backingWidth: 1,
    backingHeight: 1,
    renderTransform: new DOMMatrix(),
    inverseRenderTransform: new DOMMatrix(),
  };
  withRenderTarget(context, target, parentWorld, () => {
    const releasePresentation = enterPrimitivePresentation(
      input.presentation,
      { deferPaint: true },
    );
    try {
      renderSubtree();
    } finally {
      releasePresentation();
    }
  });
}

function assertFilterCapability(
  context: OffscreenCanvasRenderingContext2D,
  component: string,
): void {
  let prototype = Object.getPrototypeOf(context);
  while (prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'filter');
    if (descriptor) {
      if (
        typeof descriptor.get === 'function' &&
        typeof descriptor.set === 'function'
      ) {
        return;
      }
      break;
    }
    prototype = Object.getPrototypeOf(prototype);
  }
  throw filterCapabilityError(
    component,
    'requires native Canvas filter support',
  );
}

function filterCapabilityError(component: string, reason: string): Error {
  return layoutDiagnostic({
    component,
    property: 'filter',
    value: undefined,
    algorithm: 'filter-rendering',
    reason,
  });
}
