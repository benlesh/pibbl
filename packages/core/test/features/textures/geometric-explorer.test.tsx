import { afterEach, expect, it, vi } from "vitest";
import mount from "../../../../scenarios/src/learning/composition/geometric-explorer.example";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../../../src/lib/scheduler/testing.js";
import { clearSharedState } from "../../../src/lib/global-state.js";
afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});
it("exposes every recipe setting, edits named colors and bands, and changes live previews", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  canvas.width = 980;
  canvas.height = 940;
  document.body.append(canvas);
  const controller = mount(canvas);
  let time = 0;
  const flush = () => {
    for (let i = 0; i < 3 && driver.pendingHostFrames; i++)
      driver.flush((time += 16));
  };
  const input = (name: string, value: string, event = "input") => {
    const field = document.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[aria-label="${name}"]`,
    )!;
    expect(field).not.toBeNull();
    field.value = value;
    field.dispatchEvent(new Event(event, { bubbles: true }));
    flush();
  };
  const click = (name: string) => {
    const b = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent === name || b.getAttribute("aria-label") === name,
    )!;
    expect(b).not.toBeUndefined();
    b.click();
    flush();
  };
  const tile = () =>
    canvas.getContext("2d")!.getImageData(344, 150, 300, 300).data.slice();
  const surface = () =>
    canvas.getContext("2d")!.getImageData(344, 522, 612, 350).data.slice();
  try {
    flush();
    const first = tile();
    input("Jitter", ".35");
    expect(tile()).not.toEqual(first);
    for (const name of [
      "Columns",
      "Rows",
      "Dot radius",
      "Row stagger",
      "Jitter",
      "Seed",
      "Phase",
      "Speed (cycles/sec)",
      "Tile width",
      "Tile height",
      "Rotation",
      "Resolution",
    ])
      expect(document.querySelector(`[aria-label="${name}"]`)).not.toBeNull();
    input("Speed (cycles/sec)", ".2");
    expect(driver.pendingHostFrames).toBeGreaterThan(0);
    click("Stop motion");
    expect(driver.pendingHostFrames).toBe(0);
    input("Texture", "Halftone", "change");
    for (const name of [
      "Minimum radius",
      "Maximum radius",
      "Horizontal waves",
      "Vertical waves",
      "Contrast",
      "Row stagger",
    ])
      expect(document.querySelector(`[aria-label="${name}"]`)).not.toBeNull();
    const tonal = tile();
    input("Contrast", "1");
    expect(tile()).not.toEqual(tonal);
    input("Minimum radius", ".5");
    expect(document.querySelector('[role="status"]')!.textContent).toMatch(
      /Minimum/,
    );
    input("Texture", "Plaid", "change");
    input("Preset", "tartan", "change");
    const tartan = tile();
    input("Color primary", "#0000ff");
    expect(tile()).not.toEqual(tartan);
    input("Rename color primary", "ocean", "change");
    expect(document.querySelector('[aria-label="Color ocean"]')).not.toBeNull();
    expect(
      (
        document.querySelector(
          '[aria-label="horizontal band 1 color"]',
        ) as HTMLSelectElement
      ).value,
    ).toBe("ocean");
    const band = tile();
    input("horizontal band 1 width", "2");
    expect(tile()).not.toEqual(band);
    click("+ vertical band");
    expect(
      document.querySelector('[aria-label="vertical band 5 color"]'),
    ).not.toBeNull();
    click("Move vertical band 5 up");
    click("Remove vertical band 5");
    click("+ Named color");
    expect(
      document.querySelector('[aria-label="Color color1"]'),
    ).not.toBeNull();
    click("Remove color color1");
    const plaidBefore = tile();
    input("Horizontal color balance", ".8");
    expect(tile()).not.toEqual(plaidBefore);
    input("Texture", "Truchet", "change");
    for (const name of [
      "Columns",
      "Rows",
      "Line width",
      "Orientation balance",
      "Seed",
    ])
      expect(document.querySelector(`[aria-label="${name}"]`)).not.toBeNull();
    const curves = tile();
    input("Orientation balance", "1");
    expect(tile()).not.toEqual(curves);
    const repeated = surface();
    input("Tile width", "240");
    input("Rotation", "30");
    expect(surface()).not.toEqual(repeated);
    input("Resolution", "512", "change");
    input("Ramp color 1", "#eeccaa");
    expect(tile()).not.toEqual(curves);
    click("+ Color stop");
    expect(
      document.querySelector('[aria-label="Ramp color 3"]'),
    ).not.toBeNull();
    click("Remove ramp color 3");
    expect(driver.pendingHostFrames).toBe(0);
  } finally {
    controller.dispose();
    restore();
  }
  expect(document.querySelector("input")).toBeNull();
  expect(canvas.parentElement).toBe(document.body);
});
