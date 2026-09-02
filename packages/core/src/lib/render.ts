import {
  clearComponentState,
  getAnonElemName,
  GLOBAL_STATE,
} from './global-state.js';
import { Teardowns } from './teardowns.js';
import { CompRefs } from './types.js';
import { finalizeHookSlots } from './hooks/hook-slot.js';
import { resolveElementStyle } from './style/resolve-dispatch.js';
import {
  enterElementEnhancers,
  exitElementEnhancers,
  reconcileElementEnhancers,
} from './element-enhancers.js';
import {
  getLegacyIdentityHint,
  getPrimitiveDefinition,
  getPrimitiveProgramProps,
  getPrimitiveReceiverToken,
} from './element/metadata.js';
import { materializeContainerChildren } from './element/children.js';
import { isFragmentElement } from './element/fragment.js';
import type { CRCElement, CRCNode } from './element/types.js';

export function render(
  node: CRCNode,
  parentId: string,
  parent: CompRefs<any> | undefined,
): void {
  const elements = materializeContainerChildren(node, 'CRC root');
  renderPreparedChildren(elements, parentId, parent, false);
}

function renderPreparedChildren(
  elements: readonly CRCElement<any>[],
  parentId: string,
  parent: CompRefs<any> | undefined,
  isolate: boolean,
): void {
  const ctx = GLOBAL_STATE.renderContext!;
  for (const element of elements) {
    if (!isolate) {
      renderPreparedElement(element, parentId, parent);
      continue;
    }
    ctx.save();
    try {
      renderPreparedElement(element, parentId, parent);
    } finally {
      ctx.restore();
    }
  }
}

function renderPreparedElement(
  element: CRCElement<any>,
  parentId: string,
  parent: CompRefs<any> | undefined,
): void {
  if (isFragmentElement(element)) {
    renderKeyedFragment(element, parentId, parent);
    return;
  }
  renderComponentElement(element, parentId, parent);
}

function renderKeyedFragment(
  element: CRCElement<any>,
  parentId: string,
  parent: CompRefs<any> | undefined,
): void {
  try {
    const componentRefs = prepareComponentScope(
      element,
      parentId,
      parent,
    );
    const children = materializeContainerChildren(
      (element.props as { children?: CRCNode }).children,
      element,
    );
    renderPreparedChildren(children, componentRefs.id, componentRefs, true);
  } finally {
    clearComponentState();
  }
}

function renderComponentElement<P>(
  element: CRCElement<P>,
  parentId: string,
  parent: CompRefs<any> | undefined,
): void {
  try {
    const componentRefs = prepareComponentScope(element, parentId, parent);
    const id = componentRefs.id;
    GLOBAL_STATE.componentRefs = componentRefs;
    GLOBAL_STATE.componentHookIndex = 0;

    reconcileElementEnhancers(
      componentRefs,
      GLOBAL_STATE.currentCRCInstance!,
    );
    const enteredEnhancers = enterElementEnhancers(componentRefs);
    let enhancerSuccess = false;

    const ctx = GLOBAL_STATE.renderContext!;
    try {
      ctx.save();
      let onAfterRender: (() => void) | undefined;
      try {
        const definition = getPrimitiveDefinition(componentRefs.element.type);
        let result: CRCNode | void;
        if (definition) {
          const previousReceiverToken = GLOBAL_STATE.primitiveReceiverToken;
          GLOBAL_STATE.primitiveReceiverToken =
            getPrimitiveReceiverToken(componentRefs.element) ?? componentRefs;
          try {
            result = definition.render(
              getPrimitiveProgramProps(componentRefs.element),
              resolveElementStyle(componentRefs.element),
              ctx,
            ) as CRCNode;
          } finally {
            GLOBAL_STATE.primitiveReceiverToken = previousReceiverToken;
          }
        } else {
          result = componentRefs.element.type(componentRefs.element.props);
        }
        finalizeHookSlots(componentRefs);

        onAfterRender = componentRefs.onAfterRender;
        componentRefs.onAfterRender = undefined;

        const children = materializeContainerChildren(
          result as CRCNode,
          componentRefs.element,
        );
        renderPreparedChildren(children, id, componentRefs, true);
      } finally {
        onAfterRender ??= componentRefs.onAfterRender;
        componentRefs.onAfterRender = undefined;
        try {
          onAfterRender?.();
        } finally {
          ctx.restore();
        }
      }
      enhancerSuccess = true;
    } finally {
      exitElementEnhancers(enteredEnhancers, enhancerSuccess);
    }
  } finally {
    clearComponentState();
  }
}

function prepareComponentScope<P>(
  element: CRCElement<P>,
  parentId: string,
  parent: CompRefs<any> | undefined,
): CompRefs<P> {
  const typeName = getElementTypeName(element, parentId);
  const id = ensureUniqueId(parentId, typeName);
  GLOBAL_STATE.unseenIds!.delete(id);
  GLOBAL_STATE.seenIds!.add(id);
  GLOBAL_STATE.componentIsMounting =
    !GLOBAL_STATE.currentCRCInstance!.refs.has(id);
  if (GLOBAL_STATE.componentIsMounting) {
    const teardowns = new Teardowns();
    teardowns.follow(GLOBAL_STATE.currentCRCInstance!.mainTeardowns);
    const componentRefs: CompRefs<P> = {
      id,
      parent,
      element,
      refs: [],
      hooks: [],
      teardowns,
      onAfterRender: undefined,
    };
    GLOBAL_STATE.currentCRCInstance!.refs.set(id, componentRefs);
  }

  const componentRefs = GLOBAL_STATE.currentCRCInstance!.refs.get(id)!;
  componentRefs.parent = parent;
  componentRefs.element = element;
  return componentRefs;
}

function getElementTypeName(element: CRCElement<any>, parentId: string): string {
  const identityHint = getLegacyIdentityHint<{
    type: CRCElement<any>['type'];
    key: string | undefined;
    occurrence: number;
  }>(element);
  const identityType = identityHint?.type ?? element.type;
  const typeIdentity = getAnonElemName(identityType);
  const typeName = identityType.name || 'Anonymous';
  const key = identityHint ? identityHint.key : element.key;
  if (key === undefined) {
    const occurrence = identityHint?.occurrence ?? 0;
    return `${typeName}:${typeIdentity}${occurrence ? `_${occurrence}` : ''}`;
  }

  const encodedKey = encodeURIComponent(key);
  const siblingKey = `${parentId}/${encodedKey}`;
  if (GLOBAL_STATE.seenKeys!.has(siblingKey)) {
    throw new Error(`Duplicate CRC key "${key}" under "${parentId}"`);
  }
  GLOBAL_STATE.seenKeys!.add(siblingKey);
  return `${typeName}:${typeIdentity}[${encodedKey}]`;
}

function ensureUniqueId(parentId: string, typeName: string) {
  let id = `${parentId}/${typeName}`;
  let n = 1;
  while (GLOBAL_STATE.seenIds!.has(id)) {
    id = `${parentId}/${typeName}_${n++}`;
  }
  return id;
}
