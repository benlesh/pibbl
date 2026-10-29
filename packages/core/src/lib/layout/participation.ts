import { peekPreNormalizedStyle, type PreparedStyleInput } from '../style/resolve-dispatch.js';
import { materializeContainerChildren } from '../element/children.js';
import { isKnownLayoutType } from './prepared-root.js';
import { getSpecifiedStyle } from '../element/metadata.js';
import type { PibblElement } from '../element/types.js';
import { GLOBAL_STATE } from '../global-state.js';
import { isSignal, getSignalNode, withSignalDependencyRole } from '../signals/graph.js';
import type { PibblComponentRefs, PibblInstance } from '../types.js';

const contentsTransforms = new WeakSet<Function>();
export function registerContentsTransform(type: Function): void { contentsTransforms.add(type); }
export function isContentsTransform(type: Function): boolean { return contentsTransforms.has(type); }

export interface LayoutSuspensionResource { suspendLayout(): void; }
const suspensionResources = new WeakMap<PibblComponentRefs<any>, Set<LayoutSuspensionResource>>();
export function registerLayoutSuspensionResource(refs: PibblComponentRefs<any>, resource: LayoutSuspensionResource): void {
  let resources = suspensionResources.get(refs);
  if (!resources) { resources = new Set(); suspensionResources.set(refs, resources); }
  resources.add(resource);
}
export function unregisterLayoutSuspensionResource(refs: PibblComponentRefs<any>, resource: LayoutSuspensionResource): void {
  const resources = suspensionResources.get(refs);
  resources?.delete(resource);
  if (resources?.size === 0) suspensionResources.delete(refs);
}

const suspendedComponents = new WeakSet<PibblComponentRefs<any>>();
export function isLayoutComponentSuspended(refs: PibblComponentRefs<any>): boolean { return !refs.teardowns.closed && suspendedComponents.has(refs); }
export function isLayoutInstanceSuspended(owner: PibblInstance): boolean {
  let current: PibblInstance | undefined = owner;
  while (current) {
    if (current.eventParent && isLayoutComponentSuspended(current.eventParent)) return true;
    current = current.parent ? GLOBAL_STATE.pibblInstances.get(current.parent) : undefined;
  }
  return false;
}
export function resumeLayoutComponent(refs: PibblComponentRefs<any>): void { suspendedComponents.delete(refs); }
function participationStyle(element: PibblElement<any>, preparedStyle?: PreparedStyleInput | null): unknown {
  const prepared = preparedStyle === undefined ? peekPreNormalizedStyle(element) : preparedStyle;
  if (prepared) return prepared.style;
  const specified = getSpecifiedStyle(element);
  if (!isSignal(specified)) return specified;
  const node = getSignalNode(specified);
  node.validate?.();
  const current = node.value;
  // Ordinary whole-style inputs keep their existing single receiver read.
  // A participation input acquires its own layout dependency when present.
  return current && typeof current === 'object' && (current as Record<string, unknown>).layoutParticipation !== undefined
    ? specified.get() : current;
}

const mountedChildren = new WeakMap<PibblComponentRefs<any>, Set<PibblComponentRefs<any>>>();

/** Reads only the structural visibility input; hidden inputs never require measurement. */
export function layoutParticipation(element: PibblElement<any>, preparedStyle?: PreparedStyleInput | null): 'normal' | 'hidden' | 'contents' {
  const style = participationStyle(element, preparedStyle);
  const input = style && typeof style === 'object' ? (style as Record<string, unknown>).layoutParticipation : undefined;
  const value = isSignal(input) ? withSignalDependencyRole('layout', () => input.get()) : input;
  if (value === undefined || value === 'normal') return 'normal';
  if (value === 'hidden' || value === 'contents') return value;
  throw new TypeError(`${element.type.name || 'Component'} style.layoutParticipation must be normal, hidden, or contents.`);
}

export interface LayoutParticipationSource {
  readonly element: PibblElement<any>;
  readonly hidden: boolean;
  readonly children?: readonly LayoutParticipationSource[];
}
const participationPlans = new WeakMap<readonly PibblElement<any>[], readonly LayoutParticipationSource[]>();

/** Contents may expose only declared structural children, never an opaque component program. */
export function contentsChildren(element: PibblElement<any>): readonly PibblElement<any>[] {
  if (!isContentsTransform(element.type) && !isKnownLayoutType(element.type)) {
    throw new TypeError(`${element.type.name || 'Component'} contents participation requires a built-in layout or Group with declared structural children.`);
  }
  const style = participationStyle(element);
  if (style && typeof style === 'object') {
    const values = style as Record<string, unknown>;
    rejectContentsBoxProperty(values, 'width', element);
    rejectContentsBoxProperty(values, 'height', element);
    rejectContentsBoxProperty(values, 'minWidth', element);
    rejectContentsBoxProperty(values, 'maxWidth', element);
    rejectContentsBoxProperty(values, 'minHeight', element);
    rejectContentsBoxProperty(values, 'maxHeight', element);
    rejectContentsBoxProperty(values, 'boxSizing', element);
    rejectContentsBoxProperty(values, 'padding', element);
    rejectContentsBoxProperty(values, 'paddingStart', element);
    rejectContentsBoxProperty(values, 'paddingEnd', element);
    rejectContentsBoxProperty(values, 'borderWidth', element);
    rejectContentsBoxProperty(values, 'borderStartWidth', element);
    rejectContentsBoxProperty(values, 'borderEndWidth', element);
    rejectContentsBoxProperty(values, 'overflow', element);
    rejectContentsBoxProperty(values, 'filter', element);
    rejectContentsBoxProperty(values, 'position', element);
    rejectContentsBoxProperty(values, 'left', element);
    rejectContentsBoxProperty(values, 'right', element);
    rejectContentsBoxProperty(values, 'top', element);
    rejectContentsBoxProperty(values, 'bottom', element);
    rejectContentsBoxProperty(values, 'insetStart', element);
    rejectContentsBoxProperty(values, 'insetEnd', element);
    rejectContentsBoxProperty(values, 'margin', element);
    rejectContentsBoxProperty(values, 'marginTop', element);
    rejectContentsBoxProperty(values, 'marginRight', element);
    rejectContentsBoxProperty(values, 'marginBottom', element);
    rejectContentsBoxProperty(values, 'marginLeft', element);
    rejectContentsBoxProperty(values, 'marginStart', element);
    rejectContentsBoxProperty(values, 'marginEnd', element);
  }
  const input = (element.props as { readonly children?: import('../element/types.js').PibblNodeInput }).children;
  return materializeContainerChildren(input, element);
}

export function participatingLayoutChildren(source: readonly PibblElement<any>[]): readonly PibblElement<any>[] {
  let needsPlan = false;
  for (const element of source) if (layoutParticipation(element) !== 'normal') { needsPlan = true; break; }
  if (!needsPlan) return source;
  const leaves: PibblElement<any>[] = [];
  const visiting = new Set<PibblElement<any>>();
  const build = (sequence: readonly PibblElement<any>[]): LayoutParticipationSource[] => {
    const result: LayoutParticipationSource[] = [];
    for (const element of sequence) {
      const participation = layoutParticipation(element);
      if (participation === 'hidden') result.push({ element, hidden: true });
      else if (participation === 'contents') {
        if (visiting.has(element)) throw new TypeError('Contents layout descriptors form a cycle.');
        visiting.add(element);
        try { result.push({ element, hidden: false, children: build(contentsChildren(element)) }); }
        finally { visiting.delete(element); }
      } else { leaves.push(element); result.push({ element, hidden: false }); }
    }
    return result;
  };
  participationPlans.set(leaves, build(source));
  return leaves;
}

export function layoutParticipationPlan(children: readonly PibblElement<any>[]): readonly LayoutParticipationSource[] | undefined {
  return participationPlans.get(children);
}

/** Records mount ownership once; retaining a hidden subtree never scans unrelated mounts. */
export function registerLayoutComponentMount(refs: PibblComponentRefs<any>): void {
  const parent = refs.parent;
  if (!parent) return;
  let children = mountedChildren.get(parent);
  if (!children) { children = new Set(); mountedChildren.set(parent, children); }
  children.add(refs);
  const owned = children;
  refs.teardowns.add(() => { owned.delete(refs); if (!owned.size && mountedChildren.get(parent) === owned) mountedChildren.delete(parent); mountedChildren.delete(refs); });
}

export function retainHiddenLayoutDescendants(refs: PibblComponentRefs<any>): void {
  suspendedComponents.add(refs);
  refs.renderGeneration = GLOBAL_STATE.currentPibblInstance!.renderGeneration;
  const resources = suspensionResources.get(refs);
  if (resources) for (const resource of resources) resource.suspendLayout();
  const children = mountedChildren.get(refs);
  if (!children) return;
  for (const child of children) {
    if (child.teardowns.closed) continue;
    GLOBAL_STATE.seenIds!.add(child.id);
    retainHiddenLayoutDescendants(child);
  }
}

function rejectContentsBoxProperty(style: Readonly<Record<string, unknown>>, property: string, element: PibblElement<any>): void {
  const input = style[property];
  if ((isSignal(input) ? input.get() : input) !== undefined) {
    throw new TypeError(`${element.type.name} style.${property} requires a box and is incompatible with contents participation.`);
  }
}
