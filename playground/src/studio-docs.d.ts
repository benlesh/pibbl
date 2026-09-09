declare module "virtual:crc-studio-docs" {
  import type { StudioDocumentationBuild } from "../../tooling/studio-docs/build";

  export const documentation: StudioDocumentationBuild;
  export const pages: StudioDocumentationBuild["pages"];
  export const pageByRoute: StudioDocumentationBuild["pageByRoute"];
  export const apiCoverage: StudioDocumentationBuild["apiCoverage"];
}
