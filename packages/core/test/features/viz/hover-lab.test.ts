import { getScenarioBySlug, loadScenario } from "@pibbl/scenarios";
import { expect, it } from "vitest";
it("compares one nearest point, two recorded values, and two values at a dragged x", async () => {
  const entry = getScenarioBySlug("viz-hover-lab");
  expect(entry).toBeDefined();
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:1000px;height:600px";
  document.body.append(canvas);
  const controller = await (await loadScenario(entry!)).mount({ canvas });
  try {
    await controller.settled();
    await controller.perform("nearest-per-line");
    let state = controller.getState();
    expect(state.results.map((r: { x: number }) => r.x)).toEqual([0, 2]);
    await controller.perform("interpolated-x");
    state = controller.getState();
    expect(
      state.results.map((r: { x: number; y: number }) => [r.x, r.y]),
    ).toEqual([
      [5, 20],
      [5, 20],
    ]);
    expect(
      state.results.every((r: { kind: string }) => r.kind === "interpolated"),
    ).toBe(true);
    await controller.perform("closest-point");
    expect(controller.getState().results).toHaveLength(1);
    await controller.perform("interpolated-x");
    state = controller.getState();
    const b = canvas.getBoundingClientRect();
    const point = (type: string, x: number) =>
      canvas.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 1,
          pointerType: "mouse",
          buttons: type === "pointerup" ? 0 : 1,
          clientX: b.left + state.plot.x + (state.plot.width * x) / 10,
          clientY: b.top + state.plot.y + state.plot.height / 2,
          bubbles: true,
        }),
      );
    point("pointerdown", 5);
    point("pointermove", 8);
    point("pointerup", 8);
    await controller.settled();
    expect(controller.getState().inspection).toBeCloseTo(8);
    expect(controller.getState().results[1].kind).toBe("exact");
  } finally {
    await controller.dispose();
    canvas.remove();
  }
});
