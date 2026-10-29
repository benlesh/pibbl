import { describe, expect, it } from "vitest";
import {
  SandboxPreview,
  type PreviewEvent,
} from "../../../playground/src/sandbox-runner";

const rectangleLesson = `
import { pibbl, Rectangle } from "@pibbl/core";
import { jsx as _jsx } from "@pibbl/core/jsx-runtime";
window.requestAnimationFrame = () => 0;
export function Lesson() {
  return _jsx(Rectangle, { style: { width: 1, height: 1 } });
}
`;

const invalidControllerLesson = `
import { pibbl } from "@pibbl/core";
export function DifferentLesson() {
  return null;
}
`;

const throwingLesson = `
import { pibbl } from "@pibbl/core";
export function Lesson() {
  throw new Error("mount failed");
}
`;

const disposableLesson = `
import { useReaction } from "@pibbl/core";
export function NamedLesson() {
  useReaction(() => {
    console.log("component-ready");
    return () => {
      parent.postMessage({ kind: "controller-disposed" }, "*");
    };
  }, []);
  return null;
}
`;

function runPreview(
  preview: SandboxPreview,
  code: string,
  exportName = "Lesson",
): Promise<readonly PreviewEvent[]> {
  return new Promise((resolve) => {
    const events: PreviewEvent[] = [];
    preview.run({
      code,
      exportName,
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

  it("rejects a missing catalog-selected component before reporting mounted", () => {
    const host = document.createElement("div");
    const preview = new SandboxPreview(host);
    const events: PreviewEvent[] = [];
    try {
      expect(() =>
        preview.run({
          code: invalidControllerLesson,
          exportName: "Lesson",
          width: 320,
          height: 180,
          onEvent: (event) => events.push(event),
        }),
      ).toThrow(/Lesson.*not found/);
      expect(events).toEqual([]);
    } finally {
      preview.dispose();
    }
  });

  it("reports a scheduled component failure", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const preview = new SandboxPreview(host);
    try {
      const events = await runPreview(preview, throwingLesson);
      await expect
        .poll(() =>
          events.some(
            (event) =>
              event.kind === "error" && event.message?.includes("mount failed"),
          ),
        )
        .toBe(true);
    } finally {
      preview.dispose();
      host.remove();
    }
  });

  it("mounts an exported component and releases its hooks when the preview is disposed", async () => {
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
      const events = await runPreview(preview, disposableLesson, "NamedLesson");
      expect(events[0]).toEqual({ kind: "mounted" });
      await expect
        .poll(() =>
          events.some(
            (event) =>
              event.kind === "log" &&
              event.message?.includes("component-ready"),
          ),
        )
        .toBe(true);
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
      exportName: "Scene",
      config: { viewport: "responsive" },
      width: 1100,
      height: 680,
      code: `
      import { pibbl, createElement, useLayoutBox } from "@pibbl/core";
      export function Scene() { const box = useLayoutBox(); console.log(box.width + "x" + box.height); return null; }
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
