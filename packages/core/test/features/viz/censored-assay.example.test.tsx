import { signal } from "@pibbl/core";
import { VizCensoredAssayExample as mountComponent } from "../../../../scenarios/src/learning/composition/viz-censored-assay.example";
import { afterEach, expect, it, vi } from "vitest";
import { createExampleMount } from "../../../../scenarios/src/example-host";

const mount = createExampleMount(mountComponent, {
  config: {
    viewport: "responsive",
  },
});

let controller: ReturnType<typeof mount> | undefined;
afterEach(() => {
  controller?.dispose();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

it("presents synthetic assay limits as limits in its canvas and accessible table", async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 640;
  document.body.append(canvas);
  const selected = signal<string | null>(null);
  controller = mount(canvas, { selected });
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  expect(document.body.textContent).toContain(
    "Below/above entries are reporting limits, not observed concentrations.",
  );
  expect(document.querySelectorAll("tbody tr")).toHaveLength(8);
  selected.set("PK-01");
  expect(document.body.textContent).toContain("View supplied assay records");
  controller.dispose();
  controller = undefined;
  expect(document.querySelector("details")).toBeNull();
});
