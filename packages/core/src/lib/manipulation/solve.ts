import { assertFiniteBox, assertFinitePoint, freezeBox } from './geometry.js';
import { isSnapActive, snapToLattice } from './snap.js';
import type {
  CRCManipulationBox,
  CRCManipulationMoveSnap,
  CRCManipulationResizeOptions,
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
      throw new Error('Rotation manipulation is not implemented.');
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
  if (!snapActive) return result(proposed, proposed, false, true);

  const [stepX, stepY] = moveSteps(snap!);
  const origin = snap!.origin;
  const applied = freezeBox({
    ...proposed,
    left: axis === 'y' ? proposed.left : snapToLattice(proposed.left, stepX, origin?.x ?? 0),
    top: axis === 'x' ? proposed.top : snapToLattice(proposed.top, stepY, origin?.y ?? 0),
  });
  return result(proposed, applied, true, true);
}

function solveResize(input: ManipulationSolveInput): ManipulationSolveResult {
  if (!input.handle) throw new Error('Resize manipulation requires a handle.');
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
  const snapped = snapActive ? snapResize(proposed, input.handle, snap!) : proposed;
  const width = clamp(snapped.width, constraints.minWidth, constraints.maxWidth);
  const height = clamp(snapped.height, constraints.minHeight, constraints.maxHeight);
  const applied = resizeFromDimensions(input.initial, input.handle, width, height);
  const snapSatisfied = !snapActive || (width === snapped.width && height === snapped.height);
  return result(proposed, applied, snapActive, snapSatisfied);
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
  proposed: CRCManipulationBox,
  handle: CRCResizePosition,
  snap: CRCManipulationResizeSizeSnap,
): CRCManipulationBox {
  if (snap.target !== undefined && snap.target !== 'size') {
    throw new Error(`Resize snap target "${snap.target}" is not implemented.`);
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

function result(
  proposed: CRCManipulationBox,
  applied: CRCManipulationBox,
  snapActive: boolean,
  snapSatisfied: boolean,
): ManipulationSolveResult {
  return Object.freeze({ proposed, applied, snapActive, snapSatisfied });
}
