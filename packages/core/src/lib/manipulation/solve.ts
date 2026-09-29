import { assertFiniteBox, assertFinitePoint, freezeBox } from './geometry.js';
import { assertFiniteOrigin, assertPositiveFiniteStep, isSnapActive, snapToLattice } from './snap.js';
import type {
  CRCManipulationBox,
  CRCManipulationMoveSnap,
  CRCManipulationResizeOptions,
  CRCManipulationResizeGridSnap,
  CRCManipulationResizeSizeSnap,
  CRCResizePosition,
  ManipulationSolveInput,
  ManipulationSolveResult,
} from './types.js';

export function solveManipulation(input: ManipulationSolveInput): ManipulationSolveResult {
  assertFiniteBox(input.initial, 'initial');
  assertFinitePoint(input.initialPoint, 'initialPoint');
  assertFinitePoint(input.currentPoint, 'currentPoint');
  validateConfiguredSnaps(input);

  switch (input.operation) {
    case 'move':
      return solveMove(input);
    case 'resize':
      return solveResize(input);
    case 'rotate':
      return solveRotation(input);
  }
}

function solveMove(input: ManipulationSolveInput): ManipulationSolveResult {
  const { initial } = input;
  const axis = input.move?.axis ?? 'both';
  const deltaX = input.currentPoint.x - input.initialPoint.x;
  const deltaY = input.currentPoint.y - input.initialPoint.y;
  const proposed = freezeBox({
    ...initial,
    left: axis === 'y' ? initial.left : initial.left + deltaX,
    top: axis === 'x' ? initial.top : initial.top + deltaY,
  });
  const snap = input.move?.snap;
  const snapActive = snap !== undefined && isSnapActive(
    snap.enabled,
    snap.when,
    input.modifiers,
  );
  if (!snapActive) return result(proposed, clampMoveToBounds(proposed, input.move?.bounds, input.initialRotation ?? 0), false, true, input.initialRotation);

  const [stepX, stepY] = moveSteps(snap!);
  const origin = snap!.origin;
  const applied = freezeBox({
    ...proposed,
    left: axis === 'y' ? proposed.left : snapToLattice(proposed.left, stepX, origin?.x ?? 0),
    top: axis === 'x' ? proposed.top : snapToLattice(proposed.top, stepY, origin?.y ?? 0),
  });
  const bounded = clampMoveToBounds(applied, input.move?.bounds, input.initialRotation ?? 0);
  return result(proposed, bounded, true, boxesEqual(applied, bounded), input.initialRotation);
}

function solveResize(input: ManipulationSolveInput): ManipulationSolveResult {
  if (!input.handle) throw new Error('Resize manipulation requires a handle.');
  if (input.resize?.snap?.target === 'grid' && (input.initialRotation ?? 0) !== 0) {
    throw new Error('Grid resize snapping requires an unrotated box.');
  }
  const rotation = input.initialRotation ?? 0;
  if (!Number.isFinite(rotation)) throw new Error('initialRotation must be finite.');
  const proposed = resizeFromPoint(input.initial, input.handle, rotateInverse({
    x: input.currentPoint.x - input.initialPoint.x,
    y: input.currentPoint.y - input.initialPoint.y,
  }, rotation));
  const constraints = resolvedResizeConstraints(input.resize);
  const snap = input.resize?.snap;
  const snapActive = snap !== undefined && isSnapActive(
    snap.enabled,
    snap.when,
    input.modifiers,
  );
  const snapped = snapActive ? snapResize(input.initial, proposed, input.handle, snap!) : proposed;
  let width = snapped.width;
  let height = snapped.height;
  const ratio = activeRatio(input.initial, input.resize, input.modifiers);
  if (ratio !== undefined) {
    [width, height] = applyAspectRatio(input.initial, input.handle, width, height, ratio);
    [width, height] = clampRatioDimensions(width, ratio, constraints);
  } else {
    width = clamp(width, constraints.minWidth, constraints.maxWidth);
    height = clamp(height, constraints.minHeight, constraints.maxHeight);
  }
  let applied = resizeFromDimensionsRotated(input.initial, input.handle, width, height, rotation);
  applied = clampResizeToBoundsRotated(input.initial, input.handle, applied, rotation, input.resize?.bounds, ratio);
  const snapSatisfied = !snapActive || boxesEqual(snapped, applied);
  return result(proposed, applied, snapActive, snapSatisfied, input.initialRotation);
}

function solveRotation(input: ManipulationSolveInput): ManipulationSolveResult {
  const initialRotation = input.initialRotation ?? 0;
  const delta = input.rotationDelta ?? 0;
  if (!Number.isFinite(initialRotation) || !Number.isFinite(delta)) {
    throw new Error('Rotation values must be finite.');
  }
  const proposedRotation = initialRotation + delta;
  const snap = input.rotate?.snap;
  const snapActive = snap !== undefined && isSnapActive(snap.enabled, snap.when, input.modifiers);
  const appliedRotation = snapActive ? snapToLattice(proposedRotation, snap!.step, snap!.origin ?? 0) : proposedRotation;
  return result(input.initial, input.initial, snapActive, true, initialRotation, proposedRotation, appliedRotation);
}

function resizeFromPoint(
  initial: CRCManipulationBox,
  handle: CRCResizePosition,
  delta: Readonly<{ x: number; y: number }>,
): CRCManipulationBox {
  const movesLeft = handle.includes('left');
  const movesRight = handle.includes('right');
  const movesTop = handle.includes('top');
  const movesBottom = handle.includes('bottom');
  return freezeBox({
    left: movesLeft ? initial.left + delta.x : initial.left,
    top: movesTop ? initial.top + delta.y : initial.top,
    width: initial.width + (movesRight ? delta.x : 0) - (movesLeft ? delta.x : 0),
    height: initial.height + (movesBottom ? delta.y : 0) - (movesTop ? delta.y : 0),
  });
}

function resizeFromDimensions(
  initial: CRCManipulationBox,
  handle: CRCResizePosition,
  width: number,
  height: number,
): CRCManipulationBox {
  return freezeBox({
    left: handle.includes('left') ? initial.left + initial.width - width : initial.left,
    top: handle.includes('top') ? initial.top + initial.height - height : initial.top,
    width,
    height,
  });
}

function snapResize(
  initial: CRCManipulationBox,
  proposed: CRCManipulationBox,
  handle: CRCResizePosition,
  snap: CRCManipulationResizeSizeSnap | CRCManipulationResizeGridSnap,
): CRCManipulationBox {
  if (snap.target === 'grid') {
    const [stepX, stepY] = gridSteps(snap);
    const origin = snap.origin;
    const movesLeft = handle.includes('left');
    const movesTop = handle.includes('top');
    const edgeX = movesLeft ? proposed.left : proposed.left + proposed.width;
    const edgeY = movesTop ? proposed.top : proposed.top + proposed.height;
    const snappedEdgeX = snapToLattice(edgeX, stepX, origin?.x ?? 0);
    const snappedEdgeY = snapToLattice(edgeY, stepY, origin?.y ?? 0);
    const width = movesLeft ? initial.left + initial.width - snappedEdgeX : snappedEdgeX - initial.left;
    const height = movesTop ? initial.top + initial.height - snappedEdgeY : snappedEdgeY - initial.top;
    return resizeFromDimensions(initial, handle, width, height);
  }
  const [stepWidth, stepHeight] = sizeSteps(snap);
  return resizeFromDimensions(
    proposed,
    handle,
    snapToLattice(proposed.width, stepWidth),
    snapToLattice(proposed.height, stepHeight),
  );
}

function moveSteps(snap: CRCManipulationMoveSnap): readonly [number, number] {
  return typeof snap.step === 'number' ? [snap.step, snap.step] : [snap.step.x, snap.step.y];
}

function sizeSteps(snap: CRCManipulationResizeSizeSnap): readonly [number, number] {
  return typeof snap.step === 'number' ? [snap.step, snap.step] : [snap.step.width, snap.step.height];
}

function gridSteps(snap: CRCManipulationResizeGridSnap): readonly [number, number] {
  return typeof snap.step === 'number' ? [snap.step, snap.step] : [snap.step.x, snap.step.y];
}

function resolvedResizeConstraints(options: CRCManipulationResizeOptions | undefined): Readonly<{
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
}> {
  const minWidth = options?.minWidth ?? 1;
  const minHeight = options?.minHeight ?? 1;
  const maxWidth = options?.maxWidth ?? Number.POSITIVE_INFINITY;
  const maxHeight = options?.maxHeight ?? Number.POSITIVE_INFINITY;
  for (const [name, value] of Object.entries({ minWidth, minHeight, maxWidth, maxHeight })) {
    if (!Number.isFinite(value) && value !== Number.POSITIVE_INFINITY) {
      throw new Error(`${name} must be finite, received ${value}`);
    }
  }
  if (minWidth <= 0 || minHeight <= 0 || maxWidth <= 0 || maxHeight <= 0) {
    throw new Error('Resize constraints must be greater than zero.');
  }
  if (minWidth > maxWidth || minHeight > maxHeight) {
    throw new Error('Resize minimum dimensions must not exceed maximum dimensions.');
  }
  return { minWidth, minHeight, maxWidth, maxHeight };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampMoveToBounds(box: CRCManipulationBox, bounds: CRCManipulationBox | undefined, rotation = 0): CRCManipulationBox {
  if (!bounds) return box;
  assertFiniteBox(bounds, 'move.bounds');
  const corners = rotatedCorners(box, rotation);
  const minX = Math.min(...corners.map(point => point.x));
  const maxX = Math.max(...corners.map(point => point.x));
  const minY = Math.min(...corners.map(point => point.y));
  const maxY = Math.max(...corners.map(point => point.y));
  if (maxX - minX > bounds.width || maxY - minY > bounds.height) throw new Error('Move bounds cannot contain the initial box.');
  return freezeBox({ ...box,
    left: box.left + clamp(0, bounds.left - minX, bounds.left + bounds.width - maxX),
    top: box.top + clamp(0, bounds.top - minY, bounds.top + bounds.height - maxY),
  });
}

function clampResizeToBounds(initial: CRCManipulationBox, handle: CRCResizePosition, box: CRCManipulationBox, bounds: CRCManipulationBox | undefined): CRCManipulationBox {
  if (!bounds) return box;
  assertFiniteBox(bounds, 'resize.bounds');
  if (initial.left < bounds.left || initial.top < bounds.top || initial.left + initial.width > bounds.left + bounds.width || initial.top + initial.height > bounds.top + bounds.height) throw new Error('Resize bounds must contain the initial box.');
  const maxWidth = handle.includes('left') ? initial.left + initial.width - bounds.left : bounds.left + bounds.width - initial.left;
  const maxHeight = handle.includes('top') ? initial.top + initial.height - bounds.top : bounds.top + bounds.height - initial.top;
  return resizeFromDimensions(initial, handle, clamp(box.width, 1, maxWidth), clamp(box.height, 1, maxHeight));
}

function applyAspectRatio(initial: CRCManipulationBox, _handle: CRCResizePosition, width: number, height: number, ratio: number): readonly [number, number] {
  const widthChange = Math.abs(width / initial.width - 1);
  const heightChange = Math.abs(height / initial.height - 1);
  return widthChange >= heightChange ? [width, width / ratio] : [height * ratio, height];
}

function activeRatio(initial: CRCManipulationBox, options: CRCManipulationResizeOptions | undefined, modifiers: ManipulationSolveInput['modifiers']): number | undefined {
  const aspect = options?.aspectRatio;
  if (!aspect || !isSnapActive(true, aspect.when, modifiers)) return undefined;
  const ratio = aspect.value === 'initial' ? initial.width / initial.height : aspect.value;
  if (!Number.isFinite(ratio) || ratio <= 0) throw new Error('Resize aspect ratio must be finite and greater than zero.');
  return ratio;
}

function clampRatioDimensions(width: number, ratio: number, constraints: ReturnType<typeof resolvedResizeConstraints>): readonly [number, number] {
  const minWidth = Math.max(constraints.minWidth, constraints.minHeight * ratio);
  const maxWidth = Math.min(constraints.maxWidth, constraints.maxHeight * ratio);
  if (minWidth > maxWidth) throw new Error('Resize constraints cannot satisfy the aspect ratio.');
  const clamped = clamp(width, minWidth, maxWidth);
  return [clamped, clamped / ratio];
}

function rotateInverse(point: Readonly<{ x: number; y: number }>, radians: number): Readonly<{ x: number; y: number }> {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return { x: point.x * cosine + point.y * sine, y: -point.x * sine + point.y * cosine };
}

function resizeFromDimensionsRotated(initial: CRCManipulationBox, handle: CRCResizePosition, width: number, height: number, radians: number): CRCManipulationBox {
  const oldCenter = { x: initial.left + initial.width / 2, y: initial.top + initial.height / 2 };
  const opposite = {
    x: handle.includes('left') ? initial.width / 2 : handle.includes('right') ? -initial.width / 2 : 0,
    y: handle.includes('top') ? initial.height / 2 : handle.includes('bottom') ? -initial.height / 2 : 0,
  };
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const anchor = { x: oldCenter.x + opposite.x * cosine - opposite.y * sine, y: oldCenter.y + opposite.x * sine + opposite.y * cosine };
  const nextOpposite = {
    x: handle.includes('left') ? width / 2 : handle.includes('right') ? -width / 2 : 0,
    y: handle.includes('top') ? height / 2 : handle.includes('bottom') ? -height / 2 : 0,
  };
  const center = { x: anchor.x - (nextOpposite.x * cosine - nextOpposite.y * sine), y: anchor.y - (nextOpposite.x * sine + nextOpposite.y * cosine) };
  return freezeBox({ left: center.x - width / 2, top: center.y - height / 2, width, height });
}

function clampResizeToBoundsRotated(initial: CRCManipulationBox, handle: CRCResizePosition, box: CRCManipulationBox, rotation: number, bounds: CRCManipulationBox | undefined, ratio: number | undefined): CRCManipulationBox {
  if (!bounds) return box;
  assertFiniteBox(bounds, 'resize.bounds');
  if (!containsRotated(bounds, initial, rotation)) throw new Error('Resize bounds must contain the initial box.');
  if (containsRotated(bounds, box, rotation)) return box;
  // Each rotated corner is affine over this anchored size segment. Intersect
  // those exact half-plane intervals instead of iterating toward a boundary.
  let minimum = 0;
  let maximum = 1;
  const start = ratio === undefined ? initial : resizeFromDimensionsRotated(initial, handle, initial.width, initial.width / ratio, rotation);
  for (const coordinate of ['x', 'y'] as const) {
    const lower = coordinate === 'x' ? bounds.left : bounds.top;
    const upper = coordinate === 'x' ? bounds.left + bounds.width : bounds.top + bounds.height;
    const startCorners = rotatedCorners(start, rotation);
    const endCorners = rotatedCorners(box, rotation);
    for (let index = 0; index < 4; index++) {
      const from = startCorners[index][coordinate];
      const slope = endCorners[index][coordinate] - from;
      if (slope === 0) {
        if (from < lower || from > upper) throw new Error('Resize bounds have no feasible anchored size.');
        continue;
      }
      const first = (lower - from) / slope;
      const second = (upper - from) / slope;
      minimum = Math.max(minimum, Math.min(first, second));
      maximum = Math.min(maximum, Math.max(first, second));
    }
  }
  if (minimum > maximum) throw new Error('Resize bounds have no feasible anchored size.');
  const parameter = clamp(1, minimum, maximum);
  const width = start.width + (box.width - start.width) * parameter;
  const height = start.height + (box.height - start.height) * parameter;
  return resizeFromDimensionsRotated(initial, handle, width, height, rotation);
}

function containsRotated(bounds: CRCManipulationBox, box: CRCManipulationBox, radians: number): boolean {
  return rotatedCorners(box, radians).every(point => point.x >= bounds.left && point.x <= bounds.left + bounds.width && point.y >= bounds.top && point.y <= bounds.top + bounds.height);
}

function rotatedCorners(box: CRCManipulationBox, radians: number): readonly Readonly<{ x: number; y: number }>[] {
  const center = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [[-box.width / 2, -box.height / 2], [box.width / 2, -box.height / 2], [box.width / 2, box.height / 2], [-box.width / 2, box.height / 2]].map(([x, y]) => ({ x: center.x + x * cosine - y * sine, y: center.y + x * sine + y * cosine }));
}

function validateConfiguredSnaps(input: ManipulationSolveInput): void {
  const check = (step: number | Readonly<Record<string, number>>, origin: Readonly<Record<string, number | undefined>> | undefined, label: string) => {
    for (const [name, value] of Object.entries(typeof step === 'number' ? { value: step } : step)) assertPositiveFiniteStep(value, `${label}.${name}`);
    for (const [name, value] of Object.entries(origin ?? {})) if (value !== undefined) assertFiniteOrigin(value, `${label}.origin.${name}`);
  };
  if (input.move?.snap) check(input.move.snap.step, input.move.snap.origin, 'move.snap.step');
  if (input.resize?.snap) check(input.resize.snap.step, input.resize.snap.target === 'grid' ? input.resize.snap.origin : undefined, 'resize.snap.step');
  if (input.rotate?.snap) check(input.rotate.snap.step, { value: input.rotate.snap.origin }, 'rotate.snap.step');
}

function boxesEqual(left: CRCManipulationBox, right: CRCManipulationBox): boolean {
  return left.left === right.left && left.top === right.top && left.width === right.width && left.height === right.height;
}

function result(
  proposed: CRCManipulationBox,
  applied: CRCManipulationBox,
  snapActive: boolean,
  snapSatisfied: boolean,
  initialRotation = 0,
  proposedRotation = initialRotation,
  appliedRotation = proposedRotation,
): ManipulationSolveResult {
  return Object.freeze({ proposed, applied, snapActive, snapSatisfied, proposedRotation, appliedRotation });
}
