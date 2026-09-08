import { GLOBAL_STATE } from '../global-state.js';
import type { LayoutBox } from '../layout/types.js';
import type { RenderTargetSnapshot } from '../render-target.js';
import { layoutDiagnostic } from '../style/diagnostics.js';
import type { ResolvedFilterList } from '../style/filter.js';

export const BLUR_EXTENT_FACTOR = (3 * Math.sqrt(2 * Math.PI)) / 4;

const MAX_UNSIGNED_LONG = 0xffff_ffff;

export interface PixelBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface FilterPixelWindow {
  readonly logicalBounds: Readonly<LayoutBox>;
  readonly backingX: number;
  readonly backingY: number;
  readonly backingWidth: number;
  readonly backingHeight: number;
  readonly renderTransform: DOMMatrix;
  readonly inverseRenderTransform: DOMMatrix;
}

export interface FilterWindows {
  readonly source: FilterPixelWindow;
  readonly output: FilterPixelWindow;
  readonly density: number;
  readonly sourceToOutputX: number;
  readonly sourceToOutputY: number;
}

export function reverseFilterInfluence(
  output: Readonly<PixelBounds>,
  filters: ResolvedFilterList,
  density: number,
): PixelBounds {
  let left = output.x;
  let top = output.y;
  let right = output.x + output.width;
  let bottom = output.y + output.height;
  assertPixelEdges(left, top, right, bottom);

  for (let index = filters.values.length - 1; index >= 0; index -= 1) {
    const filter = filters.values[index]!;
    if (filter.type === 'blur') {
      const extent = blurExtent(filter.radius, density);
      left -= extent;
      top -= extent;
      right += extent;
      bottom += extent;
    } else if (filter.type === 'dropShadow') {
      const extent = blurExtent(filter.blurRadius ?? 0, density);
      const offsetX = filter.offsetX * density;
      const offsetY = filter.offsetY * density;
      const shadowLeft = Math.floor(left - offsetX - extent);
      const shadowTop = Math.floor(top - offsetY - extent);
      const shadowRight = Math.ceil(right - offsetX + extent);
      const shadowBottom = Math.ceil(bottom - offsetY + extent);
      left = Math.min(left, shadowLeft);
      top = Math.min(top, shadowTop);
      right = Math.max(right, shadowRight);
      bottom = Math.max(bottom, shadowBottom);
    }
    assertPixelEdges(left, top, right, bottom);
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

export function largestAffineScale(matrix: DOMMatrixReadOnly): number {
  const { a, b, c, d } = matrix;
  const sumOfSquares = a * a + b * b + c * c + d * d;
  const determinant = a * d - b * c;
  const discriminant = Math.max(
    0,
    sumOfSquares * sumOfSquares - 4 * determinant * determinant,
  );
  return Math.sqrt((sumOfSquares + Math.sqrt(discriminant)) / 2);
}

export function resolveFilterWindows(
  parentTarget: RenderTargetSnapshot,
  parentPaintTransform: DOMMatrixReadOnly,
  filters: ResolvedFilterList,
): FilterWindows | 'discard' {
  if (!isFiniteAffine(parentPaintTransform)) return 'discard';
  const determinant =
    parentPaintTransform.a * parentPaintTransform.d -
    parentPaintTransform.b * parentPaintTransform.c;
  if (determinant === 0) return 'discard';

  let inverse: DOMMatrix;
  try {
    inverse = new DOMMatrix([
      parentPaintTransform.a,
      parentPaintTransform.b,
      parentPaintTransform.c,
      parentPaintTransform.d,
      parentPaintTransform.e,
      parentPaintTransform.f,
    ]).inverse();
  } catch {
    return 'discard';
  }
  if (!isFiniteAffine(inverse)) return 'discard';

  const localToParentBacking = parentTarget.renderTransform.multiply(
    parentPaintTransform,
  );
  if (!isFiniteAffine(localToParentBacking)) return 'discard';
  const density = largestAffineScale(localToParentBacking);
  if (!Number.isFinite(density) || density <= 0) return 'discard';

  const projected = projectBounds(parentTarget.logicalBounds, inverse);
  if (!projected) return 'discard';
  const outputPixels = snapToBackingPixels(projected, density);
  const sourcePixels = reverseFilterInfluence(outputPixels, filters, density);
  assertCanvasPixelBounds(outputPixels);
  assertCanvasPixelBounds(sourcePixels);

  const output = createWindow(outputPixels, density);
  const source = createWindow(sourcePixels, density);
  return {
    source,
    output,
    density,
    sourceToOutputX: source.backingX - output.backingX,
    sourceToOutputY: source.backingY - output.backingY,
  };
}

function blurExtent(radius: number, density: number): number {
  const scaled = radius * density * BLUR_EXTENT_FACTOR;
  if (!Number.isFinite(scaled) || !Number.isSafeInteger(Math.ceil(scaled))) {
    throw filterRegionError(
      scaled,
      'filter expansion exceeds finite safe-integer backing arithmetic',
    );
  }
  return Math.ceil(scaled);
}

function projectBounds(
  bounds: Readonly<LayoutBox>,
  inverse: DOMMatrixReadOnly,
): LayoutBox | undefined {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  if (![bounds.x, bounds.y, right, bottom].every(Number.isFinite)) {
    return undefined;
  }

  const points = [
    projectPoint(bounds.x, bounds.y, inverse),
    projectPoint(right, bounds.y, inverse),
    projectPoint(bounds.x, bottom, inverse),
    projectPoint(right, bottom, inverse),
  ];
  if (points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    return undefined;
  }
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const projectedRight = Math.max(...xs);
  const projectedBottom = Math.max(...ys);
  return {
    x: left,
    y: top,
    width: projectedRight - left,
    height: projectedBottom - top,
  };
}

function projectPoint(
  x: number,
  y: number,
  matrix: DOMMatrixReadOnly,
): { x: number; y: number } {
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  };
}

function snapToBackingPixels(
  bounds: Readonly<LayoutBox>,
  density: number,
): PixelBounds {
  const scaledLeft = bounds.x * density;
  const scaledTop = bounds.y * density;
  const scaledRight = (bounds.x + bounds.width) * density;
  const scaledBottom = (bounds.y + bounds.height) * density;
  if (![scaledLeft, scaledTop, scaledRight, scaledBottom].every(Number.isFinite)) {
    throw filterRegionError(
      { scaledLeft, scaledTop, scaledRight, scaledBottom },
      'filter backing edge arithmetic overflowed',
    );
  }
  const left = Math.floor(scaledLeft);
  const top = Math.floor(scaledTop);
  const right = Math.ceil(scaledRight);
  const bottom = Math.ceil(scaledBottom);
  assertPixelEdges(left, top, right, bottom);
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function createWindow(
  pixels: Readonly<PixelBounds>,
  density: number,
): FilterPixelWindow {
  const renderTransform = new DOMMatrix([
    density,
    0,
    0,
    density,
    -pixels.x,
    -pixels.y,
  ]);
  return {
    logicalBounds: Object.freeze({
      x: pixels.x / density,
      y: pixels.y / density,
      width: pixels.width / density,
      height: pixels.height / density,
    }),
    backingX: pixels.x,
    backingY: pixels.y,
    backingWidth: pixels.width,
    backingHeight: pixels.height,
    renderTransform,
    inverseRenderTransform: renderTransform.inverse(),
  };
}

function assertPixelEdges(
  left: number,
  top: number,
  right: number,
  bottom: number,
): void {
  const edges = { left, top, right, bottom };
  if (!Object.values(edges).every(Number.isSafeInteger)) {
    throw filterRegionError(
      edges,
      'filter backing edges must remain finite safe integers',
    );
  }
  const width = right - left;
  const height = bottom - top;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)) {
    throw filterRegionError(
      { width, height },
      'filter backing dimensions must remain finite safe integers',
    );
  }
}

function assertCanvasPixelBounds(bounds: Readonly<PixelBounds>): void {
  const { width, height } = bounds;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > MAX_UNSIGNED_LONG ||
    height > MAX_UNSIGNED_LONG
  ) {
    throw filterRegionError(
      { width, height },
      `filter backing dimensions must be positive unsigned-long integers no greater than ${MAX_UNSIGNED_LONG}`,
    );
  }
  const area = width * height;
  if (!Number.isSafeInteger(area)) {
    throw filterRegionError(
      area,
      'filter backing area must remain a finite safe integer',
    );
  }
}

function isFiniteAffine(matrix: DOMMatrixReadOnly): boolean {
  return matrix.is2D && [
    matrix.a,
    matrix.b,
    matrix.c,
    matrix.d,
    matrix.e,
    matrix.f,
  ].every(Number.isFinite);
}

function filterRegionError(value: unknown, reason: string): Error {
  const type = GLOBAL_STATE.componentRefs?.element.type;
  const component = typeof type === 'function' && type.name ?
    type.name : 'filter boundary';
  return layoutDiagnostic({
    component,
    property: 'filter.backingDimensions',
    value,
    algorithm: 'filter-capture',
    reason,
  });
}
