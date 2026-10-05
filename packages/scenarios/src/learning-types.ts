import type { getLearningExampleBySlug, getLearningExamplesByBrowseGroup, getLearningExamplesBySection, learningSections } from './learning-catalog.js';
import type { loadTutorialSnapshot } from './tutorial-catalog.js';
import type { TutorialSnapshotCatalogEntry, TutorialSnapshotMetadata } from './tutorial-types.js';
import type { PibblController } from "@pibbl/core";

/**
 * A stable identifier for a public learning-example section.
 *
 * @see {@link LearningExampleMetadata}
 * @see {@link LearningSection}
 * @see {@link getLearningExamplesBySection}
 */
export type LearningSectionId =
  | "start"
  | "drawing"
  | "composition"
  | "layout"
  | "mouse-events"
  | "user-events"
  | "keyboard-focus"
  | "advanced-interactions"
  | "three";

/**
 * The JSX or createElement authoring form used by a learning example.
 *
 * @see {@link LearningExampleMetadata}
 */
export type LearningAuthoring = "jsx" | "createElement";

/**
 * A public example browse category independent of deterministic lab catalogs.
 *
 * @see {@link LearningExampleMetadata}
 * @see {@link getLearningExamplesByBrowseGroup}
 */
export type LearningBrowseGroup =
  | "drawing"
  | "composition"
  | "three"
  | "layout"
  | "events-and-interaction"
  | "focus-and-keyboard";

/**
 * Presentation metadata for one public learning-example section.
 *
 * @see {@link LearningSectionId}
 * @see {@link learningSections}
 */
export interface LearningSection {
  /** Id recorded or configured by this scenario. See {@link LearningSectionId}. */
  id: LearningSectionId;
  /** Label recorded or configured by this scenario. See {@link LearningSection}. */
  label: string;
  /** Description recorded or configured by this scenario. See {@link LearningSection}. */
  description: string;
  /** Order recorded or configured by this scenario. See {@link LearningSection}. */
  order: number;
}

/**
 * A suggested learning exercise associated with an example.
 *
 * @see {@link LearningExampleMetadata}
 */
export interface LearningPrompt {
  /** Gesture recorded or configured by this scenario. See {@link LearningPrompt}. */
  gesture: string;
  /** Code recorded or configured by this scenario. See {@link LearningPrompt}. */
  code: string;
}

/**
 * Related examples and documentation used to guide further learning.
 *
 * @see {@link LearningExampleMetadata}
 */
export interface LearningRelationships {
  /** Previous recorded or configured by this scenario. See {@link LearningRelationships}. */
  previous?: string;
  /** Next recorded or configured by this scenario. See {@link LearningRelationships}. */
  next?: string;
  /** Related recorded or configured by this scenario. See {@link LearningRelationships}. */
  related: readonly string[];
}

/**
 * Source metadata needed to open an example in the Studio workbench.
 *
 * @see {@link LearningExampleMetadata}
 * @see {@link TutorialSnapshotMetadata}
 */
export interface WorkbenchSourceMetadata {
  /** Slug recorded or configured by this scenario. See {@link WorkbenchSourceMetadata}. */
  slug: string;
  /** Canvas recorded or configured by this scenario. See {@link WorkbenchSourceMetadata}. */
  canvas: {
    /** Width recorded or configured by this scenario. See {@link WorkbenchSourceMetadata}. */
    width: number;
    /** Height recorded or configured by this scenario. See {@link WorkbenchSourceMetadata}. */
    height: number;
  };
  /** Source recorded or configured by this scenario. See {@link WorkbenchSourceMetadata}. */
  source: {
    /** Path recorded or configured by this scenario. See {@link WorkbenchSourceMetadata}. */
    path: string;
  };
}

/**
 * Identity, learning goals, routing, and relationships of a public example.
 *
 * @see {@link WorkbenchSourceMetadata}
 * @see {@link LearningAuthoring}
 * @see {@link LearningSectionId}
 * @see {@link LearningBrowseGroup}
 * @see {@link LearningPrompt}
 * @see {@link LearningRelationships}
 * @see {@link LearningExampleCatalogEntry}
 */
export interface LearningExampleMetadata extends WorkbenchSourceMetadata {
  /** Authoring recorded or configured by this scenario. See {@link LearningAuthoring}. */
  authoring: LearningAuthoring;
  /** Title recorded or configured by this scenario. See {@link LearningExampleMetadata}. */
  title: string;
  /** Short title recorded or configured by this scenario. See {@link LearningExampleMetadata}. */
  shortTitle: string;
  /** Section recorded or configured by this scenario. See {@link LearningSectionId}. */
  section: LearningSectionId;
  /**
   * The public Examples browse group. The two introductory lessons live in
   * Learn instead, so they deliberately have no public example group.
   */
  browseGroup?: LearningBrowseGroup;
  /** Order recorded or configured by this scenario. See {@link LearningExampleMetadata}. */
  order: number;
  /** Summary recorded or configured by this scenario. See {@link LearningExampleMetadata}. */
  summary: string;
  /** Api recorded or configured by this scenario. See {@link LearningExampleMetadata}. */
  api: readonly string[];
  /** Objectives recorded or configured by this scenario. See {@link LearningExampleMetadata}. */
  objectives: readonly [string, string];
  /** Prompts recorded or configured by this scenario. See {@link LearningPrompt}. */
  prompts: LearningPrompt;
  /** Api notes recorded or configured by this scenario. See {@link LearningExampleMetadata}. */
  apiNotes: readonly string[];
  /** Relationships recorded or configured by this scenario. See {@link LearningRelationships}. */
  relationships: LearningRelationships;
}

/**
 * The mounted learning example's ownership and cleanup interface.
 *
 * @param canvas - Canvas on which to mount the example.
 * @returns A controller whose dispose method releases the example mount. See {@link PibblController}
 * .
 *
 * @see {@link PibblController}
 * @see {@link LearningExampleModule}
 */
export type LearningMount = (canvas: HTMLCanvasElement) => PibblController;

/**
 * The executable module loaded by a public learning catalog entry.
 *
 * @see {@link LearningMount}
 * @see {@link LearningExampleCatalogEntry}
 * @see {@link loadTutorialSnapshot}
 * @see {@link TutorialSnapshotCatalogEntry}
 */
export interface LearningExampleModule {
  /** Default recorded or configured by this scenario. See {@link LearningMount}. */
  default: LearningMount;
}

/**
 * Public example metadata and the lazy loader of its executable module.
 *
 * @see {@link LearningExampleMetadata}
 * @see {@link LearningExampleModule}
 * @see {@link getLearningExampleBySlug}
 * @see {@link getLearningExamplesByBrowseGroup}
 * @see {@link getLearningExamplesBySection}
 */
export interface LearningExampleCatalogEntry extends LearningExampleMetadata {
  /**
   * Load recorded or configured by this scenario. See {@link LearningExampleModule}.
   * @returns A promise for the example module. See {@link LearningExampleModule}.
   */
  load: () => Promise<LearningExampleModule>;
}
