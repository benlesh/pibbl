import { hasPercentagePadding } from './box-insets.js';
import { Rectangle } from '../components/rect.js';
import { Text } from '../components/text.js';
import type { PibblElement } from '../element/types.js';
import { isSignal, untracked } from '../signals/graph.js';
import type { LayoutBox } from './types.js';

export interface AllocationSettings {
  layoutDirection: 'ltr' | 'rtl';
  flexDirection: string;
  flexWrap: string;
  justifyContent: string;
  alignItems: string;
  alignContent: string;
  rowGap: number;
  columnGap: number;
}
export interface CachedFlexPlacement {
  readonly box: Readonly<LayoutBox>;
  readonly usedWidth: number;
  readonly usedHeight: number;
}

/** One scalar snapshot; its input identity is weak and never owns descriptors. */
export class FlexAllocationCache {
  private input: WeakRef<object> | undefined;
  private revision = -1;
  private width = 0;
  private height = 0;
  private settings: AllocationSettings | undefined;
  private placements: readonly CachedFlexPlacement[] | undefined;

  read(input: unknown, revision: number, box: Readonly<LayoutBox>, settings: AllocationSettings) {
    const previous = this.settings;
    if (!previous || this.input?.deref() !== input || this.revision !== revision ||
        box.width !== this.width || box.height !== this.height ||
        previous.layoutDirection !== settings.layoutDirection || previous.flexDirection !== settings.flexDirection || previous.flexWrap !== settings.flexWrap ||
        previous.justifyContent !== settings.justifyContent || previous.alignItems !== settings.alignItems ||
        previous.alignContent !== settings.alignContent || previous.rowGap !== settings.rowGap ||
        previous.columnGap !== settings.columnGap) return;
    return this.placements;
  }

  store(input: object, revision: number, box: Readonly<LayoutBox>, settings: AllocationSettings, placements: readonly CachedFlexPlacement[]) {
    this.input = new WeakRef(input);
    this.revision = revision;
    this.width = box.width;
    this.height = box.height;
    this.settings = {
      layoutDirection: settings.layoutDirection,
      flexDirection: settings.flexDirection, flexWrap: settings.flexWrap,
      justifyContent: settings.justifyContent, alignItems: settings.alignItems,
      alignContent: settings.alignContent, rowGap: settings.rowGap, columnGap: settings.columnGap,
    };
    this.placements = placements;
  }
}

// This proof runs only on a miss. Never invoke accessors, freeze caller values,
// infer an ordinary component's purity, or traverse signal implementation state.
export function frozenFlexInputs(input: unknown): input is readonly PibblElement<any>[] {
  if (!Array.isArray(input) || !Object.isFrozen(input)) return false;
  return untracked(() => {
    const visiting = new Set<object>();
    for (let index = 0; index < input.length; index++) {
      const entry = Object.getOwnPropertyDescriptor(input, String(index));
      if (!entry || !('value' in entry)) return false;
      const child = entry.value as PibblElement<any>;
      if (!child || !Object.isFrozen(child)) return false;
      const type = Object.getOwnPropertyDescriptor(child, 'type');
      const props = Object.getOwnPropertyDescriptor(child, 'props');
      if (!type || !('value' in type) || (type.value !== Rectangle && type.value !== Text) ||
          !props || !('value' in props) || !plainFrozenRecord(props.value)) return false;
      const fields = Object.getOwnPropertyDescriptors(props.value);
      for (const key of Object.keys(fields)) {
        const field = fields[key];
        if (!('value' in field)) return false;
        if (key === 'style') {
          if (!frozenStyle(field.value, visiting)) return false;
        } else if (key === 'children') {
          if (type.value !== Text || !frozenMetricValue(field.value, visiting)) return false;
        } else if (!(key.startsWith('on') && typeof field.value === 'function') &&
                   !scalar(field.value)) return false;
      }
      if (type.value === Text) {
        const style = fields.style?.value;
        const authoredFont = style?.font;
        const font = isSignal(authoredFont) ? authoredFont.get() : authoredFont;
        if (font !== undefined && (typeof font !== 'string' ||
            !/^(?:(?:bold|italic|normal) )?\d+(?:\.\d+)?px (?:sans-serif|serif|monospace)$/.test(font))) return false;
      }
    }
    return true;
  });
}

function scalar(value: unknown): boolean {
  return value === null || value === undefined || typeof value === 'string' ||
    typeof value === 'number' || typeof value === 'boolean';
}
function plainFrozenRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && Object.isFrozen(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function frozenStyle(value: unknown, visiting: Set<object>): boolean {
  if (value === undefined) return true;
  if (!plainFrozenRecord(value)) return false;
  const fields = Object.getOwnPropertyDescriptors(value);
  for (const key of Object.keys(fields)) {
    const field = fields[key];
    if (!('value' in field) || key === 'when' || key === 'custom' || key === 'transition') return false;
    // These values affect pixels only and are resolved anew by the receiver.
    if (key === 'fill' || key === 'stroke' || key === 'opacity' || key === 'filter') continue;
    if (!frozenMetricValue(field.value, visiting)) return false;
    // Cached placements carry used sizes, not canonical owner-relative padding.
    // Keep percentage padding on the normal receiver-owned allocation path.
    if (key === 'padding' && hasPercentagePadding(isSignal(field.value) ? field.value.get() : field.value)) return false;
  }
  return true;
}
function frozenMetricValue(value: unknown, visiting: Set<object>): boolean {
  if (scalar(value)) return true;
  if (isSignal(value)) return frozenMetricValue(value.get(), visiting);
  if (!value || typeof value !== 'object' || !Object.isFrozen(value) || visiting.has(value)) return false;
  if (!Array.isArray(value) && !plainFrozenRecord(value)) return false;
  visiting.add(value);
  try {
    const fields = Object.getOwnPropertyDescriptors(value);
    for (const key of Object.keys(fields)) {
      const field = fields[key];
      if (!('value' in field) || !frozenMetricValue(field.value, visiting)) return false;
    }
    return true;
  } finally { visiting.delete(value); }
}
