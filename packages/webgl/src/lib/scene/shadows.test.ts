import { describe, expect, it } from "vitest";
import { createWebGLGeometry } from "../geometry/geometry.js";
import { resolveCamera } from "../math/camera.js";
import { composeModelMatrix4 } from "../math/matrix4.js";
import {
  createWebGLSceneComposer,
  submitWebGLLight,
  submitWebGLMesh,
} from "./composer.js";
import {
  haveSameWebGLShadowPlan,
  resolveWebGLShadowQuality,
} from "./shadows.js";
import { settleWebGLScene } from "./settle.js";

const geometry = createWebGLGeometry({
  positions: [
    -1, -1, -1, 1, -1, -1, -1, 1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1,
    1, -1, 1, -1, 1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
  ],
  normals: [
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0,
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
  ],
});

describe("directional shadow planning", () => {
  it.each([
    ["low", 512, 1],
    ["medium", 1024, 4],
    ["high", 2048, 9],
  ] as const)(
    "maps %s to its exact requested resolution and comparison count",
    (quality, requestedResolution, comparisonCount) => {
      expect(resolveWebGLShadowQuality(quality)).toEqual({
        quality,
        requestedResolution,
        comparisonCount,
      });
    },
  );

  it("keeps disabled quality free of shadow plans", () => {
    expect(resolveWebGLShadowQuality(false)).toBeUndefined();
    expect(settleScene({ shadowQuality: false }).shadowPlans).toEqual([]);
  });

  it("fits transformed eight-corner world bounds and the Group3D directional pose", () => {
    const scene = settleScene({
      lightTransform: {
        rotationXDegrees: -35,
        rotationYDegrees: 45,
      },
      meshTransform: {
        translateX: 4,
        translateY: 2,
        translateZ: -3,
        rotationYDegrees: 45,
        scaleX: 2,
        scaleY: 3,
        scaleZ: 4,
      },
    });

    expect(scene.meshes[0]!.worldBounds).toMatchObject({
      minimumX: expect.closeTo(-0.2426407, 5),
      maximumX: expect.closeTo(8.2426407, 5),
      minimumY: -1,
      maximumY: 5,
      minimumZ: expect.closeTo(-7.2426407, 5),
      maximumZ: expect.closeTo(1.2426407, 5),
    });
    expect(scene.lights[0]).toMatchObject({
      kind: "directional",
      direction: [
        expect.closeTo(-0.5792279, 5),
        expect.closeTo(-0.5735764, 5),
        expect.closeTo(-0.5792279, 5),
      ],
    });
    expect(scene.shadowPlans).toHaveLength(1);
    expect(scene.shadowPlans[0]).toMatchObject({
      kind: "directional",
      lightIndex: 0,
      requestedResolution: 1024,
      comparisonCount: 4,
      casters: [scene.meshes[0]],
    });
    const shadowPlan = scene.shadowPlans[0]!;
    if (shadowPlan.kind !== "directional") {
      throw new Error("Expected a directional shadow plan.");
    }
    expect(Array.from(shadowPlan.projectionViewMatrix)).toHaveLength(16);
    expect(
      Array.from(shadowPlan.projectionViewMatrix).every(Number.isFinite),
    ).toBe(true);
  });

  it("derives cast and receive defaults from alpha and lit while honoring explicit overrides", () => {
    const opaqueLit = settleScene({ alpha: 1 }).meshes[0]!;
    expect(opaqueLit).toMatchObject({ castShadow: true, receiveShadow: true });
    const transparentLit = settleScene({ alpha: 0.5 }).meshes[0]!;
    expect(transparentLit).toMatchObject({
      castShadow: false,
      receiveShadow: true,
    });
    const transparentExplicit = settleScene({
      alpha: 0.5,
      castShadow: true,
      receiveShadow: false,
    }).meshes[0]!;
    expect(transparentExplicit).toMatchObject({
      castShadow: true,
      receiveShadow: false,
    });
    const opaqueUnlit = settleScene({ alpha: 1, lit: false }).meshes[0]!;
    expect(opaqueUnlit).toMatchObject({
      castShadow: true,
      receiveShadow: false,
    });
    const invisible = settleScene({
      alpha: 0,
      castShadow: true,
      receiveShadow: true,
    }).meshes[0]!;
    expect(invisible).toMatchObject({
      castShadow: false,
      receiveShadow: false,
    });
  });

  it("excludes presentation camera and light color but includes depth-affecting semantics in equality", () => {
    const first = settleScene().shadowPlans[0]!;
    const orbit = settleScene({ cameraPosition: [8, 6, 9] }).shadowPlans[0]!;
    const recolored = settleScene({ lightColor: [0.2, 0.4, 0.8, 1] })
      .shadowPlans[0]!;
    const movedCaster = settleScene({ meshTransform: { translateX: 1 } })
      .shadowPlans[0]!;
    const movedLight = settleScene({
      lightTransform: { rotationYDegrees: 15 },
    }).shadowPlans[0]!;

    expect(haveSameWebGLShadowPlan(first, 1024, orbit, 1024)).toBe(true);
    expect(haveSameWebGLShadowPlan(first, 1024, recolored, 1024)).toBe(true);
    expect(haveSameWebGLShadowPlan(first, 1024, movedCaster, 1024)).toBe(false);
    expect(haveSameWebGLShadowPlan(first, 1024, movedLight, 1024)).toBe(false);
    expect(haveSameWebGLShadowPlan(first, 1024, first, 512)).toBe(false);
  });

  it("keeps receiver remount identity out of the depth key when its derived extent is unchanged", () => {
    const first = settleScene({ meshIdentity: Object.freeze({}) })
      .shadowPlans[0]!;
    const remounted = settleScene({ meshIdentity: Object.freeze({}) })
      .shadowPlans[0]!;

    expect(haveSameWebGLShadowPlan(first, 1024, remounted, 1024)).toBe(false);
    const receiverOnlyFirst = receiverOnlyPlan(first);
    const receiverOnlyRemounted = receiverOnlyPlan(remounted);
    expect(
      haveSameWebGLShadowPlan(
        receiverOnlyFirst,
        1024,
        receiverOnlyRemounted,
        1024,
      ),
    ).toBe(true);
  });

  it("leaves pick/focus and color queues unchanged when directional shadows participate", () => {
    const without = settleScene({ shadowQuality: false });
    const withShadows = settleScene({ shadowQuality: "medium" });

    expect(withShadows.opaque.map((mesh) => mesh.sourceIndex)).toEqual(
      without.opaque.map((mesh) => mesh.sourceIndex),
    );
    expect(withShadows.transparent.map((mesh) => mesh.sourceIndex)).toEqual(
      without.transparent.map((mesh) => mesh.sourceIndex),
    );
    expect(withShadows.pickEntries).toEqual(without.pickEntries);
  });
});

describe("point shadow planning", () => {
  it("builds the six canonical 90-degree cube views with pole-safe up vectors", () => {
    const scene = settleScene({
      lightKind: "point",
      lightTransform: {
        translateX: 2,
        translateY: 3,
        translateZ: 4,
      },
      lightRange: 10,
    });

    expect(scene.shadowPlans).toHaveLength(1);
    const point = scene.shadowPlans[0] as any;
    expect(point).toMatchObject({
      kind: "point",
      lightIndex: 0,
      lightPosition: [2, 3, 4],
      nearDistance: 0.01,
      farDistance: 10,
      requestedResolution: 1024,
      comparisonCount: 4,
    });
    expect(
      point.projectionViewMatrices.map((value: Float32Array) => rounded(value)),
    ).toEqual([
      [0, 0, 1.002002, 1, 0, -1, 0, 0, -1, 0, 0, 0, 4, 3, -2.024024, -2],
      [0, 0, -1.002002, -1, 0, -1, 0, 0, 1, 0, 0, 0, -4, 3, 1.983984, 2],
      [1, 0, 0, 0, 0, 0, 1.002002, 1, 0, 1, 0, 0, -2, -4, -3.026026, -3],
      [1, 0, 0, 0, 0, 0, -1.002002, -1, 0, -1, 0, 0, -2, 4, 2.985986, 3],
      [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1.002002, 1, -2, 3, -4.028028, -4],
      [-1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1.002002, -1, 2, 3, 3.987988, 4],
    ]);
  });

  it("uses finite range as far distance and otherwise encloses every relevant bound", () => {
    const finite = settleScene({
      lightKind: "point",
      lightRange: 3,
    }).shadowPlans[0] as any;
    expect(finite.farDistance).toBe(3);

    const derived = settleScene({
      lightKind: "point",
      lightTransform: { translateX: 2, translateY: 3, translateZ: 4 },
    }).shadowPlans[0] as any;
    expect(derived.farDistance).toBeGreaterThanOrEqual(Math.sqrt(50));
    expect(Number.isFinite(derived.farDistance)).toBe(true);
  });

  it("reuses camera-only and recolor plans but invalidates point pose, range, and casters", () => {
    const first = settleScene({ lightKind: "point" }).shadowPlans[0] as any;
    const orbit = settleScene({
      lightKind: "point",
      cameraPosition: [8, 6, 9],
    }).shadowPlans[0] as any;
    const recolored = settleScene({
      lightKind: "point",
      lightColor: [0.2, 0.4, 0.8, 1],
    }).shadowPlans[0] as any;
    const moved = settleScene({
      lightKind: "point",
      lightTransform: { translateX: 1 },
    }).shadowPlans[0] as any;
    const ranged = settleScene({
      lightKind: "point",
      lightRange: 4,
    }).shadowPlans[0] as any;
    const movedCaster = settleScene({
      lightKind: "point",
      meshTransform: { translateX: 1 },
    }).shadowPlans[0] as any;

    expect(haveSameWebGLShadowPlan(first, 1024, orbit, 1024)).toBe(true);
    expect(haveSameWebGLShadowPlan(first, 1024, recolored, 1024)).toBe(true);
    expect(haveSameWebGLShadowPlan(first, 1024, moved, 1024)).toBe(false);
    expect(haveSameWebGLShadowPlan(first, 1024, ranged, 1024)).toBe(false);
    expect(haveSameWebGLShadowPlan(first, 1024, movedCaster, 1024)).toBe(false);
  });

  it("keeps finite-range receiver-only movement out of the point depth key", () => {
    const first = settleScene({
      lightKind: "point",
      lightRange: 10,
      receiverTransform: { translateX: 2 },
    }).shadowPlans[0]!;
    const movedReceiver = settleScene({
      lightKind: "point",
      lightRange: 10,
      receiverTransform: { translateX: 5 },
    }).shadowPlans[0]!;

    expect(first.casters).toHaveLength(1);
    expect(first.receivers).toHaveLength(1);
    expect(first.receivers[0]!.worldBounds).not.toEqual(
      movedReceiver.receivers[0]!.worldBounds,
    );
    expect(haveSameWebGLShadowPlan(first, 1024, movedReceiver, 1024)).toBe(
      true,
    );
  });

  it("keeps insertion of a non-shadow light out of the point depth key", () => {
    const first = settleScene({ lightKind: "point", lightRange: 10 })
      .shadowPlans[0]!;
    const shifted = settleScene({
      lightKind: "point",
      lightRange: 10,
      ambientBefore: true,
    }).shadowPlans[0]!;

    expect(first.lightIndex).toBe(0);
    expect(shifted.lightIndex).toBe(1);
    expect(haveSameWebGLShadowPlan(first, 1024, shifted, 1024)).toBe(true);
  });

  it("skips finite-range point shadows without an in-range caster or receiver", () => {
    const noCaster = settleScene({
      lightKind: "point",
      lightRange: 2,
      meshTransform: { translateX: 10 },
      receiverTransform: {},
    });
    const noReceiver = settleScene({
      lightKind: "point",
      lightRange: 2,
      receiverTransform: { translateX: 10 },
    });

    expect(noCaster.shadowPlans).toEqual([]);
    expect(noReceiver.shadowPlans).toEqual([]);
  });

  it("submits and keys only point casters intersecting the finite range", () => {
    const first = settleScene({
      lightKind: "point",
      lightRange: 3,
      receiverTransform: {},
      additionalCasterTransform: { translateX: 10 },
    });
    const movedIrrelevant = settleScene({
      lightKind: "point",
      lightRange: 3,
      receiverTransform: {},
      additionalCasterTransform: { translateX: 20 },
    });
    const movedRelevant = settleScene({
      lightKind: "point",
      lightRange: 3,
      meshTransform: { translateX: 0.25 },
      receiverTransform: {},
      additionalCasterTransform: { translateX: 10 },
    });
    const plan = first.shadowPlans[0]!;

    expect(plan.casters).toEqual([first.meshes[0]]);
    expect(plan.receivers).toEqual([first.meshes[2]]);
    expect(
      haveSameWebGLShadowPlan(
        plan,
        1024,
        movedIrrelevant.shadowPlans[0]!,
        1024,
      ),
    ).toBe(true);
    expect(
      haveSameWebGLShadowPlan(plan, 1024, movedRelevant.shadowPlans[0]!, 1024),
    ).toBe(false);
  });
});

describe("spot shadow planning", () => {
  it("builds one outer-cone perspective view from the transformed spot pose", () => {
    const scene = settleScene({
      lightKind: "spot",
      lightTransform: {
        translateX: 2,
        translateY: 3,
        translateZ: 4,
        rotationYDegrees: 90,
      },
      meshTransform: {
        translateY: 3,
        translateZ: 4,
      },
      lightRange: 10,
      outerConeAngleDegrees: 30,
    });

    expect(scene.shadowPlans).toHaveLength(1);
    const spot = scene.shadowPlans[0] as any;
    expect(scene.lights[0]).toMatchObject({
      kind: "spot",
      position: [2, 3, 4],
      direction: [
        expect.closeTo(-1, 6),
        expect.closeTo(0, 6),
        expect.closeTo(0, 6),
      ],
    });
    expect(spot).toMatchObject({
      kind: "spot",
      lightIndex: 0,
      lightPosition: [2, 3, 4],
      nearDistance: 0.5,
      farDistance: 10,
      requestedResolution: 1024,
      comparisonCount: 4,
    });
    expect(rounded(spot.projectionViewMatrix)).toEqual([
      0, 0, -1.105263, -1, 0, 1.732051, 0, 0, -1.732051, 0, 0, 0, 6.928203,
      -5.196152, 1.157895, 2,
    ]);
  });

  it("uses finite range or bounds-derived far and keeps a pole-aligned view finite", () => {
    const finite = settleScene({
      lightKind: "spot",
      lightRange: 3,
      outerConeAngleDegrees: 40,
    }).shadowPlans[0] as any;
    expect(finite.farDistance).toBe(3);

    const derived = settleScene({
      lightKind: "spot",
      lightTransform: { translateX: 2, translateY: 3, translateZ: 4 },
    }).shadowPlans[0] as any;
    expect(derived.farDistance).toBeGreaterThanOrEqual(Math.sqrt(50));
    expect(Number.isFinite(derived.farDistance)).toBe(true);

    const pole = settleScene({
      lightKind: "spot",
      lightTransform: { rotationXDegrees: 90 },
    }).shadowPlans[0] as any;
    expect(Array.from(pole.projectionViewMatrix).every(Number.isFinite)).toBe(
      true,
    );

    const zeroCone = settleScene({
      lightKind: "spot",
      innerConeAngleDegrees: 0,
      outerConeAngleDegrees: 0,
    }).shadowPlans[0] as any;
    expect(
      Array.from(zeroCone.projectionViewMatrix).every(Number.isFinite),
    ).toBe(true);
  });

  it("keeps short-range caster bounds before far/2 inside the spot frustum", () => {
    const scene = settleScene({
      lightKind: "spot",
      lightRange: 0.1,
      lightTransform: { translateZ: 0.05 },
      meshTransform: { scaleX: 0.01, scaleY: 0.01, scaleZ: 0.01 },
    });
    const plan = scene.shadowPlans[0] as any;

    expect(plan.farDistance).toBe(0.1);
    expect(plan.nearDistance).toBeGreaterThan(0);
    expect(plan.nearDistance).toBeLessThan(0.04);
    expect(plan.casters).toEqual([scene.meshes[0]]);
    expect(plan.receivers).toEqual([scene.meshes[0]]);
  });

  it("keeps high-dynamic-range forward bounds inside the spot frustum", () => {
    const scene = settleScene({
      lightKind: "spot",
      lightRange: 1_000_000,
      lightTransform: { translateZ: 1.5 },
    });
    const plan = scene.shadowPlans[0] as any;

    expect(plan.farDistance).toBe(1_000_000);
    expect(plan.nearDistance).toBeGreaterThan(0);
    expect(plan.nearDistance).toBeLessThan(0.5);
    expect(plan.casters).toEqual([scene.meshes[0]]);
  });

  it("keeps close forward geometry from a straddling bound", () => {
    const straddling = settleScene({
      lightKind: "spot",
      lightRange: 10,
      meshTransform: {
        scaleX: 0.000001,
        scaleY: 0.000001,
        scaleZ: 0.000001,
      },
    });
    const plan = straddling.shadowPlans[0] as any;
    expect(plan.nearDistance).toBeGreaterThan(0);
    expect(plan.nearDistance).toBeLessThan(0.000001);
    expect(plan.casters).toEqual([straddling.meshes[0]]);
  });

  it("skips a spot depth plan when every relevant bound is behind the light", () => {
    const behindOnly = settleScene({
      lightKind: "spot",
      lightRange: 10,
      meshTransform: {
        translateZ: 2,
        scaleX: 0.1,
        scaleY: 0.1,
        scaleZ: 0.1,
      },
    });
    expect(behindOnly.shadowPlans).toEqual([]);
  });

  it("derives scale-stable radial bias above depth precision but below close occlusion separation", () => {
    const small = settleScene({
      lightKind: "spot",
      lightRange: 10,
      lightTransform: { translateZ: 5 },
    }).shadowPlans[0] as any;
    const large = settleScene({
      lightKind: "spot",
      lightRange: 10_000,
      lightTransform: { translateZ: 5_000 },
      meshTransform: { scaleX: 1_000, scaleY: 1_000, scaleZ: 1_000 },
    }).shadowPlans[0] as any;

    expect(large.nearDistance / small.nearDistance).toBeCloseTo(1_000, 5);
    expect(large.bias).toBeCloseTo(small.bias, 7);
    expect(small.bias).toBeGreaterThan(1 / 0xffffff);
    expect(large.bias).toBeGreaterThan(1 / 0xffffff);
    expect(small.bias).toBeLessThan(
      radialDepthSeparation(small.farDistance, 4, 4.005),
    );
    expect(large.bias).toBeLessThan(
      radialDepthSeparation(large.farDistance, 4_000, 4_005),
    );
  });

  it("honors spot opt-out and reuses only matching depth inputs", () => {
    const disabled = settleScene({
      lightKind: "spot",
      lightCastShadow: false,
    });
    expect(disabled.shadowPlans).toEqual([]);

    const first = settleScene({ lightKind: "spot" }).shadowPlans[0] as any;
    const orbit = settleScene({
      lightKind: "spot",
      cameraPosition: [8, 6, 9],
    }).shadowPlans[0] as any;
    const recolored = settleScene({
      lightKind: "spot",
      lightColor: [0.2, 0.4, 0.8, 1],
    }).shadowPlans[0] as any;
    const moved = settleScene({
      lightKind: "spot",
      lightTransform: { translateX: 1 },
    }).shadowPlans[0] as any;
    const rotated = settleScene({
      lightKind: "spot",
      lightTransform: { rotationYDegrees: 15 },
    }).shadowPlans[0] as any;
    const cone = settleScene({
      lightKind: "spot",
      outerConeAngleDegrees: 30,
    }).shadowPlans[0] as any;
    const movedCaster = settleScene({
      lightKind: "spot",
      meshTransform: { translateX: 1 },
    }).shadowPlans[0] as any;

    expect(haveSameWebGLShadowPlan(first, 1024, orbit, 1024)).toBe(true);
    expect(haveSameWebGLShadowPlan(first, 1024, recolored, 1024)).toBe(true);
    expect(haveSameWebGLShadowPlan(first, 1024, moved, 1024)).toBe(false);
    expect(haveSameWebGLShadowPlan(first, 1024, rotated, 1024)).toBe(false);
    expect(haveSameWebGLShadowPlan(first, 1024, cone, 1024)).toBe(false);
    expect(haveSameWebGLShadowPlan(first, 1024, movedCaster, 1024)).toBe(false);
  });

  it("skips spot shadows without a caster and receiver inside range and outer cone", () => {
    const casterOutsideRange = settleScene({
      lightKind: "spot",
      lightRange: 10,
      outerConeAngleDegrees: 20,
      meshTransform: { translateZ: -20 },
      receiverTransform: { translateZ: -4 },
    });
    const casterOutsideCone = settleScene({
      lightKind: "spot",
      lightRange: 10,
      outerConeAngleDegrees: 20,
      meshTransform: { translateX: 5, translateZ: -4 },
      receiverTransform: { translateZ: -4 },
    });
    const receiverOutsideCone = settleScene({
      lightKind: "spot",
      lightRange: 10,
      outerConeAngleDegrees: 20,
      meshTransform: { translateZ: -4 },
      receiverTransform: { translateX: 5, translateZ: -4 },
    });

    expect(casterOutsideRange.shadowPlans).toEqual([]);
    expect(casterOutsideCone.shadowPlans).toEqual([]);
    expect(receiverOutsideCone.shadowPlans).toEqual([]);
  });

  it("submits and keys only spot casters intersecting range and outer cone", () => {
    const first = settleScene({
      lightKind: "spot",
      lightRange: 10,
      outerConeAngleDegrees: 20,
      meshTransform: { translateZ: -4 },
      receiverTransform: { translateZ: -6 },
      additionalCasterTransform: { translateX: 5, translateZ: -4 },
    });
    const movedIrrelevant = settleScene({
      lightKind: "spot",
      lightRange: 10,
      outerConeAngleDegrees: 20,
      meshTransform: { translateZ: -4 },
      receiverTransform: { translateZ: -6 },
      additionalCasterTransform: { translateX: 8, translateZ: -4 },
    });
    const movedRelevant = settleScene({
      lightKind: "spot",
      lightRange: 10,
      outerConeAngleDegrees: 20,
      meshTransform: { translateX: 0.25, translateZ: -4 },
      receiverTransform: { translateZ: -6 },
      additionalCasterTransform: { translateX: 5, translateZ: -4 },
    });
    const plan = first.shadowPlans[0]!;

    expect(plan.casters).toEqual([first.meshes[0]]);
    expect(plan.receivers).toEqual([first.meshes[2]]);
    expect(
      haveSameWebGLShadowPlan(
        plan,
        1024,
        movedIrrelevant.shadowPlans[0]!,
        1024,
      ),
    ).toBe(true);
    expect(
      haveSameWebGLShadowPlan(plan, 1024, movedRelevant.shadowPlans[0]!, 1024),
    ).toBe(false);
  });
});

function settleScene(
  options: {
    readonly shadowQuality?: false | "low" | "medium" | "high";
    readonly alpha?: number;
    readonly lit?: boolean;
    readonly castShadow?: boolean;
    readonly receiveShadow?: boolean;
    readonly cameraPosition?: readonly [number, number, number];
    readonly lightColor?: readonly [number, number, number, number];
    readonly lightTransform?: Parameters<typeof composeModelMatrix4>[1];
    readonly meshTransform?: Parameters<typeof composeModelMatrix4>[1];
    readonly meshIdentity?: object;
    readonly receiverTransform?: Parameters<typeof composeModelMatrix4>[1];
    readonly additionalCasterTransform?: Parameters<
      typeof composeModelMatrix4
    >[1];
    readonly lightKind?: "directional" | "point" | "spot";
    readonly lightRange?: number;
    readonly lightCastShadow?: boolean;
    readonly innerConeAngleDegrees?: number;
    readonly outerConeAngleDegrees?: number;
    readonly ambientBefore?: boolean;
  } = {},
) {
  const camera = resolveCamera(
    {
      type: "perspective",
      position: options.cameraPosition ?? [5, 4, 8],
      lookAt: [0, 0, 0],
      up: [0, 1, 0],
      fieldOfViewDegrees: 50,
      near: 0.1,
      far: 100,
    },
    100,
    100,
  );
  const composer = createWebGLSceneComposer({
    frame: {
      canvas: {} as HTMLCanvasElement,
      logicalWidth: 100,
      logicalHeight: 100,
      backingWidth: 100,
      backingHeight: 100,
      renderTimestamp: 1,
    },
    camera,
    contextGeneration: 7,
    shadowQuality: options.shadowQuality ?? "medium",
  } as any);
  if (options.ambientBefore) {
    submitWebGLLight(composer, {
      kind: "ambient",
      componentName: "AmbientLight",
      color: [0.1, 0.1, 0.1, 1],
      intensity: 0.2,
    } as any);
  }
  const lightModel = new Float32Array(16);
  composeModelMatrix4(lightModel, options.lightTransform);
  const lightBase = {
    identity: DIRECT_LIGHT_IDENTITY,
    componentName:
      options.lightKind === "point"
        ? "PointLight"
        : options.lightKind === "spot"
          ? "SpotLight"
          : "DirectionalLight",
    localModel: lightModel,
    color: options.lightColor ?? [1, 1, 1, 1],
    intensity: 1,
    castShadow: options.lightCastShadow ?? true,
  };
  submitWebGLLight(
    composer,
    options.lightKind === "point"
      ? ({
          ...lightBase,
          kind: "point",
          range: options.lightRange,
        } as any)
      : options.lightKind === "spot"
        ? ({
            ...lightBase,
            kind: "spot",
            range: options.lightRange,
            innerConeAngleDegrees: options.innerConeAngleDegrees ?? 10,
            outerConeAngleDegrees: options.outerConeAngleDegrees ?? 45,
          } as any)
        : ({
            ...lightBase,
            kind: "directional",
          } as any),
  );
  const meshModel = new Float32Array(16);
  composeModelMatrix4(meshModel, options.meshTransform);
  submitWebGLMesh(composer, {
    identity: options.meshIdentity ?? MESH_IDENTITY,
    componentName: "Mesh",
    geometry,
    localModel: meshModel,
    color: [1, 1, 1, options.alpha ?? 1],
    lit: options.lit ?? true,
    castShadow: options.castShadow,
    receiveShadow:
      options.receiverTransform === undefined ? options.receiveShadow : false,
  } as any);
  if (options.additionalCasterTransform !== undefined) {
    const additionalCasterModel = new Float32Array(16);
    composeModelMatrix4(
      additionalCasterModel,
      options.additionalCasterTransform,
    );
    submitWebGLMesh(composer, {
      identity: ADDITIONAL_CASTER_IDENTITY,
      componentName: "AdditionalCaster",
      geometry,
      localModel: additionalCasterModel,
      color: [1, 1, 1, 1],
      lit: true,
      castShadow: true,
      receiveShadow: false,
    } as any);
  }
  if (options.receiverTransform !== undefined) {
    const receiverModel = new Float32Array(16);
    composeModelMatrix4(receiverModel, options.receiverTransform);
    submitWebGLMesh(composer, {
      identity: RECEIVER_IDENTITY,
      componentName: "Receiver",
      geometry,
      localModel: receiverModel,
      color: [1, 1, 1, 1],
      lit: true,
      castShadow: false,
      receiveShadow: true,
    } as any);
  }
  return settleWebGLScene(composer);
}

function rounded(values: ArrayLike<number>): number[] {
  return Array.from(values, (value) => Number(value.toFixed(6)));
}

function radialDepthSeparation(
  far: number,
  firstDistance: number,
  secondDistance: number,
): number {
  const depth = (distance: number) => distance / far;
  return depth(secondDistance) - depth(firstDistance);
}

const DIRECT_LIGHT_IDENTITY = Object.freeze({});
const MESH_IDENTITY = Object.freeze({});
const ADDITIONAL_CASTER_IDENTITY = Object.freeze({});
const RECEIVER_IDENTITY = Object.freeze({});

function receiverOnlyPlan(
  plan: ReturnType<typeof settleScene>["shadowPlans"][number],
): typeof plan {
  return Object.freeze({ ...plan, casters: Object.freeze([]) });
}
