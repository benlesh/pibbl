import {
  clearComponentState,
  getAnonElemName,
  GLOBAL_STATE,
} from './global-state.js';
import { Teardowns } from './teardowns.js';
import { CompEl, CompRefs, SystemStyle } from './types.js';
import { finalizeHookSlots } from './hooks/hook-slot.js';
import { resolveElementStyle } from './style/resolve-dispatch.js';
import {
  disposeElementEnhancers,
  enterElementEnhancers,
  exitElementEnhancers,
  reconcileElementEnhancers,
} from './element-enhancers.js';

export function render<P, S extends SystemStyle>(
  element: CompEl<P, S>,
  parentId: string,
  parent: CompRefs<any> | undefined,
): void {
  try {
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
      teardowns.add(() => disposeElementEnhancers(componentRefs));
      GLOBAL_STATE.currentCRCInstance!.refs.set(id, componentRefs);
    }

    const componentRefs = GLOBAL_STATE.currentCRCInstance!.refs.get(id)!;
    GLOBAL_STATE.componentRefs = componentRefs;
    GLOBAL_STATE.componentHookIndex = 0;

    componentRefs.element = element;

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
        const result = componentRefs.element.type(
          componentRefs.element.props,
          resolveElementStyle(componentRefs.element),
          ctx,
        );
        finalizeHookSlots(componentRefs);

        onAfterRender = componentRefs.onAfterRender;
        componentRefs.onAfterRender = undefined;

        if (result) {
          if (Array.isArray(result)) {
            for (let i = 0; i < result.length; i++) {
              const child = result[i];
              if (child) {
                ctx.save();
                try {
                  render(child, id, componentRefs);
                } finally {
                  ctx.restore();
                }
              }
            }
          } else {
            ctx.save();
            try {
              render(result, id, componentRefs);
            } finally {
              ctx.restore();
            }
          }
        }
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

function getElementTypeName(element: CompEl<any, any>, parentId: string): string {
  const identityHint = element.identityHint;
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
