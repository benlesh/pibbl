import { definePrimitive } from "../define-primitive.js";
import { GLOBAL_STATE } from "../global-state.js";
import { createLayerSurface } from "../surface/resolve-surface.js";
import {
  resolveRequiredLength,
  stripLayoutParticipation,
} from "../style/resolve-built-in.js";
import type {
  PibblComponent,
  PrimitiveCapabilities,
  RenderingContext2D,
} from "../types.js";
import { PIBBL_EVENT_DEFINITIONS } from "../events/event-definitions.js";
import { wireStructuralEvents } from "../components/structural-events.js";
import { RenderLayerController } from "./controller.js";
import type {
  PibblRenderLayerDefinition,
  PibblRenderLayerProps,
  PibblRenderLayerSize,
  PibblRenderLayerStyle,
} from "./types.js";

type ResolvedRenderLayerStyle = PibblRenderLayerStyle & {
  readonly width: number;
  readonly height: number;
};

/**
 * Defines a Pibbl component backed by a persistent external-renderer surface and resource lifetime.
 * Pibbl schedules frames and commits the bitmap and interaction snapshot together; the definition
 * owns application-resource cleanup.
 *
 * @param definition - Synchronous resource lifecycle, rendering, and interaction implementation.
 * See {@link PibblRenderLayerDefinition} .
 * @returns A Pibbl component that owns one external-renderer boundary per mounted identity. See
 * {@link PibblComponent} , {@link PibblRenderLayerProps} .
 *
 * @see {@link PibblRenderLayerDefinition}
 * @see {@link PibblComponent}
 * @see {@link PibblRenderLayerProps}
 */
export function defineRenderLayer<
  Props,
  Resources,
  Target extends object = object,
>(
  definition: PibblRenderLayerDefinition<Props, Resources, Target>,
): PibblComponent<PibblRenderLayerProps<Props>> {
  const immutableDefinition = snapshotDefinition(definition);
  const primitive = (definePrimitive as any)(
    function renderDefinedRenderLayer(
      props: Readonly<PibblRenderLayerProps<Props>>,
      style: Readonly<ResolvedRenderLayerStyle>,
      ctx: RenderingContext2D,
    ) {
      wireStructuralEvents(props);
      const refs = GLOBAL_STATE.componentRefs!;
      let controller = refs.refs[0] as
        RenderLayerController<Props, Resources, Target> | undefined;
      if (!controller) {
        controller = new RenderLayerController(immutableDefinition, refs);
        refs.refs[0] = controller;
      }
      const surface = GLOBAL_STATE.currentPibblInstance!.surface.snapshot!;
      const layerSurface = createLayerSurface(
        style.width,
        style.height,
        surface.backingPixelsPerLogicalUnitX,
        surface.backingPixelsPerLogicalUnitY,
      );
      const size: PibblRenderLayerSize = Object.freeze({
        width: style.width,
        height: style.height,
        backingWidth: layerSurface.backingWidth,
        backingHeight: layerSurface.backingHeight,
        pixelRatioX: layerSurface.backingPixelsPerLogicalUnitX,
        pixelRatioY: layerSurface.backingPixelsPerLogicalUnitY,
      });
      controller.render(customProps(props) as Props, size, ctx, {
        missBehavior: props.missBehavior ?? "pass-through",
        pointerEvents: props.pointerEvents,
        keyboardFocusable: props.keyboardFocusable,
        keyboardNavigationBounds: props.keyboardNavigationBounds,
      });
    },
    { resolveStyle },
  );
  return primitive as PibblComponent<PibblRenderLayerProps<Props>>;
}

const resolveStyle: NonNullable<
  PrimitiveCapabilities<
    PibblRenderLayerProps<any>,
    PibblRenderLayerStyle,
    PibblRenderLayerStyle,
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

function customProps<Props>(
  props: Readonly<PibblRenderLayerProps<Props>>,
): Props {
  const custom = { ...props } as Record<PropertyKey, unknown>;
  delete custom.missBehavior;
  delete custom.pointerEvents;
  delete custom.keyboardFocusable;
  delete custom.keyboardNavigationBounds;
  for (const definition of PIBBL_EVENT_DEFINITIONS) {
    delete custom[definition.prop];
    delete custom[definition.captureProp];
  }
  return custom as Props;
}

function snapshotDefinition<Props, Resources, Target extends object>(
  definition: PibblRenderLayerDefinition<Props, Resources, Target>,
): PibblRenderLayerDefinition<Props, Resources, Target> {
  return Object.freeze({
    create: definition.create,
    update: definition.update,
    resize: definition.resize,
    render: definition.render,
    dispose: definition.dispose,
    interaction: definition.interaction
      ? Object.freeze({
          settle: definition.interaction.settle,
        })
      : undefined,
  });
}
