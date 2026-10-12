import { expect, it, vi } from "vitest";
import mount from "../../../../scenarios/src/learning/composition/viz-pie-composition.example.js";
import { getLearningExampleBySlug } from "@pibbl/scenarios";
import { loadWorkbenchSource } from "../../../../../playground/src/learning-sources.js";
import { validateLearningSourceText } from "../../../../../tooling/learning-source-contract.js";
it("runs the editable pie example and retains pinned category identity when slices reorder", async () => {
  const entry = getLearningExampleBySlug("viz-pie-composition")!;
  const source = await loadWorkbenchSource(entry);
  validateLearningSourceText(source, {
    authoring: "jsx",
    label: "Pie composition",
    sourcePath: entry.source.path,
  });
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 570;
  document.body.append(canvas);
  const positions: {
    text: string;
    x: number;
    y: number;
    align: string;
    baseline: string;
  }[] = [];
  const original = CanvasRenderingContext2D.prototype.fillText;
  const text = vi
    .spyOn(CanvasRenderingContext2D.prototype, "fillText")
    .mockImplementation(function (
      this: CanvasRenderingContext2D,
      value,
      x,
      y,
      maxWidth,
    ) {
      const point = new DOMPoint(x, y).matrixTransform(this.getTransform());
      positions.push({
        text: value,
        x: point.x,
        y: point.y,
        align: this.textAlign,
        baseline: this.textBaseline,
      });
      if (maxWidth === undefined) original.call(this, value, x, y);
      else original.call(this, value, x, y, maxWidth);
    });
  const controller = mount(canvas);
  const settle = async () => {
    for (let i = 0; i < 3; i++)
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
  };
  const pointer = (type: string, x: number, y: number) => {
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent(type, {
        clientX: rect.left + x,
        clientY: rect.top + y,
        bubbles: true,
        pointerId: 1,
      }),
    );
  };
  const click = (x: number, y: number) => {
    const rect = canvas.getBoundingClientRect();
    for (const type of ["mousedown", "mouseup", "click"])
      canvas.dispatchEvent(
        new MouseEvent(type, {
          clientX: rect.left + x,
          clientY: rect.top + y,
          bubbles: true,
        }),
      );
  };
  try {
    await settle();
    for (const [text, x] of [
      ["Reverse slice order", 758],
      ["Clear pinned slice", 904],
    ] as const)
      expect(positions).toContainEqual({
        text,
        x,
        y: 491,
        align: "center",
        baseline: "middle",
      });
    pointer("pointermove", 390, 210);
    await settle();
    expect(positions).toContainEqual({
      text: "Walk · 35%",
      x: 831,
      y: 397,
      align: "center",
      baseline: "middle",
    });
    click(390, 210);
    await settle();
    expect(
      text.mock.calls.some(([s]) => s === "35 of 100 responses · pinned"),
    ).toBe(true);
    text.mockClear();
    click(750, 491);
    await settle();
    expect(
      text.mock.calls.some(([s]) => s === "35 of 100 responses · pinned"),
    ).toBe(true);
    click(410, 491);
    await settle(); // Tiny sample, both sides of the circle.
    const outside = [
      "Bicycle share · 2%",
      "Community shuttle · 1%",
      "Local ferry · 2%",
      "Accessible transit · 1%",
    ].map((label) => positions.find((p) => p.text === label)!);
    expect(outside.every(Boolean)).toBe(true);
    expect(outside.some((p) => p.x < 218)).toBe(true);
    expect(outside.some((p) => p.x > 442)).toBe(true);
    click(outside[3].x + 4, outside[3].y - 4);
    await settle();
    expect(
      text.mock.calls.some(([s]) => s === "1 of 100 responses · pinned"),
    ).toBe(true);
    text.mockClear();
    click(70, 491);
    await settle(); // strict inside
    expect(text.mock.calls.some(([s]) => s === "Community shuttle · 1%")).toBe(
      false,
    );
    text.mockClear();
    click(170, 491);
    await settle(); // outside
    expect(text.mock.calls.some(([s]) => s === "Community shuttle · 1%")).toBe(
      true,
    );
  } finally {
    controller.dispose();
    text.mockRestore();
    canvas.remove();
  }
});
