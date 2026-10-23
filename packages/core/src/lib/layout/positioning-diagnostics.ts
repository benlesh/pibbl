import { isDevelopment } from '../development.js';
import { getElementSource } from '../element/metadata.js';
import type { PibblElement } from '../element/types.js';
import type { SystemStyle } from '../types.js';

export function assertSupportedChildPosition(layout: string, child: PibblElement<any>, style: Readonly<SystemStyle>, supportsExplicitPosition = false, rejectsLegacyOffsets = true): void {
  const values = style as Readonly<Record<string, unknown>>;
  const position = values.position;
  if (position !== undefined && (!supportsExplicitPosition || (position !== 'static' && position !== 'relative'))) {
    throw new Error(`PIBBL_LAYOUT_UNSUPPORTED_POSITION: ${child.type.name || 'Anonymous'} inside ${layout} declares position: ${String(position)}. ${layout} does not support this placement mode.`);
  }
  const hasRightOrBottom = values.right !== undefined || values.bottom !== undefined;
  if (position === undefined && hasRightOrBottom) {
    throw new Error(`PIBBL_LAYOUT_IGNORED_POSITION: ${child.type.name || 'Anonymous'} inside ${layout} declares right/bottom without position: relative. ${layout} cannot apply these insets.`);
  }
  if (!isDevelopment || position !== undefined || !rejectsLegacyOffsets) return;
  const fields = (['left', 'top'] as const).filter(key => Object.prototype.hasOwnProperty.call(values, key) && values[key] !== undefined);
  if (fields.length === 0) return;
  const source = getElementSource(child);
  const location = source ? ` Source: ${source.fileName}:${source.lineNumber}` : '';
  throw new Error(`PIBBL_LAYOUT_IGNORED_POSITION: ${child.type.name || 'Anonymous'} inside ${layout} declares ${fields.map(key => `${key}: ${String(values[key])}`).join(', ')}. ${layout} controls this child's position; these fields have no effect. Use ${layout} alignment/gap or an Absolute region for positioned content.${location}`);
}
