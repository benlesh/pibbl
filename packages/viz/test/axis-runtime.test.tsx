import { Axis, Scale, type AxisProps } from "@crc/viz";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";

let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("emits the singleton category once with the default tick count", () => {
  runtime = testRuntime();
  const labels: string[] = [];
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(
    (text) => {
      labels.push(String(text));
    },
  );
  runtime.mount(
    <Scale id="category" type="band" domain={["only"]} range={[0, 100]}>
      <Axis scale="category" position="left" />
    </Scale>,
  );
  runtime.flush();
  expect(labels).toEqual(["only"]);
});

it("rejects mutually exclusive tick inputs and invalid positions before drawing", () => {
  const invalid = [
    {
      scale: "category",
      position: "left",
      tickValues: ["only"],
      tickCount: 1,
    },
    { scale: "category", position: "middle" },
  ] as unknown as readonly AxisProps[];
  for (const props of invalid) {
    runtime = testRuntime();
    runtime.mount(
      <Scale id="category" type="band" domain={["only"]} range={[0, 100]}>
        <Axis {...props} />
      </Scale>,
    );
    expect(() => runtime.flush()).toThrow(/tickValues.*tickCount|position/);
    runtime.dispose();
  }
});
