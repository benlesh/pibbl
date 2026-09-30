import { assertFiniteBox, assertFinitePoint, freezeBox } from "./geometry.js";
import {
  assertFiniteOrigin,
  assertPositiveFiniteStep,
  isSnapActive,
  snapToLattice,
} from "./snap.js";
import type {
  CRCManipulationBox,
  CRCManipulationMoveSnap,
  CRCManipulationResizeOptions,
  CRCManipulationResizeGridSnap,
  CRCManipulationResizeSizeSnap,
  CRCResizePosition,
  ManipulationSolveInput,
  ManipulationSolveResult,
} from "./types.js";

export function solveManipulation(
  input: ManipulationSolveInput,
): ManipulationSolveResult {
  assertFiniteBox(input.initial, "initial");
  assertFinitePoint(input.initialPoint, "initialPoint");
  assertFinitePoint(input.currentPoint, "currentPoint");
  validateConfiguredSnaps(input);
  if (!Number.isFinite(input.initialRotation ?? 0))
    throw new Error("initialRotation must be finite.");

  switch (input.operation) {
    case "move":
      return solveMove(input);
    case "resize":
      return solveResize(input);
    case "rotate":
      return solveRotation(input);
  }
}

function solveMove(input: ManipulationSolveInput): ManipulationSolveResult {
  const { initial } = input;
  const axis = input.move?.axis ?? "both";
  if (input.move?.bounds) {
    assertFiniteBox(input.move.bounds, "move.bounds");
    if (
      !containsRotated(input.move.bounds, initial, input.initialRotation ?? 0)
    )
      throw new Error("Move bounds must contain the initial box.");
  }
  const deltaX = input.currentPoint.x - input.initialPoint.x;
  const deltaY = input.currentPoint.y - input.initialPoint.y;
  const proposed = freezeBox({
    ...initial,
    left: axis === "y" ? initial.left : initial.left + deltaX,
    top: axis === "x" ? initial.top : initial.top + deltaY,
  });
  const snap = input.move?.snap;
  const snapActive =
    snap !== undefined &&
    isSnapActive(snap.enabled, snap.when, input.modifiers);
  if (!snapActive)
    return result(
      proposed,
      clampMoveToBounds(
        proposed,
        input.move?.bounds,
        input.initialRotation ?? 0,
      ),
      false,
      true,
      input.initialRotation,
    );

  const [stepX, stepY] = moveSteps(snap!);
  const origin = snap!.origin;
  const applied = freezeBox({
    ...proposed,
    left:
      axis === "y"
        ? proposed.left
        : snapToLattice(proposed.left, stepX, origin?.x ?? 0),
    top:
      axis === "x"
        ? proposed.top
        : snapToLattice(proposed.top, stepY, origin?.y ?? 0),
  });
  const bounded = clampMoveToBounds(
    applied,
    input.move?.bounds,
    input.initialRotation ?? 0,
  );
  return result(
    proposed,
    bounded,
    true,
    boxesEqual(applied, bounded),
    input.initialRotation,
  );
}

function solveResize(input: ManipulationSolveInput): ManipulationSolveResult {
  const handle = input.handle;
  if (!handle) throw new Error("Resize manipulation requires a handle.");
  const rotation = input.initialRotation ?? 0;
  if (!Number.isFinite(rotation))
    throw new Error("initialRotation must be finite.");
  if (input.resize?.snap?.target === "grid" && rotation !== 0)
    throw new Error("Grid resize snapping requires an unrotated box.");
  const raw = resizeFromPoint(
    input.initial,
    handle,
    rotateInverse(
      {
        x: input.currentPoint.x - input.initialPoint.x,
        y: input.currentPoint.y - input.initialPoint.y,
      },
      rotation,
    ),
  );
  const proposed = resizeFromDimensionsRotated(
    input.initial,
    handle,
    raw.width,
    raw.height,
    rotation,
  );
  const ratio = activeRatio(input.initial, input.resize, input.modifiers);
  const changesWidth = handle.includes("left") || handle.includes("right");
  const changesHeight = handle.includes("top") || handle.includes("bottom");
  const constraints = resolvedResizeConstraints(input.resize);
  if (ratio === undefined) {
    if (!changesWidth) {
      if (
        input.initial.width < constraints.minWidth ||
        input.initial.width > constraints.maxWidth
      )
        throw new Error(
          "Resize width constraints conflict with the fixed dimension.",
        );
      constraints.minWidth = constraints.maxWidth = input.initial.width;
    }
    if (!changesHeight) {
      if (
        input.initial.height < constraints.minHeight ||
        input.initial.height > constraints.maxHeight
      )
        throw new Error(
          "Resize height constraints conflict with the fixed dimension.",
        );
      constraints.minHeight = constraints.maxHeight = input.initial.height;
    }
  }
  const snap = input.resize?.snap;
  const snapActive =
    snap !== undefined &&
    isSnapActive(snap.enabled, snap.when, input.modifiers);
  let width = raw.width;
  let height = raw.height;
  if (ratio !== undefined) {
    const widthDrives =
      changesWidth &&
      (!changesHeight ||
        Math.abs(raw.width / input.initial.width - 1) >=
          Math.abs(raw.height / input.initial.height - 1));
    if (snapActive) {
      const snapped = snapResize(input.initial, raw, handle, snap!);
      if (widthDrives) width = snapped.width;
      else height = snapped.height;
    }
    if (widthDrives) height = width / ratio;
    else width = height * ratio;
  } else if (snapActive) {
    const snapped = snapResize(input.initial, raw, handle, snap!);
    width = snapped.width;
    height = snapped.height;
  }
  const bounded = constrainDimensions(
    input.initial,
    handle,
    { width, height },
    rotation,
    input.resize?.bounds,
    ratio,
    constraints,
  );
  const applied = resizeFromDimensionsRotated(
    input.initial,
    handle,
    bounded.width,
    bounded.height,
    rotation,
  );
  const onLattice = (value: number, step: number, origin = 0) =>
    Math.abs(value - snapToLattice(value, step, origin)) <=
    1e-9 * Math.max(1, Math.abs(value));
  let snapSatisfied = true;
  if (snapActive) {
    if (snap!.target === "grid") {
      const grid = snap as CRCManipulationResizeGridSnap;
      const [stepX, stepY] = gridSteps(grid);
      snapSatisfied =
        (!changesWidth ||
          onLattice(
            handle.includes("left")
              ? applied.left
              : applied.left + applied.width,
            stepX,
            grid.origin?.x,
          )) &&
        (!changesHeight ||
          onLattice(
            handle.includes("top") ? applied.top : applied.top + applied.height,
            stepY,
            grid.origin?.y,
          ));
    } else {
      const [stepWidth, stepHeight] = sizeSteps(
        snap as CRCManipulationResizeSizeSnap,
      );
      snapSatisfied =
        (!(changesWidth || ratio !== undefined) ||
          onLattice(applied.width, stepWidth)) &&
        (!(changesHeight || ratio !== undefined) ||
          onLattice(applied.height, stepHeight));
    }
  }
  return result(proposed, applied, snapActive, snapSatisfied, rotation);
}

function solveRotation(input: ManipulationSolveInput): ManipulationSolveResult {
  const initialRotation = input.initialRotation ?? 0;
  const delta = input.rotationDelta ?? 0;
  if (!Number.isFinite(initialRotation) || !Number.isFinite(delta)) {
    throw new Error("Rotation values must be finite.");
  }
  const proposedRotation = initialRotation + delta;
  const snap = input.rotate?.snap;
  const snapActive =
    snap !== undefined &&
    isSnapActive(snap.enabled, snap.when, input.modifiers);
  const appliedRotation = snapActive
    ? snapToLattice(proposedRotation, snap!.step, snap!.origin ?? 0)
    : proposedRotation;
  return result(
    input.initial,
    input.initial,
    snapActive,
    true,
    initialRotation,
    proposedRotation,
    appliedRotation,
  );
}

function resizeFromPoint(
  initial: CRCManipulationBox,
  handle: CRCResizePosition,
  delta: Readonly<{ x: number; y: number }>,
): CRCManipulationBox {
  const movesLeft = handle.includes("left");
  const movesRight = handle.includes("right");
  const movesTop = handle.includes("top");
  const movesBottom = handle.includes("bottom");
  return freezeBox({
    left: movesLeft ? initial.left + delta.x : initial.left,
    top: movesTop ? initial.top + delta.y : initial.top,
    width:
      initial.width + (movesRight ? delta.x : 0) - (movesLeft ? delta.x : 0),
    height:
      initial.height + (movesBottom ? delta.y : 0) - (movesTop ? delta.y : 0),
  });
}

function resizeFromDimensions(
  initial: CRCManipulationBox,
  handle: CRCResizePosition,
  width: number,
  height: number,
): CRCManipulationBox {
  return freezeBox({
    left: handle.includes("left")
      ? initial.left + initial.width - width
      : initial.left,
    top: handle.includes("top")
      ? initial.top + initial.height - height
      : initial.top,
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
  if (snap.target === "grid") {
    const [stepX, stepY] = gridSteps(snap);
    const origin = snap.origin;
    const movesLeft = handle.includes("left");
    const movesTop = handle.includes("top");
    const edgeX = movesLeft ? proposed.left : proposed.left + proposed.width;
    const edgeY = movesTop ? proposed.top : proposed.top + proposed.height;
    const snappedEdgeX = snapToLattice(edgeX, stepX, origin?.x ?? 0);
    const snappedEdgeY = snapToLattice(edgeY, stepY, origin?.y ?? 0);
    const width = !(handle.includes("left") || handle.includes("right"))
      ? initial.width
      : movesLeft
        ? initial.left + initial.width - snappedEdgeX
        : snappedEdgeX - initial.left;
    const height = !(handle.includes("top") || handle.includes("bottom"))
      ? initial.height
      : movesTop
        ? initial.top + initial.height - snappedEdgeY
        : snappedEdgeY - initial.top;
    return resizeFromDimensions(initial, handle, width, height);
  }
  const [stepWidth, stepHeight] = sizeSteps(snap);
  return resizeFromDimensions(
    proposed,
    handle,
    handle.includes("left") || handle.includes("right")
      ? snapToLattice(proposed.width, stepWidth)
      : proposed.width,
    handle.includes("top") || handle.includes("bottom")
      ? snapToLattice(proposed.height, stepHeight)
      : proposed.height,
  );
}

function moveSteps(snap: CRCManipulationMoveSnap): readonly [number, number] {
  return typeof snap.step === "number"
    ? [snap.step, snap.step]
    : [snap.step.x, snap.step.y];
}

function sizeSteps(
  snap: CRCManipulationResizeSizeSnap,
): readonly [number, number] {
  return typeof snap.step === "number"
    ? [snap.step, snap.step]
    : [snap.step.width, snap.step.height];
}

function gridSteps(
  snap: CRCManipulationResizeGridSnap,
): readonly [number, number] {
  return typeof snap.step === "number"
    ? [snap.step, snap.step]
    : [snap.step.x, snap.step.y];
}

function resolvedResizeConstraints(
  options: CRCManipulationResizeOptions | undefined,
): {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
} {
  for (const name of [
    "minWidth",
    "minHeight",
    "maxWidth",
    "maxHeight",
  ] as const) {
    const value = options?.[name];
    if (value !== undefined && (!Number.isFinite(value) || value <= 0))
      throw new Error(`${name} must be positive and finite.`);
  }
  const minWidth = options?.minWidth ?? 1;
  const minHeight = options?.minHeight ?? 1;
  const maxWidth = options?.maxWidth ?? Number.POSITIVE_INFINITY;
  const maxHeight = options?.maxHeight ?? Number.POSITIVE_INFINITY;
  for (const [name, value] of Object.entries({
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
  })) {
    if (!Number.isFinite(value) && value !== Number.POSITIVE_INFINITY) {
      throw new Error(`${name} must be finite, received ${value}`);
    }
  }
  if (minWidth <= 0 || minHeight <= 0 || maxWidth <= 0 || maxHeight <= 0) {
    throw new Error("Resize constraints must be greater than zero.");
  }
  if (minWidth > maxWidth || minHeight > maxHeight) {
    throw new Error(
      "Resize minimum dimensions must not exceed maximum dimensions.",
    );
  }
  return { minWidth, minHeight, maxWidth, maxHeight };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampMoveToBounds(
  box: CRCManipulationBox,
  bounds: CRCManipulationBox | undefined,
  rotation = 0,
): CRCManipulationBox {
  if (!bounds) return box;
  assertFiniteBox(bounds, "move.bounds");
  const corners = rotatedCorners(box, rotation);
  const minX = Math.min(...corners.map((point) => point.x));
  const maxX = Math.max(...corners.map((point) => point.x));
  const minY = Math.min(...corners.map((point) => point.y));
  const maxY = Math.max(...corners.map((point) => point.y));
  if (maxX - minX > bounds.width || maxY - minY > bounds.height)
    throw new Error("Move bounds cannot contain the initial box.");
  return freezeBox({
    ...box,
    left:
      box.left +
      clamp(0, bounds.left - minX, bounds.left + bounds.width - maxX),
    top:
      box.top + clamp(0, bounds.top - minY, bounds.top + bounds.height - maxY),
  });
}

function activeRatio(
  initial: CRCManipulationBox,
  options: CRCManipulationResizeOptions | undefined,
  modifiers: ManipulationSolveInput["modifiers"],
): number | undefined {
  const aspect = options?.aspectRatio;
  if (!aspect) return undefined;
  const ratio =
    aspect.value === "initial" ? initial.width / initial.height : aspect.value;
  if (!Number.isFinite(ratio) || ratio <= 0)
    throw new Error(
      "Resize aspect ratio must be finite and greater than zero.",
    );
  return isSnapActive(true, aspect.when, modifiers) ? ratio : undefined;
}

function rotateInverse(
  point: Readonly<{ x: number; y: number }>,
  radians: number,
): Readonly<{ x: number; y: number }> {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: point.x * cosine + point.y * sine,
    y: -point.x * sine + point.y * cosine,
  };
}

function resizeFromDimensionsRotated(
  initial: CRCManipulationBox,
  handle: CRCResizePosition,
  width: number,
  height: number,
  radians: number,
): CRCManipulationBox {
  const oldCenter = {
    x: initial.left + initial.width / 2,
    y: initial.top + initial.height / 2,
  };
  const opposite = {
    x: handle.includes("left")
      ? initial.width / 2
      : handle.includes("right")
        ? -initial.width / 2
        : 0,
    y: handle.includes("top")
      ? initial.height / 2
      : handle.includes("bottom")
        ? -initial.height / 2
        : 0,
  };
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const anchor = {
    x: oldCenter.x + opposite.x * cosine - opposite.y * sine,
    y: oldCenter.y + opposite.x * sine + opposite.y * cosine,
  };
  const nextOpposite = {
    x: handle.includes("left")
      ? width / 2
      : handle.includes("right")
        ? -width / 2
        : 0,
    y: handle.includes("top")
      ? height / 2
      : handle.includes("bottom")
        ? -height / 2
        : 0,
  };
  const center = {
    x: anchor.x - (nextOpposite.x * cosine - nextOpposite.y * sine),
    y: anchor.y - (nextOpposite.x * sine + nextOpposite.y * cosine),
  };
  return freezeBox({
    left: center.x - width / 2,
    top: center.y - height / 2,
    width,
    height,
  });
}

function constrainDimensions(
  initial: CRCManipulationBox,
  handle: CRCResizePosition,
  proposed: SizePoint,
  rotation: number,
  bounds: CRCManipulationBox | undefined,
  ratio: number | undefined,
  constraints: ReturnType<typeof resolvedResizeConstraints>,
): SizePoint {
  if (!Number.isFinite(proposed.width) || !Number.isFinite(proposed.height))
    throw new Error("Resize geometry exceeds finite coordinates.");
  if (bounds) {
    assertFiniteBox(bounds, "resize.bounds");
    if (!containsRotated(bounds, initial, rotation))
      throw new Error("Resize bounds must contain the initial box.");
  }
  if (ratio !== undefined) {
    let minimum = Math.max(constraints.minWidth, constraints.minHeight * ratio);
    let maximum = Math.min(constraints.maxWidth, constraints.maxHeight * ratio);
    for (const plane of bounds
      ? boundsPlanes(initial, handle, rotation, bounds)
      : []) {
      const slope = plane.a + plane.b / ratio;
      if (Math.abs(slope) < 1e-12) {
        if (plane.c < -1e-9)
          throw new Error("Resize bounds have no feasible ratio.");
      } else if (slope > 0) maximum = Math.min(maximum, plane.c / slope);
      else minimum = Math.max(minimum, plane.c / slope);
    }
    if (minimum > maximum)
      throw new Error(
        "Resize constraints cannot satisfy the aspect ratio and bounds.",
      );
    const width = clamp(proposed.width, minimum, maximum);
    return { width, height: width / ratio };
  }
  if (bounds)
    return projectSizeToBounds(
      initial,
      handle,
      proposed,
      rotation,
      bounds,
      constraints,
    );
  return {
    width: clamp(proposed.width, constraints.minWidth, constraints.maxWidth),
    height: clamp(
      proposed.height,
      constraints.minHeight,
      constraints.maxHeight,
    ),
  };
}

type SizePoint = Readonly<{ width: number; height: number }>;
type HalfPlane = Readonly<{ a: number; b: number; c: number }>;

function projectSizeToBounds(
  initial: CRCManipulationBox,
  handle: CRCResizePosition,
  proposed: SizePoint,
  rotation: number,
  bounds: CRCManipulationBox,
  constraints: ReturnType<typeof resolvedResizeConstraints>,
): SizePoint {
  const maximumWidth = Number.isFinite(constraints.maxWidth)
    ? constraints.maxWidth
    : Math.max(initial.width, bounds.width + bounds.height);
  const maximumHeight = Number.isFinite(constraints.maxHeight)
    ? constraints.maxHeight
    : Math.max(initial.height, bounds.width + bounds.height);
  let polygon: SizePoint[] = [
    { width: constraints.minWidth, height: constraints.minHeight },
    { width: maximumWidth, height: constraints.minHeight },
    { width: maximumWidth, height: maximumHeight },
    { width: constraints.minWidth, height: maximumHeight },
  ];
  const planes = boundsPlanes(initial, handle, rotation, bounds);
  for (const plane of planes) polygon = clipPolygon(polygon, plane);
  if (polygon.length === 0)
    throw new Error("Resize bounds have no feasible size region.");
  return closestPointInPolygon(
    { width: proposed.width, height: proposed.height },
    polygon,
  );
}

function boundsPlanes(
  initial: CRCManipulationBox,
  handle: CRCResizePosition,
  rotation: number,
  bounds: CRCManipulationBox,
): readonly HalfPlane[] {
  const zero = resizeFromDimensionsRotated(initial, handle, 0, 0, rotation);
  const unitWidth = resizeFromDimensionsRotated(
    initial,
    handle,
    1,
    0,
    rotation,
  );
  const unitHeight = resizeFromDimensionsRotated(
    initial,
    handle,
    0,
    1,
    rotation,
  );
  const planes: HalfPlane[] = [];
  const zeroCorners = rotatedCorners(zero, rotation);
  const widthCorners = rotatedCorners(unitWidth, rotation);
  const heightCorners = rotatedCorners(unitHeight, rotation);
  for (let index = 0; index < 4; index++) {
    for (const [coordinate, lower, upper] of [
      ["x", bounds.left, bounds.left + bounds.width],
      ["y", bounds.top, bounds.top + bounds.height],
    ] as const) {
      const constant = zeroCorners[index][coordinate];
      const a = widthCorners[index][coordinate] - constant;
      const b = heightCorners[index][coordinate] - constant;
      planes.push(
        { a, b, c: upper - constant },
        { a: -a, b: -b, c: constant - lower },
      );
    }
  }
  return planes;
}

function clipPolygon(
  points: readonly SizePoint[],
  plane: HalfPlane,
): SizePoint[] {
  const output: SizePoint[] = [];
  for (let index = 0; index < points.length; index++) {
    const from = points[index];
    const to = points[(index + 1) % points.length];
    const fromValue = plane.a * from.width + plane.b * from.height - plane.c;
    const toValue = plane.a * to.width + plane.b * to.height - plane.c;
    if (fromValue <= 0) output.push(from);
    if (fromValue <= 0 !== toValue <= 0) {
      const t = fromValue / (fromValue - toValue);
      output.push({
        width: from.width + (to.width - from.width) * t,
        height: from.height + (to.height - from.height) * t,
      });
    }
  }
  return output;
}

function closestPointInPolygon(
  point: SizePoint,
  polygon: readonly SizePoint[],
): SizePoint {
  const area = polygon.reduce((sum, candidate, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return sum + candidate.width * next.height - next.width * candidate.height;
  }, 0);
  if (
    Math.abs(area) > 1e-12 &&
    polygon.every((candidate, index) => {
      const next = polygon[(index + 1) % polygon.length];
      return (
        (next.width - candidate.width) * (point.height - candidate.height) -
          (next.height - candidate.height) * (point.width - candidate.width) >=
        -1e-9
      );
    })
  )
    return point;
  let best = polygon[0];
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index++) {
    const from = polygon[index];
    const to = polygon[(index + 1) % polygon.length];
    const dx = to.width - from.width;
    const dy = to.height - from.height;
    const scale =
      dx === 0 && dy === 0
        ? 0
        : clamp(
            ((point.width - from.width) * dx +
              (point.height - from.height) * dy) /
              (dx * dx + dy * dy),
            0,
            1,
          );
    const candidate = {
      width: from.width + dx * scale,
      height: from.height + dy * scale,
    };
    const nextDistance =
      (candidate.width - point.width) ** 2 +
      (candidate.height - point.height) ** 2;
    if (
      nextDistance < distance ||
      (nextDistance === distance &&
        (candidate.width > best.width ||
          (candidate.width === best.width && candidate.height > best.height)))
    ) {
      best = candidate;
      distance = nextDistance;
    }
  }
  return best;
}

function containsRotated(
  bounds: CRCManipulationBox,
  box: CRCManipulationBox,
  radians: number,
): boolean {
  return rotatedCorners(box, radians).every(
    (point) =>
      point.x >= bounds.left &&
      point.x <= bounds.left + bounds.width &&
      point.y >= bounds.top &&
      point.y <= bounds.top + bounds.height,
  );
}

function rotatedCorners(
  box: CRCManipulationBox,
  radians: number,
): readonly Readonly<{ x: number; y: number }>[] {
  const center = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    [-box.width / 2, -box.height / 2],
    [box.width / 2, -box.height / 2],
    [box.width / 2, box.height / 2],
    [-box.width / 2, box.height / 2],
  ].map(([x, y]) => ({
    x: center.x + x * cosine - y * sine,
    y: center.y + x * sine + y * cosine,
  }));
}

function validateConfiguredSnaps(input: ManipulationSolveInput): void {
  const check = (
    step: number | Readonly<Record<string, number>>,
    origin: Readonly<Record<string, number | undefined>> | undefined,
    label: string,
  ) => {
    for (const [name, value] of Object.entries(
      typeof step === "number" ? { value: step } : step,
    ))
      assertPositiveFiniteStep(value, `${label}.${name}`);
    for (const [name, value] of Object.entries(origin ?? {}))
      if (value !== undefined)
        assertFiniteOrigin(value, `${label}.origin.${name}`);
  };
  if (input.move?.snap)
    check(input.move.snap.step, input.move.snap.origin, "move.snap.step");
  if (input.resize?.snap)
    check(
      input.resize.snap.step,
      input.resize.snap.target === "grid"
        ? input.resize.snap.origin
        : undefined,
      "resize.snap.step",
    );
  if (input.rotate?.snap)
    check(
      input.rotate.snap.step,
      { value: input.rotate.snap.origin },
      "rotate.snap.step",
    );
}

function boxesEqual(
  left: CRCManipulationBox,
  right: CRCManipulationBox,
): boolean {
  return (
    left.left === right.left &&
    left.top === right.top &&
    left.width === right.width &&
    left.height === right.height
  );
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
  assertFiniteBox(applied, "applied");
  if (!Number.isFinite(proposedRotation) || !Number.isFinite(appliedRotation))
    throw new Error("Rotation exceeds finite coordinates.");
  return Object.freeze({
    proposed,
    applied,
    snapActive,
    snapSatisfied,
    proposedRotation,
    appliedRotation,
  });
}
