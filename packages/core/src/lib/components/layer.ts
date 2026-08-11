import { defineComp } from '../define-comp.js';
import { executeRender } from '../execute-render.js';
import {
  getCRCInstance,
  getCurrentCRCInstance,
  GLOBAL_STATE,
} from '../global-state.js';
import { mountCRC } from '../mount-crc.js';
import { CompEl, IntrinsicProps, RenderingContext2D } from '../types.js';
import { shallowEquals } from '../util/shallow-equals.js';

export interface LayerProps extends IntrinsicProps {
  render: CompEl;
  width?: number;
  height?: number;
}

export function Layer(props: LayerProps, ctx: RenderingContext2D) {
  const canvas = GLOBAL_STATE.canvas!;
  const { width = canvas.width, height = canvas.height } = props;
  const componentRefs = GLOBAL_STATE.componentRefs!;
  if (GLOBAL_STATE.componentIsMounting) {
    const offscreenCanvas = new OffscreenCanvas(width, height);
    const controller = mountCRC(offscreenCanvas, props.render, { parent: canvas });
    componentRefs.refs[0] = offscreenCanvas;
    componentRefs.teardowns.add(controller.dispose);
  }

  const offscreenCanvas = componentRefs.refs[0];
  const layerCRC = getCRCInstance(offscreenCanvas);

  if (
    GLOBAL_STATE.componentIsMounting ||
    offscreenCanvas.width !== width ||
    offscreenCanvas.height !== height ||
    !shallowEquals(layerCRC.root.props, props.render.props)
  ) {
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;

    executeRender(
      offscreenCanvas,
      getCurrentCRCInstance().renderTimestamp,
      layerCRC.root,
      false,
    );
  }

  ctx.drawImage(offscreenCanvas, 0, 0);
}

export const layer = defineComp(Layer);
