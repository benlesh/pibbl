import { resolve } from "node:path";

import type { Plugin, ViteDevServer } from "vite";

import {
  buildStudioDocumentation,
  discoverStudioDocumentationSourcePaths,
  toStudioDocumentationSearchInput,
  type StudioDocumentationBuild,
} from "./build";
import { loadStudioLearningCatalogs } from "./learning-catalog-adapter";
import { buildSearchBundle, type SerializedSearchBundle } from "./search-index";

const virtualDocumentationId = "virtual:pibbl-studio-docs";
const resolvedVirtualDocumentationId = `\0${virtualDocumentationId}`;
const virtualSearchId = "virtual:pibbl-studio-search";
const resolvedVirtualSearchId = `\0${virtualSearchId}`;

export function pibblStudioDocs(options: { repositoryRoot: string }): Plugin {
  let latestBuild: StudioDocumentationBuild | undefined;
  let latestSearchBundle: SerializedSearchBundle | undefined;

  async function rebuild(pluginContext?: {
    addWatchFile(path: string): void;
  }): Promise<StudioDocumentationBuild> {
    const documentation = await buildStudioDocumentation(
      studioDocumentationBuildOptions(options.repositoryRoot),
    );
    latestBuild = documentation;
    latestSearchBundle = buildSearchBundle(
      toStudioDocumentationSearchInput(documentation),
    );
    pluginContext?.addWatchFile(resolve(options.repositoryRoot, "docs/site"));
    for (const sourcePath of await discoverStudioDocumentationSourcePaths(
      options,
    )) {
      pluginContext?.addWatchFile(resolve(options.repositoryRoot, sourcePath));
    }
    for (const catalogPath of relevantCatalogPaths(options.repositoryRoot)) {
      pluginContext?.addWatchFile(catalogPath);
    }
    return documentation;
  }

  return {
    name: "pibbl-studio-docs",
    async buildStart() {
      await rebuild(this);
    },
    async resolveId(id) {
      if (id === virtualDocumentationId) return resolvedVirtualDocumentationId;
      if (id === virtualSearchId) return resolvedVirtualSearchId;
      return undefined;
    },
    async load(id) {
      if (id === resolvedVirtualDocumentationId) {
        const documentation = latestBuild ?? (await rebuild());
        const navigation = {
          pages: documentation.pages.map(({ route, frontmatter }) => ({ route, frontmatter })),
          legacyRouteToRoute: documentation.legacyRouteToRoute,
        };
        return [
          `export const documentation = ${JSON.stringify(navigation)};`,
          "export const pages = documentation.pages;",
          "export const legacyRouteToRoute = documentation.legacyRouteToRoute;",
        ].join("\n");
      }
      if (id === resolvedVirtualSearchId) {
        if (latestSearchBundle === undefined) await rebuild();
        const searchBundle = latestSearchBundle;
        if (searchBundle === undefined) {
          throw new Error(
            "Studio search data was not generated during rebuild.",
          );
        }
        return [
          `export const serializedSearchIndex = ${JSON.stringify(searchBundle.serializedSearchIndex)};`,
          `export const searchRecords = ${JSON.stringify(searchBundle.searchRecords)};`,
        ].join("\n");
      }
      return undefined;
    },
    handleHotUpdate(context) {
      if (!isRelevantUpdate(context.file, options.repositoryRoot))
        return undefined;
      latestBuild = undefined;
      latestSearchBundle = undefined;
      return invalidateVirtualModules(context.server);
    },
  };
}

/**
 * Supplies the real public learning catalog to every served or built manifest
 * without asking Vite's config loader to compile the catalog's TSX examples.
 */
export function studioDocumentationBuildOptions(repositoryRoot: string) {
  return {
    repositoryRoot,
    ...loadStudioLearningCatalogs(repositoryRoot),
  };
}

function relevantCatalogPaths(repositoryRoot: string): readonly string[] {
  return [
    resolve(repositoryRoot, "packages/scenarios/src/learning-catalog.ts"),
    resolve(repositoryRoot, "packages/scenarios/src/learning-types.ts"),
    resolve(repositoryRoot, "packages/scenarios/src/tutorial-catalog.ts"),
    resolve(repositoryRoot, "packages/scenarios/src/tutorial-types.ts"),
  ];
}

function isRelevantUpdate(path: string, repositoryRoot: string): boolean {
  const publicDocsDirectory = resolve(repositoryRoot, "docs/site");
  return (
    path === publicDocsDirectory ||
    path.startsWith(`${publicDocsDirectory}/`) ||
    relevantCatalogPaths(repositoryRoot).includes(path)
  );
}

function invalidateVirtualModules(server: ViteDevServer) {
  return [resolvedVirtualDocumentationId, resolvedVirtualSearchId]
    .map((id) => server.moduleGraph.getModuleById(id))
    .filter(
      (module): module is NonNullable<typeof module> => module !== undefined,
    )
    .map((module) => {
      server.moduleGraph.invalidateModule(module);
      return module;
    });
}
