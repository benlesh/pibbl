import { expect, it } from "vitest";
import { lazyTransitionKernel } from "../src/lib/transitions/wasm/kernel";
import { bytes } from "../src/lib/transitions/wasm/embers-bytes";

const kernel = lazyTransitionKernel(bytes, 4);
for (const kind of ["box", "ellipse", "polygon", "rotated box"] as const) {
  it(`sweeps and bounces against a packed ${kind} in WASM`, () => {
    const { exports, values } = kernel(1)();
    exports.resetPhysics!();
    // Downward sweep through the top surface y=90, with a normal pointing up.
    values.set([100, 110, 0, 200, 0, 100, 70], 14000);
    const data =
      kind === "polygon"
        ? [4, 0, 0, 0, 100, 100, 80, 90, 120, 90, 120, 110, 80, 110]
        : [
            100,
            100,
            kind === "rotated box" ? 10 : 20,
            kind === "rotated box" ? 20 : 10,
            kind === "rotated box" ? Math.PI / 2 : 0,
            0,
            0,
            0,
            100,
            100,
          ];
    values.set(data, 22400);
    exports.collideObstacles!(
      kind.includes("box") ? 10 : 0,
      kind === "ellipse" ? 10 : 0,
      kind === "polygon" ? data.length : 0,
      0.5,
    );
    expect(values[14000]).toBeCloseTo(100);
    expect(values[14001]).toBeCloseTo(89.95);
    expect(values[14003]).toBeCloseTo(-100);
  });
}
it("selects the closest impact, skips inactive particles, and does not grow memory", () => {
  const { exports, values } = kernel(1)(),
    buffer = values.buffer;
  exports.resetPhysics!();
  values.set([10, 200, 0, 100, 0, 10, 0], 14000);
  values.set(
    [10, 100, 20, 10, 0, 0, 0, 0, 10, 100, 10, 50, 20, 10, 0, 0, 0, 0, 10, 50],
    22400,
  );
  exports.collideObstacles!(20, 0, 0, 1);
  expect(values[14001]).toBeCloseTo(39.95);
  expect(values[14003]).toBe(-100);
  expect(values[14011]).toBe(-1);
  expect(values.buffer).toBe(buffer);
});
it("leaves misses and initially overlapping particles unchanged", () => {
  const { exports, values } = kernel(1)();
  exports.resetPhysics!();
  values.set([100, 101, 0, 10, 0, 100, 100], 14000);
  values.set([0, 110, 0, 10, 0, 0, 0], 14007);
  values.set([100, 100, 20, 10, 0, 0, 0, 0, 100, 100], 22400);
  exports.collideObstacles!(10, 0, 0, 1);
  expect(values[14001]).toBe(101);
  expect(values[14008]).toBe(110);
});
