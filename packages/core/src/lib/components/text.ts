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
  IntrinsicSizesResult,
  RenderingContext2D,
} from '../types.js';
import type { Constraints } from '../layout/types.js';
import type { PibblRenderTransaction, PibblTextInput } from '../types.js';
import type { PibblPhysics2DPropExtension } from '../types.js';
import { resolveScalarSizingLength } from '../style/sizing-length.js';
import { normalizeBoxInsets } from '../layout/box-insets.js';
import { wireCommonEvents } from '../util/wire-common-events.js';
import { pushClippingPath } from '../util/push-clipping-path.js';
import { resolveTextClipBounds, resolveTextLayout } from './text-layout.js';
import { withReceiverInputProvision } from '../signals/input-provision.js';
import { withSignalDependencyRole, withSignalWriteForbidden } from '../signals/graph.js';
import { withHooksForbidden } from '../hooks/hook-slot.js';

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
  resolveStyle: (style, context) => {
    let x = 0, y = 0;
    if (style.padding !== undefined || style.paddingStart !== undefined || style.paddingEnd !== undefined ||
        style.borderWidth !== undefined || style.borderStartWidth !== undefined || style.borderEndWidth !== undefined) {
      const insets = normalizeBoxInsets(style, context);
      x = insets.left; y = insets.top;
    }
    return {
      ...stripLayoutParticipation(style),
      x,
      y,
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
    } as ResolvedTextStyle;
  },
  measure: ({ props, style, constraints, service }) =>
    measureTextStyle(
      materializeTextContent(props),
      style,
      constraints,
      service,
    ),
  measureIntrinsic: ({ props, style, service }) => measureTextIntrinsic(props, style, service),
  measureBaselines: ({ props, style, allocation, service }) =>
    measureTextBaselines(
      materializeTextContent(props),
      style,
      allocation,
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


function measureTextBaselines(
  text: string,
  style: Readonly<TextStyle>,
  allocation: Readonly<{ width: number; height: number }>,
  service: CanvasMeasurementService,
) {
  if (text.length === 0) return { status: 'unsupported' as const, reason: 'Text baseline measurement requires nonempty text' };
  const measureAtBaseline = service.measureTextAtBaseline;
  if (!measureAtBaseline) {
    return {
      status: 'unsupported' as const,
      reason: 'Text baseline measurement requires CanvasMeasurementService.measureTextAtBaseline',
    };
  }
  const font = style.font ?? '13px sans-serif';
  const textBaseline = style.textBaseline ?? 'top';
  const layout = resolveTextLayout(
    value => measureAtBaseline.call(service, value, { font, textBaseline }),
    text,
    { ...style, x: 0, y: 0, width: allocation.width, height: allocation.height },
  );
  const firstLine = layout.lines[0];
  const lastLine = layout.lines[layout.lines.length - 1];
  if (!firstLine || !lastLine || firstLine.text.length === 0 || lastLine.text.length === 0) {
    return { status: 'unsupported' as const, reason: 'Text does not resolve a line for baseline measurement: requires a nonempty rendered baseline line' };
  }
  const firstMetrics = measureAtBaseline.call(service, firstLine.text, { font, textBaseline });
  const first = firstLine.y - firstMetrics.alphabeticBaseline;
  let last = first;
  if (lastLine !== firstLine) {
    const lastMetrics = measureAtBaseline.call(service, lastLine.text, { font, textBaseline });
    last = lastLine.y - lastMetrics.alphabeticBaseline;
  }
  if (!Number.isFinite(first) || !Number.isFinite(last)) {
    return {
      status: 'unsupported' as const,
      reason: 'Canvas text metrics do not provide a finite alphabeticBaseline for Text baseline measurement',
    };
  }
  return { status: 'measured' as const, first, last };
}

/** Width contributions and their respective natural heights share Text's existing wrap policy. */
function measureTextIntrinsic(props: Readonly<TextProps>, style: Readonly<TextStyle>, service: CanvasMeasurementService): IntrinsicSizesResult {
  const text = prepareLayoutTextContent(props, {});
  const font = style.font ?? '13px sans-serif';
  const maximum = style.wrap ? measureLayoutTextNaturalRun(text, { font, service }) : service.measureText(text, font).width;
  const minimum = style.wrap ? measureLayoutTextMinimumWidth(props, { font, service }) : maximum;
  const intrinsicStyle = { ...style, width: undefined, height: undefined, fit: 'visible' as const };
  const minResult = measureTextStyle(text, intrinsicStyle, { minWidth: 0, maxWidth: minimum, minHeight: 0, maxHeight: Infinity }, service);
  const maxResult = measureTextStyle(text, intrinsicStyle, { minWidth: 0, maxWidth: maximum, minHeight: 0, maxHeight: Infinity }, service);
  if (minResult.status !== 'measured') return minResult;
  if (maxResult.status !== 'measured') return maxResult;
  return { status: 'measured', minContent: { width: minimum, height: minResult.size.height }, maxContent: { width: maximum, height: maxResult.size.height } };
}

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
    resolveScalarSizingLength(style.width, constraints.maxWidth, 'width', context);
  const specifiedHeight = style.height === undefined ? undefined :
    resolveScalarSizingLength(style.height, constraints.maxHeight, 'height', context);
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

/** @internal Measure a materialized value without bypassing receiver reads. */
export function measureLayoutTextNaturalRun(
  text: string, options: { font: string; service: CanvasMeasurementService },
): number {
  // wrapText discards leading empty words but preserves later spaces. Use the
  // same boundary rather than adding a CSS whitespace-normalization policy.
  let start = 0;
  while (text.charCodeAt(start) === 32) start++;
  if (start === text.length) return 0;
  const width = options.service.measureText(text.slice(start), options.font).width;
  if (!Number.isFinite(width) || width < 0) {
    throw new Error('Text intrinsic measurement requires a finite nonnegative natural width.');
  }
  return width;
}

/** @internal Longest run under Text's existing ASCII-space wrapping contract. */
export function measureLayoutTextMinimumWidth(
  props: Readonly<TextProps>,
  options: { font: string; service: CanvasMeasurementService; receiverToken?: object },
): number {
  const text = prepareLayoutTextContent(props, { receiverToken: options.receiverToken });
  let longest = 0;
  let start = 0;
  for (let index = 0; index <= text.length; index++) {
    if (index !== text.length && text.charCodeAt(index) !== 32) continue;
    if (index > start) {
      const width = options.service.measureText(text.slice(start, index), options.font).width;
      if (!Number.isFinite(width) || width < 0) {
        throw new Error('Text intrinsic measurement requires finite nonnegative word widths.');
      }
      if (width > longest) longest = width;
    }
    start = index + 1;
  }
  return longest;
}

/** @internal Prepare measured Text through its existing transaction/receiver ownership. */
export function prepareLayoutTextContent(
  props: Readonly<TextProps>, options: { receiverToken?: object },
): string {
  return withSignalWriteForbidden('Signal writes are forbidden during Pibbl measurement', () =>
    withHooksForbidden('Pibbl hooks cannot be called while preparing measured Text content.', () =>
      materializeTextContent(props, options.receiverToken),
    ),
  );
}

function materializeTextContent(
  props: Readonly<TextProps>, receiver = GLOBAL_STATE.primitiveReceiverToken,
): string {
  const transaction = GLOBAL_STATE.renderTransaction;
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
    () => withSignalDependencyRole(
      'measurement',
      () => materializeTextChildren(props.children, 'Text'),
    ),
  );
  receivers.set(receiver, materialized);
  return materialized;
}
