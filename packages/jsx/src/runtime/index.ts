import type {
  Hook,
  IntrinsicElement,
  IntrinsicElements,
  PerformanceMetrics,
  RuntimeOptions,
  VirtualNode,
} from './types';

import {
  g,
  type GProps,
  layer,
  type LayerProps,
  line,
  type LineProps,
  path,
  type PathProps,
  rect,
  type RectProps,
  type RenderingContext2D,
  text,
  type TextProps,
} from '@crc/core';

// Intrinsic elements mapping
const intrinsicElements: Record<keyof IntrinsicElements, IntrinsicElement> = {
  rect,
  text,
  g,
  path,
  line,
  layer,
};

// Runtime hooks for component modification
const componentHooks = new Map<string, Hook>();

// Performance metrics storage
const metrics: PerformanceMetrics[] = [];

// Development utilities
function recordMetric(metric: PerformanceMetrics) {
  metrics.push(metric);
  if (metrics.length > 1000) metrics.shift(); // Keep last 1000
}

function getComponentName(type: string | IntrinsicElement): string {
  return typeof type === 'string' ? type : type.name || 'Anonymous';
}

// Direct transformation approach
export function jsx(
  type: string | IntrinsicElement,
  props: Record<string, IntrinsicElements[keyof IntrinsicElements]>,
  options: RuntimeOptions = {},
) {
  const componentName = getComponentName(type);
  const start = performance.now();

  // Runtime type checking in development
  if (options.strict && typeof type === 'string' && !intrinsicElements[type as keyof IntrinsicElements]) {
    console.warn(
      `Unknown intrinsic element: <${type}>. ` +
      `Valid elements are: ${Object.keys(intrinsicElements).join(', ')}`,
    );
  }

  // Apply runtime hooks if any
  const hook = componentHooks.get(componentName);
  if (hook) {
    type = hook(type as IntrinsicElement, props);
  }

  // Debug logging
  if (options.debug) {
    // eslint-disable-next-line no-console
    console.log('Rendering:', { componentName, props });
  }

  // Create the element
  const result = typeof type === 'string' ?
      // @ts-expect-error I'm bad at typescript
      (intrinsicElements[type] as IntrinsicElement)(props) :
    // @ts-expect-error I'm bad at typescript
      (type as unknown)(props);

  // Record performance
  if (options.performance) {
    recordMetric({
      componentName,
      renderTime: performance.now() - start,
      // @ts-expect-error I'm bad at typescript
      childCount: (props.children?.length || 0),
      depth: 0, // TODO: Track depth
    });
  }

  return result;
}

// Virtual tree approach
export function jsxVirtual(
  type: string | IntrinsicElement,
  props: Record<string, any>,
  options: RuntimeOptions = {},
): VirtualNode {
  return {
    type,
    props,
    children: props.children || [],
    effects: [],
    // eslint-disable-next-line unicorn/error-message
    __source: options.debug ? new Error().stack : undefined,
    __debug: options.debug,
  };
}

// Process virtual tree
export function processVirtualNode(
  node: VirtualNode,
  ctx: RenderingContext2D,
  depth = 0,
): any {
  const start = performance.now();
  const componentName = getComponentName(node.type);

  // Run effects
  node.effects?.forEach(effect => effect());

  // Process children first
  const processedChildren = node.children.map(
    child => processVirtualNode(child, ctx, depth + 1),
  );

  // Debug logging
  if (node.__debug) {
    // eslint-disable-next-line no-console
    console.log('Processing:', {
      componentName,
      props: node.props,
      depth,
      childCount: node.children.length,
    });
  }

  // Create the element
  const result = typeof node.type === 'string' ?
      // @ts-expect-error I'm bad at typescript
      (intrinsicElements[node.type as keyof IntrinsicElements] as unknown)(
        { ...node.props, children: processedChildren },
      ) :
      // @ts-expect-error I'm bad at typescript
      (node.type as unknown)({ ...node.props, children: processedChildren });

  // Record metrics
  recordMetric({
    componentName,
    renderTime: performance.now() - start,
    childCount: node.children.length,
    depth,
  });

  return result;
}

// Runtime utilities
export function registerHook(componentName: string, hook: Hook) {
  componentHooks.set(componentName, hook);
}

export function getMetrics(): PerformanceMetrics[] {
  return [...metrics];
}

// JSX namespace augmentation
declare global {
  namespace JSX {
    interface Element extends VirtualNode {}
    interface IntrinsicElements {
      rect: RectProps;
      text: TextProps;
      g: GProps;
      path: PathProps;
      line: LineProps;
      layer: LayerProps;
    }
  }
}

// JSX Runtime exports
export const jsxs = jsx; // jsxs is just an alias for jsx in our implementation
export const Fragment = Symbol('Fragment');
