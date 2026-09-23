import {
  clearComponentState,
  getAnonElemName,
  GLOBAL_STATE,
} from './global-state.js';
import { Teardowns } from './teardowns.js';
import { CRCComponentRefs } from './types.js';
import { finalizeHookSlots } from './hooks/hook-slot.js';
import { resolveElementStyle } from './style/resolve-dispatch.js';
import {
  enterElementEnhancers,
  exitElementEnhancers,
  reconcileElementEnhancers,
} from './element-enhancers.js';
import {
  getPlacementIdentityHint,
  getPrimitiveDefinition,
  getPrimitiveProgramProps,
  getPrimitiveReceiverToken,
  getElementSource,
} from './element/metadata.js';
import { materializeContainerChildren } from './element/children.js';
import { isFragmentElement } from './element/fragment.js';
import type { CRCElement, CRCNode } from './element/types.js';
import {
  backendMismatchError,
  type CRCBackendDriver,
  type CRCBackendFrame,
} from './backend/types.js';
import {
  collectSignalReads,
  createSignalRenderConsumer,
  disposeSignalRenderConsumer,
} from './signals/render-consumer.js';
import { untracked } from './signals/graph.js';
import { requestInstanceRender } from './scheduler/realm-scheduler.js';

export function render(
  node: CRCNode,
  parentId: string,
  parent: CRCComponentRefs<any> | undefined,
): void {
  const elements = materializeContainerChildren(node, 'CRC root');
  renderPreparedChildren(elements, parentId, parent);
}

function renderPreparedChildren(
  elements: readonly CRCElement<any>[],
  parentId: string,
  parent: CRCComponentRefs<any> | undefined,
): void {
  for (const element of elements) {
    renderPreparedElement(element, parentId, parent);
  }
}

function renderPreparedElement(
  element: CRCElement<any>,
  parentId: string,
  parent: CRCComponentRefs<any> | undefined,
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
  parent: CRCComponentRefs<any> | undefined,
): void {
  try {
    const componentRefs = prepareComponentScope(
      element,
      parentId,
      parent,
    );
    reconcileElementEnhancers(
      componentRefs,
      GLOBAL_STATE.currentCRCInstance!,
    );
    const enteredEnhancers = enterElementEnhancers(componentRefs);
    let enhancerSuccess = false;
    let releaseComponent: (() => void) | undefined;
    try {
      releaseComponent = enterBackendComponent();
      const children = materializeContainerChildren(
        (element.props as { children?: CRCNode }).children,
        element,
      );
      renderPreparedChildren(children, componentRefs.id, componentRefs);
      enhancerSuccess = true;
    } finally {
      try {
        releaseComponent?.();
      } finally {
        exitElementEnhancers(enteredEnhancers, enhancerSuccess);
      }
    }
  } finally {
    clearComponentState();
  }
}

function renderComponentElement<P>(
  element: CRCElement<P>,
  parentId: string,
  parent: CRCComponentRefs<any> | undefined,
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
    let releaseComponent: (() => void) | undefined;
    try {
      const { driver, frame } = requireBackendFrame();
      releaseComponent = driver.enterComponent(frame);
      let onAfterRender: (() => void) | undefined;
      let afterRenderFinished = false;
      const finishAfterRender = () => {
        if (afterRenderFinished) return;
        afterRenderFinished = true;
        onAfterRender ??= componentRefs.onAfterRender;
        componentRefs.onAfterRender = undefined;
        onAfterRender?.();
      };
      try {
        collectSignalReads(componentRefs.signalConsumer!, commitSignalReads => {
          const definition = getPrimitiveDefinition(componentRefs.element.type);
          const renderProgram = (invoke: () => CRCNode | void) => {
            try {
              const previousReceiverToken = GLOBAL_STATE.primitiveReceiverToken;
              GLOBAL_STATE.primitiveReceiverToken =
                getPrimitiveReceiverToken(componentRefs.element) ?? componentRefs;
              let result: CRCNode | void;
              try {
                result = invoke();
              } finally {
                GLOBAL_STATE.primitiveReceiverToken = previousReceiverToken;
              }
              finalizeHookSlots(componentRefs);

              onAfterRender = componentRefs.onAfterRender;
              componentRefs.onAfterRender = undefined;
              commitSignalReads();

              untracked(() => {
                const children = materializeContainerChildren(
                  result as CRCNode,
                  componentRefs.element,
                );
                renderPreparedChildren(children, id, componentRefs);
              });
            } finally {
              finishAfterRender();
            }
          };
          if (definition) {
            if (definition.backend !== driver.token) {
              throw backendMismatchError(
                componentRefs.element.type.name || 'Anonymous',
                definition.backend,
                driver,
                getElementSource(componentRefs.element),
              );
            }
            const receiverToken =
              getPrimitiveReceiverToken(componentRefs.element) ?? componentRefs;
            const style = (() => {
              const previousReceiverToken = GLOBAL_STATE.primitiveReceiverToken;
              GLOBAL_STATE.primitiveReceiverToken = receiverToken;
              try {
                return resolveElementStyle(componentRefs.element);
              } finally {
                GLOBAL_STATE.primitiveReceiverToken = previousReceiverToken;
              }
            })();
            let invoked = false;
            driver.runPrimitive(frame, {
              componentName: componentRefs.element.type.name || 'Anonymous',
              source: getElementSource(componentRefs.element),
              definition,
              props: getPrimitiveProgramProps(componentRefs.element),
              style,
            }, invoke => {
              if (invoked) {
                throw new Error(
                  `${driver.name} invoked ${componentRefs.element.type.name || 'Anonymous'} more than once in one traversal.`,
                );
              }
              invoked = true;
              renderProgram(invoke);
            });
            if (!invoked) {
              throw new Error(
                `${driver.name} did not invoke ${componentRefs.element.type.name || 'Anonymous'} during traversal.`,
              );
            }
          } else {
            renderProgram(() =>
              componentRefs.element.type(componentRefs.element.props)
            );
          }
        });
        componentRefs.signalConsumer!.markClean();
      } finally {
        try {
          finishAfterRender();
        } finally {
          releaseComponent?.();
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

function requireBackendFrame(): {
  driver: CRCBackendDriver<unknown>;
  frame: CRCBackendFrame<unknown>;
} {
  const driver = GLOBAL_STATE.backendDriver;
  const frame = GLOBAL_STATE.backendFrame;
  if (!driver || !frame) {
    throw new Error('CRC component traversal requires an active backend frame.');
  }
  return { driver, frame };
}

function enterBackendComponent(): () => void {
  const { driver, frame } = requireBackendFrame();
  return driver.enterComponent(frame);
}

function prepareComponentScope<P>(
  element: CRCElement<P>,
  parentId: string,
  parent: CRCComponentRefs<any> | undefined,
): CRCComponentRefs<P> {
  const crcInstance = GLOBAL_STATE.currentCRCInstance!;
  const typeName = getElementTypeName(element, parentId);
  const id = ensureUniqueId(parentId, typeName);
  GLOBAL_STATE.seenIds!.add(id);
  let componentRefs = crcInstance.refs.get(id) as
    CRCComponentRefs<P> | undefined;
  GLOBAL_STATE.componentIsMounting = componentRefs === undefined;
  if (componentRefs === undefined) {
    const teardowns = new Teardowns();
    teardowns.follow(crcInstance.mainTeardowns);
    const mountedRefs: CRCComponentRefs<P> = {
      id,
      parent,
      element,
      renderGeneration: crcInstance.renderGeneration,
      refs: [],
      hooks: [],
      signalConsumer: undefined,
      teardowns,
      onAfterRender: undefined,
    };
    if (!isFragmentElement(element)) {
      mountedRefs.signalConsumer = createSignalRenderConsumer({
        debugName: `${element.type.name || 'Anonymous'} (${id})`,
        invalidate: () => {
          if (
            GLOBAL_STATE.crcInstances.get(crcInstance.canvas) !== crcInstance ||
            crcInstance.mainTeardowns.closed ||
            mountedRefs.teardowns.closed ||
            crcInstance.refs.get(mountedRefs.id) !== mountedRefs
          ) {
            return;
          }
          requestInstanceRender(crcInstance);
        },
      });
      teardowns.add(() => {
        disposeSignalRenderConsumer(mountedRefs.signalConsumer!);
      });
    }
    crcInstance.refs.set(id, mountedRefs);
    componentRefs = mountedRefs;
  }

  componentRefs.parent = parent;
  componentRefs.element = element;
  componentRefs.renderGeneration = crcInstance.renderGeneration;
  return componentRefs;
}

function getElementTypeName(element: CRCElement<any>, parentId: string): string {
  const identityHint = getPlacementIdentityHint<{
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
