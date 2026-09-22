import { describe, expect, it } from "vitest";
import { SandboxPreview } from "../../../playground/src/sandbox-runner";

const rectangleLesson = `
import { crc, Rectangle } from "@crc/core";
import { jsx as _jsx } from "@crc/core/jsx-runtime";
export default function mount(canvas) {
  return crc(canvas, _jsx(Rectangle, { style: { width: 1, height: 1 } }));
}
`;

function waitForPreview(
  preview: SandboxPreview,
  host: HTMLElement,
): Promise<"mounted" | "error"> {
  return new Promise((resolve) => {
    preview.run({
      code: rectangleLesson,
      width: 320,
      height: 180,
      onEvent(event) {
        host.dataset.result = event.kind;
        if (event.kind === "mounted" || event.kind === "error") {
          resolve(event.kind);
        }
      },
    });
  });
}

describe("Studio sandbox preview", () => {
  it("starts an offscreen preview without waiting for an animation frame", async () => {
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;top:5000px;width:320px;height:180px";
    document.body.appendChild(host);
    const preview = new SandboxPreview(host);

    try {
      await expect(waitForPreview(preview, host)).resolves.toBe("mounted");
      expect(host.dataset.result).toBe("mounted");
    } finally {
      preview.dispose();
      host.remove();
    }
  }, 12_000);
});
