import { isCRCElement } from './create-element.js';
import { isFragmentElement } from './fragment.js';
import {
  getElementPolicyDefinition,
  getPolicyPreparationSource,
  getElementSource,
  setPolicyPreparationSource,
} from './metadata.js';
import type {
  CRCElement,
  CRCNode,
  CRCTextChild,
} from './types.js';

type ChildReceiver = string | CRCElement<any>;

const REACT_ELEMENT_TYPE = Symbol.for('react.element');
const REACT_TRANSITIONAL_ELEMENT_TYPE = Symbol.for(
  'react.transitional.element',
);

/**
 * Materializes one receiver's recursive container input into direct elements.
 * Arrays and unkeyed Fragments are transparent; keyed Fragments remain entries.
 */
export function materializeContainerChildren(
  node: CRCNode,
  receiver: ChildReceiver,
  options: Readonly<{ validateKeys?: boolean }> = {},
): readonly CRCElement<any>[] {
  const elements: CRCElement<any>[] = [];
  visitContainerNode(node, receiver, elements);
  if (options.validateKeys !== false) assertUniqueKeys(elements, receiver);
  return Object.freeze(elements);
}

/** Prepares a policy descriptor for APIs that receive one element directly. */
export function prepareElementPolicies(
  element: CRCElement<any>,
  receiver: string,
): CRCElement<any> {
  if (!getElementPolicyDefinition(element.type)) return element;
  const [prepared] = materializeContainerChildren(element, receiver);
  return prepared;
}

/** Materializes Text's recursive scalar content into one reusable string. */
export function materializeTextChildren(
  node: CRCTextChild,
  receiver: ChildReceiver,
): string {
  const parts: string[] = [];
  visitTextNode(node, receiver, parts);
  return parts.join('');
}

function visitContainerNode(
  node: unknown,
  receiver: ChildReceiver,
  elements: CRCElement<any>[],
  pendingPolicies: readonly CRCElement<any>[] = [],
  preservePolicies = false,
): void {
  if (
    node === false ||
    node === true ||
    node === null ||
    node === undefined ||
    node === '' ||
    Object.is(node, 0) ||
    Object.is(node, -0)
  ) {
    return;
  }

  if (isCRCElement(node)) {
    const policy = getElementPolicyDefinition(node.type);
    if (policy) {
      if (preservePolicies) {
        elements.push(node);
        return;
      }
      const policyChildren = materializeUnpreparedPolicyChildren(
        (node.props as { readonly children?: CRCNode }).children,
        node,
      );
      if (policyChildren.length !== 1) {
        throw new Error(
          `${describeReceiver(node)} requires exactly one CRC element child ` +
          `after empty values are removed; received ${policyChildren.length}.`,
        );
      }
      visitContainerNode(
        policyChildren[0],
        node,
        elements,
        [...pendingPolicies, node],
      );
      return;
    }
    if (isFragmentElement(node) && node.key === undefined) {
      visitContainerNode(
        node.props.children,
        node,
        elements,
        pendingPolicies,
        preservePolicies,
      );
      return;
    }
    let prepared = node;
    const preparationSource = getPolicyPreparationSource(node) ?? node;
    for (const pendingPolicy of pendingPolicies) {
      const definition = getElementPolicyDefinition(pendingPolicy.type);
      if (!definition) {
        throw new Error('CRC policy preparation metadata was lost.');
      }
      prepared = definition.prepare(pendingPolicy, prepared);
    }
    if (prepared !== node) {
      setPolicyPreparationSource(prepared, preparationSource);
    }
    elements.push(prepared);
    return;
  }

  if (typeof node === 'string') {
    throw invalidChild(receiver, 'a non-empty string');
  }
  if (typeof node === 'number') {
    throw invalidChild(receiver, 'a nonzero number');
  }
  if (typeof node === 'function') {
    throw invalidChild(receiver, 'a function');
  }
  if (typeof node === 'symbol') {
    throw invalidChild(receiver, 'a symbol');
  }
  if (typeof node !== 'object') {
    throw invalidChild(receiver, `an unsupported ${typeof node} value`);
  }

  if (isReactElement(node)) {
    throw reactElementError(receiver);
  }
  if (isPromiseLike(node)) {
    throw invalidChild(receiver, 'a Promise');
  }
  if (isAsyncIterable(node)) {
    throw invalidChild(receiver, 'an async iterable');
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      visitContainerNode(
        child,
        receiver,
        elements,
        pendingPolicies,
        preservePolicies,
      );
    }
    return;
  }
  if (isIterable(node)) {
    for (const child of node) {
      visitContainerNode(
        child,
        receiver,
        elements,
        pendingPolicies,
        preservePolicies,
      );
    }
    return;
  }

  throw invalidChild(receiver, 'an unsupported object');
}

function materializeUnpreparedPolicyChildren(
  node: CRCNode,
  receiver: CRCElement<any>,
): readonly CRCElement<any>[] {
  const elements: CRCElement<any>[] = [];
  visitContainerNode(node, receiver, elements, [], true);
  assertUniqueKeys(elements, receiver);
  return Object.freeze(elements);
}

function visitTextNode(
  node: unknown,
  receiver: ChildReceiver,
  parts: string[],
): void {
  if (
    node === false ||
    node === true ||
    node === null ||
    node === undefined
  ) {
    return;
  }
  if (typeof node === 'string' || typeof node === 'number') {
    parts.push(String(node));
    return;
  }
  if (isCRCElement(node)) {
    throw invalidChild(receiver, 'a CRC element inside textual content');
  }
  if (typeof node === 'function') {
    throw invalidChild(receiver, 'a function');
  }
  if (typeof node === 'symbol') {
    throw invalidChild(receiver, 'a symbol');
  }
  if (typeof node !== 'object') {
    throw invalidChild(receiver, `an unsupported ${typeof node} value`);
  }
  if (isReactElement(node)) {
    throw reactElementError(receiver);
  }
  if (isPromiseLike(node)) {
    throw invalidChild(receiver, 'a Promise');
  }
  if (isAsyncIterable(node)) {
    throw invalidChild(receiver, 'an async iterable');
  }
  if (Array.isArray(node)) {
    for (const child of node) visitTextNode(child, receiver, parts);
    return;
  }
  if (isIterable(node)) {
    for (const child of node) visitTextNode(child, receiver, parts);
    return;
  }
  throw invalidChild(receiver, 'an unsupported object');
}

function assertUniqueKeys(
  elements: readonly CRCElement<any>[],
  receiver: ChildReceiver,
): void {
  const keys = new Set<string>();
  for (const element of elements) {
    const key = element.key;
    if (key === undefined) continue;
    if (keys.has(key)) {
      throw invalidChild(receiver, `duplicate CRC key "${key}"`);
    }
    keys.add(key);
  }
}

function invalidChild(receiver: ChildReceiver, description: string): Error {
  return new Error(
    `${describeReceiver(receiver)} received ${description} as a CRC child.`,
  );
}

function reactElementError(receiver: ChildReceiver): Error {
  return new Error(
    'CRC received a React element. This file is using the React JSX runtime.\n' +
    'Set jsxImportSource to "@crc/core" or add ' +
    '/** @jsxImportSource @crc/core */.\n' +
    `Received by ${describeReceiver(receiver)}.`,
  );
}

function describeReceiver(receiver: ChildReceiver): string {
  if (typeof receiver === 'string') return receiver;
  const name = receiver.type.name || 'Anonymous';
  const source = getElementSource(receiver);
  return source ?
      `${name} at ${source.fileName}:${source.lineNumber}:${source.columnNumber}` :
    name;
}

function isReactElement(value: object): boolean {
  const brand = (value as { $$typeof?: unknown }).$$typeof;
  return brand === REACT_ELEMENT_TYPE ||
    brand === REACT_TRANSITIONAL_ELEMENT_TYPE;
}

function isPromiseLike(value: object): boolean {
  return typeof (value as { then?: unknown }).then === 'function';
}

function isAsyncIterable(value: object): boolean {
  return typeof (value as { [Symbol.asyncIterator]?: unknown })[
    Symbol.asyncIterator
  ] === 'function';
}

function isIterable(value: object): value is Iterable<unknown> {
  return typeof (value as { [Symbol.iterator]?: unknown })[
    Symbol.iterator
  ] === 'function';
}
