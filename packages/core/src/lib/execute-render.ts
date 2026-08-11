import { clearTempState, GLOBAL_STATE } from './global-state.js';
import { render } from './render.js';
import { Canvas, CompEl } from './types.js';
import { get2dContext } from './util/get-2d-context.js';

/**
 * Gets the root element for a canvas and renders it. This is the
 * entry point for rendering the entire tree.
 * @param canvas The canvas to render on
 */
export function executeRender(
  canvas: Canvas,
  renderTimestamp: number,
  updatedRoot?: CompEl,
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

  if (crcInstance.animationFrameId !== undefined) {
    cancelAnimationFrame(crcInstance.animationFrameId);
    crcInstance.animationFrameId = undefined;
  }

  const prevCurrentCRCInstance = GLOBAL_STATE.currentCRCInstance;
  const prevCanvas = GLOBAL_STATE.canvas;
  const prevRenderContext = GLOBAL_STATE.renderContext;
  const prevMouseTransform = GLOBAL_STATE.mouseTransform;
  const prevSeenIds = GLOBAL_STATE.seenIds;
  const prevUnseendIds = GLOBAL_STATE.unseenIds;
  const prevComponentRefs = GLOBAL_STATE.componentRefs;
  try {
    GLOBAL_STATE.currentCRCInstance = crcInstance;
    GLOBAL_STATE.currentCRCInstance.renderTimestamp = renderTimestamp;
    GLOBAL_STATE.canvas = canvas;
    const rootElement = updatedRoot ?? GLOBAL_STATE.currentCRCInstance.root;
    GLOBAL_STATE.currentCRCInstance.root = rootElement;
    const ctx = get2dContext(canvas);
    GLOBAL_STATE.renderContext = ctx;

    GLOBAL_STATE.unseenIds = new Set(
      GLOBAL_STATE.currentCRCInstance.refs.keys(),
    );
    GLOBAL_STATE.seenIds = new Set();
    const id = 'root';
    GLOBAL_STATE.unseenIds.delete(id);
    GLOBAL_STATE.seenIds.add(id);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    render(rootElement, id, undefined);

    for (const id of GLOBAL_STATE.unseenIds) {
      // HACK: I want to be more efficient here, but this is fine for now
      GLOBAL_STATE.currentCRCInstance.refs.get(id)?.teardowns.execute();
      GLOBAL_STATE.currentCRCInstance.refs.delete(id);
    }
  } finally {
    const { parent } = crcInstance;
    clearTempState();
    if (updateParents && parent && GLOBAL_STATE.crcInstances.has(parent)) {
      executeRender(parent, renderTimestamp);
    }
    GLOBAL_STATE.currentCRCInstance = prevCurrentCRCInstance;
    GLOBAL_STATE.canvas = prevCanvas;
    GLOBAL_STATE.renderContext = prevRenderContext;
    GLOBAL_STATE.mouseTransform = prevMouseTransform;
    GLOBAL_STATE.seenIds = prevSeenIds;
    GLOBAL_STATE.unseenIds = prevUnseendIds;
    GLOBAL_STATE.componentRefs = prevComponentRefs;
  }
}
