import {
  getWorkbenchEntryBySlug,
  learningExampleCatalog,
  loadTutorialSnapshot,
  tutorialSnapshotCatalog,
  validateTutorialSnapshotCatalog,
  type TutorialSnapshotCatalogEntry,
} from "@crc/scenarios";
import { expect, it } from "vitest";
import {
  learningSourcePaths,
  tutorialSourcePaths,
  workbenchSourcePaths,
} from "../../../playground/src/learning-sources";

const module = async () => ({ default: () => ({ dispose() {} }) });
const record = (
  chapter: number,
  slug = `diagram-editor-chapter-${String(chapter)}`,
): TutorialSnapshotCatalogEntry => ({
  slug,
  tutorial: "diagram-editor",
  chapter,
  title: `Chapter ${String(chapter)}`,
  authoring: "jsx",
  canvas: { width: 960, height: 600 },
  source: {
    path: `packages/scenarios/src/tutorials/diagram-editor/${String(chapter).padStart(2, "0")}-chapter-${String(chapter)}.example.tsx`,
  },
  load: module,
});

it("validates one ordered tutorial prefix and rejects gaps", () => {
  expect(validateTutorialSnapshotCatalog([record(1), record(2)])).toHaveLength(
    2,
  );
  expect(() => validateTutorialSnapshotCatalog([record(1), record(3)])).toThrow(
    /contiguous from 1/u,
  );
});

it("keeps tutorial and ordinary learning slugs in one workbench namespace", () => {
  expect(tutorialSnapshotCatalog).toEqual([]);
  expect(getWorkbenchEntryBySlug(learningExampleCatalog[0]!.slug)).toBe(
    learningExampleCatalog[0],
  );
  expect(() =>
    validateTutorialSnapshotCatalog([
      record(1, learningExampleCatalog[0]!.slug),
    ]),
  ).toThrow(/duplicate workbench slug/u);
});

it("rejects metadata outside the diagram-editor JSX snapshot contract", () => {
  expect(() =>
    validateTutorialSnapshotCatalog([
      { ...record(1), tutorial: "other" } as unknown as TutorialSnapshotCatalogEntry,
    ]),
  ).toThrow(/diagram-editor/u);
  expect(() =>
    validateTutorialSnapshotCatalog([
      {
        ...record(1),
        authoring: "createElement",
      } as unknown as TutorialSnapshotCatalogEntry,
    ]),
  ).toThrow(/JSX/u);
  expect(() =>
    validateTutorialSnapshotCatalog([
      {
        ...record(1),
        canvas: { width: 959, height: 600 },
      } as unknown as TutorialSnapshotCatalogEntry,
    ]),
  ).toThrow(/960 by 600/u);
  expect(() =>
    validateTutorialSnapshotCatalog([
      { ...record(1), source: { path: "packages/scenarios/src/learning/start/nope.example.tsx" } },
    ]),
  ).toThrow(/canonical tutorial source path/u);
});

it("rejects duplicate chapters and source paths", () => {
  expect(() =>
    validateTutorialSnapshotCatalog([record(1), record(1, "another-chapter")]),
  ).toThrow(/contiguous from 1/u);
  expect(() =>
    validateTutorialSnapshotCatalog([
      record(1),
      { ...record(2), source: record(1).source },
    ]),
  ).toThrow(/duplicate tutorial source path/u);
});

it("rejects tutorial modules without a default mount function", async () => {
  const invalid = {
    ...record(1),
    load: async () => ({}),
  } as TutorialSnapshotCatalogEntry;
  await expect(loadTutorialSnapshot(invalid)).rejects.toThrow(/default mount/u);
});

it("discovers learning and tutorial source paths as separate inventories", () => {
  expect(learningSourcePaths).toEqual(
    learningExampleCatalog.map((entry) => entry.source.path).sort(),
  );
  expect(tutorialSourcePaths).toEqual([]);
  expect(workbenchSourcePaths).toEqual(learningSourcePaths);
});
