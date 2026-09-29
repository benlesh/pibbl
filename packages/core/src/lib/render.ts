import {
  clearComponentState,
  getAnonElemName,
  GLOBAL_STATE,
} from './global-state.js';
import { Teardowns } from './teardowns.js';
import { CRCComponentRefs } from './types.js';
import { finalizeHookSlots } from './hooks/hook-slot.js';
import { resolveElementStyle, takePreNormalizedStyle } from './style/resolve-dispatch.js';
import {
  getPlacementSignalHandoff,
  enterPlacementHandoffCapture,
  withPlacementHandoff,
} from './style/positioning.js';
import {
  enterElementEnhancers,
  exitElementEnhancers,
  hasElementEnhancers,
  prepareElementEnhancers,
  reconcileElementEnhancers,
} from './element-enhancers.js';
import {
  getPlacementIdentityHint,
  getPrimitiveDefinition,
  getPrimitiveReceiverToken,
  getElementSource,
  isPlacementConsumed,
} from './element/metadata.js';
import { resolvePrimitiveInputs } from './element/resolve-primitive-inputs.js';
import { materializeContainerChildren } from './element/children.js';
import { isFragmentElement } from './element/fragment.js';
import type { CRCElement, CRCNode, CRCNodeInput } from './element/types.js';
import {
  backendMismatchError,
  type CRCBackendDriver,
  type CRCBackendFrame,
} from './backend/types.js';
import {
  collectComponentSignalReads,
  disposeSignalRenderConsumer,
} from './signals/render-consumer.js';
import { adoptReceiverInputProvision } from './signals/input-provision.js';
import { untracked } from './signals/graph.js';
import { requestInstanceRender } from './scheduler/realm-scheduler.js';
import {
  getCurrentWorldTransform,
  hasCurrentWorldTransformCanvasDelta,
} from './render-target.js';

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
      collectComponentSignalReads(
        componentRefs,
        () => componentSignalReadOptions(componentRefs),
        commitSignalReads => {
          const receiverToken =
            getPrimitiveReceiverToken(componentRefs.element) ?? componentRefs;
          adoptReceiverInputProvision(
            GLOBAL_STATE.renderTransaction,
            receiverToken,
          );
          const children = materializeContainerChildren(
            element.props.children,
            element,
          );
          commitSignalReads();
          untracked(() => {
            renderPreparedChildren(children, componentRefs.id, componentRefs);
          });
        },
      );
      componentRefs.signalConsumer?.markClean();
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
    const definition = getPrimitiveDefinition(componentRefs.element.type);
    const receiverToken =
      getPrimitiveReceiverToken(componentRefs.element) ?? componentRefs;

    reconcileElementEnhancers(
      componentRefs,
      GLOBAL_STATE.currentCRCInstance!,
      definition !== undefined,
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
        collectComponentSignalReads(componentRefs, () => ({
          ...componentSignalReadOptions(componentRefs),
        }), commitSignalReads => {
          adoptReceiverInputProvision(
            GLOBAL_STATE.renderTransaction,
            receiverToken,
          );
          const renderProgram = (invoke: () => CRCNodeInput | void) => {
            try {
              const previousReceiverToken = GLOBAL_STATE.primitiveReceiverToken;
              GLOBAL_STATE.primitiveReceiverToken = receiverToken;
              let result: CRCNodeInput | void;
              try {
                result = invoke();
              } finally {
                GLOBAL_STATE.primitiveReceiverToken = previousReceiverToken;
              }
              finalizeHookSlots(componentRefs);

              onAfterRender = componentRefs.onAfterRender;
              componentRefs.onAfterRender = undefined;
              const children = materializeContainerChildren(
                result as CRCNodeInput,
                componentRefs.element,
              );
              commitSignalReads();

              untracked(() => {
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
            const preparedStyle = takePreNormalizedStyle(componentRefs.element);
            const inputs = resolvePrimitiveInputs(
              componentRefs.element,
              definition,
              preparedStyle,
            );
            const style = (() => {
              const previousReceiverToken = GLOBAL_STATE.primitiveReceiverToken;
              GLOBAL_STATE.primitiveReceiverToken = receiverToken;
              try {
                return resolveElementStyle(
                  componentRefs.element,
                  inputs.style,
                  true,
                  preparedStyle,
                );
              } finally {
                GLOBAL_STATE.primitiveReceiverToken = previousReceiverToken;
              }
            })();
            const componentName = componentRefs.element.type.name || 'Anonymous';
            const source = getElementSource(componentRefs.element);
            const props = inputs.props;
            const tracksPresentationLineage = hasElementEnhancers(componentRefs);
            const tracksCanvasWorldTransform =
              GLOBAL_STATE.worldBaseTransform !== undefined &&
              GLOBAL_STATE.renderContext !== undefined &&
              GLOBAL_STATE.renderTarget !== undefined;
            const prepared = tracksPresentationLineage
              ? prepareElementEnhancers(componentRefs, {
                  componentType: componentRefs.element.type,
                  componentName,
                  props,
                  style,
                  source,
                  parentWorldTransform: tracksCanvasWorldTransform ?
                    getCurrentWorldTransform() : new DOMMatrix(),
                  presentationTransformLineage:
                    GLOBAL_STATE.presentationTransformLineage,
                  hasUntrackedCanvasTransform: tracksCanvasWorldTransform &&
                    hasCurrentWorldTransformCanvasDelta(),
                })
              : undefined;
            let invoked = false;
            if (tracksPresentationLineage) {
              GLOBAL_STATE.presentationTransformLineageTrackingDepth += 1;
            }
            try {
              driver.runPrimitive(frame, {
                componentName,
                source,
                definition,
                props,
                style,
                presentationTransform2D: prepared?.presentationTransform2D,
              }, invoke => {
                if (invoked) {
                  throw new Error(
                    `${driver.name} invoked ${componentName} more than once in one traversal.`,
                  );
                }
                invoked = true;
                renderProgram(invoke);
              });
            } finally {
              if (tracksPresentationLineage) {
                GLOBAL_STATE.presentationTransformLineageTrackingDepth -= 1;
              }
            }
            if (!invoked) {
              throw new Error(
                `${driver.name} did not invoke ${componentName} during traversal.`,
              );
            }
          } else {
            // Layout owns the outer translation. A private marker survives one
            // intentional `{ ...style }` forward without changing other children.
            const preparedStyle = takePreNormalizedStyle(componentRefs.element);
            const signalHandoff = getPlacementSignalHandoff(componentRefs.element);
            const consumedStyle = preparedStyle?.style ?? signalHandoff;
            const receivesPlacementHandoff =
              isPlacementConsumed(componentRefs.element) ||
              signalHandoff !== undefined;
            const props = isPlacementConsumed(componentRefs.element) ?
              withPlacementHandoff(componentRefs.element.props, consumedStyle) :
              componentRefs.element.props;
            renderProgram(() => {
              const releaseHandoff = receivesPlacementHandoff ?
                enterPlacementHandoffCapture(props, consumedStyle) :
                undefined;
              try {
                return componentRefs.element.type(props);
              } finally {
                releaseHandoff?.();
              }
            });
          }
        });
        componentRefs.signalConsumer?.markClean();
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

function componentSignalReadOptions(
  componentRefs: CRCComponentRefs<any>,
) {
  const crcInstance = GLOBAL_STATE.currentCRCInstance!;
  return {
    debugName: `${componentRefs.element.type.name || 'Anonymous'} (${componentRefs.id})`,
    invalidate: () => {
      if (
        GLOBAL_STATE.crcInstances.get(crcInstance.canvas) !== crcInstance ||
        crcInstance.mainTeardowns.closed ||
        componentRefs.teardowns.closed ||
        crcInstance.refs.get(componentRefs.id) !== componentRefs
      ) {
        return;
      }
      requestInstanceRender(crcInstance);
    },
    onMaterialize: () => {
      if (componentRefs.signalConsumerTeardownAttached) return;
      componentRefs.signalConsumerTeardownAttached = true;
      componentRefs.teardowns.add(() => {
        const consumer = componentRefs.signalConsumer;
        componentRefs.signalConsumer = undefined;
        if (consumer !== undefined) {
          disposeSignalRenderConsumer(consumer);
        }
      });
    },
  };
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
      signalConsumerTeardownAttached: false,
      teardowns,
      onAfterRender: undefined,
    };
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
