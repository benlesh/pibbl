import { pibblSync } from '@pibbl/core/sync';
import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "@pibbl/core";
import { LoadingCard } from "../../scenarios/src/learning/composition/state-machines.example";
import { clickLogicalPoint } from "./support/user-input";

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

it("loads, retries, resets, and cancels through the named machine component", async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 420;
  document.body.append(canvas);
  const context = canvas.getContext("2d")!;
  const fillText = context.fillText;
  let message = "";
  const messages = new Set([
    "Ready to load",
    "Loading…",
    "First attempt failed. Retry?",
    "Your level is ready",
    "Canceled — no late result",
  ]);
  vi.spyOn(context, "fillText").mockImplementation(
    function (text, x, y, maxWidth) {
      if (messages.has(text)) message = text;
      if (maxWidth === undefined) fillText.call(context, text, x, y);
      else fillText.call(context, text, x, y, maxWidth);
    },
  );
  const controller = pibblSync(canvas, createElement<object>(LoadingCard, null));
  dispose = () => controller.dispose();
  await expect.poll(() => message).toBe("Ready to load");
  await clickLogicalPoint(canvas, { x: 100, y: 300 });
  await expect
    .poll(() => message, { timeout: 3000 })
    .toBe("First attempt failed. Retry?");
  await clickLogicalPoint(canvas, { x: 100, y: 300 });
  await expect
    .poll(() => message, { timeout: 3000 })
    .toBe("Your level is ready");
  await clickLogicalPoint(canvas, { x: 400, y: 300 });
  await expect.poll(() => message).toBe("Ready to load");
  await clickLogicalPoint(canvas, { x: 100, y: 300 });
  await expect.poll(() => message).toBe("Loading…");
  await clickLogicalPoint(canvas, { x: 100, y: 300 });
  await expect.poll(() => message).toBe("Canceled — no late result");
  await new Promise((resolve) => setTimeout(resolve, 900));
  expect(message).toBe("Canceled — no late result");
});
