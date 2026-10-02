import type { RenderingContext2D } from '../lib/types.js';
import { layoutDiagnostic } from '../lib/style/diagnostics.js';

export function assertNativeCanvasFilter(context: RenderingContext2D, cssText: string, component: string): void {
  const descriptor = findFilterDescriptor(context);
  if (!descriptor) throw diagnostic(component, undefined, 'requires native Canvas filter support with a getter and setter');
  descriptor.set!.call(context, 'none');
  if (descriptor.get!.call(context) !== 'none') throw diagnostic(component, undefined, 'the native Canvas filter state could not reset to none');
  descriptor.set!.call(context, cssText);
  if (descriptor.get!.call(context) === 'none') throw diagnostic(component, cssText, 'the complete native Canvas filter chain is unsupported');
}

export function resetNativeCanvasFilter(context: RenderingContext2D, component: string): void {
  const descriptor = findFilterDescriptor(context);
  if (!descriptor) throw diagnostic(component, undefined, 'requires native Canvas filter support with a getter and setter');
  descriptor.set!.call(context, 'none');
}

function findFilterDescriptor(context: RenderingContext2D): PropertyDescriptor | undefined {
  let prototype: object | null = Object.getPrototypeOf(context);
  while (prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'filter');
    if (descriptor?.get && descriptor?.set) return descriptor;
    prototype = Object.getPrototypeOf(prototype);
  }
  return undefined;
}
function diagnostic(component: string, value: unknown, reason: string): Error {
  return layoutDiagnostic({ component, property: 'filter', value, algorithm: 'filter-rendering', reason });
}
