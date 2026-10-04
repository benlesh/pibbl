import { crc, type CRCNode, type CRCController } from "@crc/core";
import { vi } from "vitest";

export function testRuntime() {
  const callbacks = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
    (callback) => {
      callbacks.set(++id, callback);
      return id;
    },
  );
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((key) =>
    callbacks.delete(key),
  );
  const controllers: CRCController[] = [];
  return {
    get pending() {
      return callbacks.size;
    },
    flush() {
      const entries = [...callbacks];
      callbacks.clear();
      for (const [, callback] of entries) callback(performance.now());
    },
    mount(node: CRCNode) {
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 400;
      document.body.append(canvas);
      controllers.push(crc(canvas, node, { pixelRatio: 1 }));
      return canvas;
    },
    dispose() {
      for (const controller of controllers) controller.dispose();
      document.body.replaceChildren();
      vi.restoreAllMocks();
    },
  };
}
