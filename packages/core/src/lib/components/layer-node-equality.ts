import { haveSameElementEnhancers } from '../element-enhancers.js';
import { isCRCElement } from '../element/create-element.js';
import type { CRCElement } from '../element/types.js';
import { shallowEquals } from '../util/shallow-equals.js';

/**
 * Compares Layer's already-materialized retained tree without evaluating child
 * iterables. Iterable receivers are materialized before this function runs;
 * nested opaque iterables compare only by identity.
 */
export function haveSameLayerNodeTree(left: unknown, right: unknown): boolean {
  if (isCRCElement(left) || isCRCElement(right)) {
    return isCRCElement(left) && isCRCElement(right) &&
      haveSameLayerElement(left, right);
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) &&
      haveSameChildSequence(left, right);
  }

  return left === right;
}

function haveSameLayerElement(
  left: CRCElement<any>,
  right: CRCElement<any>,
): boolean {
  if (
    left.type !== right.type ||
    left.key !== right.key ||
    !haveSameElementEnhancers(left, right)
  ) {
    return false;
  }

  const leftProps = splitProps(left.props);
  const rightProps = splitProps(right.props);
  return shallowEquals(leftProps.nonChild, rightProps.nonChild) &&
    shallowEquals(leftProps.style, rightProps.style) &&
    haveSameLayerNodeTree(leftProps.children, rightProps.children);
}

function haveSameChildSequence(
  left: readonly unknown[],
  right: readonly unknown[],
): boolean {
  return left.length === right.length && left.every((child, index) =>
    haveSameLayerNodeTree(child, right[index])
  );
}

function splitProps(props: Readonly<Record<PropertyKey, unknown>>): {
  children: unknown;
  nonChild: Readonly<Record<PropertyKey, unknown>>;
  style: Readonly<Record<PropertyKey, unknown>>;
} {
  const {
    children,
    style,
    ...nonChild
  } = props as Readonly<{
    children?: unknown;
    style?: Readonly<Record<PropertyKey, unknown>>;
    [key: PropertyKey]: unknown;
  }>;
  return {
    children,
    nonChild,
    style: style ?? EMPTY_PROPS,
  };
}

const EMPTY_PROPS: Readonly<Record<PropertyKey, unknown>> = Object.freeze({});
