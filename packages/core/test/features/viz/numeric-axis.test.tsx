import numericDemo from "../../../../scenarios/src/learning/composition/viz-numeric-axis.example.js";
import { Axis, LinearScale, linearTicks, niceLinearDomain, formatNumber } from "@pibbl/core/viz";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("offers readable ticks and explicit nicening without mutating the domain", () => {
  const domain = [0.13, 0.97] as const;
  expect(linearTicks(domain, { count: 5 })).toEqual([0.2, 0.4, 0.6, 0.8]);
  expect(niceLinearDomain(domain, { count: 5 })).toEqual([0, 1]);
  expect(linearTicks([0.97, 0.13], { count: 5 })).toEqual([0.8, 0.6, 0.4, 0.2]);
  expect(domain).toEqual([0.13, 0.97]);
  expect(formatNumber(-0.00001, { maximumFractionDigits: 2, suffix: " ppm" })).toBe("0 ppm");
  expect(formatNumber(0.4, { minimumFractionDigits: 2 })).toBe("0.40");
});
it("omits colliding labels independently of tick positions", () => {
  runtime = testRuntime();
  const labels: string[] = [];
  const lines: number[][] = [];
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(text => { labels.push(String(text)); });
  vi.spyOn(Path2D.prototype, "lineTo").mockImplementation((x, y) => { lines.push([x, y]); });
  runtime.mount(<LinearScale id="x" domain={[0, 100]} range={[0, 100]}>
    <Axis scale="x" position="bottom" tickValues={[0, 25, 50, 75, 100]} labelOverlap="skip" labelGap={8} tickFormat={v => `${v} ppm`} />
  </LinearScale>);
  runtime.flush();
  expect(labels).toEqual(["0 ppm", "100 ppm"]);
  expect(lines.filter(([, y]) => y === 406).map(([x]) => x)).toEqual([0, 25, 50, 75, 100]);
});
it("keeps readable ticks within Axis's 100-value limit", () => {
  expect(linearTicks([0, 140], { count: 100 }).length).toBeLessThanOrEqual(100);
});

it("mounts the minimal numeric demo through the public runtime", () => {
  runtime = testRuntime();
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:360px;height:260px";
  document.body.append(canvas);
  const app = numericDemo(canvas);
  try { expect(() => runtime.flush()).not.toThrow(); }
  finally { app.dispose(); }
});
