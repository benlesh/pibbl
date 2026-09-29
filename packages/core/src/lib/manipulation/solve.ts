import { assertFiniteBox, assertFinitePoint, freezeBox } from './geometry.js';
import { isSnapActive, snapToLattice } from './snap.js';
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
  if (!snapActive) return result(proposed, clampMoveToBounds(proposed, input.move?.bounds), false, true, input.initialRotation);

  const [stepX, stepY] = moveSteps(snap!);
  const origin = snap!.origin;
  const applied = freezeBox({
    ...proposed,
    left: axis === 'y' ? proposed.left : snapToLattice(proposed.left, stepX, origin?.x ?? 0),
    top: axis === 'x' ? proposed.top : snapToLattice(proposed.top, stepY, origin?.y ?? 0),
  });
  const bounded = clampMoveToBounds(applied, input.move?.bounds);
  return result(proposed, bounded, true, boxesEqual(applied, bounded), input.initialRotation);
}

function solveResize(input: ManipulationSolveInput): ManipulationSolveResult {
  if (!input.handle) throw new Error('Resize manipulation requires a handle.');
  if (input.resize?.snap?.target === 'grid' && (input.initialRotation ?? 0) !== 0) {
    throw new Error('Grid resize snapping requires an unrotated box.');
  }
  const proposed = resizeFromPoint(input.initial, input.handle, {
    x: input.currentPoint.x - input.initialPoint.x,
    y: input.currentPoint.y - input.initialPoint.y,
  });
  const constraints = resolvedResizeConstraints(input.resize);
  const snap = input.resize?.snap;
  const snapActive = snap !== undefined && isSnapActive(
    snap.enabled,
    snap.when,
    input.modifiers,
  );
  const snapped = snapActive ? snapResize(input.initial, proposed, input.handle, snap!) : proposed;
  let width = clamp(snapped.width, constraints.minWidth, constraints.maxWidth);
  let height = clamp(snapped.height, constraints.minHeight, constraints.maxHeight);
  [width, height] = applyAspectRatio(input.initial, input.handle, width, height, input.resize?.aspectRatio?.value, input.resize?.aspectRatio?.when, input.modifiers);
  let applied = resizeFromDimensions(input.initial, input.handle, width, height);
  applied = clampResizeToBounds(input.initial, input.handle, applied, input.resize?.bounds);
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

function clampMoveToBounds(box: CRCManipulationBox, bounds: CRCManipulationBox | undefined): CRCManipulationBox {
  if (!bounds) return box;
  assertFiniteBox(bounds, 'move.bounds');
  if (box.width > bounds.width || box.height > bounds.height) throw new Error('Move bounds cannot contain the initial box.');
  return freezeBox({ ...box,
    left: clamp(box.left, bounds.left, bounds.left + bounds.width - box.width),
    top: clamp(box.top, bounds.top, bounds.top + bounds.height - box.height),
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

function applyAspectRatio(initial: CRCManipulationBox, _handle: CRCResizePosition, width: number, height: number, value: 'initial' | number | undefined, when: import('./types.js').CRCManipulationWhen | undefined, modifiers: ManipulationSolveInput['modifiers']): readonly [number, number] {
  if (value === undefined || !isSnapActive(true, when, modifiers)) return [width, height];
  const ratio = value === 'initial' ? initial.width / initial.height : value;
  if (!Number.isFinite(ratio) || ratio <= 0) throw new Error('Resize aspect ratio must be finite and greater than zero.');
  const widthChange = Math.abs(width / initial.width - 1);
  const heightChange = Math.abs(height / initial.height - 1);
  return widthChange >= heightChange ? [width, width / ratio] : [height * ratio, height];
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
