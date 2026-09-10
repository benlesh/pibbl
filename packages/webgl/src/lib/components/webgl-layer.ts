import {
  Fragment,
  createElement,
  crcEventListener,
  definePrimitive,
  resolveLength,
  type BoxStyle,
  type CRCEventHandlers,
  type CRCNode,
  type LayoutItemStyle,
  type RenderingContext2D,
  type StyleResolutionContext,
} from '@crc/core';
import {
  getCurrentBackendHostCanvas,
  getCurrentFrameTimestamp,
  getCurrentSurfaceDensity,
  useInternalHookSlot,
} from '@crc/core/internal';
import {
  WebGLLayerController,
  resolveWebGLLayerSurface,
} from '../layer-controller.js';
import type { CRCWebGLPerspectiveCamera } from '../types.js';

export interface WebGLLayerProps extends CRCEventHandlers {
  children: CRCNode;
  camera?: CRCWebGLPerspectiveCamera;
  pointerEvents?: 'auto' | 'none';
}

export interface WebGLLayerStyle extends BoxStyle, LayoutItemStyle {}

interface ResolvedWebGLLayerStyle {
  readonly width: number;
  readonly height: number;
  readonly filter?: WebGLLayerStyle['filter'];
}

function renderWebGLLayer(
  props: Readonly<WebGLLayerProps>,
  style: Readonly<ResolvedWebGLLayerStyle>,
  context: RenderingContext2D,
): void {
  crcEventListener(props);
  const root = createElement(Fragment, {
    key: 'crc-webgl-layer-root',
    children: props.children,
  });
  const density = getCurrentSurfaceDensity();
  const surface = resolveWebGLLayerSurface(
    style.width,
    style.height,
    density,
  );
  const slot = useInternalHookSlot(
    'webglLayerController',
    teardowns => {
      const controller = new WebGLLayerController(
        getCurrentBackendHostCanvas(),
        root,
        props.camera,
        surface,
      );
      teardowns.add(() => controller.dispose());
      return controller;
    },
  );
  const controller = slot.value;
  controller.registerInteraction(
    style.width,
    style.height,
    props.pointerEvents ?? 'auto',
  );
  controller.renderUpdatedChild(
    root,
    props.camera,
    surface,
    getCurrentFrameTimestamp(),
  );
  controller.composite(context, {
    x: 0,
    y: 0,
    width: style.width,
    height: style.height,
  });
}

/** Composites one private WebGL2 CRC subtree into the Canvas paint order. */
export const WebGLLayer = definePrimitive<
  WebGLLayerProps,
  WebGLLayerStyle,
  WebGLLayerStyle,
  ResolvedWebGLLayerStyle
>(renderWebGLLayer, {
  resolveStyle: resolveWebGLLayerStyle,
});

function resolveWebGLLayerStyle(
  style: Readonly<WebGLLayerStyle>,
  context: Readonly<StyleResolutionContext>,
): ResolvedWebGLLayerStyle {
  const width = resolveLayerLength(
    style.width ?? context.allocation.width,
    context.percentageBasis.width,
    'width',
    context,
  );
  const height = resolveLayerLength(
    style.height ?? context.allocation.height,
    context.percentageBasis.height,
    'height',
    context,
  );
  return { width, height };
}

function resolveLayerLength(
  value: NonNullable<WebGLLayerStyle['width']>,
  reference: number,
  property: 'width' | 'height',
  context: Readonly<StyleResolutionContext>,
): number {
  const resolved = resolveLength(value, reference, property, context);
  if (!Number.isFinite(resolved) || resolved === undefined || resolved <= 0) {
    throw new RangeError(
      `WebGLLayer ${property} must resolve to a finite positive number.`,
    );
  }
  return resolved;
}
