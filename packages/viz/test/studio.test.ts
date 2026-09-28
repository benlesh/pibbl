import { expect, it } from "vitest";
import { declarationLibraries } from "../../../playground/src/editor-declaration-libraries.js";
it("provides the viz public declarations to the editable Studio", () => {
  const lib = declarationLibraries().find(
    (lib) => lib.filePath === "file:///node_modules/@crc/viz/index.d.ts",
  );
  expect(lib).toBeDefined();
});

import { toRunnableScript } from "../../../playground/src/sandbox-module.js";
import { validateLearningSourceText } from "../../../tooling/learning-source-contract.js";
import lesson from "../../scenarios/src/learning/composition/viz-responsive-line.example.tsx?raw";
it("accepts the standalone viz lesson but still rejects a required fixture argument", () => {
  const contract = {
    authoring: "jsx" as const,
    label: 'Learning example "viz-responsive-line"',
    sourcePath:
      "packages/scenarios/src/learning/composition/viz-responsive-line.example.tsx",
  };
  expect(() => validateLearningSourceText(lesson, contract)).not.toThrow();
  expect(() =>
    validateLearningSourceText(
      lesson.replace("fixture: Fixture = {}", "fixture: Fixture"),
      contract,
    ),
  ).toThrow(/mount/);
  expect(() =>
    toRunnableScript(
      'import { Scale, Axis } from "@crc/viz"; export default function mount(canvas) { return {dispose(){}}; }',
    ),
  ).not.toThrow();
  expect(() =>
    toRunnableScript(
      'import { Scale } from "@crc/viz/internal"; export default function mount(canvas) { return {dispose(){}}; }',
    ),
  ).toThrow();
});
import { loadLearningSource } from "../../../playground/src/learning-sources.js";
import { getLearningExampleBySlug } from "@crc/scenarios";
it("loads the exact editable lesson source through the workbench adapter", async () => {
  await expect(
    loadLearningSource(getLearningExampleBySlug("viz-responsive-line")!),
  ).resolves.toBe(lesson);
});
it("runs a defaulted fixture mount without requiring a second caller argument", () => {
  const emitted =
    'import { Scale } from "@crc/viz"; export default function mount(canvas, fixture = {}) { return {dispose(){}}; }';
  expect(() => toRunnableScript(emitted)).not.toThrow();
  expect(() =>
    toRunnableScript(emitted.replace("fixture = {}", "fixture")),
  ).toThrow();
});
