import {
  learningExampleCatalog,
} from "./learning-catalog";
import type {
  LearningExampleCatalogEntry,
  LearningExampleModule,
} from "./learning-types";
import type {
  TutorialSnapshotCatalogEntry,
} from "./tutorial-types";

const TUTORIAL = "diagram-editor";
const SOURCE_PATH = /^packages\/scenarios\/src\/tutorials\/diagram-editor\/\d{2}-.+\.example\.tsx$/u;

export function validateTutorialSnapshotCatalog(
  catalog: readonly TutorialSnapshotCatalogEntry[],
): readonly TutorialSnapshotCatalogEntry[] {
  const learningSlugs = new Set(learningExampleCatalog.map(({ slug }) => slug));
  const slugs = new Set<string>();
  const paths = new Set<string>();

  for (const [index, entry] of catalog.entries()) {
    if (entry.chapter !== index + 1) {
      throw new Error("Tutorial chapters must be contiguous from 1.");
    }
    if (entry.tutorial !== TUTORIAL) {
      throw new Error(`Tutorial snapshot "${entry.slug}" must use ${TUTORIAL}.`);
    }
    if (entry.authoring !== "jsx") {
      throw new Error(`Tutorial snapshot "${entry.slug}" must use JSX authoring.`);
    }
    if (entry.canvas.width !== 960 || entry.canvas.height !== 600) {
      throw new Error(`Tutorial snapshot "${entry.slug}" must use a 960 by 600 canvas.`);
    }
    if (!SOURCE_PATH.test(entry.source.path)) {
      throw new Error(
        `Tutorial snapshot "${entry.slug}" must use a canonical tutorial source path.`,
      );
    }
    if (learningSlugs.has(entry.slug) || slugs.has(entry.slug)) {
      throw new Error(`duplicate workbench slug "${entry.slug}".`);
    }
    if (paths.has(entry.source.path)) {
      throw new Error(`duplicate tutorial source path "${entry.source.path}".`);
    }
    slugs.add(entry.slug);
    paths.add(entry.source.path);
  }
  return catalog;
}

const drafts = [
  {
    slug: "diagram-editor-canvas-scene",
    tutorial: "diagram-editor",
    chapter: 1,
    title: "Create the Canvas scene",
    authoring: "jsx",
    canvas: { width: 960, height: 600 },
    source: {
      path: "packages/scenarios/src/tutorials/diagram-editor/01-canvas-scene.example.tsx",
    },
    load: () => import("./tutorials/diagram-editor/01-canvas-scene.example"),
  },
  {
    slug: "diagram-editor-first-node",
    tutorial: "diagram-editor",
    chapter: 2,
    title: "Draw the first node",
    authoring: "jsx",
    canvas: { width: 960, height: 600 },
    source: {
      path: "packages/scenarios/src/tutorials/diagram-editor/02-first-node.example.tsx",
    },
    load: () => import("./tutorials/diagram-editor/02-first-node.example"),
  },
] satisfies readonly TutorialSnapshotCatalogEntry[];

export const tutorialSnapshotCatalog = validateTutorialSnapshotCatalog(drafts);

export function getTutorialSnapshotBySlug(
  slug: string,
): TutorialSnapshotCatalogEntry | undefined {
  return tutorialSnapshotCatalog.find((entry) => entry.slug === slug);
}

export function getWorkbenchEntryBySlug(
  slug: string,
): LearningExampleCatalogEntry | TutorialSnapshotCatalogEntry | undefined {
  return (
    learningExampleCatalog.find((entry) => entry.slug === slug) ??
    getTutorialSnapshotBySlug(slug)
  );
}

export async function loadTutorialSnapshot(
  entry: TutorialSnapshotCatalogEntry,
): Promise<LearningExampleModule> {
  const module = await entry.load();
  if (typeof module.default !== "function") {
    throw new Error(`Tutorial snapshot "${entry.slug}" has no default mount function.`);
  }
  return module;
}
