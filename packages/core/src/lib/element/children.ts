import { isPibblElement } from './create-element.js';
import { isFragmentElement } from './fragment.js';
import {
  getElementPolicyDefinition,
  getPolicyPreparationSource,
  getElementSource,
  setPolicyPreparationSource,
} from './metadata.js';
import type {
  PibblElement,
  PibblNodeInput,
  PibblTextInput,
} from './types.js';
import { isSignal } from '../signals/graph.js';

type ChildReceiver = string | PibblElement<any>;

const REACT_ELEMENT_TYPE = Symbol.for('react.element');
const REACT_TRANSITIONAL_ELEMENT_TYPE = Symbol.for(
  'react.transitional.element',
);

/** Rejects a directly supplied foreign JSX root before Pibbl acquires resources. */
export function assertCompatibleRootNode(node: unknown): void {
  if (isSignal(node)) {
    throw new Error(
      'Pibbl root received a signal without a component receiver. ' +
      'Place the signal under a component or read it explicitly.',
    );
  }
  if (!node || typeof node !== 'object' || isPibblElement(node)) return;
  if (isReactElement(node)) throw reactElementError('Pibbl root');
  if (
    !isPromiseLike(node) &&
    !isAsyncIterable(node) &&
    !Array.isArray(node) &&
    !isIterable(node) &&
    isForeignElementLike(node)
  ) {
    throw foreignElementError('Pibbl root');
  }
}

/**
 * Materializes one receiver's recursive container input into direct elements.
 * Arrays and unkeyed Fragments are transparent; keyed Fragments remain entries.
 */
export function materializeContainerChildren(
  node: PibblNodeInput,
  receiver: ChildReceiver,
  options: Readonly<{ validateKeys?: boolean }> = {},
): readonly PibblElement<any>[] {
  const elements: PibblElement<any>[] = [];
  visitContainerNode(node, receiver, elements, [], false, true, new Set());
  if (options.validateKeys !== false) assertUniqueKeys(elements, receiver);
  return Object.freeze(elements);
}

/** Prepares a policy descriptor for APIs that receive one element directly. */
export function prepareElementPolicies(
  element: PibblElement<any>,
  receiver: string,
): PibblElement<any> {
  if (!getElementPolicyDefinition(element.type)) return element;
  const [prepared] = materializeContainerChildren(element, receiver);
  return prepared;
}

/** Materializes Text's recursive scalar content into one reusable string. */
export function materializeTextChildren(
  node: PibblTextInput,
  receiver: ChildReceiver,
): string {
  const parts: string[] = [];
  visitTextNode(node, receiver, parts, true, new Set());
  return parts.join('');
}

function visitContainerNode(
  node: unknown,
  receiver: ChildReceiver,
  elements: PibblElement<any>[],
  pendingPolicies: readonly PibblElement<any>[] = [],
  preservePolicies = false,
  allowSignals = true,
  ancestors: Set<object>,
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

  if (isSignal(node)) {
    if (receiver === 'Pibbl root') {
      throw new Error(
        'Pibbl root received a signal without a component receiver. ' +
        'Place the signal under a component or read it explicitly.',
      );
    }
    if (!allowSignals) throw nestedSignalChild(receiver);
    visitContainerNode(
      node.get(),
      receiver,
      elements,
      pendingPolicies,
      preservePolicies,
      false,
      ancestors,
    );
    return;
  }

  if (isPibblElement(node)) {
    const policy = getElementPolicyDefinition(node.type);
    if (policy) {
      if (preservePolicies) {
        elements.push(node);
        return;
      }
      const policyChildren = materializeUnpreparedPolicyChildren(
        (node.props as { readonly children?: PibblNodeInput }).children,
        node,
        allowSignals,
        ancestors,
      );
      if (policyChildren.length !== 1) {
        throw new Error(
          `${describeReceiver(node)} requires exactly one Pibbl element child ` +
          `after empty values are removed; received ${policyChildren.length}.`,
        );
      }
      visitContainerNode(
        policyChildren[0],
        node,
        elements,
        [...pendingPolicies, node],
        preservePolicies,
        allowSignals,
        ancestors,
      );
      return;
    }
    if (isFragmentElement(node) && node.key === undefined) {
      visitContainerNode(
        node.props.children,
        receiver,
        elements,
        pendingPolicies,
        preservePolicies,
        allowSignals,
        ancestors,
      );
      return;
    }
    let prepared = node;
    const preparationSource = getPolicyPreparationSource(node) ?? node;
    for (const pendingPolicy of pendingPolicies) {
      const definition = getElementPolicyDefinition(pendingPolicy.type);
      if (!definition) {
        throw new Error('Pibbl policy preparation metadata was lost.');
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
    withAcyclicContainer(node, receiver, ancestors, () => {
      for (const child of node) {
        visitContainerNode(
          child,
          receiver,
          elements,
          pendingPolicies,
          preservePolicies,
          allowSignals,
          ancestors,
        );
      }
    });
    return;
  }
  if (isIterable(node)) {
    withAcyclicContainer(node, receiver, ancestors, () => {
      for (const child of node) {
        visitContainerNode(
          child,
          receiver,
          elements,
          pendingPolicies,
          preservePolicies,
          allowSignals,
          ancestors,
        );
      }
    });
    return;
  }
  if (isForeignElementLike(node)) {
    throw foreignElementError(receiver);
  }

  throw invalidChild(receiver, 'an unsupported object');
}

function materializeUnpreparedPolicyChildren(
  node: PibblNodeInput,
  receiver: PibblElement<any>,
  allowSignals: boolean,
  ancestors: Set<object>,
): readonly PibblElement<any>[] {
  const elements: PibblElement<any>[] = [];
  visitContainerNode(
    node,
    receiver,
    elements,
    [],
    true,
    allowSignals,
    ancestors,
  );
  assertUniqueKeys(elements, receiver);
  return Object.freeze(elements);
}

function visitTextNode(
  node: unknown,
  receiver: ChildReceiver,
  parts: string[],
  allowSignals: boolean,
  ancestors: Set<object>,
): void {
  if (
    node === false ||
    node === true ||
    node === null ||
    node === undefined
  ) {
    return;
  }
  if (isSignal(node)) {
    if (!allowSignals) throw nestedSignalChild(receiver);
    visitTextNode(node.get(), receiver, parts, false, ancestors);
    return;
  }
  if (typeof node === 'string' || typeof node === 'number') {
    parts.push(String(node));
    return;
  }
  if (isPibblElement(node)) {
    throw invalidChild(receiver, 'a Pibbl element inside textual content');
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
    withAcyclicContainer(node, receiver, ancestors, () => {
      for (const child of node) {
        visitTextNode(child, receiver, parts, allowSignals, ancestors);
      }
    });
    return;
  }
  if (isIterable(node)) {
    withAcyclicContainer(node, receiver, ancestors, () => {
      for (const child of node) {
        visitTextNode(child, receiver, parts, allowSignals, ancestors);
      }
    });
    return;
  }
  if (isForeignElementLike(node)) {
    throw foreignElementError(receiver);
  }
  throw invalidChild(receiver, 'an unsupported object');
}

function assertUniqueKeys(
  elements: readonly PibblElement<any>[],
  receiver: ChildReceiver,
): void {
  const keys = new Set<string>();
  for (const element of elements) {
    const key = element.key;
    if (key === undefined) continue;
    if (keys.has(key)) {
      throw invalidChild(receiver, `duplicate Pibbl key "${key}"`);
    }
    keys.add(key);
  }
}

function invalidChild(receiver: ChildReceiver, description: string): Error {
  return new Error(
    `${describeReceiver(receiver)} received ${description} as a Pibbl child.`,
  );
}

function nestedSignalChild(receiver: ChildReceiver): Error {
  return invalidChild(
    receiver,
    'a signal inside a signal-resolved child structure',
  );
}

function withAcyclicContainer<T extends object>(
  value: T,
  receiver: ChildReceiver,
  ancestors: Set<object>,
  visit: () => void,
): void {
  if (ancestors.has(value)) {
    throw invalidChild(receiver, 'a cyclic child structure');
  }
  ancestors.add(value);
  try {
    visit();
  } finally {
    ancestors.delete(value);
  }
}

function reactElementError(receiver: ChildReceiver): Error {
  return new Error(
    'Pibbl received a React element. This file is using the React JSX runtime.\n' +
    'Set jsxImportSource to "@pibbl/core" or add ' +
    '/** @jsxImportSource @pibbl/core */.\n' +
    `Received by ${describeReceiver(receiver)}.`,
  );
}

function foreignElementError(receiver: ChildReceiver): Error {
  return new Error(
    `${describeReceiver(receiver)} received an element-like object that was ` +
    'not created by @pibbl/core as a Pibbl child.\n' +
    'Check this file\'s JSX runtime and set jsxImportSource to "@pibbl/core".',
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

function isForeignElementLike(value: object): boolean {
  if (
    !Object.prototype.hasOwnProperty.call(value, 'type') ||
    !Object.prototype.hasOwnProperty.call(value, 'props')
  ) {
    return false;
  }
  try {
    const type = (value as { type?: unknown }).type;
    const props = (value as { props?: unknown }).props;
    return (
      (typeof type === 'function' ||
        typeof type === 'string' ||
        typeof type === 'symbol') &&
      (props === null || typeof props === 'object')
    );
  } catch {
    return false;
  }
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
