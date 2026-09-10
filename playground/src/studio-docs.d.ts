declare module "virtual:crc-studio-docs" {
  import type { StudioDocumentationBrowserBuild } from "../../tooling/studio-docs/build";

  export const documentation: StudioDocumentationBrowserBuild;
  export const pages: StudioDocumentationBrowserBuild["pages"];
  export const pageByRoute: StudioDocumentationBrowserBuild["pageByRoute"];
  export const apiCoverage: StudioDocumentationBrowserBuild["apiCoverage"];
}

declare module "virtual:crc-studio-search" {
  import type { SearchRecord } from "../../tooling/studio-docs/search-index";

  export const serializedSearchIndex: string;
  export const searchRecords: readonly SearchRecord[];
}
