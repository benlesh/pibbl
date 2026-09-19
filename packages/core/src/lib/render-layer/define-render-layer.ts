import { definePrimitive } from "../define-primitive.js";
import { GLOBAL_STATE } from "../global-state.js";
import { createLayerSurface } from "../surface/resolve-surface.js";
import {
  resolveRequiredLength,
  stripLayoutParticipation,
} from "../style/resolve-built-in.js";
import type {
  CRCComponent,
  PrimitiveCapabilities,
  RenderingContext2D,
} from "../types.js";
import { RenderLayerController } from "./controller.js";
import type {
  CRCRenderLayerDefinition,
  CRCRenderLayerProps,
  CRCRenderLayerSize,
  CRCRenderLayerStyle,
} from "./types.js";

type ResolvedRenderLayerStyle = CRCRenderLayerStyle & {
  readonly width: number;
  readonly height: number;
};

export function defineRenderLayer<
  Props,
  Resources,
  Target extends object = object,
>(
  definition: CRCRenderLayerDefinition<Props, Resources, Target>,
): CRCComponent<CRCRenderLayerProps<Props>> {
  const primitive = (definePrimitive as any)(
    function renderDefinedRenderLayer(
      props: Readonly<CRCRenderLayerProps<Props>>,
      style: Readonly<ResolvedRenderLayerStyle>,
      ctx: RenderingContext2D,
    ) {
      const refs = GLOBAL_STATE.componentRefs!;
      let controller = refs.refs[0] as
        RenderLayerController<Props, Resources, Target> | undefined;
      if (!controller) {
        controller = new RenderLayerController(definition, refs);
        refs.refs[0] = controller;
      }
      const surface = GLOBAL_STATE.currentCRCInstance!.surface.snapshot!;
      const layerSurface = createLayerSurface(
        style.width,
        style.height,
        surface.backingPixelsPerLogicalUnitX,
        surface.backingPixelsPerLogicalUnitY,
      );
      const size: CRCRenderLayerSize = Object.freeze({
        width: style.width,
        height: style.height,
        backingWidth: layerSurface.backingWidth,
        backingHeight: layerSurface.backingHeight,
        pixelRatioX: layerSurface.backingPixelsPerLogicalUnitX,
        pixelRatioY: layerSurface.backingPixelsPerLogicalUnitY,
      });
      controller.render(customProps(props) as Props, size, ctx);
    },
    { resolveStyle },
  );
  return primitive as CRCComponent<CRCRenderLayerProps<Props>>;
}

const resolveStyle: NonNullable<
  PrimitiveCapabilities<
    CRCRenderLayerProps<any>,
    CRCRenderLayerStyle,
    CRCRenderLayerStyle,
    ResolvedRenderLayerStyle
  >["resolveStyle"]
> = (style, context) =>
  ({
    ...stripLayoutParticipation(style),
    width: resolveRequiredLength(
      style.width ?? context.allocation.width,
      context.percentageBasis.width,
      "width",
      context,
    ),
    height: resolveRequiredLength(
      style.height ?? context.allocation.height,
      context.percentageBasis.height,
      "height",
      context,
    ),
}) as ResolvedRenderLayerStyle;

function customProps<Props>(props: Readonly<CRCRenderLayerProps<Props>>): Props {
  const custom = { ...props } as Record<PropertyKey, unknown>;
  delete custom.missBehavior;
  delete custom.pointerEvents;
  delete custom.keyboardFocusable;
  delete custom.keyboardNavigationBounds;
  for (const key of Object.keys(custom)) {
    if (key.startsWith('on')) delete custom[key];
  }
  return custom as Props;
}
