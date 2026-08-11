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
  IntrinsicProps,
  RenderingContext2D,
} from '../types.js';
import { shallowEquals } from '../util/shallow-equals.js';

export interface LayerProps extends IntrinsicProps {
  render: CompEl;
  width?: number;
  height?: number;
}

interface LayerSlot {
  canvas: OffscreenCanvas;
  interactionLayer: CRCInteractionLayer;
}

export function Layer(props: LayerProps, ctx: RenderingContext2D) {
  const canvas = GLOBAL_STATE.canvas!;
  const { width = canvas.width, height = canvas.height } = props;
  const componentRefs = GLOBAL_STATE.componentRefs!;
  const parentInstance = getCurrentCRCInstance();
  if (GLOBAL_STATE.componentIsMounting) {
    const offscreenCanvas = new OffscreenCanvas(width, height);
    const controller = mountCRC(offscreenCanvas, props.render, { parent: canvas });
    const interactionLayer: CRCInteractionLayer = {
      kind: 'layer',
      instance: getCRCInstance(offscreenCanvas),
      transform: new DOMMatrix(),
      clippingStack: [],
      bounds: createBounds(width, height),
    };
    componentRefs.refs[0] = { canvas: offscreenCanvas, interactionLayer } satisfies LayerSlot;
    componentRefs.teardowns.add(() => {
      parentInstance.paintEntries.delete(interactionLayer);
      controller.dispose();
    });
  }

  const slot = componentRefs.refs[0] as LayerSlot;
  const offscreenCanvas = slot.canvas;
  const layerCRC = getCRCInstance(offscreenCanvas);
  const dimensionsChanged =
    offscreenCanvas.width !== width || offscreenCanvas.height !== height;

  if (
    GLOBAL_STATE.componentIsMounting ||
    dimensionsChanged ||
    layerCRC.root.type !== props.render.type ||
    layerCRC.root.props.key !== props.render.props.key ||
    !shallowEquals(layerCRC.root.props, props.render.props)
  ) {
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;

    executeRender(
      offscreenCanvas,
      getCurrentCRCInstance().renderTimestamp,
      props.render,
      false,
    );
  }

  ctx.drawImage(offscreenCanvas, 0, 0);

  const { interactionLayer } = slot;
  parentInstance.paintEntries.delete(interactionLayer);
  interactionLayer.transform = ctx.getTransform();
  interactionLayer.clippingStack = Array.from(GLOBAL_STATE.clippingStack);
  if (dimensionsChanged) {
    interactionLayer.bounds = createBounds(width, height);
  }
  parentInstance.paintEntries.add(interactionLayer);
}

export const layer = defineComp(Layer);

function createBounds(width: number, height: number): Path2D {
  const bounds = new Path2D();
  bounds.rect(0, 0, width, height);
  return bounds;
}
