import { afterEach, expect, it } from "vitest";
import { mountExampleComponent } from "../../scenarios/src/async-example-host";

afterEach(() => document.body.replaceChildren());

function surface() {
  const parent = document.createElement("section");
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:320px;height:180px;touch-action:pan-y";
  const style = canvas.getAttribute("style");
  parent.append(canvas);
  document.body.append(parent);
  return { parent, canvas, style };
}

it("cancels a pending example before replacing its host", async () => {
  const { parent, canvas, style } = surface();
  const options = { Component: () => null, htmlOverlay: true };
  const first = mountExampleComponent(canvas, options);
  const rejected = expect(first).rejects.toMatchObject({ name: "AbortError" });
  const second = await mountExampleComponent(canvas, options);
  await rejected;
  expect(canvas.parentElement?.parentElement).toBe(parent);
  second.dispose();
  second.dispose();
  expect([...parent.childNodes]).toEqual([canvas]);
  expect(canvas.getAttribute("style")).toBe(style);
});

it("restores the host when its signal aborts during startup or after mounting", async () => {
  for (const pending of [true, false]) {
    const { parent, canvas, style } = surface();
    const lifetime = new AbortController();
    const result = mountExampleComponent(canvas, {
      Component: () => null,
      htmlOverlay: true,
      config: { signal: lifetime.signal },
    });
    if (pending) {
      const rejected = expect(result).rejects.toMatchObject({
        name: "AbortError",
      });
      lifetime.abort();
      await rejected;
    } else {
      const controller = await result;
      lifetime.abort();
      controller.dispose();
    }
    expect([...parent.childNodes]).toEqual([canvas]);
    expect(canvas.getAttribute("style")).toBe(style);
  }
});

it("restores a rejected async surface and allows a fresh example", async () => {
  const { parent, canvas, style } = surface();
  await expect(
    mountExampleComponent(canvas, {
      Component: () => null,
      htmlOverlay: true,
      config: { pixelRatio: 0 },
    }),
  ).rejects.toThrow();
  expect([...parent.childNodes]).toEqual([canvas]);
  expect(canvas.getAttribute("style")).toBe(style);
  const fresh = await mountExampleComponent(canvas, {
    Component: () => null,
    htmlOverlay: true,
  });
  fresh.dispose();
  expect([...parent.childNodes]).toEqual([canvas]);
});

it("keeps replacement ownership when an older controller is disposed again", async () => {
  const { parent, canvas, style } = surface();
  const options = { Component: () => null, htmlOverlay: true };
  const old = await mountExampleComponent(canvas, options);
  const fresh = await mountExampleComponent(canvas, options);
  old.dispose();
  expect(canvas.parentElement?.parentElement).toBe(parent);
  const aborted = new AbortController();
  aborted.abort();
  await expect(
    mountExampleComponent(canvas, {
      ...options,
      config: { signal: aborted.signal },
    }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(canvas.parentElement?.parentElement).toBe(parent);
  fresh.dispose();
  expect([...parent.childNodes]).toEqual([canvas]);
  expect(canvas.getAttribute("style")).toBe(style);
});
