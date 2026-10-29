import { beforeAll, describe, expect, it } from "vitest";
import {
  autoFillTracks,
  autoFitTracks,
  createLayoutTree,
  fitContent,
  prepareLayout,
} from "../src/index.js";

beforeAll(async () => {
  await prepareLayout();
});

describe("native owned layout tree", () => {
  it("uses the real native Flex arena for persistent geometry, measurement, and disposal", () => {
    const tree = createLayoutTree();
    const root = tree.createNode({
      style: { width: 120, height: 40, flexDirection: "row", gap: 10 },
    });
    const measured = tree.createNode({
      style: { flexGrow: 1, minWidth: 20, height: 20 },
      measure: ({ width }) => ({ width: width.maximum / 2, height: 20 }),
    });
    const fixed = tree.createNode({ style: { width: 30, height: 20 } });
    tree.appendChild(root, measured);
    tree.appendChild(root, fixed);
    const first = tree.calculateLayout({ root, width: 120, height: 40 });
    expect(first.getBox(measured)).toEqual({
      x: 0,
      y: 0,
      width: 80,
      height: 20,
    });
    expect(first.getBox(fixed)).toEqual({ x: 90, y: 0, width: 30, height: 20 });
    tree.setStyle(root, { width: 160 });
    const second = tree.calculateLayout({ root, width: 160, height: 40 });
    expect(second.getBox(measured).width).toBe(120);
    tree.dispose();
    expect(() =>
      tree.calculateLayout({ root, width: 160, height: 40 }),
    ).toThrow(/disposed/);
  });

  it("resolves percentage dimensions and min/max bounds against the actual parent content box", () => {
    const tree = createLayoutTree();
    const root = tree.createNode({
      style: { width: 200, height: 40, flexDirection: "row" },
    });
    const child = tree.createNode({
      style: { width: "50%", minWidth: "60%", maxWidth: "70%", height: 20 },
    });
    tree.appendChild(root, child);
    const snapshot = tree.calculateLayout({ root, width: 200, height: 40 });
    expect(snapshot.getBox(child)).toEqual({
      x: 0,
      y: 0,
      width: 120,
      height: 20,
    });
    tree.dispose();
  });

  it("uses native Grid assignment, spans, implicit tracks, and paired intrinsic contributions", () => {
    const tree = createLayoutTree();
    const root = tree.createNode({
      style: {
        layout: "grid",
        width: 100,
        height: 50,
        gridTemplateColumns: ["auto"],
        gridTemplateRows: [50],
        gridAutoColumns: "auto",
        gridAutoRows: 50,
        gridAutoFlow: "row dense",
      },
    });
    const spanning = tree.createNode({
      style: { gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1 },
      measureIntrinsic: () => ({
        minWidth: 20,
        maxWidth: 40,
        minHeight: 10,
        maxHeight: 20,
      }),
    });
    const automatic = tree.createNode({
      measureIntrinsic: () => ({
        minWidth: 10,
        maxWidth: 30,
        minHeight: 10,
        maxHeight: 20,
      }),
    });
    tree.appendChild(root, spanning);
    tree.appendChild(root, automatic);
    const snapshot = tree.calculateLayout({ root, width: 100, height: 50 });
    expect(snapshot.getBox(spanning)).toEqual({
      x: 0,
      y: 0,
      width: 40,
      height: 50,
    });
    expect(snapshot.getBox(automatic)).toEqual({
      x: 0,
      y: 50,
      width: 32.5,
      height: 50,
    });
    tree.dispose();
  });

  it("expands auto-repeat tracks in the native Grid owner and collapses unoccupied auto-fit tracks", () => {
    const fill = createLayoutTree();
    const fillRoot = fill.createNode({
      style: {
        layout: "grid",
        width: 100,
        height: 20,
        gridTemplateColumns: [autoFillTracks(20)],
        gridTemplateRows: [20],
        columnGap: 5,
      },
    });
    const fillA = fill.createNode();
    const fillB = fill.createNode();
    const fillC = fill.createNode();
    fill.appendChild(fillRoot, fillA);
    fill.appendChild(fillRoot, fillB);
    fill.appendChild(fillRoot, fillC);
    const filled = fill.calculateLayout({
      root: fillRoot,
      width: 100,
      height: 20,
    });
    expect(filled.getBox(fillA)).toEqual({ x: 0, y: 0, width: 20, height: 20 });
    expect(filled.getBox(fillB)).toEqual({
      x: 25,
      y: 0,
      width: 20,
      height: 20,
    });
    expect(filled.getBox(fillC)).toEqual({
      x: 50,
      y: 0,
      width: 20,
      height: 20,
    });
    fill.dispose();

    const fit = createLayoutTree();
    const fitRoot = fit.createNode({
      style: {
        layout: "grid",
        width: 100,
        height: 20,
        gridTemplateColumns: [autoFitTracks(20)],
        gridTemplateRows: [20],
        columnGap: 5,
      },
    });
    const fitA = fit.createNode();
    const fitB = fit.createNode();
    fit.appendChild(fitRoot, fitA);
    fit.appendChild(fitRoot, fitB);
    const fitted = fit.calculateLayout({
      root: fitRoot,
      width: 100,
      height: 20,
    });
    expect(fitted.getBox(fitA)).toEqual({ x: 0, y: 0, width: 20, height: 20 });
    expect(fitted.getBox(fitB)).toEqual({ x: 25, y: 0, width: 20, height: 20 });
    fit.dispose();
  });

  it("keeps the immutable fit-content constructor explicit", () => {
    expect(fitContent(40)).toEqual({ kind: "fit-content", limit: 40 });
    expect(() => fitContent(-1)).toThrow(/limit/);
    expect(() => fitContent("-1%")).toThrow(/limit/);
    expect(autoFillTracks(20)).toEqual({
      kind: "repeat",
      count: "auto-fill",
      tracks: [20],
    });
    expect(autoFitTracks(20)).toEqual({
      kind: "repeat",
      count: "auto-fit",
      tracks: [20],
    });

    const tree = createLayoutTree();
    const root = tree.createNode({
      style: {
        layout: "grid",
        width: 20,
        height: 20,
        gridTemplateColumns: ["-1%"],
        gridTemplateRows: [20],
      },
    });
    expect(() => tree.calculateLayout({ root, width: 20, height: 20 })).toThrow(
      /Grid/,
    );
    tree.dispose();
  });

  it("rejects declarations whose owning layout mode would otherwise ignore them", () => {
    const tree = createLayoutTree();
    const root = tree.createNode({
      style: { width: 40, height: 20, gridTemplateColumns: [20] },
    });
    expect(() => tree.calculateLayout({ root, width: 40, height: 20 })).toThrow(
      /Grid declarations/,
    );

    tree.setStyle(root, {
      layout: "grid",
      gridTemplateColumns: [20],
      gridTemplateRows: [20],
      flexGrow: 1,
    });
    expect(() => tree.calculateLayout({ root, width: 40, height: 20 })).toThrow(
      /Flex item declarations/,
    );

    const flex = tree.createNode({ style: { width: 40, height: 20 } });
    const misplaced = tree.createNode({ style: { gridColumnStart: 1 } });
    tree.appendChild(flex, misplaced);
    expect(() =>
      tree.calculateLayout({ root: flex, width: 40, height: 20 }),
    ).toThrow(/Grid item placement/);
    tree.dispose();
  });

  it("does not publish or retain a partial snapshot when a measurement callback tries to mutate its owner", () => {
    const tree = createLayoutTree();
    const root = tree.createNode({
      style: { width: 40, height: 20, flexDirection: "row" },
    });
    let mutate = true;
    const measured = tree.createNode({
      measure: () => {
        if (mutate) tree.setStyle(root, { width: 60 });
        return { width: 20, height: 10 };
      },
    });
    tree.appendChild(root, measured);
    expect(() => tree.calculateLayout({ root, width: 40, height: 20 })).toThrow(
      /cannot mutate/,
    );
    mutate = false;
    const recovered = tree.calculateLayout({ root, width: 40, height: 20 });
    expect(recovered.revision).toBe(1);
    expect(recovered.getBox(measured)).toEqual({
      x: 0,
      y: 0,
      width: 20,
      height: 10,
    });
    tree.dispose();
  });
});
