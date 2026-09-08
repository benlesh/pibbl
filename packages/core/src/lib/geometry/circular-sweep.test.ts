import { afterEach, describe, expect, it } from "vitest";
import {
  createArcPath,
  createWedgePath,
  resolveCircularSweep,
} from "./circular-sweep";
import { installRecordingPath2D } from "./recording-path2d.test-util";

const fullTurn = Math.PI * 2;

let recording: ReturnType<typeof installRecordingPath2D> | undefined;

afterEach(() => recording?.restore());

describe("resolveCircularSweep", () => {
  it("keeps a zero span empty in either direction", () => {
    expect(resolveCircularSweep(1, 1, false)).toMatchObject({
      sweep: 0,
      fullCircle: false,
    });
    expect(resolveCircularSweep(1, 1, true)).toMatchObject({
      sweep: 0,
      fullCircle: false,
    });
  });

  it("normalizes clockwise short and long sweeps into [0, 2π)", () => {
    expect(resolveCircularSweep(0, Math.PI / 2, false).sweep).toBe(Math.PI / 2);
    expect(resolveCircularSweep(0, -Math.PI / 2, false).sweep).toBe(
      Math.PI * 1.5,
    );
  });

  it("normalizes counterclockwise short and long sweeps into (-2π, 0]", () => {
    expect(resolveCircularSweep(0, -Math.PI / 2, true).sweep).toBe(
      -Math.PI / 2,
    );
    expect(resolveCircularSweep(0, Math.PI / 2, true).sweep).toBe(
      -Math.PI * 1.5,
    );
  });

  it("recognizes only direction-matching differences of at least one turn as full", () => {
    expect(resolveCircularSweep(0, fullTurn, false)).toMatchObject({
      sweep: fullTurn,
      fullCircle: true,
    });
    expect(resolveCircularSweep(fullTurn, 0, true)).toMatchObject({
      sweep: -fullTurn,
      fullCircle: true,
    });
    expect(resolveCircularSweep(0, fullTurn + 1, false)).toMatchObject({
      sweep: fullTurn,
      fullCircle: true,
    });
    expect(resolveCircularSweep(fullTurn + 1, 0, true)).toMatchObject({
      sweep: -fullTurn,
      fullCircle: true,
    });
  });

  it("normalizes opposite-direction full-turn differences instead of making them full", () => {
    expect(resolveCircularSweep(0, -fullTurn, false)).toMatchObject({
      sweep: 0,
      fullCircle: false,
    });
    expect(resolveCircularSweep(0, fullTurn, true)).toMatchObject({
      sweep: 0,
      fullCircle: false,
    });
    expect(
      resolveCircularSweep(0, -(fullTurn + Math.PI / 2), false),
    ).toMatchObject({ sweep: Math.PI * 1.5, fullCircle: false });
    expect(resolveCircularSweep(0, fullTurn + Math.PI / 2, true)).toMatchObject(
      { sweep: -Math.PI * 1.5, fullCircle: false },
    );
  });
});

describe("circular path creators", () => {
  it("records clockwise and counterclockwise arc paths from raw options", () => {
    recording = installRecordingPath2D();

    expect(
      recording.commands(
        createArcPath({
          radius: 10,
          startAngle: 0,
          endAngle: Math.PI,
        }),
      ),
    ).toEqual([["arc", 0, 0, 10, 0, Math.PI, false]]);
    expect(
      recording.commands(
        createArcPath({
          cx: 2,
          cy: 3,
          radius: 10,
          startAngle: 0,
          endAngle: Math.PI / 2,
          counterclockwise: true,
        }),
      ),
    ).toEqual([["arc", 2, 3, 10, 0, -Math.PI * 1.5, true]]);
  });

  it("records partial wedges with center and radial segments", () => {
    recording = installRecordingPath2D();

    expect(
      recording.commands(
        createWedgePath({
          radius: 10,
          startAngle: 0,
          endAngle: Math.PI,
        }),
      ),
    ).toEqual([
      ["moveTo", 0, 0],
      ["lineTo", 10, 0],
      ["arc", 0, 0, 10, 0, Math.PI, false],
      ["closePath"],
    ]);
  });

  it("records full wedges without a radial seam", () => {
    recording = installRecordingPath2D();

    expect(
      recording.commands(
        createWedgePath({
          radius: 10,
          startAngle: 0,
          endAngle: fullTurn,
        }),
      ),
    ).toEqual([["arc", 0, 0, 10, 0, fullTurn, false], ["closePath"]]);
  });

  it("creates empty paths for zero spans and zero radii", () => {
    recording = installRecordingPath2D();

    expect(
      recording.commands(
        createArcPath({
          radius: 10,
          startAngle: 0,
          endAngle: 0,
        }),
      ),
    ).toEqual([]);
    expect(
      recording.commands(
        createWedgePath({
          radius: 10,
          startAngle: 0,
          endAngle: 0,
        }),
      ),
    ).toEqual([]);
    expect(
      recording.commands(
        createArcPath({
          radius: 0,
          startAngle: 0,
          endAngle: Math.PI,
        }),
      ),
    ).toEqual([]);
    expect(
      recording.commands(
        createWedgePath({
          radius: 0,
          startAngle: 0,
          endAngle: Math.PI,
        }),
      ),
    ).toEqual([]);
  });

  it("creates fresh paths", () => {
    recording = installRecordingPath2D();
    const options = { radius: 10, startAngle: 0, endAngle: Math.PI } as const;

    expect(createArcPath(options)).not.toBe(createArcPath(options));
    expect(createWedgePath(options)).not.toBe(createWedgePath(options));
  });

  it("rejects non-finite raw options and a negative radius", () => {
    recording = installRecordingPath2D();

    expect(() =>
      createArcPath({
        cx: Number.NaN,
        radius: 1,
        startAngle: 0,
        endAngle: 1,
      }),
    ).toThrowError(/cx.*finite/);
    expect(() =>
      createArcPath({
        cy: Number.POSITIVE_INFINITY,
        radius: 1,
        startAngle: 0,
        endAngle: 1,
      }),
    ).toThrowError(/cy.*finite/);
    expect(() =>
      createArcPath({
        radius: Number.NEGATIVE_INFINITY,
        startAngle: 0,
        endAngle: 1,
      }),
    ).toThrowError(/radius.*finite/);
    expect(() =>
      createArcPath({
        radius: -1,
        startAngle: 0,
        endAngle: 1,
      }),
    ).toThrowError(/radius.*nonnegative/);
    expect(() =>
      createArcPath({
        radius: 1,
        startAngle: Number.NaN,
        endAngle: 1,
      }),
    ).toThrowError(/startAngle.*finite/);
    expect(() =>
      createArcPath({
        radius: 1,
        startAngle: 0,
        endAngle: Number.NEGATIVE_INFINITY,
      }),
    ).toThrowError(/endAngle.*finite/);
  });

  it("produces usable platform paths", () => {
    recording = installRecordingPath2D();
    recording.restore();
    const context = document.createElement("canvas").getContext("2d")!;
    context.lineWidth = 2;

    expect(
      context.isPointInStroke(
        createArcPath({
          cx: 20,
          cy: 20,
          radius: 10,
          startAngle: 0,
          endAngle: Math.PI,
        }),
        20,
        30,
      ),
    ).toBe(true);
    expect(
      context.isPointInStroke(
        createArcPath({
          cx: 20,
          cy: 20,
          radius: 10,
          startAngle: 0,
          endAngle: Math.PI,
        }),
        20,
        10,
      ),
    ).toBe(false);

    const partialWedge = createWedgePath({
      cx: 20,
      cy: 20,
      radius: 10,
      startAngle: 0,
      endAngle: Math.PI / 2,
    });
    expect(context.isPointInPath(partialWedge, 25, 25)).toBe(true);
    expect(context.isPointInPath(partialWedge, 15, 25)).toBe(false);

    const fullWedge = createWedgePath({
      cx: 20,
      cy: 20,
      radius: 10,
      startAngle: 0,
      endAngle: fullTurn,
    });
    expect(context.isPointInPath(fullWedge, 20, 20)).toBe(true);
    expect(context.isPointInPath(fullWedge, 35, 20)).toBe(false);
  });
});
