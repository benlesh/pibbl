import { definePrimitive } from '../define-primitive.js';
import { materializeContainerChildren } from '../element/children.js';
import { createElement } from '../element/create-element.js';
import { Fragment, type FragmentProps } from '../element/fragment.js';
import { executeRender } from '../execute-render.js';
import {
  getCRCInstance,
  getCurrentCRCInstance,
  GLOBAL_STATE,
} from '../global-state.js';
import { mountCRC } from '../mount-crc.js';
import {
  CRCNode,
  CRCInteractionLayer,
  RenderingContext2D,
  SystemStyle,
} from '../types.js';
import { CRCPaintEntryKind } from '../events/paint-entry.js';
import {
  resolveRequiredLength,
  stripLayoutParticipation,
} from '../style/resolve-built-in.js';
import type {
  BoxStyle,
  LayoutItemStyle,
  ResolvedDrawingStyle,
} from '../style/types.js';
import {
  getSurfaceSnapshot,
} from '../surface/transform.js';
import { getCurrentWorldTransform } from '../render-target.js';
import { createLayerSurface } from '../surface/resolve-surface.js';
import {
  completeInstanceRenderRevision,
  hasPendingInstanceRender,
} from '../scheduler/realm-scheduler.js';
import type { CRCElement } from '../element/types.js';
import {
  haveSameLayerNodeTree,
  snapshotLayerNodeTree,
  type LayerNodeSnapshot,
} from './layer-node-equality.js';
import {
  type CRCStructuralEventProps,
  wireStructuralEvents,
} from './structural-events.js';

export interface LayerProps extends CRCStructuralEventProps {
  children: CRCNode;
}

export interface LayerStyle extends SystemStyle, BoxStyle, LayoutItemStyle {}

type ResolvedLayerStyle = ResolvedDrawingStyle<LayerStyle> & {
  width: number;
  height: number;
};

interface LayerSlot {
  canvas: OffscreenCanvas;
  interactionLayer: CRCInteractionLayer;
  logicalWidth: number;
  logicalHeight: number;
  focusRenderRevision: number | undefined;
  retainedTree: LayerNodeSnapshot | undefined;
}

function renderLayer(
  props: LayerProps,
  style: Readonly<ResolvedLayerStyle>,
  ctx: RenderingContext2D,
) {
  wireStructuralEvents(props);
  const materializedChildren = materializeContainerChildren(
    props.children,
    'Layer',
  );
  const nextRoot = createPrivateLayerRoot(materializedChildren);
  const canvas = GLOBAL_STATE.canvas!;
  const { width = canvas.width, height = canvas.height } = style;
  const componentRefs = GLOBAL_STATE.componentRefs!;
  const parentInstance = getCurrentCRCInstance();
  const parentSurface = getSurfaceSnapshot(parentInstance);
  const layerSurface = createLayerSurface(
    width,
    height,
    parentSurface.backingPixelsPerLogicalUnitX,
    parentSurface.backingPixelsPerLogicalUnitY,
  );
  if (GLOBAL_STATE.componentIsMounting) {
    const offscreenCanvas = new OffscreenCanvas(
      layerSurface.backingWidth,
      layerSurface.backingHeight,
    );
    const controller = mountCRC(offscreenCanvas, nextRoot, {
      parent: canvas,
      surface: layerSurface,
    });
    const childInstance = getCRCInstance(offscreenCanvas);
    childInstance.eventParent = componentRefs;
    const interactionLayer: CRCInteractionLayer = {
      paintKind: CRCPaintEntryKind.NestedInstance,
      instance: childInstance,
      transform: new DOMMatrix(),
      clippingStack: [],
      bounds: createBounds(width, height),
      resolveLocal: undefined,
    };
    componentRefs.refs[0] = {
      canvas: offscreenCanvas,
      interactionLayer,
      logicalWidth: width,
      logicalHeight: height,
      focusRenderRevision: undefined,
      retainedTree: undefined,
    } satisfies LayerSlot;
    componentRefs.teardowns.add(() => {
      childInstance.eventParent = undefined;
      parentInstance.paintEntries.delete(interactionLayer);
      controller.dispose();
    });
  }

  const slot = componentRefs.refs[0] as LayerSlot;
  const offscreenCanvas = slot.canvas;
  const layerCRC = getCRCInstance(offscreenCanvas);
  const dimensionsChanged = slot.logicalWidth !== width ||
    slot.logicalHeight !== height;
  const surfaceChanged =
    offscreenCanvas.width !== layerSurface.backingWidth ||
    offscreenCanvas.height !== layerSurface.backingHeight;

  const { interactionLayer } = slot;
  parentInstance.paintEntries.delete(interactionLayer);
  interactionLayer.transform = getCurrentWorldTransform();
  interactionLayer.clippingStack = Array.from(GLOBAL_STATE.clippingStack);
  if (dimensionsChanged) {
    interactionLayer.bounds = createBounds(width, height);
  }
  // Install the current bridge before entering the child render. Focus bounds
  // collected by the child must never see the previous frame's transform.
  parentInstance.paintEntries.add(interactionLayer);

  const focusPolicy = parentInstance.eventRoot.focusPolicy;
  const focusRenderRevision = focusPolicy?.layerFocusRenderRevision?.(layerCRC);

  const shouldRender =
    GLOBAL_STATE.componentIsMounting ||
    dimensionsChanged ||
    surfaceChanged ||
    !haveSameLayerNodeTree(slot.retainedTree, nextRoot) ||
    slot.focusRenderRevision !== focusRenderRevision ||
    hasPendingInstanceRender(layerCRC);
  if (shouldRender) {
    if (layerCRC.surface.kind !== 'layer') {
      throw new Error('CRC layer mounted without a derived surface.');
    }
    layerCRC.surface.snapshot = layerSurface;
    layerCRC.surface.managed = true;
    offscreenCanvas.width = layerSurface.backingWidth;
    offscreenCanvas.height = layerSurface.backingHeight;
    slot.logicalWidth = width;
    slot.logicalHeight = height;

    const renderedRevision = layerCRC.requestedRenderRevision;
    executeRender(
      offscreenCanvas,
      getCurrentCRCInstance().renderTimestamp,
      nextRoot,
      false,
    );
    completeInstanceRenderRevision(layerCRC, renderedRevision);
    slot.retainedTree = snapshotLayerNodeTree(nextRoot);
  } else {
    parentInstance.eventRoot.focusPolicy?.replayRetainedSubtree(layerCRC);
  }
  const renderedFocusPolicy = parentInstance.eventRoot.focusPolicy;
  slot.focusRenderRevision =
    renderedFocusPolicy?.layerFocusRenderRevision?.(layerCRC);

  ctx.drawImage(
    offscreenCanvas,
    0,
    0,
    offscreenCanvas.width,
    offscreenCanvas.height,
    0,
    0,
    width,
    height,
  );

}

/** Describes a retained offscreen composition layer. */
export const Layer = definePrimitive<
  LayerProps,
  LayerStyle,
  LayerStyle,
  ResolvedLayerStyle
>(renderLayer, {
  resolveStyle: resolveLayerStyle,
});

function resolveLayerStyle(
  style: Readonly<LayerStyle>,
  context: Parameters<NonNullable<
    import('../types.js').PrimitiveCapabilities<
      LayerProps,
      LayerStyle,
      LayerStyle,
      ResolvedLayerStyle
    >['resolveStyle']
  >>[1],
): ResolvedLayerStyle {
  return {
    ...stripLayoutParticipation(style),
    width: resolveRequiredLength(
      style.width ?? context.allocation.width,
      context.percentageBasis.width,
      'width',
      context,
    ),
    height: resolveRequiredLength(
      style.height ?? context.allocation.height,
      context.percentageBasis.height,
      'height',
      context,
    ),
  } as ResolvedLayerStyle;
}

function createPrivateLayerRoot(
  children: readonly CRCElement<any>[],
): CRCElement<FragmentProps> {
  return createElement(Fragment, {
    key: 'crc-layer-root',
    children,
  });
}

function createBounds(width: number, height: number): Path2D {
  const bounds = new Path2D();
  bounds.rect(0, 0, width, height);
  return bounds;
}
