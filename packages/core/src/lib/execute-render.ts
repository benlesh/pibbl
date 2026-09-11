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
import type {
  CRCBackendFrame,
  CRCBackendMount,
} from './backend/types.js';

/**
 * Gets the root element for a canvas and renders it. This is the
 * entry point for rendering the entire tree.
 * @param canvas The canvas to render on
 */
export function executeRender(
  canvas: Canvas,
  renderTimestamp: number,
  updatedRoot?: CRCNode | typeof NO_PENDING_ROOT,
  updateParents = false,
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

  if (crcInstance.animationFrameId !== undefined) {
    cancelAnimationFrame(crcInstance.animationFrameId);
    crcInstance.animationFrameId = undefined;
  }

  const prevCurrentCRCInstance = GLOBAL_STATE.currentCRCInstance;
  const prevCanvas = GLOBAL_STATE.canvas;
  const prevRenderContext = GLOBAL_STATE.renderContext;
  const prevRenderTarget = GLOBAL_STATE.renderTarget;
  const prevWorldBaseTransform = GLOBAL_STATE.worldBaseTransform;
  const prevRenderTransaction = GLOBAL_STATE.renderTransaction;
  const prevPrimitiveReceiverToken = GLOBAL_STATE.primitiveReceiverToken;
  const prevSeenIds = GLOBAL_STATE.seenIds;
  const prevSeenKeys = GLOBAL_STATE.seenKeys;
  const prevUnseendIds = GLOBAL_STATE.unseenIds;
  const prevComponentRefs = GLOBAL_STATE.componentRefs;
  const prevComponentHookIndex = GLOBAL_STATE.componentHookIndex;
  const prevComponentIsMounting = GLOBAL_STATE.componentIsMounting;
  const prevClippingStack = GLOBAL_STATE.clippingStack;
  const prevLayoutStack = GLOBAL_STATE.layoutStack;
  const prevBackendDriver = GLOBAL_STATE.backendDriver;
  const prevBackendFrame = GLOBAL_STATE.backendFrame;
  const prevBackendEnvironment = GLOBAL_STATE.backendEnvironment;
  let frame: CRCBackendFrame<unknown> | undefined;
  let frameSuccess = false;
  try {
    GLOBAL_STATE.currentCRCInstance = crcInstance;
    GLOBAL_STATE.renderTransaction = renderTransaction;
    GLOBAL_STATE.currentCRCInstance.renderTimestamp = renderTimestamp;
    GLOBAL_STATE.canvas = canvas;
    const rootNode = arguments.length >= 3 && updatedRoot !== NO_PENDING_ROOT ?
      updatedRoot :
      GLOBAL_STATE.currentCRCInstance.root;
    GLOBAL_STATE.currentCRCInstance.root = rootNode;
    const driver = crcInstance.backendDriver;
    GLOBAL_STATE.backendDriver = driver;
    frame = driver.beginFrame({
      canvas,
      logicalWidth: crcInstance.rootLayoutBox.width,
      logicalHeight: crcInstance.rootLayoutBox.height,
      backingWidth: canvas.width,
      backingHeight: canvas.height,
      renderTimestamp,
    });
    if (!frame) {
      finishTransaction(true);
      return;
    }
    GLOBAL_STATE.backendFrame = frame;
    GLOBAL_STATE.backendEnvironment = frame.environment;
    GLOBAL_STATE.renderContext = frame.context2D;
    GLOBAL_STATE.renderTarget = frame.renderTarget;
    GLOBAL_STATE.worldBaseTransform = frame.worldBaseTransform;
    GLOBAL_STATE.clippingStack = [];
    const surface = crcInstance.surface.snapshot;
    const logicalWidth = surface?.logicalWidth ?? crcInstance.rootLayoutBox.width;
    const logicalHeight = surface?.logicalHeight ?? crcInstance.rootLayoutBox.height;
    const previousRootBox = crcInstance.rootLayoutBox;
    if (
      previousRootBox.width !== logicalWidth ||
      previousRootBox.height !== logicalHeight
    ) {
      crcInstance.rootLayoutBox = Object.freeze({
        x: 0,
        y: 0,
        width: logicalWidth,
        height: logicalHeight,
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
    render(rootNode, id, undefined);

    for (const id of GLOBAL_STATE.unseenIds) {
      // HACK: I want to be more efficient here, but this is fine for now
      GLOBAL_STATE.currentCRCInstance.refs.get(id)?.teardowns.execute();
      GLOBAL_STATE.currentCRCInstance.refs.delete(id);
    }
    frameSuccess = true;
    driver.finishFrame(frame, true);
    finishTransaction(true);
  } catch (error) {
    finishTransaction(false);
    for (const refs of crcInstance.refs.values()) {
      refs.teardowns.execute();
    }
    crcInstance.refs.clear();
    throw error;
  } finally {
    const { parent } = crcInstance;
    try {
      try {
        if (frame && !frameSuccess) {
          crcInstance.backendDriver.finishFrame(frame, false);
        }
      } finally {
        try {
          clearTempState();
          GLOBAL_STATE.clippingStack = prevClippingStack;
          GLOBAL_STATE.layoutStack = prevLayoutStack;
          if (ownsRenderTransaction) {
            try {
              finishTransaction(false);
            } finally {
              if (crcInstance.eventRoot.renderTransaction === renderTransaction) {
                crcInstance.eventRoot.renderTransaction = undefined;
              }
            }
          }
        } finally {
          GLOBAL_STATE.currentCRCInstance = prevCurrentCRCInstance;
          GLOBAL_STATE.canvas = prevCanvas;
          GLOBAL_STATE.renderContext = prevRenderContext;
          GLOBAL_STATE.renderTarget = prevRenderTarget;
          GLOBAL_STATE.worldBaseTransform = prevWorldBaseTransform;
          GLOBAL_STATE.renderTransaction = prevRenderTransaction;
          GLOBAL_STATE.primitiveReceiverToken = prevPrimitiveReceiverToken;
          GLOBAL_STATE.seenIds = prevSeenIds;
          GLOBAL_STATE.seenKeys = prevSeenKeys;
          GLOBAL_STATE.unseenIds = prevUnseendIds;
          GLOBAL_STATE.componentRefs = prevComponentRefs;
          GLOBAL_STATE.componentHookIndex = prevComponentHookIndex;
          GLOBAL_STATE.componentIsMounting = prevComponentIsMounting;
          GLOBAL_STATE.backendDriver = prevBackendDriver;
          GLOBAL_STATE.backendFrame = prevBackendFrame;
          GLOBAL_STATE.backendEnvironment = prevBackendEnvironment;
        }
      }
    } finally {
      if (updateParents && parent) {
        const parentInstance = GLOBAL_STATE.crcInstances.get(parent);
        if (
          parentInstance &&
          parentInstance.eventRoot === crcInstance.eventRoot &&
          !parentInstance.mainTeardowns.closed
        ) {
          const pendingRoot = parentInstance.pendingRoot;
          parentInstance.pendingRoot = NO_PENDING_ROOT;
          parentInstance.pendingUpdateParents = false;
          executeRender(parent, renderTimestamp, pendingRoot, true);
        }
      }
    }
  }
}

/** Executes one synchronous private-backend render through its owned mount. */
export function executeBackendCRC(
  mount: CRCBackendMount,
  root: CRCNode,
  timestamp: number,
): void {
  mount.render(root, timestamp);
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
