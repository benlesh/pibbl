import { createCRCElement } from './create-element.js';
export { Fragment } from './fragment.js';
import type { CRCElementSource } from './metadata.js';
import type {
  CRCElement,
  CRCElementType,
  CRCKey,
} from './types.js';

/**
 * @internal Automatic JSX production constructor.
 *
 * @param type - CRC component or fragment emitted by the JSX compiler. See {@link CRCElementType}.
 * @param props - Compiler-generated props, including children.
 * @param key - Optional reconciliation key supplied separately by the compiler. See {@link CRCKey}
 * .
 * @returns A branded CRC element descriptor. See {@link CRCElement}.
 *
 * @see {@link CRCElementType}
 * @see {@link CRCKey}
 * @see {@link CRCElement}
 */
export function jsx<P>(
  type: CRCElementType<P>,
  props: P,
  key?: CRCKey,
): CRCElement<P> {
  return createCRCElement(type, props, key, undefined);
}

/**
 * @internal Automatic JSX production constructor for static child lists.
 *
 * @param type - CRC component or fragment emitted by the JSX compiler. See {@link CRCElementType}.
 * @param props - Compiler-generated props, including the static child list.
 * @param key - Optional reconciliation key. See {@link CRCKey}.
 * @returns A branded CRC element descriptor. See {@link CRCElement}.
 *
 * @see {@link CRCElementType}
 * @see {@link CRCKey}
 * @see {@link CRCElement}
 */
export const jsxs = jsx;

/**
 * @internal Automatic JSX development constructor.
 *
 * @param type - CRC component or fragment emitted by the JSX compiler. See {@link CRCElementType}.
 * @param props - Compiler-generated props, including children.
 * @param key - Reconciliation key, if present. See {@link CRCKey}.
 * @param _isStaticChildren - Compiler compatibility flag; not used by CRC.
 * @param source - Development source location for diagnostics. See {@link CRCElementSource}.
 * @param _self - Compiler compatibility receiver; not used by CRC.
 * @returns A branded CRC element descriptor with development source metadata. See
 * {@link CRCElement} .
 *
 * @see {@link CRCElementType}
 * @see {@link CRCKey}
 * @see {@link CRCElementSource}
 * @see {@link CRCElement}
 */
export function jsxDEV<P>(
  type: CRCElementType<P>,
  props: P,
  key: CRCKey | undefined,
  _isStaticChildren: boolean,
  source: CRCElementSource | undefined,
  _self: unknown,
): CRCElement<P> {
  return createCRCElement(type, props, key, source);
}
