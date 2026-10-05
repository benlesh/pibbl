import type { PixelBounds } from '../lib/filter/filter-region.js';
import type { PreparedPibblFilter } from '../lib/style/filter-types.js';

export interface NativePreparedFilter extends PreparedPibblFilter {
  readonly css: (density: number) => string;
  readonly reverseInfluence: (output: Readonly<PixelBounds>, density: number) => PixelBounds;
  readonly onRejected?: () => void;
}

export function compileNativeFilters(filters: readonly NativePreparedFilter[], density: number): string {
  return filters.map(filter => filter.css(density)).join(' ');
}
