import type { RenderingContext2D } from '../lib/types.js';
import { layoutDiagnostic } from '../lib/style/diagnostics.js';

export function assertNativeCanvasFilter(
  context: RenderingContext2D,
  cssText: string,
  component: string,
  diagnoseRejection?: () => void,
): void {
  const accessor = requireNativeFilterAccessor(context, component);
  resetNativeFilterAccessor(context, accessor, component);
  writeNativeFilter(context, accessor, cssText, component);
  if (readNativeFilter(context, accessor, component) !== 'none') return;
  diagnoseRejection?.();
  throw nativeFilterDiagnostic(component, cssText, 'the complete native Canvas filter chain is unsupported');
}

export function resetNativeCanvasFilter(context: RenderingContext2D, component: string): void {
  resetNativeFilterAccessor(context, requireNativeFilterAccessor(context, component), component);
}

export function resetNativeCanvasFilterIfSupported(context: RenderingContext2D): void {
  try { resetNativeCanvasFilter(context, 'filter surface'); } catch {
    // Cleanup must never mask the original capability or user-rendering failure.
  }
}

function resetNativeFilterAccessor(
  context: RenderingContext2D,
  accessor: NativeFilterAccessor,
  component: string,
): void {
  writeNativeFilter(context, accessor, 'none', component);
  if (readNativeFilter(context, accessor, component) !== 'none') {
    throw nativeFilterDiagnostic(
      component,
      undefined,
      'the native Canvas filter state could not reset to none',
    );
  }
}

interface NativeFilterAccessor {
  readonly get: (this: RenderingContext2D) => unknown;
  readonly set: (this: RenderingContext2D, value: string) => void;
}

function requireNativeFilterAccessor(
  context: RenderingContext2D,
  component: string,
): NativeFilterAccessor {
  const ownDescriptor = Object.getOwnPropertyDescriptor(context, 'filter');
  if (ownDescriptor) {
    if (
      !ownDescriptor.configurable ||
      !Reflect.deleteProperty(context, 'filter')
    ) {
      throw nativeFilterDiagnostic(
        component,
        undefined,
        'a shadowing own filter property could not be removed',
      );
    }
  }

  let prototype = Object.getPrototypeOf(context);
  while (prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'filter');
    if (descriptor) {
      if (
        typeof descriptor.get === 'function' &&
        typeof descriptor.set === 'function'
      ) {
        return {
          get: descriptor.get as NativeFilterAccessor['get'],
          set: descriptor.set as NativeFilterAccessor['set'],
        };
      }
      break;
    }
    prototype = Object.getPrototypeOf(prototype);
  }

  throw nativeFilterDiagnostic(
    component,
    undefined,
    'requires native Canvas filter support with a getter and setter',
  );
}

function readNativeFilter(
  context: RenderingContext2D,
  accessor: NativeFilterAccessor,
  component: string,
): string {
  let value: unknown;
  try {
    value = accessor.get.call(context);
  } catch {
    throw nativeFilterDiagnostic(
      component,
      undefined,
      'the native Canvas filter getter threw',
    );
  }
  if (typeof value !== 'string') {
    throw nativeFilterDiagnostic(
      component,
      value,
      'the native Canvas filter getter returned a non-string value',
    );
  }
  return value;
}

function writeNativeFilter(
  context: RenderingContext2D,
  accessor: NativeFilterAccessor,
  value: string,
  component: string,
): void {
  try {
    accessor.set.call(context, value);
  } catch {
    throw nativeFilterDiagnostic(
      component,
      value,
      'the native Canvas filter setter threw',
    );
  }
}

function nativeFilterDiagnostic(
  component: string,
  value: unknown,
  reason: string,
) {
  return layoutDiagnostic({
    component,
    property: 'filter',
    value,
    algorithm: 'filter-rendering',
    reason,
  });
}

