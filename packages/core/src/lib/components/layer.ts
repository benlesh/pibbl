import { defineComp } from '../define-comp.js';
import { executeRender } from '../execute-render.js';
import {
  getCRCInstance,
  getCurrentCRCInstance,
  GLOBAL_STATE,
} from '../global-state.js';
import { mountCRC } from '../mount-crc.js';
import {
  CompEl,
  CRCInteractionLayer,
  RenderingContext2D,
  SystemStyle,
} from '../types.js';
import { shallowEquals } from '../util/shallow-equals.js';
import { haveSameElementEnhancers } from '../element-enhancers.js';
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
  toLogicalTransform,
} from '../surface/transform.js';
import { createLayerSurface } from '../surface/resolve-surface.js';

export interface LayerProps {
  render: CompEl<any, any>;
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
}

export function Layer(
  props: LayerProps,
  style: Readonly<ResolvedLayerStyle>,
  ctx: RenderingContext2D,
) {
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
    const controller = mountCRC(offscreenCanvas, props.render, {
      parent: canvas,
      surface: layerSurface,
    });
    const childInstance = getCRCInstance(offscreenCanvas);
    childInstance.eventParent = componentRefs;
    const interactionLayer: CRCInteractionLayer = {
      kind: 'layer',
      instance: childInstance,
      transform: new DOMMatrix(),
      clippingStack: [],
      bounds: createBounds(width, height),
    };
    componentRefs.refs[0] = {
      canvas: offscreenCanvas,
      interactionLayer,
      logicalWidth: width,
      logicalHeight: height,
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
  interactionLayer.transform = toLogicalTransform(
    getSurfaceSnapshot(parentInstance),
    ctx.getTransform(),
  );
  interactionLayer.clippingStack = Array.from(GLOBAL_STATE.clippingStack);
  if (dimensionsChanged) {
    interactionLayer.bounds = createBounds(width, height);
  }
  // Install the current bridge before entering the child render. Focus bounds
  // collected by the child must never see the previous frame's transform.
  parentInstance.paintEntries.add(interactionLayer);

  const shouldRender =
    GLOBAL_STATE.componentIsMounting ||
    dimensionsChanged ||
    surfaceChanged ||
    layerCRC.root.type !== props.render.type ||
    layerCRC.root.key !== props.render.key ||
    !shallowEquals(layerCRC.root.props, props.render.props) ||
    !shallowEquals(layerCRC.root.style, props.render.style) ||
    !haveSameElementEnhancers(layerCRC.root, props.render);
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

    executeRender(
      offscreenCanvas,
      getCurrentCRCInstance().renderTimestamp,
      props.render,
      false,
    );
  } else {
    parentInstance.eventRoot.focusPolicy?.replayRetainedSubtree(layerCRC);
  }

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

export const layer = defineComp<
  LayerProps,
  LayerStyle,
  LayerStyle,
  ResolvedLayerStyle
>(Layer, {
  resolveStyle: (style, context) => ({
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
  }) as ResolvedLayerStyle,
});

function createBounds(width: number, height: number): Path2D {
  const bounds = new Path2D();
  bounds.rect(0, 0, width, height);
  return bounds;
}
