import { learningExampleCatalog } from "./learning-catalog";
import type {
  LearningExampleCatalogEntry,
  LearningExampleModule,
} from "./learning-types";
import type { TutorialSnapshotCatalogEntry } from "./tutorial-types";

const TUTORIAL = "diagram-editor";
const SOURCE_DIRECTORY = "packages/scenarios/src/tutorials/diagram-editor";
const CANONICAL_SNAPSHOTS = [
  ["canvas-scene", "canvas-scene"],
  ["first-node", "first-node"],
  ["connect-nodes", "connect-nodes"],
  ["reusable-node", "reusable-node"],
  ["editor-chrome", "editor-chrome"],
  ["selection", "selection"],
  ["dragging", "dragging"],
  ["pan-and-zoom", "pan-and-zoom"],
  ["viewport-and-layer", "viewport-and-layer"],
  ["filters", "filters"],
  ["keyboard-interaction", "keyboard-interaction"],
  ["finished", "finished-editor"],
] as const;

/**
 * Validates tutorial snapshot metadata and returns the catalog.
 *
 * @param catalog - Tutorial snapshot catalog to validate. See {@link TutorialSnapshotCatalogEntry}
 * .
 * @returns The supplied catalog after successful validation; invalid metadata throws. See
 * {@link TutorialSnapshotCatalogEntry} .
 *
 * @see {@link TutorialSnapshotCatalogEntry}
 */
export function validateTutorialSnapshotCatalog(
  catalog: readonly TutorialSnapshotCatalogEntry[],
): readonly TutorialSnapshotCatalogEntry[] {
  if (catalog.length !== CANONICAL_SNAPSHOTS.length) {
    throw new Error(
      `The diagram-editor tutorial catalog must contain exactly 12 snapshots; received ${String(catalog.length)}.`,
    );
  }
  const learningSlugs = new Set(learningExampleCatalog.map(({ slug }) => slug));
  const slugs = new Set<string>();
  const paths = new Set<string>();

  for (const [index, entry] of catalog.entries()) {
    const chapter = index + 1;
    const chapterPrefix = String(chapter).padStart(2, "0");
    const [slugSuffix, pathSuffix] = CANONICAL_SNAPSHOTS[index]!;
    const canonicalSlug = `${TUTORIAL}-${slugSuffix}`;
    const canonicalPath = `${SOURCE_DIRECTORY}/${chapterPrefix}-${pathSuffix}.example.tsx`;
    if (entry.chapter !== index + 1) {
      throw new Error("Tutorial chapters must be contiguous from 1.");
    }
    if (entry.tutorial !== TUTORIAL) {
      throw new Error(
        `Tutorial snapshot "${entry.slug}" must use ${TUTORIAL}.`,
      );
    }
    if (entry.authoring !== "jsx") {
      throw new Error(
        `Tutorial snapshot "${entry.slug}" must use JSX authoring.`,
      );
    }
    if (entry.canvas.width !== 960 || entry.canvas.height !== 600) {
      throw new Error(
        `Tutorial snapshot "${entry.slug}" must use a 960 by 600 canvas.`,
      );
    }
    if (
      !entry.source.path.startsWith(`${SOURCE_DIRECTORY}/${chapterPrefix}-`)
    ) {
      throw new Error(
        `Tutorial Chapter ${String(chapter)} must use filename chapter prefix ${chapterPrefix} in catalog order.`,
      );
    }
    if (learningSlugs.has(entry.slug) || slugs.has(entry.slug)) {
      throw new Error(`duplicate workbench slug "${entry.slug}".`);
    }
    if (paths.has(entry.source.path)) {
      throw new Error(`duplicate tutorial source path "${entry.source.path}".`);
    }
    if (entry.slug !== canonicalSlug || entry.source.path !== canonicalPath) {
      throw new Error(
        `Tutorial Chapter ${String(chapter)} must keep stable diagram-editor slug/path correspondence: ${canonicalSlug} -> ${canonicalPath}.`,
      );
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
  {
    slug: "diagram-editor-connect-nodes",
    tutorial: "diagram-editor",
    chapter: 3,
    title: "Connect two nodes",
    authoring: "jsx",
    canvas: { width: 960, height: 600 },
    source: {
      path: "packages/scenarios/src/tutorials/diagram-editor/03-connect-nodes.example.tsx",
    },
    load: () => import("./tutorials/diagram-editor/03-connect-nodes.example"),
  },
  {
    slug: "diagram-editor-reusable-node",
    tutorial: "diagram-editor",
    chapter: 4,
    title: "Extract a reusable node component",
    authoring: "jsx",
    canvas: { width: 960, height: 600 },
    source: {
      path: "packages/scenarios/src/tutorials/diagram-editor/04-reusable-node.example.tsx",
    },
    load: () => import("./tutorials/diagram-editor/04-reusable-node.example"),
  },
  {
    slug: "diagram-editor-editor-chrome",
    tutorial: "diagram-editor",
    chapter: 5,
    title: "Build the editor chrome",
    authoring: "jsx",
    canvas: { width: 960, height: 600 },
    source: {
      path: "packages/scenarios/src/tutorials/diagram-editor/05-editor-chrome.example.tsx",
    },
    load: () => import("./tutorials/diagram-editor/05-editor-chrome.example"),
  },
  {
    slug: "diagram-editor-selection",
    tutorial: "diagram-editor",
    chapter: 6,
    title: "Select nodes with state",
    authoring: "jsx",
    canvas: { width: 960, height: 600 },
    source: {
      path: "packages/scenarios/src/tutorials/diagram-editor/06-selection.example.tsx",
    },
    load: () => import("./tutorials/diagram-editor/06-selection.example"),
  },
  {
    slug: "diagram-editor-dragging",
    tutorial: "diagram-editor",
    chapter: 7,
    title: "Drag nodes safely",
    authoring: "jsx",
    canvas: { width: 960, height: 600 },
    source: {
      path: "packages/scenarios/src/tutorials/diagram-editor/07-dragging.example.tsx",
    },
    load: () => import("./tutorials/diagram-editor/07-dragging.example"),
  },
  {
    slug: "diagram-editor-pan-and-zoom",
    tutorial: "diagram-editor",
    chapter: 8,
    title: "Pan and zoom the workspace",
    authoring: "jsx",
    canvas: { width: 960, height: 600 },
    source: {
      path: "packages/scenarios/src/tutorials/diagram-editor/08-pan-and-zoom.example.tsx",
    },
    load: () => import("./tutorials/diagram-editor/08-pan-and-zoom.example"),
  },
  {
    slug: "diagram-editor-viewport-and-layer",
    tutorial: "diagram-editor",
    chapter: 9,
    title: "Constrain the viewport",
    authoring: "jsx",
    canvas: { width: 960, height: 600 },
    source: {
      path: "packages/scenarios/src/tutorials/diagram-editor/09-viewport-and-layer.example.tsx",
    },
    load: () =>
      import("./tutorials/diagram-editor/09-viewport-and-layer.example"),
  },
  {
    slug: "diagram-editor-filters",
    tutorial: "diagram-editor",
    chapter: 10,
    title: "Polish selection with filters",
    authoring: "jsx",
    canvas: { width: 960, height: 600 },
    source: {
      path: "packages/scenarios/src/tutorials/diagram-editor/10-filters.example.tsx",
    },
    load: () => import("./tutorials/diagram-editor/10-filters.example"),
  },
  {
    slug: "diagram-editor-keyboard-interaction",
    tutorial: "diagram-editor",
    chapter: 11,
    title: "Add keyboard interaction",
    authoring: "jsx",
    canvas: { width: 960, height: 600 },
    source: {
      path: "packages/scenarios/src/tutorials/diagram-editor/11-keyboard-interaction.example.tsx",
    },
    load: () =>
      import("./tutorials/diagram-editor/11-keyboard-interaction.example"),
  },
  {
    slug: "diagram-editor-finished",
    tutorial: "diagram-editor",
    chapter: 12,
    title: "Finish and harden the editor",
    authoring: "jsx",
    canvas: { width: 960, height: 600 },
    source: {
      path: "packages/scenarios/src/tutorials/diagram-editor/12-finished-editor.example.tsx",
    },
    load: () => import("./tutorials/diagram-editor/12-finished-editor.example"),
  },
] satisfies readonly TutorialSnapshotCatalogEntry[];

/**
 * Executable tutorial snapshots available in the Studio workbench.
 *
 * @see {@link TutorialSnapshotCatalogEntry}
 */
export const tutorialSnapshotCatalog = validateTutorialSnapshotCatalog(drafts);

/**
 * Finds a tutorial's executable snapshot by slug, or returns undefined.
 *
 * @param slug - Tutorial snapshot URL slug to look up.
 * @returns The matching snapshot, or undefined when absent. See
 * {@link TutorialSnapshotCatalogEntry} .
 *
 * @see {@link TutorialSnapshotCatalogEntry}
 */
export function getTutorialSnapshotBySlug(
  slug: string,
): TutorialSnapshotCatalogEntry | undefined {
  return tutorialSnapshotCatalog.find((entry) => entry.slug === slug);
}

/**
 * Finds either a learning example or tutorial snapshot for the Studio workbench.
 *
 * @param slug - Example or tutorial snapshot URL slug to look up.
 * @returns The matching workbench entry, or undefined when absent. See
 * {@link LearningExampleCatalogEntry} , {@link TutorialSnapshotCatalogEntry} .
 *
 * @see {@link LearningExampleCatalogEntry}
 * @see {@link TutorialSnapshotCatalogEntry}
 */
export function getWorkbenchEntryBySlug(
  slug: string,
): LearningExampleCatalogEntry | TutorialSnapshotCatalogEntry | undefined {
  return (
    learningExampleCatalog.find((entry) => entry.slug === slug) ??
    getTutorialSnapshotBySlug(slug)
  );
}

/**
 * Loads a tutorial snapshot's executable module on demand.
 *
 * @param entry - Snapshot entry whose lazy loader should run. See
 * {@link TutorialSnapshotCatalogEntry} .
 * @returns A promise for the loaded snapshot module. See {@link LearningExampleModule}.
 *
 * @see {@link TutorialSnapshotCatalogEntry}
 * @see {@link LearningExampleModule}
 */
export async function loadTutorialSnapshot(
  entry: TutorialSnapshotCatalogEntry,
): Promise<LearningExampleModule> {
  const module = await entry.load();
  if (typeof module.default !== "function") {
    throw new Error(
      `Tutorial snapshot "${entry.slug}" has no default mount function.`,
    );
  }
  return module;
}
