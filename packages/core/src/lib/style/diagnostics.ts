import type { Constraints } from '../layout/types.js';

export interface LayoutDiagnosticContext {
  component?: string;
  algorithm?: string;
  constraints?: Readonly<Constraints>;
}

export interface LayoutDiagnosticInput extends LayoutDiagnosticContext {
  property: string;
  value: unknown;
  reason: string;
}

export class LayoutDiagnostic extends Error {
  readonly component: string;
  readonly property: string;
  readonly suppliedValue: unknown;
  readonly algorithm: string;
  readonly constraints: Readonly<Constraints> | undefined;

  constructor(input: LayoutDiagnosticInput) {
    const component = input.component ?? 'layout';
    const algorithm = input.algorithm ?? 'value-resolution';
    const constraints = input.constraints;
    super(
      `${component}: property ${input.property} received ${formatValue(input.value)} ` +
        `during ${algorithm}; constraints ${formatConstraints(constraints)}; ${input.reason}`,
    );
    this.name = 'LayoutDiagnostic';
    this.component = component;
    this.property = input.property;
    this.suppliedValue = input.value;
    this.algorithm = algorithm;
    this.constraints = constraints;
  }
}

export function layoutDiagnostic(
  input: LayoutDiagnosticInput,
): LayoutDiagnostic {
  return new LayoutDiagnostic(input);
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NaN';
    if (value === Number.POSITIVE_INFINITY) return 'Infinity';
    if (value === Number.NEGATIVE_INFINITY) return '-Infinity';
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function formatConstraints(
  constraints: Readonly<Constraints> | undefined,
): string {
  if (!constraints) return 'unspecified';
  return (
    `{ minWidth: ${formatValue(constraints.minWidth)}, maxWidth: ${formatValue(constraints.maxWidth)}, ` +
    `minHeight: ${formatValue(constraints.minHeight)}, maxHeight: ${formatValue(constraints.maxHeight)} }`
  );
}
