import type { getTutorialSnapshotBySlug, getWorkbenchEntryBySlug, loadTutorialSnapshot } from './tutorial-catalog.js';
import type {
  LearningExampleModule,
  WorkbenchSourceMetadata,
} from "./learning-types";

/**
 * Identity, source, and presentation metadata for an executable tutorial snapshot.
 *
 * @see {@link WorkbenchSourceMetadata}
 * @see {@link TutorialSnapshotCatalogEntry}
 */
export interface TutorialSnapshotMetadata extends WorkbenchSourceMetadata {
  /** Slug recorded or configured by this scenario. See {@link TutorialSnapshotMetadata}. */
  readonly slug: string;
  /** Tutorial recorded or configured by this scenario. See {@link TutorialSnapshotMetadata}. */
  readonly tutorial: "diagram-editor";
  /** Chapter recorded or configured by this scenario. See {@link TutorialSnapshotMetadata}. */
  readonly chapter: number;
  /** Title recorded or configured by this scenario. See {@link TutorialSnapshotMetadata}. */
  readonly title: string;
  /** Authoring recorded or configured by this scenario. See {@link TutorialSnapshotMetadata}. */
  readonly authoring: "jsx";
  /** Canvas recorded or configured by this scenario. See {@link TutorialSnapshotMetadata}. */
  readonly canvas: {
    /** Width recorded or configured by this scenario. See {@link TutorialSnapshotMetadata}. */
    readonly width: 960;
    /** Height recorded or configured by this scenario. See {@link TutorialSnapshotMetadata}. */
    readonly height: 600;
  };
  /** Source recorded or configured by this scenario. See {@link TutorialSnapshotMetadata}. */
  readonly source: {
    /** Path recorded or configured by this scenario. See {@link TutorialSnapshotMetadata}. */
    readonly path: string;
  };
}

/**
 * Tutorial snapshot metadata paired with its lazy executable loader.
 *
 * @see {@link TutorialSnapshotMetadata}
 * @see {@link LearningExampleModule}
 * @see {@link getTutorialSnapshotBySlug}
 * @see {@link getWorkbenchEntryBySlug}
 * @see {@link loadTutorialSnapshot}
 */
export interface TutorialSnapshotCatalogEntry extends TutorialSnapshotMetadata {
  /**
   * Load recorded or configured by this scenario. See {@link LearningExampleModule}.
   * @returns A promise for the example module. See {@link LearningExampleModule}.
   */
  readonly load: () => Promise<LearningExampleModule>;
}
