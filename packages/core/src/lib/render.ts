import {
  clearComponentState,
  getAnonElemName,
  GLOBAL_STATE,
} from './global-state.js';
import { Teardowns } from './teardowns.js';
import { CompEl, CompRefs } from './types.js';
import { finalizeHookSlots } from './hooks/hook-slot.js';

export function render<P>(
  element: CompEl<P>,
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
      GLOBAL_STATE.currentCRCInstance!.refs.set(id, {
        id,
        parent,
        element,
        refs: [],
        hooks: [],
        teardowns,
        onAfterRender: undefined,
      });
    }

    const componentRefs = GLOBAL_STATE.currentCRCInstance!.refs.get(id)!;
    GLOBAL_STATE.componentRefs = componentRefs;
    GLOBAL_STATE.componentHookIndex = 0;

    componentRefs.element = element;

    const ctx = GLOBAL_STATE.renderContext!;
    ctx.save();
    try {
      const result = componentRefs.element.type(
        componentRefs.element.props,
        ctx,
      );
      finalizeHookSlots(componentRefs);

      const onAfterRender = componentRefs.onAfterRender;
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

      onAfterRender?.();
    } finally {
      ctx.restore();
    }
  } finally {
    clearComponentState();
  }
}

function getElementTypeName(element: CompEl, parentId: string): string {
  const typeIdentity = getAnonElemName(element.type);
  const typeName = element.type.name || 'Anonymous';
  const key = (element.props as { key?: string } | null | undefined)?.key;
  if (key === undefined) {
    return `${typeName}:${typeIdentity}`;
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
