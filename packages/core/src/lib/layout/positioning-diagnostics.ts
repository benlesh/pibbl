import { isDevelopment } from '../development.js';
import { getElementSource } from '../element/metadata.js';
import type { PibblElement } from '../element/types.js';
import type { SystemStyle } from '../types.js';

export function assertSupportedChildPosition(layout: string, child: PibblElement<any>, style: Readonly<SystemStyle>): void {
  if (!isDevelopment) return;
  const values = style as Readonly<Record<string, unknown>>;
  const fields = (['left', 'top'] as const).filter(key => Object.prototype.hasOwnProperty.call(values, key) && values[key] !== undefined);
  if (fields.length === 0) return;
  const source = getElementSource(child);
  const location = source ? ` Source: ${source.fileName}:${source.lineNumber}` : '';
  throw new Error(`PIBBL_LAYOUT_IGNORED_POSITION: ${child.type.name || 'Anonymous'} inside ${layout} declares ${fields.map(key => `${key}: ${String(values[key])}`).join(', ')}. ${layout} controls this child's position; these fields have no effect. Use ${layout} alignment/gap or an Absolute region for positioned content.${location}`);
}
