import {
  defineBackendPrimitive,
  getBackendEnvironment,
  getCurrentElementSource,
} from '@crc/core/internal';
import { WEBGL_BACKEND_TOKEN } from '../backend.js';
import { submitWebGLBackground } from '../scene/composer.js';
import type { WebGLRGBA, WebGLSceneComposer } from '../scene/types.js';
import { parseConcreteColor } from './style-values.js';

declare const webGLBackgroundPropsMarker: unique symbol;

export interface WebGLBackgroundProps {
  readonly [webGLBackgroundPropsMarker]?: never;
}

export interface WebGLBackgroundStyle {
  readonly color: string;
}

type WebGLBackgroundPrimitiveStyle = WebGLBackgroundStyle & {
  readonly filter?: never;
};

function renderWebGLBackground(
  props: Readonly<WebGLBackgroundProps>,
  style: Readonly<WebGLBackgroundPrimitiveStyle>,
): void {
  const componentName = 'WebGLBackground';
  validateProps(componentName, props);
  validateStyle(componentName, style);
  if (!Object.hasOwn(style, 'color')) {
    throw new TypeError(`${componentName} style.color is required.`);
  }
  const color = parseConcreteColor(componentName, 'style.color', style.color);
  submitWebGLBackground(
    getBackendEnvironment<WebGLSceneComposer>(WEBGL_BACKEND_TOKEN),
    {
      componentName,
      source: getCurrentElementSource(),
      color: Object.freeze([
        color.red,
        color.green,
        color.blue,
        color.alpha,
      ]) as WebGLRGBA,
    },
  );
}

function validateProps(componentName: string, props: object): void {
  for (const key of Reflect.ownKeys(props)) {
    throw new TypeError(`${componentName} prop.${String(key)} is not supported.`);
  }
}

function validateStyle(componentName: string, style: object): void {
  for (const key of Reflect.ownKeys(style)) {
    if (key !== 'color') {
      throw new TypeError(
        `${componentName} style.${String(key)} is not supported.`,
      );
    }
  }
}

export const WebGLBackground = defineBackendPrimitive<
  WebGLBackgroundProps,
  WebGLBackgroundPrimitiveStyle,
  WebGLBackgroundPrimitiveStyle,
  WebGLBackgroundPrimitiveStyle,
  WebGLSceneComposer
>(WEBGL_BACKEND_TOKEN, renderWebGLBackground);
