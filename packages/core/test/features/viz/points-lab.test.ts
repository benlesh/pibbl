import { getScenarioBySlug, loadScenario } from "@pibbl/scenarios";
import { expect, it } from "vitest";
it("inspects allocated plots, keeps custom keyed state on reorder, and reflows on resize", async () => {
  const entry = getScenarioBySlug("viz-points-lab");
  expect(entry).toBeDefined();
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:1000px;height:640px";
  document.body.append(canvas);
  const controller = await (await loadScenario(entry!)).mount({ canvas });
  try {
    await controller.settled();
    const initial = controller.getState();
    expect(initial.panels).toHaveLength(2);
    expect(initial.panels[0].width).not.toBe(initial.panels[1].width);
    expect(initial.selected).toBe("c");
    const anchor = initial.panels[1].anchors.find((p: any) => p.id === "c");
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: rect.left + anchor.x,
        clientY: rect.top + anchor.y,
        pointerType: "touch",
        bubbles: true,
      }),
    );
    await controller.settled();
    expect(controller.getState().customClicks).toBe(1);
    expect(controller.getState().marks.c).toBe(1);
    await controller.perform("reorder");
    expect(controller.getState().marks.c).toBe(1);
    await controller.perform("next");
    expect(controller.getState().selected).not.toBe("c");
    canvas.style.width = "760px";
    await controller.settled();
    expect(controller.getState().panels[0].width).toBeLessThan(
      initial.panels[0].width,
    );
    canvas.style.width = "600px";
    canvas.style.height = "400px";
    await controller.settled();
    const bottom = Math.max(
      ...controller.getState().panels[1].anchors.map((p: { y: number }) => p.y),
    );
    expect(bottom).toBeLessThan(canvas.getBoundingClientRect().height);
    await controller.perform("remove-selected");
    await controller.perform("reset");
    expect(controller.getState().selected).toBe("c");
  } finally {
    await controller.dispose();
    canvas.remove();
  }
});
