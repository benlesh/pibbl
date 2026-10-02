import { crc, createElement, Text } from "@crc/core";
import { expect, it } from "vitest";
import { createTextRecorder } from "../../../tooling/agent-verification/text";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../src/lib/scheduler/testing";

it("redacts private resolved text while permitting exact fixture labels without extra materialization", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  const context = canvas.getContext("2d")!;
  const original = context.fillText;
  const recorder = createTextRecorder(context, {
    fixtureText: ["Public fixture"],
    capacity: 4,
  });
  let reads = 0;
  const children = {
    *[Symbol.iterator]() {
      reads++;
      yield "PRIVATE_ACCOUNT_493";
    },
  };
  const controller = crc(
    canvas,
    createElement(Text, {
      children,
      style: { fill: "black", font: "16px sans-serif", left: 10, top: 20 },
    }),
  );
  try {
    driver.flush(1);
    expect(reads).toBe(1);
    const hidden = recorder.snapshot();
    expect(hidden.records[0]).toMatchObject({
      operation: "fillText",
      content: { status: "redacted" },
      x: 10,
      y: 20,
    });
    expect(JSON.stringify(hidden)).not.toContain("PRIVATE_ACCOUNT_493");
    context.fillText("Public fixture", 3, 4);
    context.fillText("Public fixture plus private suffix", 3, 4);
    const observed = recorder.snapshot();
    expect(observed.records[1].content).toEqual({
      status: "fixture",
      value: "Public fixture",
    });
    expect(observed.records[2].content).toEqual({ status: "redacted" });
    expect(observed.geometry).toBe("draw-positions-not-glyph-bounds");
    expect(observed.fontAttribution).toBe("unknown");
    expect(reads).toBe(1);
    expect(hidden.records).toHaveLength(1);
    recorder.stop();
    expect(context.fillText).toBe(original);
    context.fillText("Public fixture", 0, 0);
    expect(recorder.snapshot().records).toHaveLength(3);
    recorder.dispose();
    expect(recorder.snapshot().records).toHaveLength(0);
  } finally {
    recorder.dispose();
    controller.dispose();
    restore();
    canvas.remove();
  }
});

it("bounds retained calls, restores method ownership and preserves native receiver errors", () => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const hadOwn = Object.hasOwn(context, "fillText");
  const original = context.fillText;
  const recorder = createTextRecorder(context, { capacity: 2 });
  try {
    expect(() => createTextRecorder(context)).toThrow("already");
    for (let i = 0; i < 5; i++) context.fillText(`private-${i}`, i, i);
    const state = recorder.snapshot();
    expect(state.records.map((record) => record.sequence)).toEqual([4, 5]);
    expect(state.dropped).toBe(3);
    expect(Object.isFrozen(state.records[0])).toBe(true);
    expect(() =>
      Reflect.apply(context.fillText, {}, ["secret", 1, 1]),
    ).toThrow();
    expect(recorder.snapshot().records).toHaveLength(2);
  } finally {
    recorder.dispose();
  }
  expect(context.fillText).toBe(original);
  expect(Object.hasOwn(context, "fillText")).toBe(hadOwn);
  expect(() =>
    createTextRecorder(context, { fixtureText: ["x".repeat(257)] }),
  ).toThrow("fixture");
  expect(() => createTextRecorder(context, { capacity: 0 })).toThrow(
    "capacity",
  );
});

it("does not turn observation failures into drawing failures or disclose their error messages", () => {
  const context = document.createElement("canvas").getContext("2d")!;
  const recorder = createTextRecorder(context);
  Object.defineProperty(context, "textAlign", {
    configurable: true,
    get() {
      throw new Error("PRIVATE_OBSERVATION_DETAIL");
    },
  });
  try {
    expect(() => context.fillText("PRIVATE_TEXT", 0, 0)).not.toThrow();
    const failed = recorder.snapshot();
    expect(failed.observationFailures).toBe(1);
    expect(failed.completeness).toBe("incomplete");
    expect(JSON.stringify(failed)).not.toContain("PRIVATE");
    Reflect.deleteProperty(context, "textAlign");
    context.fillText("PRIVATE_TEXT", 1, 1);
    expect(recorder.snapshot().records).toHaveLength(1);
    expect(recorder.snapshot().records[0].sequence).toBe(1);
  } finally {
    Reflect.deleteProperty(context, "textAlign");
    recorder.dispose();
  }
});

it("leaves native text conversion single-shot and never allowlists coerced objects", () => {
  const context = document.createElement("canvas").getContext("2d")!;
  const recorder = createTextRecorder(context, {
    fixtureText: ["Public fixture"],
  });
  let conversions = 0;
  const value = {
    toString() {
      conversions++;
      return "Public fixture";
    },
  };
  try {
    context.strokeText(value as unknown as string, 1, 2);
    expect(conversions).toBe(1);
    expect(recorder.snapshot().records[0]).toMatchObject({
      operation: "strokeText",
      content: { status: "redacted" },
    });
    recorder.snapshot();
    expect(conversions).toBe(1);
  } finally {
    recorder.dispose();
  }
});

it('bounds the worst escaped fixture payload and copies the caller allowlist', () => {
  const context = document.createElement('canvas').getContext('2d')!;
  const label = '\u0000'.repeat(256);
  const allowed = [label];
  const recorder = createTextRecorder(context, { capacity: 256, fixtureText: allowed });
  allowed[0] = 'PRIVATE_LATE_ALLOWLIST_MUTATION';
  try {
    for (let i = 0; i < 256; i++) context.fillText(label, Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_VALUE);
    const captured = recorder.snapshot();
    expect(captured.records).toHaveLength(256);
    expect(new TextEncoder().encode(JSON.stringify(captured)).byteLength).toBeLessThan(512 * 1024);
    expect(captured.records[0].content).toEqual({ status: 'fixture', value: label });
    context.fillText(allowed[0], 0, 0);
    expect(recorder.snapshot().records.at(-1)!.content).toEqual({ status: 'redacted' });
  } finally { recorder.dispose(); }
});

it('rolls back partial installation and does not overwrite a later method owner', () => {
  const context = document.createElement('canvas').getContext('2d')!;
  const originalFill = context.fillText;
  const originalStroke = context.strokeText;
  Object.defineProperty(context, 'strokeText', { value: originalStroke, configurable: false });
  expect(() => createTextRecorder(context)).toThrow();
  expect(context.fillText).toBe(originalFill);
  expect(Object.hasOwn(context, 'fillText')).toBe(false);
  const other = document.createElement('canvas').getContext('2d')!;
  const recorder = createTextRecorder(other);
  const later = function(this: CanvasRenderingContext2D, ...args: Parameters<CanvasRenderingContext2D['fillText']>) { return Reflect.apply(originalFill, this, args); };
  other.fillText = later;
  recorder.dispose();
  expect(other.fillText).toBe(later);
  const next = createTextRecorder(other);
  next.dispose();
  expect(other.fillText).toBe(later);
});
