import {
  clearTempState,
  GLOBAL_STATE,
  NO_PENDING_ROOT,
} from './global-state.js';
import { render } from './render.js';
import {
  Canvas,
  type CRCNode,
  type CRCRenderTransaction,
} from './types.js';
import { get2dContext } from './util/get-2d-context.js';
import { prepareSurface } from './surface/root-surface.js';
import { rootRenderTarget } from './render-target.js';
import type { CRCFrameSnapshot } from './scheduler/types.js';
import { withSignalWriteForbidden } from './signals/graph.js';

/**
 * Gets the root element for a canvas and renders it. This is the
 * entry point for rendering the entire tree.
 * @param canvas The canvas to render on
 */
export function executeRender(
  canvas: Canvas,
  renderTimestamp: number,
  updatedRoot?: CRCNode | typeof NO_PENDING_ROOT,
  _updateParents = false,
  frameSnapshot?: CRCFrameSnapshot,
): void {
  if (!canvas) {
    throw new Error('No canvas element provided');
  }

  const crcInstance = GLOBAL_STATE.crcInstances.get(canvas);

  if (!crcInstance) {
    throw new Error('CRC is not mounted on this element');
  }

  if (crcInstance.mainTeardowns.closed) return;

  const inheritedTransaction = crcInstance.eventRoot.renderTransaction;
  const renderTransaction = inheritedTransaction ?? new RootRenderTransaction();
  const ownsRenderTransaction = !inheritedTransaction;
  if (ownsRenderTransaction) {
    crcInstance.eventRoot.renderTransaction = renderTransaction;
  }
  let transactionFinished = false;
  const finishTransaction = (success: boolean) => {
    if (!ownsRenderTransaction || transactionFinished) return;
    transactionFinished = true;
    (renderTransaction as RootRenderTransaction).finish(success);
  };

  const prevCurrentCRCInstance = GLOBAL_STATE.currentCRCInstance;
  const prevCanvas = GLOBAL_STATE.canvas;
  const prevRenderContext = GLOBAL_STATE.renderContext;
  const prevRenderTarget = GLOBAL_STATE.renderTarget;
  const prevWorldBaseTransform = GLOBAL_STATE.worldBaseTransform;
  const prevRenderTransaction = GLOBAL_STATE.renderTransaction;
  const prevFrameSnapshot = GLOBAL_STATE.frameSnapshot;
  const prevPrimitiveReceiverToken = GLOBAL_STATE.primitiveReceiverToken;
  const prevSeenIds = GLOBAL_STATE.seenIds;
  const prevSeenKeys = GLOBAL_STATE.seenKeys;
  const prevUnseendIds = GLOBAL_STATE.unseenIds;
  const prevComponentRefs = GLOBAL_STATE.componentRefs;
  const prevClippingStack = GLOBAL_STATE.clippingStack;
  const prevLayoutStack = GLOBAL_STATE.layoutStack;
  let renderContext: ReturnType<typeof get2dContext> | undefined;
  try {
    const activeFrameSnapshot = frameSnapshot ?? prevFrameSnapshot ?? Object.freeze({
      frameId: 0,
      hostTime: renderTimestamp,
      logicalTime: renderTimestamp,
    });
    GLOBAL_STATE.frameSnapshot = activeFrameSnapshot;
    GLOBAL_STATE.currentCRCInstance = crcInstance;
    GLOBAL_STATE.renderTransaction = renderTransaction;
    GLOBAL_STATE.currentCRCInstance.renderTimestamp = activeFrameSnapshot.logicalTime;
    GLOBAL_STATE.canvas = canvas;
    const rootNode = arguments.length >= 3 && updatedRoot !== NO_PENDING_ROOT ?
      updatedRoot :
      GLOBAL_STATE.currentCRCInstance.root;
    GLOBAL_STATE.currentCRCInstance.root = rootNode;
    const surface = prepareSurface(crcInstance);
    if (!surface) {
      finishTransaction(true);
      return;
    }
    const ctx = get2dContext(canvas);
    renderContext = ctx;
    GLOBAL_STATE.renderContext = ctx;
    GLOBAL_STATE.renderTarget = rootRenderTarget(surface);
    GLOBAL_STATE.worldBaseTransform = new DOMMatrix();
    GLOBAL_STATE.clippingStack = [];
    const previousRootBox = crcInstance.rootLayoutBox;
    if (
      previousRootBox.width !== surface.logicalWidth ||
      previousRootBox.height !== surface.logicalHeight
    ) {
      crcInstance.rootLayoutBox = Object.freeze({
        x: 0,
        y: 0,
        width: surface.logicalWidth,
        height: surface.logicalHeight,
      });
    }
    GLOBAL_STATE.layoutStack = [{
      allocation: crcInstance.rootLayoutBox,
      percentageBasis: crcInstance.rootLayoutBox,
    }];

    GLOBAL_STATE.unseenIds = new Set(
      GLOBAL_STATE.currentCRCInstance.refs.keys(),
    );
    GLOBAL_STATE.seenIds = new Set();
    GLOBAL_STATE.seenKeys = new Set();
    const id = 'root';
    GLOBAL_STATE.unseenIds.delete(id);
    GLOBAL_STATE.seenIds.add(id);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, surface.backingWidth, surface.backingHeight);
    ctx.setTransform(surface.renderTransform);

    try {
      withSignalWriteForbidden(
        'CRC render',
        () => render(rootNode, id, undefined),
      );
    } catch (error) {
      finishTransaction(false);
      for (const refs of GLOBAL_STATE.currentCRCInstance.refs.values()) {
        refs.teardowns.execute();
      }
      GLOBAL_STATE.currentCRCInstance.refs.clear();
      throw error;
    }

    for (const id of GLOBAL_STATE.unseenIds) {
      // HACK: I want to be more efficient here, but this is fine for now
      GLOBAL_STATE.currentCRCInstance.refs.get(id)?.teardowns.execute();
      GLOBAL_STATE.currentCRCInstance.refs.delete(id);
    }
    finishTransaction(true);
  } catch (error) {
    finishTransaction(false);
    throw error;
  } finally {
    renderContext?.setTransform(1, 0, 0, 1, 0, 0);
    clearTempState();
    GLOBAL_STATE.clippingStack = prevClippingStack;
    GLOBAL_STATE.layoutStack = prevLayoutStack;
    if (ownsRenderTransaction) {
      finishTransaction(false);
      if (crcInstance.eventRoot.renderTransaction === renderTransaction) {
        crcInstance.eventRoot.renderTransaction = undefined;
      }
    }
    GLOBAL_STATE.currentCRCInstance = prevCurrentCRCInstance;
    GLOBAL_STATE.canvas = prevCanvas;
    GLOBAL_STATE.renderContext = prevRenderContext;
    GLOBAL_STATE.renderTarget = prevRenderTarget;
    GLOBAL_STATE.worldBaseTransform = prevWorldBaseTransform;
    GLOBAL_STATE.renderTransaction = prevRenderTransaction;
    GLOBAL_STATE.frameSnapshot = prevFrameSnapshot;
    GLOBAL_STATE.primitiveReceiverToken = prevPrimitiveReceiverToken;
    GLOBAL_STATE.seenIds = prevSeenIds;
    GLOBAL_STATE.seenKeys = prevSeenKeys;
    GLOBAL_STATE.unseenIds = prevUnseendIds;
    GLOBAL_STATE.componentRefs = prevComponentRefs;
  }
}

class RootRenderTransaction implements CRCRenderTransaction {
  private callbacks = new Set<(success: boolean) => void>();
  private result: boolean | undefined;

  onFinish(callback: (success: boolean) => void): void {
    if (this.result !== undefined) {
      callback(this.result);
      return;
    }
    this.callbacks.add(callback);
  }

  finish(success: boolean): void {
    if (this.result !== undefined) return;
    this.result = success;
    const callbacks = Array.from(this.callbacks);
    this.callbacks.clear();
    for (const callback of callbacks) callback(success);
  }
}
