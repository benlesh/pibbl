import { resolveTexturePaint } from '../textures/texture-protocol.js';
import { definePrimitive } from '../define-primitive.js';
import { materializeTextChildren } from '../element/children.js';
import { GLOBAL_STATE } from '../global-state.js';
import type {
  PibblEventFocusOptions,
  PibblEventHandlers,
  PibblEventParticipationOptions,
} from '../events/types.js';
import {
  resolveOptionalLength,
  stripLayoutParticipation,
} from '../style/resolve-built-in.js';
import { registerOpaqueStyleProperties } from '../style/resolve-dispatch.js';
import type { ResolvedTextStyle, TextStyle } from '../style/types.js';
import {
  CanvasMeasurementService,
  MeasureResult,
  RenderingContext2D,
} from '../types.js';
import type { Constraints } from '../layout/types.js';
import type { PibblRenderTransaction, PibblTextInput } from '../types.js';
import type { PibblPhysics2DPropExtension } from '../types.js';
import { resolveLength } from '../style/resolve-length.js';
import { wireCommonEvents } from '../util/wire-common-events.js';
import { pushClippingPath } from '../util/push-clipping-path.js';
import { resolveTextClipBounds, resolveTextLayout } from './text-layout.js';
import { withReceiverInputProvision } from '../signals/input-provision.js';

/**
 * Authored inputs for Text, including the declared data and presentation options.
 *
 * @see {@link PibblEventHandlers}
 * @see {@link PibblEventParticipationOptions}
 * @see {@link PibblPhysics2DPropExtension}
 * @see {@link PibblTextInput}
 * @see {@link Text}
 */
export interface TextProps
  extends
    PibblEventHandlers,
    PibblEventFocusOptions,
    PibblEventParticipationOptions,
    PibblPhysics2DPropExtension {
  /** Descendant content or the callback that supplies it. See {@link PibblTextInput}. */
  children?: PibblTextInput;
}

const materializedTextTransactions = new WeakMap<
  PibblRenderTransaction,
  WeakMap<object, string>
>();

function renderText(
  props: TextProps,
  style: Readonly<ResolvedTextStyle>,
  ctx: RenderingContext2D,
) {
  const text = materializeTextContent(props);
  const {
    font = '13px sans-serif',
    textBaseline = 'top',
    textAlign = 'left',
    fill,
    stroke,
    strokeWidth = 0,
    opacity,
    cursor,
  } = style;

  if (opacity !== undefined) {
    ctx.globalAlpha = ctx.globalAlpha * opacity;
  }

  ctx.font = font;
  ctx.textBaseline = textBaseline;
  ctx.textAlign = textAlign;

  const layout = resolveTextLayout(
    value => ctx.measureText(value),
    text,
    style,
  );
  const clipBounds =
    layout.clipBounds ?? resolveTextClipBounds(style, ctx.canvas.height);

  let releaseClip: (() => void) | undefined;
  if (clipBounds) {
    const clipPath = new Path2D();
    clipPath.rect(
      clipBounds.x,
      clipBounds.y,
      clipBounds.width,
      clipBounds.height,
    );
    releaseClip = pushClippingPath(ctx, clipPath);
  }

  try {
    const textBounds = props.pointerEvents === 'none' ? undefined : new Path2D();

    for (const line of layout.lines) {
      if (stroke && strokeWidth) {
        ctx.strokeStyle = resolveTexturePaint(stroke, ctx, layout.bounds ?? line.bounds);
        ctx.lineWidth = strokeWidth;
        ctx.strokeText(line.text, line.x, line.y, line.squishWidth);
      }

      if (fill) {
        ctx.fillStyle = resolveTexturePaint(fill, ctx, layout.bounds ?? line.bounds);
        ctx.fillText(line.text, line.x, line.y, line.squishWidth);
      }

      if (textBounds) {
        textBounds.moveTo(line.bounds.x, line.bounds.y);
        textBounds.lineTo(line.bounds.x + line.bounds.width, line.bounds.y);
        textBounds.lineTo(
          line.bounds.x + line.bounds.width,
          line.bounds.y + line.bounds.height,
        );
        textBounds.lineTo(line.bounds.x, line.bounds.y + line.bounds.height);
        textBounds.closePath();
      }
    }

    wireCommonEvents(
      props,
      textBounds,
      true,
      strokeWidth,
      cursor,
      layout.bounds,
    );
  } finally {
    releaseClip?.();
  }
}

/**
 * Draws Canvas text from textual children using the resolved font, wrapping, fitting, and paint
 * style.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; Pibbl mounts this component through JSX or createElement.
 *
 * @see {@link TextProps}
 * @see {@link TextStyle}
 */
export const Text = definePrimitive<
  TextProps,
  TextStyle,
  TextStyle,
  ResolvedTextStyle
>(renderText, {
  childInput: 'text',
  resolveStyle: (style, context) => ({
    ...stripLayoutParticipation(style),
    x: 0,
    y: 0,
    width: resolveOptionalLength(
      style.width,
      context.percentageBasis.width,
      'width',
      context,
    ),
    height: resolveOptionalLength(
      style.height,
      context.percentageBasis.height,
      'height',
      context,
    ),
  }) as ResolvedTextStyle,
  measure: ({ props, style, constraints, service }) =>
    measureTextStyle(
      materializeTextContent(props),
      style,
      constraints,
      service,
    ),
});
registerOpaqueStyleProperties(Text, [
  'font',
  'fill',
  'stroke',
  'cursor',
  'fit',
  'textBaseline',
  'textAlign',
]);

function measureTextStyle(
  text: string,
  style: Readonly<TextStyle>,
  constraints: Readonly<Constraints>,
  service: CanvasMeasurementService,
): MeasureResult {
  const context = {
    component: 'Text',
    algorithm: 'measurement',
    constraints,
  };
  const specifiedWidth = style.width === undefined ? undefined :
    resolveLength(style.width, constraints.maxWidth, 'width', context);
  const specifiedHeight = style.height === undefined ? undefined :
    resolveLength(style.height, constraints.maxHeight, 'height', context);
  const layoutWidth = specifiedWidth ?? (
    style.wrap && Number.isFinite(constraints.maxWidth) ?
      constraints.maxWidth :
      undefined
  );
  const font = style.font ?? '13px sans-serif';
  const layout = resolveTextLayout(
    value => service.measureText(value, font),
    text,
    {
      ...style,
      x: 0,
      y: 0,
      width: layoutWidth,
      height: specifiedHeight,
    },
  );
  return {
    status: 'measured',
    size: {
      width: specifiedWidth ?? (style.wrap && layoutWidth !== undefined ?
        layoutWidth :
        layout.bounds?.width ?? 0),
      height: specifiedHeight ?? (style.wrap ?
        layout.lines.length * (style.lineHeight ?? 13) :
        layout.bounds?.height ?? 0),
    },
  };
}

function materializeTextContent(props: Readonly<TextProps>): string {
  const transaction = GLOBAL_STATE.renderTransaction;
  const receiver = GLOBAL_STATE.primitiveReceiverToken;
  if (!transaction || !receiver) {
    return materializeTextChildren(props.children, 'Text');
  }

  let receivers = materializedTextTransactions.get(transaction);
  if (!receivers) {
    receivers = new WeakMap();
    materializedTextTransactions.set(transaction, receivers);
  }
  const cached = receivers.get(receiver);
  if (cached !== undefined) return cached;
  const materialized = withReceiverInputProvision(
    transaction,
    receiver,
    () => materializeTextChildren(props.children, 'Text'),
  );
  receivers.set(receiver, materialized);
  return materialized;
}
