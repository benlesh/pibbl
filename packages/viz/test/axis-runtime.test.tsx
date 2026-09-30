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

it("preserves explicit band tick order and validates explicit domains before formatting", () => {
  runtime = testRuntime();
  const labels: string[] = [];
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(
    function (this: CanvasRenderingContext2D, text) {
      labels.push(String(text));
    },
  );
  runtime.mount(
    <Scale id="category" type="band" domain={["A", "B", "C"]} range={[0, 300]}>
      <Axis scale="category" position="left" tickValues={["C", "A"]} />
    </Scale>,
  );
  runtime.flush();
  expect(labels).toEqual(["C", "A"]);

  const format = vi.fn((value: number | string) => String(value));
  runtime = testRuntime();
  runtime.mount(
    <Scale id="value" type="linear" domain={[0, 10]} range={[0, 100]}>
      <Axis scale="value" position="bottom" tickValues={[11]} tickFormat={format} />
    </Scale>,
  );
  expect(() => runtime.flush()).toThrow(/tickValues/);
  expect(format).not.toHaveBeenCalled();
  runtime.dispose();

  runtime = testRuntime();
  runtime.mount(
    <Scale id="category" type="band" domain={["A"]} range={[0, 100]}>
      <Axis scale="category" position="left" tickValues={["missing"]} tickFormat={format} />
    </Scale>,
  );
  expect(() => runtime.flush()).toThrow(/tickValues/);
  expect(format).not.toHaveBeenCalled();
});

it("bounds generated tick counts and emits zero or one tick deliberately", () => {
  for (const [count, expected] of [[0, []], [1, ["A"]]] as const) {
    runtime = testRuntime();
    const labels: string[] = [];
    vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(
      function (this: CanvasRenderingContext2D, text) { labels.push(String(text)); },
    );
    runtime.mount(
      <Scale id="category" type="band" domain={["A", "B", "C"]} range={[0, 300]}>
        <Axis scale="category" position="left" tickCount={count} />
      </Scale>,
    );
    runtime.flush();
    expect(labels).toEqual(expected);
    runtime.dispose();
  }
  runtime = testRuntime();
  runtime.mount(
    <Scale id="category" type="band" domain={["A"]} range={[0, 100]}>
      <Axis scale="category" position="left" tickCount={101} />
    </Scale>,
  );
  expect(() => runtime.flush()).toThrow(/tickCount/);

  runtime = testRuntime();
  runtime.mount(
    <Scale id="value" type="linear" domain={[0, 200]} range={[0, 200]}>
      <Axis
        scale="value"
        position="bottom"
        tickValues={Array.from({ length: 101 }, (_, index) => index)}
      />
    </Scale>,
  );
  expect(() => runtime.flush()).toThrow(/tickValues/);
});
