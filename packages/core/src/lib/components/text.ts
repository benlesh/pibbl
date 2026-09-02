import { defineComp } from '../define-comp.js';
import { definePrimitive } from '../define-primitive.js';
import { materializeTextChildren } from '../element/children.js';
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
} from '../events/types.js';
import {
  resolveLocalOffset,
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
import type { CRCTextChild } from '../types.js';
import { resolveLength } from '../style/resolve-length.js';
import { wireCommonEvents } from '../util/wire-common-events.js';
import { pushClippingPath } from '../util/push-clipping-path.js';
import { resolveTextClipBounds, resolveTextLayout } from './text-layout.js';

export interface TextProps extends CRCEventHandlers, CRCEventFocusOptions {
  children?: CRCTextChild;
}

interface LegacyTextStyle extends TextStyle {
  text: string;
}

type ResolvedLegacyTextStyle = ResolvedTextStyle & { text: string };

const materializedTextObjects = new WeakMap<object, string>();

function checkPropsForEvents(
  props: CRCEventHandlers,
  cursor: string | undefined,
) {
  return Boolean(
    cursor || Object.values(props).some(value => typeof value === 'function'),
  );
}

function renderText(
  props: TextProps,
  style: Readonly<ResolvedTextStyle>,
  ctx: RenderingContext2D,
) {
  const text = materializeTextContent(props.children);
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
    const textBounds =
      checkPropsForEvents(props, cursor) ? new Path2D() : undefined;

    for (const line of layout.lines) {
      if (stroke && strokeWidth) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = strokeWidth;
        ctx.strokeText(line.text, line.x, line.y, line.squishWidth);
      }

      if (fill) {
        ctx.fillStyle = fill;
        ctx.fillText(line.text, line.x, line.y, line.squishWidth);
      }

      textBounds?.rect(
        line.bounds.x,
        line.bounds.y,
        line.bounds.width,
        line.bounds.height,
      );
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

export const Text = definePrimitive<
  TextProps,
  TextStyle,
  TextStyle,
  ResolvedTextStyle
>(renderText, {
  resolveStyle: (style, context) => ({
    ...stripLayoutParticipation(style),
    x: resolveLocalOffset(style.x, context.percentageBasis.width, 'x', context),
    y: resolveLocalOffset(style.y, context.percentageBasis.height, 'y', context),
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
      materializeTextContent(props.children),
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

function materializeTextContent(children: CRCTextChild): string {
  if (children !== null && typeof children === 'object') {
    const cached = materializedTextObjects.get(children);
    if (cached !== undefined) return cached;
    const materialized = materializeTextChildren(children, 'Text');
    materializedTextObjects.set(children, materialized);
    return materialized;
  }
  return materializeTextChildren(children, 'Text');
}

function renderLegacyText(
  props: TextProps,
  style: Readonly<ResolvedLegacyTextStyle>,
  ctx: RenderingContext2D,
) {
  const { text, ...resolvedStyle } = style;
  renderText(
    { ...props, children: text },
    resolvedStyle as Readonly<ResolvedTextStyle>,
    ctx,
  );
}

/** @internal Temporary lowercase authoring adapter retained until Task 12. */
export const text = defineComp<
  TextProps,
  LegacyTextStyle,
  LegacyTextStyle,
  ResolvedLegacyTextStyle
>(renderLegacyText, {
  resolveStyle: (style, context) => ({
    ...stripLayoutParticipation(style),
    x: resolveLocalOffset(style.x, context.percentageBasis.width, 'x', context),
    y: resolveLocalOffset(style.y, context.percentageBasis.height, 'y', context),
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
  }) as ResolvedLegacyTextStyle,
  measure: ({ style, constraints, service }) =>
    measureTextStyle(style.text, style, constraints, service),
});
registerOpaqueStyleProperties(renderLegacyText, [
  'text',
  'font',
  'fill',
  'stroke',
  'cursor',
  'fit',
  'textBaseline',
  'textAlign',
]);
