import { resolve } from "node:path";

import type { Plugin, ViteDevServer } from "vite";

import {
  buildStudioDocumentation,
  discoverStudioDocumentationSourcePaths,
  type StudioDocumentationBuild,
} from "./build";
import { loadStudioLearningExamples } from "./learning-catalog-adapter";

const virtualDocumentationId = "virtual:crc-studio-docs";
const resolvedVirtualDocumentationId = `\0${virtualDocumentationId}`;

export function crcStudioDocs(options: { repositoryRoot: string }): Plugin {
  let latestBuild: StudioDocumentationBuild | undefined;

  async function rebuild(pluginContext?: {
    addWatchFile(path: string): void;
  }): Promise<StudioDocumentationBuild> {
    const documentation = await buildStudioDocumentation(
      studioDocumentationBuildOptions(options.repositoryRoot),
    );
    latestBuild = documentation;
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
    name: "crc-studio-docs",
    async buildStart() {
      await rebuild(this);
    },
    async resolveId(id) {
      return id === virtualDocumentationId
        ? resolvedVirtualDocumentationId
        : undefined;
    },
    async load(id) {
      if (id !== resolvedVirtualDocumentationId) return undefined;
      const documentation = latestBuild ?? (await rebuild());
      return [
        `export const documentation = ${JSON.stringify(documentation)};`,
        "export const pages = documentation.pages;",
        "export const pageByRoute = documentation.pageByRoute;",
        "export const apiCoverage = documentation.apiCoverage;",
      ].join("\n");
    },
    handleHotUpdate(context) {
      if (!isRelevantUpdate(context.file, options.repositoryRoot))
        return undefined;
      latestBuild = undefined;
      return invalidateVirtualDocumentation(context.server);
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
    examples: loadStudioLearningExamples(repositoryRoot),
  };
}

function relevantCatalogPaths(repositoryRoot: string): readonly string[] {
  return [
    resolve(repositoryRoot, "packages/scenarios/src/learning-catalog.ts"),
    resolve(repositoryRoot, "packages/scenarios/src/learning-types.ts"),
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

function invalidateVirtualDocumentation(server: ViteDevServer) {
  const module = server.moduleGraph.getModuleById(
    resolvedVirtualDocumentationId,
  );
  if (module === undefined) return [];
  server.moduleGraph.invalidateModule(module);
  return [module];
}
