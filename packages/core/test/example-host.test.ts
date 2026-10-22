import { afterEach, expect, it } from "vitest";
import { mountExampleComponentSync } from "../../scenarios/src/example-host";

afterEach(() => document.body.replaceChildren());

it("restores the canvas and overlay host when surface configuration rejects a mount", () => {
  const parent = document.createElement("section");
  const before = document.createElement("span");
  const canvas = document.createElement("canvas");
  const after = document.createElement("span");
  canvas.style.cssText = "width:320px;height:180px;touch-action:pan-y";
  const style = canvas.getAttribute("style");
  parent.append(before, canvas, after);
  document.body.append(parent);
  expect(() =>
    mountExampleComponentSync(canvas, {
      Component: () => null,
      config: { pixelRatio: 0 },
      htmlOverlay: true,
    }),
  ).toThrow();
  expect([...parent.childNodes]).toEqual([before, canvas, after]);
  expect(canvas.getAttribute("style")).toBe(style);
  const fresh = mountExampleComponentSync(canvas, {
    Component: () => null,
    htmlOverlay: true,
  });
  fresh.dispose();
  fresh.dispose();
  expect([...parent.childNodes]).toEqual([before, canvas, after]);
  expect(canvas.getAttribute("style")).toBe(style);
});
