import {
  crcMemo,
  definePrimitive,
  resolveBox,
  type CRCEventHandlers,
  type CRCNode,
  type ResolvedBoxStyle,
  type SystemStyle,
} from "@crc/core";
import { crcInternalPaintTarget } from "@crc/core/internal";
import type {
  CRCParticleCommonProps,
  CRCParticleParameterValues,
  Particles2DStyle,
} from "../types.js";
import type { CanvasParticleExecutor } from "./executor.js";

export interface ParticleCanvasPrimitiveProps {
  readonly executor: CanvasParticleExecutor;
  readonly interaction: CRCParticleCommonProps<CRCParticleParameterValues>;
}

export interface ResolvedParticles2DStyle
  extends SystemStyle, ResolvedBoxStyle {
  readonly opacity: number;
  readonly overflow: "visible" | "clip";
  readonly cursor?: string;
}

function renderParticleCanvas(
  props: Readonly<ParticleCanvasPrimitiveProps>,
  style: Readonly<ResolvedParticles2DStyle>,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
): CRCNode | void {
  const { borderBox, contentBox } = style;
  const targetPath = crcMemo(() => {
    const path = new Path2D();
    path.rect(borderBox.x, borderBox.y, borderBox.width, borderBox.height);
    return path;
  }, [borderBox.x, borderBox.y, borderBox.width, borderBox.height]);
  const pointerEvents = props.interaction.pointerEvents ?? "none";
  crcInternalPaintTarget(
    pointerEvents === "auto" ? (props.interaction as CRCEventHandlers) : {},
    {
      path: targetPath,
      fill: true,
      cursor: style.cursor,
      keyboardFocusable: props.interaction.keyboardFocusable,
      keyboardNavigationBounds:
        props.interaction.keyboardNavigationBounds ?? borderBox,
    },
    pointerEvents,
  );
  props.executor.draw(context, contentBox, style.opacity, style.overflow);
}

/** The single private paint primitive returned by every Particles2D component. */
export const ParticleCanvasPrimitive = definePrimitive<
  ParticleCanvasPrimitiveProps,
  Particles2DStyle,
  Particles2DStyle,
  ResolvedParticles2DStyle
>(renderParticleCanvas, {
  resolveStyle(style, context) {
    return {
      ...resolveBox(style, context.constraints, {
        component: "Particles2D",
        algorithm: "render-dispatch",
      }),
      opacity: style.opacity ?? 1,
      overflow: style.overflow ?? "visible",
      cursor: style.cursor,
    };
  },
  measure: () => ({
    status: "unsupported",
    reason: "Particles2D has no intrinsic size",
  }),
});
