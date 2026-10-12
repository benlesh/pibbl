import { signal, type PibblController } from "@pibbl/core";
import mount from "../../../../scenarios/src/learning/composition/viz-phase-ii-trajectories.example";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";

let runtime: ReturnType<typeof testRuntime>;
let controller: PibblController | undefined;

afterEach(() => {
  controller?.dispose();
  runtime?.dispose();
  vi.restoreAllMocks();
});

it("keeps synthetic scheduled-visit missingness explicit while exposing paired participant inspection", () => {
  runtime = testRuntime();
  const canvas = document.createElement("canvas");
  canvas.style.width = "960px";
  document.body.append(canvas);
  const selectedParticipant = signal<string | null>(null);
  const showTracks = signal(true);
  const labels: string[] = [];
  const original = CanvasRenderingContext2D.prototype.fillText;
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(
    function (this: CanvasRenderingContext2D, text, x, y, maxWidth) {
      labels.push(String(text));
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    },
  );
  controller = mount(canvas, { selectedParticipant, showTracks });
  runtime.flush();

  expect(labels).toContain(
    "SYNTHETIC PHASE II · REPEATED-MEASURES TRAINING DATA",
  );
  expect(document.body.textContent).toContain("Not observed");
  expect(document.querySelectorAll("tbody tr")).toHaveLength(16);
  const select = document.querySelector<HTMLSelectElement>("select")!;
  const tracks = document.querySelector<HTMLInputElement>(
    'input[type="checkbox"]',
  )!;
  expect(select.value).toBe("");
  expect(document.querySelectorAll("select option")).toHaveLength(17);
  expect(tracks.checked).toBe(true);

  labels.length = 0;
  select.value = "P-07";
  select.dispatchEvent(new Event("change", { bubbles: true }));
  runtime.flush();
  expect(selectedParticipant.get()).toBe("P-07");
  expect(labels).toContain("P-07 · Candidate");

  tracks.checked = false;
  tracks.dispatchEvent(new Event("change", { bubbles: true }));
  expect(showTracks.get()).toBe(false);
  controller.dispose();
  controller = undefined;
  expect(document.querySelector("select")).toBeNull();
  expect(document.querySelector("details")).toBeNull();
});

it("uses compact, measured header and pane labels on a phone-width canvas", () => {
  runtime = testRuntime();
  const canvas = document.createElement("canvas");
  canvas.style.width = "360px";
  document.body.append(canvas);
  const labels: string[] = [];
  const original = CanvasRenderingContext2D.prototype.fillText;
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(
    function (this: CanvasRenderingContext2D, text, x, y, maxWidth) {
      labels.push(String(text));
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    },
  );
  controller = mount(canvas);
  runtime.flush();

  const compactLines = [
    "Participant trajectories",
    "and paired endpoints",
    "Synthetic teaching data · symptom index",
    "(0–100 points; lower is better)",
    "16 participants · scheduled visits retained",
    "when measurements are absent",
    "Participant change (points)",
    "Baseline and week 12 (points)",
  ];
  expect(labels).toEqual(expect.arrayContaining(compactLines));
  const context = canvas.getContext("2d")!;
  for (const line of compactLines)
    expect(context.measureText(line).width).toBeLessThanOrEqual(312);
});
