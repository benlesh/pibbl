import { expect, it } from "vitest";
import { getScenarioBySlug, loadScenario } from "@crc/scenarios";

it("explores a fixed NOAA snapshot through independently allocated detail and overview plots", async () => {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:1000px;height:640px";
  document.body.append(canvas);
  const definition = await loadScenario(
    getScenarioBySlug("viz-foundation-lab")!,
  );
  const controller = await definition.mount({ canvas });
  try {
    await controller.settled();
    const initial = controller.getState();
    expect(initial.samples).toBe(504);
    expect(initial.selected).toMatchObject({
      date: "Dec 2021",
      value: 416.67,
      adjusted: 417.37,
    });
    expect(initial.panels[0].domain).toEqual([384, 503]);
    expect(initial.panels[1].domain).toEqual([0, 503]);
    expect(initial.panels[0].width).not.toBe(initial.panels[1].width);
    // Ordinary pointer movement reads actual monthly values, without changing data.
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: rect.left + 64,
        clientY: rect.top + 200,
        bubbles: true,
      }),
    );
    await controller.settled();
    expect(controller.getState().selected.date).toBe("Jan 2012");
    // Clicking the overview moves the ten-year detail window into the archive.
    for (const type of ["mousedown", "mouseup", "click"])
      canvas.dispatchEvent(
        new MouseEvent(type, {
          clientX: rect.left + 25,
          clientY: rect.top + 555,
          bubbles: true,
          button: 0,
        }),
      );
    await controller.settled();
    expect(controller.getState().panels[0].domain).toEqual([0, 119]);
    expect(controller.getState().panels[1].domain).toEqual([0, 503]);
    await controller.perform("full");
    expect(controller.getState().panels[0].domain).toEqual([0, 503]);
    await controller.perform("reset");
    expect(controller.getState().selected.value).toBe(416.67);
    canvas.style.width = "700px";
    await controller.settled();
    expect(controller.getState().panels[0].width).toBeLessThan(
      initial.panels[0].width,
    );
    expect(controller.getState().panels[1].width).toBeLessThan(
      initial.panels[1].width,
    );
    expect(controller.getState().samples).toBe(504);
  } finally {
    await controller.dispose();
    canvas.remove();
  }
});

it("resizes and pans the archive brush continuously while a pointer is held", async () => {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:1000px;height:640px";
  document.body.append(canvas);
  const controller = await (
    await loadScenario(getScenarioBySlug("viz-foundation-lab")!)
  ).mount({ canvas });
  const rect = canvas.getBoundingClientRect();
  const px = (month: number) => rect.left + 24 + (month / 503) * 952;
  const send = (type: string, month: number, buttons: number) =>
    canvas.dispatchEvent(
      new PointerEvent(type, {
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
        button: 0,
        buttons,
        clientX: px(month),
        clientY: rect.top + 572,
        bubbles: true,
      }),
    );
  try {
    await controller.settled();
    send("pointerdown", 384, 1);
    send("pointermove", 300, 1);
    await controller.settled();
    expect(controller.getState().panels[0].domain).toEqual([300, 503]);
    send("pointerup", 300, 0);
    send("pointerdown", 503, 1);
    send("pointermove", 450, 1);
    await controller.settled();
    expect(controller.getState().panels[0].domain).toEqual([300, 450]);
    send("pointerup", 450, 0);
    send("pointerdown", 375, 1);
    send("pointermove", 250, 1);
    await controller.settled();
    expect(controller.getState().panels[0].domain).toEqual([175, 325]);
    expect(controller.getState().selected.date).toBe("Feb 2007");
    send("pointerup", 250, 0);
    // A released pointer no longer changes the selected domain.
    send("pointermove", 200, 0);
    await controller.settled();
    expect(controller.getState().panels[0].domain).toEqual([175, 325]);
    // Capture keeps a drag active outside the plot; cancellation ends it.
    send("pointerdown", 250, 1);
    send("pointermove", -500, 1);
    await controller.settled();
    expect(controller.getState().panels[0].domain).toEqual([0, 150]);
    send("pointercancel", -500, 0);
    send("pointermove", 300, 0);
    await controller.settled();
    expect(controller.getState().panels[0].domain).toEqual([0, 150]);
  } finally {
    await controller.dispose();
    canvas.remove();
  }
});
