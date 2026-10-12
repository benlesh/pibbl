import { createPibblElement } from './create-element.js';
export { Fragment } from './fragment.js';
import type { PibblElementSource } from './metadata.js';
import type {
  PibblElement,
  PibblElementType,
  PibblKey,
} from './types.js';

/**
 * @internal Automatic JSX production constructor.
 *
 * @param type - Pibbl component or fragment emitted by the JSX compiler. See {@link PibblElementType}.
 * @param props - Compiler-generated props, including children.
 * @param key - Optional reconciliation key supplied separately by the compiler. See {@link PibblKey}
 * .
 * @returns A branded Pibbl element descriptor. See {@link PibblElement}.
 *
 * @see {@link PibblElementType}
 * @see {@link PibblKey}
 * @see {@link PibblElement}
 */
export function jsx<P>(
  type: PibblElementType<P>,
  props: P,
  key?: PibblKey,
): PibblElement<P> {
  return createPibblElement(type, props, key, undefined);
}

/**
 * @internal Automatic JSX production constructor for static child lists.
 *
 * @param type - Pibbl component or fragment emitted by the JSX compiler. See {@link PibblElementType}.
 * @param props - Compiler-generated props, including the static child list.
 * @param key - Optional reconciliation key. See {@link PibblKey}.
 * @returns A branded Pibbl element descriptor. See {@link PibblElement}.
 *
 * @see {@link PibblElementType}
 * @see {@link PibblKey}
 * @see {@link PibblElement}
 */
export const jsxs = jsx;

/**
 * @internal Automatic JSX development constructor.
 *
 * @param type - Pibbl component or fragment emitted by the JSX compiler. See {@link PibblElementType}.
 * @param props - Compiler-generated props, including children.
 * @param key - Reconciliation key, if present. See {@link PibblKey}.
 * @param _isStaticChildren - Compiler compatibility flag; not used by Pibbl.
 * @param source - Development source location for diagnostics. See {@link PibblElementSource}.
 * @param _self - Compiler compatibility receiver; not used by Pibbl.
 * @returns A branded Pibbl element descriptor with development source metadata. See
 * {@link PibblElement} .
 *
 * @see {@link PibblElementType}
 * @see {@link PibblKey}
 * @see {@link PibblElementSource}
 * @see {@link PibblElement}
 */
export function jsxDEV<P>(
  type: PibblElementType<P>,
  props: P,
  key: PibblKey | undefined,
  _isStaticChildren: boolean,
  source: PibblElementSource | undefined,
  _self: unknown,
): PibblElement<P> {
  return createPibblElement(type, props, key, source);
}
