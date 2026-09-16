import type {
  LearningExampleModule,
  WorkbenchSourceMetadata,
} from "./learning-types";

export interface TutorialSnapshotMetadata extends WorkbenchSourceMetadata {
  readonly slug: string;
  readonly tutorial: "diagram-editor";
  readonly chapter: number;
  readonly title: string;
  readonly authoring: "jsx";
  readonly canvas: { readonly width: 960; readonly height: 600 };
  readonly source: { readonly path: string };
}

export interface TutorialSnapshotCatalogEntry extends TutorialSnapshotMetadata {
  readonly load: () => Promise<LearningExampleModule>;
}
