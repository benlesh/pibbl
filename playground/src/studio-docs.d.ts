declare module "virtual:pibbl-studio-docs" {
  import type { NavigationDocumentation } from "./app/navigation";

  export const documentation: NavigationDocumentation;
  export const pages: NavigationDocumentation["pages"];
  export const legacyRouteToRoute: Readonly<Record<string, string>>;
}

declare module "virtual:pibbl-studio-search" {
  import type { SearchRecord } from "../../tooling/studio-docs/search-index";

  export const serializedSearchIndex: string;
  export const searchRecords: readonly SearchRecord[];
}
