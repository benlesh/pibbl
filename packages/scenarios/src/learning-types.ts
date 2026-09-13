import type { CRCController } from "@crc/core";

export type LearningSectionId =
  | "start"
  | "drawing"
  | "composition"
  | "layout"
  | "mouse-events"
  | "user-events"
  | "keyboard-focus"
  | "advanced-interactions";

export type LearningAuthoring = "jsx" | "createElement";

export type LearningBrowseGroup =
  | "drawing"
  | "composition"
  | "layout"
  | "events-and-interaction"
  | "focus-and-keyboard";

export interface LearningSection {
  id: LearningSectionId;
  label: string;
  description: string;
  order: number;
}

export interface LearningPrompt {
  gesture: string;
  code: string;
}

export interface LearningRelationships {
  previous?: string;
  next?: string;
  related: readonly string[];
}

export interface WorkbenchSourceMetadata {
  slug: string;
  canvas: {
    width: number;
    height: number;
  };
  source: {
    path: string;
  };
}

export interface LearningExampleMetadata extends WorkbenchSourceMetadata {
  authoring: LearningAuthoring;
  title: string;
  shortTitle: string;
  section: LearningSectionId;
  /**
   * The public Examples browse group. The two introductory lessons live in
   * Learn instead, so they deliberately have no public example group.
   */
  browseGroup?: LearningBrowseGroup;
  order: number;
  summary: string;
  api: readonly string[];
  objectives: readonly [string, string];
  prompts: LearningPrompt;
  apiNotes: readonly string[];
  relationships: LearningRelationships;
}

export type LearningMount = (canvas: HTMLCanvasElement) => CRCController;

export interface LearningExampleModule {
  default: LearningMount;
}

export interface LearningExampleCatalogEntry extends LearningExampleMetadata {
  load: () => Promise<LearningExampleModule>;
}
