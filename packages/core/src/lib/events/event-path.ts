import type {
  CRCEventNode,
  CRCEventTargetRegistration,
} from './registrations.js';

/** Builds one immutable root-to-target snapshot for a logical dispatch. */
export function buildEventPath(
  target: CRCEventTargetRegistration,
): readonly CRCEventNode[] {
  const components = [];
  for (
    let component: typeof target.component | undefined = target.component;
    component;
    component = component.parent
  ) {
    components.push(component);
  }
  components.reverse();

  const path: CRCEventNode[] = [];
  for (const component of components) {
    const listeners = target.owner.eventRoot.listenersByComponent.get(
      component.id,
    );
    if (!listeners) continue;
    for (const listener of listeners) {
      if (listener.live && listener.component === component) {
        path.push(listener);
      }
    }
  }
  path.push(target);
  return Object.freeze(path);
}
