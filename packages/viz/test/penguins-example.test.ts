import { expect, it, vi } from "vitest";
import mount from "../../scenarios/src/learning/composition/viz-points-and-inspection.example.js";

it("plots the static Palmer Penguins measurements without inventing missing values", async () => {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:1000px;height:720px";
  document.body.append(canvas);
  const panels: Parameters<
    NonNullable<NonNullable<Parameters<typeof mount>[1]>["onPanel"]>
  >[1][] = [];
  const text = vi.spyOn(CanvasRenderingContext2D.prototype, "fillText");
  const controller = mount(canvas, {
    onPanel(index, panel) {
      panels[index] = panel;
    },
  });
  try {
    for (let i = 0; i < 3; i++)
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    expect(
      text.mock.calls.filter(([value]) => value === "181 mm · 3750 g").length,
    ).toBeGreaterThanOrEqual(2);
    expect(panels).toHaveLength(2);
    for (const panel of panels) {
      expect(panel.anchors).toHaveLength(342);
      expect(panel.anchors.some((p) => p.id === "penguin-004")).toBe(false);
      expect(panel.anchors.some((p) => p.id === "penguin-272")).toBe(false);
    }
    // Source row 1: flipper 181 mm, body mass 3750 g; domains 170–240 / 2500–6500.
    expect(panels[0].anchors[0].id).toBe("penguin-001");
    expect(panels[0].anchors[0].x).toBeCloseTo(
      68 + (panels[0].width * 11) / 70,
    );
    expect(panels[0].anchors[0].y).toBeCloseTo(
      234 + (panels[0].height * 2750) / 4000,
    );
  } finally {
    text.mockRestore();
    controller.dispose();
    canvas.remove();
  }
});
