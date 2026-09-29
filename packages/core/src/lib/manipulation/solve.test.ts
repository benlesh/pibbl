import { describe, expect, it } from "vitest";
import { solveManipulation } from "./solve";

describe("solveManipulation", () => {
  const box = { left: 32, top: 16, width: 100, height: 80 };

  it("snaps a move from its initial box only while Shift is held", () => {
    expect(
      solveManipulation({
        operation: "move",
        initial: box,
        initialPoint: { x: 10, y: 10 },
        currentPoint: { x: 33, y: 10 },
        modifiers: { shift: true },
        move: { snap: { step: 16, when: "shift" } },
      }),
    ).toMatchObject({
      proposed: { left: 55, top: 16, width: 100, height: 80 },
      applied: { left: 48, top: 16, width: 100, height: 80 },
      snapActive: true,
      snapSatisfied: true,
    });

    expect(
      solveManipulation({
        operation: "move",
        initial: box,
        initialPoint: { x: 10, y: 10 },
        currentPoint: { x: 33, y: 10 },
        modifiers: {},
        move: { snap: { step: 16, when: "shift" } },
      }).applied.left,
    ).toBe(55);
  });

  it("rounds negative halfway lattice points toward the larger index and honors origins", () => {
    expect(
      solveManipulation({
        operation: "move",
        initial: { left: -24, top: 0, width: 20, height: 20 },
        initialPoint: { x: 0, y: 0 },
        currentPoint: { x: 4, y: 0 },
        modifiers: {},
        move: { snap: { step: 16, origin: { x: 4, y: 0 } } },
      }).applied.left,
    ).toBe(-12);
  });

  it("snaps a bottom-right resize while preserving the top-left anchor", () => {
    expect(
      solveManipulation({
        operation: "resize",
        handle: "bottom-right",
        initial: box,
        initialPoint: { x: 0, y: 0 },
        currentPoint: { x: 23, y: 11 },
        modifiers: {},
        resize: { snap: { target: "size", step: 8 } },
      }),
    ).toMatchObject({
      applied: { left: 32, top: 16, width: 120, height: 88 },
      snapActive: true,
      snapSatisfied: true,
    });
  });

  it("preserves the opposite corner and gives minimum dimensions precedence over snapping", () => {
    expect(
      solveManipulation({
        operation: "resize",
        handle: "top-left",
        initial: box,
        initialPoint: { x: 0, y: 0 },
        currentPoint: { x: 91, y: 71 },
        modifiers: {},
        resize: {
          minWidth: 32,
          minHeight: 24,
          snap: { target: "size", step: 16 },
        },
      }).applied,
    ).toEqual({ left: 100, top: 72, width: 32, height: 24 });
  });

  it("snaps unwrapped rotation deltas with positive half ties", () => {
    expect(
      solveManipulation({
        operation: "rotate",
        initial: box,
        initialRotation: 0,
        rotationDelta: (22 * Math.PI) / 180,
        initialPoint: { x: 0, y: 0 },
        currentPoint: { x: 0, y: 0 },
        modifiers: {},
        rotate: { snap: { step: (15 * Math.PI) / 180 } },
      }).appliedRotation,
    ).toBeCloseTo((15 * Math.PI) / 180);
    expect(
      solveManipulation({
        operation: "rotate",
        initial: box,
        initialRotation: 0,
        rotationDelta: (22.5 * Math.PI) / 180,
        initialPoint: { x: 0, y: 0 },
        currentPoint: { x: 0, y: 0 },
        modifiers: {},
        rotate: { snap: { step: (15 * Math.PI) / 180 } },
      }).appliedRotation,
    ).toBeCloseTo((30 * Math.PI) / 180);
  });

  it("uses width as the tied dominant axis for ratio-locked corner resizing", () => {
    expect(
      solveManipulation({
        operation: "resize",
        handle: "bottom-right",
        initial: { left: 0, top: 0, width: 100, height: 50 },
        initialPoint: { x: 0, y: 0 },
        currentPoint: { x: 20, y: 10 },
        modifiers: {},
        resize: { aspectRatio: { value: "initial" } },
      }).applied,
    ).toEqual({ left: 0, top: 0, width: 120, height: 60 });
  });

  it("snaps the moving resize edge to its parent grid and clamps move bounds", () => {
    expect(
      solveManipulation({
        operation: "resize",
        handle: "bottom-right",
        initial: { left: 3, top: 0, width: 32, height: 20 },
        initialPoint: { x: 0, y: 0 },
        currentPoint: { x: 11, y: 0 },
        modifiers: {},
        resize: { snap: { target: "grid", step: 16 } },
      }).applied.width,
    ).toBe(45);
    expect(
      solveManipulation({
        operation: "move",
        initial: { ...box, left: 10, top: 10 },
        initialPoint: { x: 0, y: 0 },
        currentPoint: { x: 100, y: 100 },
        modifiers: {},
        move: { bounds: { left: 0, top: 0, width: 120, height: 100 } },
      }).applied,
    ).toEqual({ left: 20, top: 20, width: 100, height: 80 });
  });

  it("resizes on rotated local axes while preserving the opposite parent-space anchor", () => {
    const result = solveManipulation({
      operation: "resize",
      handle: "bottom-right",
      initial: { left: 20, top: 30, width: 100, height: 50 },
      initialRotation: Math.PI / 2,
      initialPoint: { x: 0, y: 0 },
      currentPoint: { x: 0, y: 20 },
      modifiers: {},
    });
    expect(result.applied).toEqual({
      left: 10,
      top: 40,
      width: 120,
      height: 50,
    });
  });

  it("keeps ratio-locked edge resizing symmetric on the secondary axis", () => {
    expect(
      solveManipulation({
        operation: "resize",
        handle: "right",
        initial: { left: 10, top: 20, width: 100, height: 50 },
        initialPoint: { x: 0, y: 0 },
        currentPoint: { x: 40, y: 0 },
        modifiers: {},
        resize: { aspectRatio: { value: "initial" } },
      }).applied,
    ).toEqual({ left: 10, top: 10, width: 140, height: 70 });
  });

  it("validates inactive snap steps and rejects rotated grid resize", () => {
    expect(() =>
      solveManipulation({
        operation: "move",
        initial: box,
        initialPoint: { x: 0, y: 0 },
        currentPoint: { x: 0, y: 0 },
        modifiers: {},
        move: { snap: { step: 0, enabled: false } },
      }),
    ).toThrow("greater than zero");
    expect(() =>
      solveManipulation({
        operation: "resize",
        handle: "right",
        initial: box,
        initialRotation: 0.1,
        initialPoint: { x: 0, y: 0 },
        currentPoint: { x: 0, y: 0 },
        modifiers: {},
        resize: { snap: { target: "grid", step: 8 } },
      }),
    ).toThrow("unrotated");
  });

  it.each([
    "top-left",
    "top",
    "top-right",
    "right",
    "bottom-right",
    "bottom",
    "bottom-left",
    "left",
  ] as const)("preserves a rotated opposite anchor for %s", (handle) => {
    const initial = { left: 40, top: 30, width: 80, height: 60 };
    const result = solveManipulation({
      operation: "resize",
      handle,
      initial,
      initialRotation: Math.PI / 6,
      initialPoint: { x: 0, y: 0 },
      currentPoint: { x: 12, y: 9 },
      modifiers: {},
    });
    expect(result.applied.width).toBeGreaterThanOrEqual(1);
    expect(result.applied.height).toBeGreaterThanOrEqual(1);
    const anchor = (box: typeof initial) => {
      const x = handle.includes("left")
        ? box.width / 2
        : handle.includes("right")
          ? -box.width / 2
          : 0;
      const y = handle.includes("top")
        ? box.height / 2
        : handle.includes("bottom")
          ? -box.height / 2
          : 0;
      return {
        x:
          box.left +
          box.width / 2 +
          x * Math.cos(Math.PI / 6) -
          y * Math.sin(Math.PI / 6),
        y:
          box.top +
          box.height / 2 +
          x * Math.sin(Math.PI / 6) +
          y * Math.cos(Math.PI / 6),
      };
    };
    expect(anchor(result.applied).x).toBeCloseTo(anchor(initial).x, 10);
    expect(anchor(result.applied).y).toBeCloseTo(anchor(initial).y, 10);
  });

  it("projects unlocked sizes into the bounded feasible region and honors limits", () => {
    const result = solveManipulation({
      operation: "resize",
      handle: "bottom-right",
      initial: { left: 10, top: 10, width: 40, height: 30 },
      initialRotation: Math.PI / 6,
      initialPoint: { x: 0, y: 0 },
      currentPoint: { x: 200, y: 200 },
      modifiers: {},
      resize: {
        minWidth: 20,
        minHeight: 20,
        maxWidth: 90,
        maxHeight: 70,
        bounds: { left: 0, top: 0, width: 120, height: 120 },
      },
    });
    expect(result.applied.width).toBeLessThanOrEqual(90);
    expect(result.applied.height).toBeLessThanOrEqual(70);
  });

  it("does not size-snap an untouched dimension", () => {
    expect(
      solveManipulation({
        operation: "resize",
        handle: "right",
        initial: { left: 0, top: 0, width: 31, height: 13 },
        initialPoint: { x: 0, y: 0 },
        currentPoint: { x: 2, y: 0 },
        modifiers: {},
        resize: { snap: { target: "size", step: 8 } },
      }).applied.height,
    ).toBe(13);
  });
});

describe("constraint priority and snapshot geometry", () => {
  const pointer = { initialPoint: { x: 0, y: 0 }, modifiers: {} };
  it("reports satisfied size snapping for a rotated resize", () => {
    const result = solveManipulation({
      ...pointer,
      operation: "resize",
      handle: "bottom-right",
      initial: { left: 100, top: 100, width: 100, height: 80 },
      initialRotation: Math.PI / 2,
      currentPoint: { x: -11, y: 23 },
      resize: { snap: { step: 8 } },
    });
    expect(result.applied.width).toBe(120);
    expect(result.applied.height).toBe(88);
    expect(result.snapSatisfied).toBe(true);
    expect(result.proposed.left).toBeCloseTo(83);
    expect(result.proposed.top).toBeCloseTo(106);
  });
  it("selects the ratio driver before snapping and snaps only that driver", () => {
    const result = solveManipulation({
      ...pointer,
      operation: "resize",
      handle: "bottom-right",
      initial: { left: 0, top: 0, width: 100, height: 50 },
      currentPoint: { x: 11, y: 6 },
      resize: {
        aspectRatio: { value: "initial" },
        snap: { step: { width: 80, height: 4 } },
      },
    });
    expect(result.applied.width).toBe(112);
    expect(result.applied.height).toBe(56);
    expect(result.snapSatisfied).toBe(false);
  });
  it("rejects bounds that cannot satisfy the minimum dimensions and locked ratio", () => {
    expect(() =>
      solveManipulation({
        ...pointer,
        operation: "resize",
        handle: "bottom-right",
        initial: { left: 0, top: 0, width: 100, height: 50 },
        currentPoint: { x: 100, y: 50 },
        resize: {
          minWidth: 120,
          minHeight: 60,
          aspectRatio: { value: 2 },
          bounds: { left: 0, top: 0, width: 110, height: 100 },
        },
      }),
    ).toThrow();
  });
  it("keeps the untouched dimension fixed for grid snapping on an edge", () => {
    const result = solveManipulation({
      ...pointer,
      operation: "resize",
      handle: "right",
      initial: { left: 0, top: 0, width: 100, height: 13 },
      currentPoint: { x: 8, y: 0 },
      resize: { snap: { target: "grid", step: 16 } },
    });
    expect(result.applied.height).toBe(13);
  });
  it("does not shrink the untouched dimension to fit a rotated edge resize", () => {
    const result = solveManipulation({
      ...pointer,
      operation: "resize",
      handle: "right",
      initial: { left: 20, top: 20, width: 40, height: 30 },
      initialRotation: Math.PI / 4,
      currentPoint: { x: 140, y: 140 },
      resize: { bounds: { left: 0, top: 0, width: 80, height: 80 } },
    });
    expect(result.applied.height).toBeCloseTo(30);
  });
});

it("rejects starting outside movement bounds and nonfinite explicit dimension constraints", () => {
  const initial = { left: 0, top: 0, width: 20, height: 20 };
  const common = {
    initial,
    initialPoint: { x: 0, y: 0 },
    currentPoint: { x: 0, y: 0 },
    modifiers: {},
  };
  expect(() =>
    solveManipulation({
      ...common,
      operation: "move",
      move: { bounds: { left: 10, top: 0, width: 40, height: 40 } },
    }),
  ).toThrow();
  expect(() =>
    solveManipulation({
      ...common,
      operation: "resize",
      handle: "right",
      resize: { minWidth: Infinity },
    }),
  ).toThrow();
  expect(() =>
    solveManipulation({ ...common, operation: "move", initialRotation: NaN }),
  ).toThrow();
});
