import { RootRenderTransaction } from './render-transaction.js';
import {
  clearTempState,
  GLOBAL_STATE,
  NO_PENDING_ROOT,
} from './global-state.js';
import { render } from './render.js';
import { initializeCurrentWorldTransformAnchor } from './render-target.js';
import {
  Canvas,
  type CRCNode,
} from './types.js';
import type {
  CRCBackendFrame,
  CRCBackendMount,
} from './backend/types.js';
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
  const prevWorldExactTransform = GLOBAL_STATE.worldExactTransform;
  const prevWorldPaintAnchorTransform = GLOBAL_STATE.worldPaintAnchorTransform;
  const prevPresentationTransformLineage = GLOBAL_STATE.presentationTransformLineage;
  const prevPresentationTransformLineageTrackingDepth =
    GLOBAL_STATE.presentationTransformLineageTrackingDepth;
  const prevRenderTransaction = GLOBAL_STATE.renderTransaction;
  const prevFrameSnapshot = GLOBAL_STATE.frameSnapshot;
  const prevPrimitiveReceiverToken = GLOBAL_STATE.primitiveReceiverToken;
  const prevSeenIds = GLOBAL_STATE.seenIds;
  const prevSeenKeys = GLOBAL_STATE.seenKeys;
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
  let renderSeenIds: Set<string> | undefined;
  let renderSeenKeys: Set<string> | undefined;
  try {
    const activeFrameSnapshot = frameSnapshot ?? (
      prevFrameSnapshot?.logicalTime === renderTimestamp ?
        prevFrameSnapshot :
        Object.freeze({
          frameId: prevFrameSnapshot?.frameId ?? 0,
          hostTime: prevFrameSnapshot?.hostTime ?? renderTimestamp,
          logicalTime: renderTimestamp,
        })
    );
    GLOBAL_STATE.frameSnapshot = activeFrameSnapshot;
    GLOBAL_STATE.currentCRCInstance = crcInstance;
    for (const service of crcInstance.optionalServices.values()) service.beginRender?.();
    GLOBAL_STATE.renderTransaction = renderTransaction;
    GLOBAL_STATE.currentCRCInstance.renderTimestamp = activeFrameSnapshot.logicalTime;
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
      renderTimestamp: activeFrameSnapshot.logicalTime,
    });
    if (!frame) {
      crcInstance.eventRoot.html?.suspend(crcInstance);
      finishTransaction(true);
      return;
    }
    crcInstance.eventRoot.html?.beginRender(crcInstance);
    GLOBAL_STATE.backendFrame = frame;
    GLOBAL_STATE.backendEnvironment = frame.environment;
    GLOBAL_STATE.renderContext = frame.context2D;
    GLOBAL_STATE.renderTarget = frame.renderTarget;
    GLOBAL_STATE.worldBaseTransform = frame.worldBaseTransform;
    GLOBAL_STATE.worldExactTransform = undefined;
    GLOBAL_STATE.worldPaintAnchorTransform = undefined;
    GLOBAL_STATE.presentationTransformLineage = undefined;
    GLOBAL_STATE.presentationTransformLineageTrackingDepth = 0;
    if (
      frame.context2D !== undefined &&
      frame.renderTarget !== undefined &&
      frame.worldBaseTransform !== undefined
    ) {
      initializeCurrentWorldTransformAnchor(frame.worldBaseTransform);
    }
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

    const renderGeneration = ++crcInstance.renderGeneration;
    renderSeenIds = crcInstance.renderSeenIds;
    renderSeenKeys = crcInstance.renderSeenKeys;
    renderSeenIds.clear();
    renderSeenKeys.clear();
    GLOBAL_STATE.seenIds = renderSeenIds;
    GLOBAL_STATE.seenKeys = renderSeenKeys;
    const id = 'root';
    renderSeenIds.add(id);
    withSignalWriteForbidden(
      'CRC render',
      () => render(rootNode, id, undefined),
    );

    for (const [id, componentRefs] of crcInstance.refs) {
      if (componentRefs.renderGeneration === renderGeneration) continue;
      componentRefs.teardowns.execute();
      crcInstance.refs.delete(id);
    }
    frameSuccess = true;
    for (const service of crcInstance.optionalServices.values()) service.endRender?.(true);
    driver.finishFrame(frame, true);
    finishTransaction(true);
  } catch (error) {
    for (const service of crcInstance.optionalServices.values()) service.endRender?.(false);
    finishTransaction(false);
    for (const refs of crcInstance.refs.values()) {
      refs.teardowns.execute();
    }
    crcInstance.refs.clear();
    throw error;
  } finally {
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
        renderSeenIds?.clear();
        renderSeenKeys?.clear();
        GLOBAL_STATE.currentCRCInstance = prevCurrentCRCInstance;
        GLOBAL_STATE.canvas = prevCanvas;
        GLOBAL_STATE.renderContext = prevRenderContext;
        GLOBAL_STATE.renderTarget = prevRenderTarget;
        GLOBAL_STATE.worldBaseTransform = prevWorldBaseTransform;
        GLOBAL_STATE.worldExactTransform = prevWorldExactTransform;
        GLOBAL_STATE.worldPaintAnchorTransform = prevWorldPaintAnchorTransform;
        GLOBAL_STATE.presentationTransformLineage = prevPresentationTransformLineage;
        GLOBAL_STATE.presentationTransformLineageTrackingDepth =
          prevPresentationTransformLineageTrackingDepth;
        GLOBAL_STATE.renderTransaction = prevRenderTransaction;
        GLOBAL_STATE.frameSnapshot = prevFrameSnapshot;
        GLOBAL_STATE.primitiveReceiverToken = prevPrimitiveReceiverToken;
        GLOBAL_STATE.seenIds = prevSeenIds;
        GLOBAL_STATE.seenKeys = prevSeenKeys;
        GLOBAL_STATE.componentRefs = prevComponentRefs;
        GLOBAL_STATE.componentHookIndex = prevComponentHookIndex;
        GLOBAL_STATE.componentIsMounting = prevComponentIsMounting;
        GLOBAL_STATE.backendDriver = prevBackendDriver;
        GLOBAL_STATE.backendFrame = prevBackendFrame;
        GLOBAL_STATE.backendEnvironment = prevBackendEnvironment;
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
