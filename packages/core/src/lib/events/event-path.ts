import type {
  PibblEventNode,
} from './registrations.js';
import { GLOBAL_STATE } from '../global-state.js';
import type { PibblComponentRefs, PibblInstance } from '../types.js';

interface PibblEventPathComponent {
  readonly component: PibblComponentRefs<any>;
  readonly owner: PibblInstance;
}

/** Builds one immutable root-to-target snapshot for a logical dispatch. */
export function buildEventPath(
  target: PibblEventNode,
): readonly PibblEventNode[] {
  const components: PibblEventPathComponent[] = [];
  let owner = target.owner;
  let component: PibblComponentRefs<any> | undefined = target.component;
  while (component) {
    components.push({ component, owner });
    if (component.parent) {
      component = component.parent;
      continue;
    }

    const eventParent = owner.eventParent;
    const parentOwner = owner.parent ?
      GLOBAL_STATE.pibblInstances.get(owner.parent) :
      undefined;
    if (!eventParent || !parentOwner) break;
    component = eventParent;
    owner = parentOwner;
  }
  components.reverse();

  const path: PibblEventNode[] = [];
  for (const { component, owner } of components) {
    const listeners = owner.eventRoot.listenersByComponent.get(
      component.id,
    );
    if (listeners) {
      for (const listener of listeners) {
        if (listener.live && listener.component === component) {
          path.push(listener);
          if (listener === target) return Object.freeze(path);
        }
      }
    }
    if (target.kind === 'target' && component === target.component) {
      path.push(target);
      return Object.freeze(path);
    }
  }
  // A live listener normally appears in its component bucket. Retaining it as
  // the leaf keeps an already-validated dispatch snapshot structurally whole.
  if (target.kind === 'listener') path.push(target);
  return Object.freeze(path);
}
