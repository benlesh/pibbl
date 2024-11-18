import {
  clearComponentState,
  getAnonElemName,
  GLOBAL_STATE,
} from './global-state';
import { Teardowns } from './teardowns';
import { CompEl, CompRefs } from './types';

export function render<P>(
  element: CompEl<P>,
  parentId: string,
  parent: CompRefs<any> | undefined,
): void {
  try {
    const typeName = getElementTypeName(element);
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
        teardowns,
        onAfterRender: undefined,
      });
    }

    GLOBAL_STATE.componentRefs = GLOBAL_STATE.currentCRCInstance!.refs.get(id)!;
    GLOBAL_STATE.componentHookIndex = 0;

    GLOBAL_STATE.componentRefs.element = element;

    const ctx = GLOBAL_STATE.renderContext!;
    ctx.save();
    const result = GLOBAL_STATE.componentRefs.element.type(
      GLOBAL_STATE.componentRefs.element.props,
      ctx,
    );

    const onAfterRender = GLOBAL_STATE.componentRefs.onAfterRender;
    GLOBAL_STATE.componentRefs.onAfterRender = undefined;

    if (result) {
      if (Array.isArray(result)) {
        for (let i = 0; i < result.length; i++) {
          const child = result[i];
          if (child) {
            ctx.save();
            render(child, id, GLOBAL_STATE.componentRefs);
            ctx.restore();
          }
        }
      } else {
        ctx.save();
        render(result, id, GLOBAL_STATE.componentRefs);
        ctx.restore();
      }
    }

    onAfterRender?.();

    ctx.restore();
  } finally {
    clearComponentState();
  }
}

function getElementTypeName(element: CompEl): string {
  return (
    element.props.key || element.type.name || getAnonElemName(element.type)
  );
}

function ensureUniqueId(parentId: string, typeName: string) {
  let id = `${parentId}/${typeName}`;
  let n = 1;
  while (GLOBAL_STATE.seenIds!.has(id)) {
    id = `${parentId}/${typeName}_${n++}`;
  }
  return id;
}
