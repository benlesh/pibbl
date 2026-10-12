import { signal } from "@pibbl/core";
import { Axis, BarScale, utcTickLabels } from "@pibbl/core/viz";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("keeps calendar context on every compact UTC label", () => {
  expect(utcTickLabels([Date.UTC(2020, 11, 1), Date.UTC(2021, 0, 1)])).toEqual(["Dec 2020", "Jan 2021"]);
  expect(utcTickLabels([Date.UTC(2020, 0, 1), Date.UTC(2021, 0, 1)])).toEqual(["2020", "2021"]);
  expect(utcTickLabels([Date.UTC(2021, 0, 2, 12, 30)])[0]).toContain("2021");
  expect(() => utcTickLabels([NaN])).toThrow(RangeError);
});
it.each(["left", "right", "top", "bottom"] as const)("wraps long labels on the %s edge within the declared width", position => {
  runtime = testRuntime();
  const painted: { text: string; width: number }[] = [];
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(function (this: CanvasRenderingContext2D, text) {
    painted.push({ text: String(text), width: this.measureText(String(text)).width });
  });
  runtime.mount(<BarScale id="month" domain={["September 1980 Mauna Loa"]} range={[0, 100]}>
    <Axis scale="month" position={position} labelOverflow="wrap" labelMaxWidth={90} labelMaxLines={3} />
  </BarScale>);
  runtime.flush();
  expect(painted.length).toBeGreaterThan(1);
  expect(painted.map(p => p.text).join(" ")).toBe("September 1980 Mauna Loa");
  for (const p of painted) expect(p.width).toBeLessThanOrEqual(90);
});
it("truncates overflowing labels with a measured ellipsis", () => {
  runtime = testRuntime();
  const labels: string[] = [];
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(text => { labels.push(String(text)); });
  runtime.mount(<BarScale id="x" domain={["September 1980 Mauna Loa"]} range={[0, 100]}>
    <Axis scale="x" position="bottom" labelOverflow="truncate" labelMaxWidth={70} />
  </BarScale>);
  runtime.flush();
  expect(labels).toHaveLength(1);
  expect(labels[0]).toMatch(/…$/);
});

it("updates signal-valued label policy and detaches on disposal", () => {
  runtime = testRuntime();
  const policy = signal<"truncate" | "wrap">("truncate");
  const labels: string[] = [];
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(text => { labels.push(String(text)); });
  runtime.mount(<BarScale id="x" domain={["September 1980 Mauna Loa"]} range={[0, 100]}>
    <Axis scale="x" position="left" labelOverflow={policy} labelMaxWidth={90} labelMaxLines={3} />
  </BarScale>);
  runtime.flush(); expect(labels).toHaveLength(1);
  labels.length = 0; policy.set("wrap"); runtime.flush();
  expect(labels.join(" ")).toBe("September 1980 Mauna Loa");
  runtime.dispose(); policy.set("truncate"); expect(runtime.pending).toBe(0);
});
