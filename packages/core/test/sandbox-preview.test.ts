import { describe, expect, it } from "vitest";
import {
  SandboxPreview,
  type PreviewEvent,
} from "../../../playground/src/sandbox-runner";

const rectangleLesson = `
import { crc, Rectangle } from "@crc/core";
import { jsx as _jsx } from "@crc/core/jsx-runtime";
window.requestAnimationFrame = () => 0;
export default function mount(canvas) {
  return crc(canvas, _jsx(Rectangle, { style: { width: 1, height: 1 } }));
}
`;

const invalidControllerLesson = `
import { crc } from "@crc/core";
export default function mount(canvas) {
  return {};
}
`;

const throwingLesson = `
import { crc } from "@crc/core";
export default function mount(canvas) {
  throw new Error("mount failed");
}
`;

const disposableLesson = `
import { crc } from "@crc/core";
export default function mount(canvas) {
  return {
    dispose() {
      parent.postMessage({ kind: "controller-disposed" }, "*");
    },
  };
}
`;

function runPreview(
  preview: SandboxPreview,
  code: string,
): Promise<readonly PreviewEvent[]> {
  return new Promise((resolve) => {
    const events: PreviewEvent[] = [];
    preview.run({
      code,
      width: 320,
      height: 180,
      onEvent(event) {
        events.push(event);
        if (event.kind === "mounted" || event.kind === "error") {
          resolve(events);
        }
      },
    });
  });
}

describe("Studio sandbox preview", () => {
  it("starts an offscreen preview when the child suppresses animation frames", async () => {
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;top:5000px;width:320px;height:180px";
    document.body.appendChild(host);
    const preview = new SandboxPreview(host);

    try {
      await expect(runPreview(preview, rectangleLesson)).resolves.toEqual([
        { kind: "mounted" },
      ]);
    } finally {
      preview.dispose();
      host.remove();
    }
  }, 12_000);

  it("rejects an invalid controller without first reporting mounted", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const preview = new SandboxPreview(host);

    try {
      await expect(runPreview(preview, invalidControllerLesson)).resolves.toEqual([
        {
          kind: "error",
          message: "Preview mount must return a controller with dispose().",
        },
      ]);
    } finally {
      preview.dispose();
      host.remove();
    }
  });

  it("reports a synchronous mount failure without first reporting mounted", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const preview = new SandboxPreview(host);

    try {
      await expect(runPreview(preview, throwingLesson)).resolves.toEqual([
        { kind: "error", message: "mount failed" },
      ]);
    } finally {
      preview.dispose();
      host.remove();
    }
  });

  it("disposes a valid controller when the preview is disposed", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const preview = new SandboxPreview(host);
    let frameWindow: Window | null = null;
    const disposed = new Promise<void>((resolve) => {
      const onMessage = (event: MessageEvent<unknown>) => {
        if (
          event.source !== frameWindow ||
          !event.data ||
          typeof event.data !== "object" ||
          (event.data as { kind?: unknown }).kind !== "controller-disposed"
        )
          return;
        window.removeEventListener("message", onMessage);
        resolve();
      };
      window.addEventListener("message", onMessage);
    });

    try {
      await expect(runPreview(preview, disposableLesson)).resolves.toEqual([
        { kind: "mounted" },
      ]);
      frameWindow = host.querySelector("iframe")?.contentWindow ?? null;
      preview.dispose();
      await expect(disposed).resolves.toBeUndefined();
    } finally {
      preview.dispose();
      host.remove();
    }
  });
});
