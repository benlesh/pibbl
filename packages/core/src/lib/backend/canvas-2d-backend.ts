import {
  createBackendToken,
  type CRCBackendDriver,
  type CRCBackendPrimitiveProgram,
} from './types.js';
import {
  getDefinitionPrimitivePresentation,
  type PrimitiveDefinition,
} from '../element/metadata.js';
import { GLOBAL_STATE, getCurrentCRCInstance } from '../global-state.js';
import {
  enterPrimitivePresentation,
} from '../primitive-presentation.js';
import { rootRenderTarget } from '../render-target.js';
import { getResolvedFilterList } from '../style/filter.js';
import type { SystemStyle, RenderingContext2D } from '../types.js';
import { get2dContext } from '../util/get-2d-context.js';
import { prepareSurface } from '../surface/root-surface.js';

const CANVAS_2D_TOKEN = createBackendToken('canvas2d');

/** Core's built-in Canvas 2D frame and primitive driver. */
export const CANVAS_2D_BACKEND: CRCBackendDriver<RenderingContext2D> = {
  token: CANVAS_2D_TOKEN,
  name: 'canvas2d',
  beginFrame(input) {
    const surface = prepareSurface(getCurrentCRCInstance());
    if (!surface) return undefined;
    const context = get2dContext(input.canvas);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, surface.backingWidth, surface.backingHeight);
    context.setTransform(surface.renderTransform);
    return {
      environment: context,
      context2D: context,
      renderTarget: rootRenderTarget(surface),
      worldBaseTransform: new DOMMatrix(),
    };
  },
  enterComponent() {
    const context = requireCanvasContext();
    context.save();
    return () => context.restore();
  },
  runPrimitive(_frame, input, runProgram) {
    const definition = input.definition as PrimitiveDefinition;
    const program = definition.program as CRCBackendPrimitiveProgram<
      Record<PropertyKey, unknown>,
      SystemStyle,
      RenderingContext2D
    >;
    const definitionPresentation = getDefinitionPrimitivePresentation(
      definition,
      input.style,
    );
    const position = input.style as Readonly<{ left?: number; top?: number }>;
    const positionedPresentation = (position.left || position.top) ? {
      ...definitionPresentation,
      transform: new DOMMatrix().translate(position.left ?? 0, position.top ?? 0)
        .multiply(definitionPresentation?.transform ?? new DOMMatrix()),
    } : definitionPresentation;
    const presentation = input.presentationTransform2D ? {
      ...positionedPresentation,
      transform: positionedPresentation?.transform ?
        input.presentationTransform2D.multiply(positionedPresentation.transform) :
        input.presentationTransform2D,
    } : positionedPresentation;
    const filters = getResolvedFilterList(input.style as Readonly<SystemStyle>);
    const invoke = () => runProgram(() => {
      const context = requireCanvasContext();
      return program(input.props, input.style, context);
    });
    if (filters) {
      const executor = filters.values[0]!.executor;
      GLOBAL_STATE.htmlFilterDepth++;
      try { executor.render({
        component: input.componentName,
        filters: filters.values,
        presentation,
        renderSubtree: invoke,
      }); } finally { GLOBAL_STATE.htmlFilterDepth--; }
      return;
    }
    const releasePresentation = enterPrimitivePresentation(presentation);
    try {
      invoke();
    } finally {
      releasePresentation();
    }
  },
  finishFrame(frame) {
    frame.context2D?.setTransform(1, 0, 0, 1, 0, 0);
  },
  dispose() {},
};

function requireCanvasContext(): RenderingContext2D {
  const context = GLOBAL_STATE.renderContext;
  if (!context) {
    throw new Error('Canvas 2D rendering requires an active render context.');
  }
  return context;
}
