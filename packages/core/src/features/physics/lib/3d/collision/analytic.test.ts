import { describe, expect, it } from "vitest";
import {
  distancePointToBox3D,
  distancePointToSphere3D,
  distanceSphereToBox3D,
  distanceSphereToSphere3D,
} from "./analytic.js";

const identityAxes = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

describe("analytic 3D sphere and box distances", () => {
  it("returns exact sphere witnesses for separated, touching, and coincident centers", () => {
    expect(distanceSphereToSphere3D([0, 0, 0], 2, [7, 0, 0], 3, [-1, 0, 0])).toMatchObject({
      separation: 2,
      first: [2, 0, 0],
      second: [4, 0, 0],
      normal: [-1, 0, 0],
    });
    expect(distanceSphereToSphere3D([0, 0, 0], 2, [5, 0, 0], 3, [-1, 0, 0]).separation).toBe(0);
    expect(distanceSphereToSphere3D([0, 0, 0], 2, [0, 0, 0], 1, [0, 1, 0])).toMatchObject({
      separation: -3,
      normal: [0, 1, 0],
    });
  });

  it("returns signed point distances for spheres and boxes, including interior face ties", () => {
    expect(distancePointToSphere3D([4, 0, 0], [0, 0, 0], 2, [1, 0, 0])).toMatchObject({
      separation: 2,
      first: [4, 0, 0],
      second: [2, 0, 0],
      normal: [1, 0, 0],
    });
    expect(distancePointToBox3D([3, 0, 0], [0, 0, 0], identityAxes, [1, 2, 3])).toMatchObject({
      separation: 2,
      first: [3, 0, 0],
      second: [1, 0, 0],
      normal: [1, 0, 0],
    });
    expect(distancePointToBox3D([0, 0, 0], [0, 0, 0], identityAxes, [1, 1, 1])).toMatchObject({
      separation: -1,
      second: [-1, 0, 0],
      normal: [-1, 0, 0],
      secondFeature: 0,
    });
  });

  it("returns one analytic sphere-box witness outside and inside", () => {
    expect(distanceSphereToBox3D([4, 0, 0], 1, [0, 0, 0], identityAxes, [2, 2, 2])).toMatchObject({
      separation: 1,
      first: [3, 0, 0],
      second: [2, 0, 0],
      normal: [1, 0, 0],
    });
    expect(distanceSphereToBox3D([0, 0, 0], 0.5, [0, 0, 0], identityAxes, [2, 2, 2])).toMatchObject({
      separation: -2.5,
      first: [0.5, 0, 0],
      second: [-2, 0, 0],
      normal: [-1, 0, 0],
    });
  });
});
