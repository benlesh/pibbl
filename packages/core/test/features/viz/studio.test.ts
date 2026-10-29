import { expect, it } from "vitest";
import { declarationLibraries } from "../../../../../playground/src/editor-declaration-libraries.js";
it("provides the viz public declarations to the editable Studio", () => {
  const lib = declarationLibraries().find(
    (lib) => lib.filePath === "file:///node_modules/@pibbl/core/viz/index.d.ts",
  );
  expect(lib).toBeDefined();
});

import { toRunnableScript as compileRunnableScript } from "../../../../../playground/src/sandbox-module.js";
import { validateLearningSourceText } from "../../../../../tooling/learning-source-contract.js";
import lesson from "../../../../scenarios/src/learning/composition/viz-responsive-line.example.tsx?raw";
it("accepts the standalone viz lesson but still rejects a required fixture argument", () => {
  const contract = {
    authoring: "jsx" as const,
    label: 'Learning example "viz-responsive-line"',
    sourcePath:
      "packages/scenarios/src/learning/composition/viz-responsive-line.example.tsx",
    exportName: "VizResponsiveLineExample",
  };
  expect(() => validateLearningSourceText(lesson, contract)).not.toThrow();
  expect(() =>
    validateLearningSourceText(
      lesson.replace("fixture: Fixture = {}", "fixture: Fixture"),
      contract,
    ),
  ).toThrow(/component/);
  expect(() =>
    toRunnableScript(
      'import { LinearScale, Axis } from "@pibbl/core/viz"; export function Lesson() { return {dispose(){}}; }',
    ),
  ).not.toThrow();
  expect(() =>
    toRunnableScript(
      'import { LinearScale } from "@pibbl/core/viz/internal"; export function Lesson() { return {dispose(){}}; }',
    ),
  ).toThrow();
});
import { loadWorkbenchSource } from "../../../../../playground/src/learning-sources.js";
import { getLearningExampleBySlug } from "@pibbl/scenarios";
it("loads the exact editable lesson source through the workbench adapter", async () => {
  await expect(
    loadWorkbenchSource(getLearningExampleBySlug("viz-responsive-line")!),
  ).resolves.toBe(lesson);
});
it("runs a defaulted fixture mount without requiring a second caller argument", () => {
  const emitted =
    'import { LinearScale } from "@pibbl/core/viz"; export function Lesson(fixture = {}) { return {dispose(){}}; }';
  expect(() => toRunnableScript(emitted)).not.toThrow();
  expect(() =>
    toRunnableScript(emitted.replace("fixture = {}", "fixture")),
  ).toThrow();
});

import pointsLesson from "../../../../scenarios/src/learning/composition/viz-points-and-inspection.example.tsx?raw";
it("loads the custom points lesson as editable canonical source", async () => {
  expect(() =>
    validateLearningSourceText(pointsLesson, {
      authoring: "jsx",
      label: 'Learning example "viz-points-and-inspection"',
      sourcePath:
        "packages/scenarios/src/learning/composition/viz-points-and-inspection.example.tsx",
      exportName: "VizPointsAndInspectionExample",
    }),
  ).not.toThrow();
  await expect(
    loadWorkbenchSource(getLearningExampleBySlug("viz-points-and-inspection")!),
  ).resolves.toBe(pointsLesson);
  expect(() =>
    toRunnableScript(
      'import { PointSeries, PlotSeries, nearestPoint, nearestDomainValue } from "@pibbl/core/viz"; export function Lesson() { return {dispose(){}}; }',
    ),
  ).not.toThrow();
});

import hoverLesson from "../../../../scenarios/src/learning/composition/viz-hover-comparison.example.tsx?raw";
it("loads the complete function-query comparison as canonical editable source", async () => {
  expect(() =>
    validateLearningSourceText(hoverLesson, {
      authoring: "jsx",
      label: 'Learning example "viz-hover-comparison"',
      sourcePath:
        "packages/scenarios/src/learning/composition/viz-hover-comparison.example.tsx",
      exportName: "VizHoverComparisonExample",
    }),
  ).not.toThrow();
  await expect(
    loadWorkbenchSource(getLearningExampleBySlug("viz-hover-comparison")!),
  ).resolves.toBe(hoverLesson);
  expect(() =>
    toRunnableScript(
      'import { HoverData, HoverCard, defineSeries, closestPoint, closestX, interpolateX, linearInterpolation } from "@pibbl/core/viz"; export function Lesson() { return {dispose(){}}; }',
    ),
  ).not.toThrow();
});

import groupedLesson from "../../../../scenarios/src/learning/composition/viz-grouped-bars.example.tsx?raw";
it("loads grouped bars as the canonical editable public lesson", async () => {
  expect(() =>
    validateLearningSourceText(groupedLesson, {
      authoring: "jsx",
      label: 'Learning example "viz-grouped-bars"',
      sourcePath:
        "packages/scenarios/src/learning/composition/viz-grouped-bars.example.tsx",
      exportName: "Scene",
    }),
  ).not.toThrow();
  await expect(
    loadWorkbenchSource(getLearningExampleBySlug("viz-grouped-bars")!),
  ).resolves.toBe(groupedLesson);
});

import stackedLesson from "../../../../scenarios/src/learning/composition/viz-stacked-bars.example.tsx?raw";
it("loads stacked bars as the canonical editable public lesson", async () => {
  expect(() =>
    validateLearningSourceText(stackedLesson, {
      authoring: "jsx",
      label: 'Learning example "viz-stacked-bars"',
      sourcePath:
        "packages/scenarios/src/learning/composition/viz-stacked-bars.example.tsx",
      exportName: "Scene",
    }),
  ).not.toThrow();
  await expect(
    loadWorkbenchSource(getLearningExampleBySlug("viz-stacked-bars")!),
  ).resolves.toBe(stackedLesson);
});

function toRunnableScript(code: string) {
  return compileRunnableScript(code, { exportName: "Lesson" });
}
