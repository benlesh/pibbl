import { describe, expect, it } from "vitest";
import {
  SandboxPreview,
  type PreviewEvent,
} from "../../../playground/src/sandbox-runner";

const rectangleLesson = `
import { pibbl, Rectangle } from "@pibbl/core";
import { jsx as _jsx } from "@pibbl/core/jsx-runtime";
window.requestAnimationFrame = () => 0;
export default function mount(canvas) {
  return pibbl(canvas, _jsx(Rectangle, { style: { width: 1, height: 1 } }));
}
`;

const invalidControllerLesson = `
import { pibbl } from "@pibbl/core";
export default function mount(canvas) {
  return {};
}
`;

const throwingLesson = `
import { pibbl } from "@pibbl/core";
export default function mount(canvas) {
  throw new Error("mount failed");
}
`;

const disposableLesson = `
import { pibbl } from "@pibbl/core";
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
    host.style.cssText =
      "position:absolute;top:5000px;width:320px;height:180px";
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
      await expect(
        runPreview(preview, invalidControllerLesson),
      ).resolves.toEqual([
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

it("keeps a responsive canvas inside its preview after both dimensions shrink", async () => {
  const host = document.createElement("div");
  host.style.cssText = "width:640px;height:395.625px";
  document.body.append(host);
  const preview = new SandboxPreview(host);
  const sizes: string[] = [];
  try {
    preview.run({
      width: 1100,
      height: 680,
      code: `
      import { pibbl, createElement, useLayoutBox } from "@pibbl/core";
      function Scene() { const box = useLayoutBox(); console.log(box.width + "x" + box.height); }
      export default function mount(canvas) { return pibbl(canvas, createElement(Scene, {}), { viewport: "responsive" }); }
    `,
      onEvent(event) {
        if (event.kind === "log") sizes.push(event.message!);
      },
    });
    host.querySelector("iframe")!.style.cssText =
      "width:100%;height:100%;border:0";
    // Browser iframe viewports round fractional CSS heights to whole pixels.
    await expect.poll(() => sizes.at(-1)).toBe("640x396");
    host.style.width = "480px";
    host.style.height = "296.71875px";
    await expect.poll(() => sizes.at(-1)).toBe("480x297");
  } finally {
    preview.dispose();
    host.remove();
  }
});
