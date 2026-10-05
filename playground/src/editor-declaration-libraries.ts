import pibblDeclarationBundle from "./pibbl-editor-types.txt?raw";

export interface EditorDeclarationLibrary {
  readonly content: string;
  readonly filePath: string;
}

interface DeclarationLibraryDefaults {
  setExtraLibs(libraries: EditorDeclarationLibrary[]): void;
}

const declarationModulePaths = new Map([
  ["@pibbl/text", "file:///node_modules/@pibbl/text/index.d.ts"],
  ["@pibbl/core/filters", "file:///node_modules/@pibbl/core/filters.d.ts"],
  ["@pibbl/core/textures", "file:///node_modules/@pibbl/core/textures/index.d.ts"],
  ["@pibbl/core/viz", "file:///node_modules/@pibbl/core/viz/index.d.ts"],
  ["@pibbl/core", "file:///node_modules/@pibbl/core/index.d.ts"],
  ["@pibbl/core/jsx-runtime", "file:///node_modules/@pibbl/core/jsx-runtime.d.ts"],
  [
    "@pibbl/core/jsx-dev-runtime",
    "file:///node_modules/@pibbl/core/jsx-dev-runtime.d.ts",
  ],
  ["@pibbl/core/particles", "file:///node_modules/@pibbl/core/particles/index.d.ts"],
  ["@pibbl/core/machines", "file:///node_modules/@pibbl/core/machines/index.d.ts"],
  ["@pibbl/core/machines/animation", "file:///node_modules/@pibbl/core/machines/animation.d.ts"],
  ["@pibbl/core/sprites", "file:///node_modules/@pibbl/core/sprites/index.d.ts"],
  ["@pibbl/core/sprites/formats/aseprite", "file:///node_modules/@pibbl/core/sprites/formats/aseprite.d.ts"],
  ["@pibbl/core/sprites/formats/texture-packer", "file:///node_modules/@pibbl/core/sprites/formats/texture-packer.d.ts"],
  ["@pibbl/core/physics/2d", "file:///node_modules/@pibbl/core/physics/2d.d.ts"],
  [
    "@pibbl/core/physics/2d/geometry",
    "file:///node_modules/@pibbl/core/physics/2d/geometry.d.ts",
  ],
  ["@pibbl/three", "file:///node_modules/@pibbl/three/index.d.ts"],
]);

function pibblDeclarationLibraries(): EditorDeclarationLibrary[] {
  const markers = [
    ...pibblDeclarationBundle.matchAll(/^\/\* @pibbl-studio-module (.+) \*\/$/gmu),
  ];
  const libraries = markers.map((marker, index) => {
    const moduleName = marker[1];
    const filePath = moduleName && declarationModulePaths.get(moduleName);
    if (!filePath) throw new Error("Unknown Pibbl Studio declaration module.");
    return {
      content: pibblDeclarationBundle
        .slice(
          marker.index + marker[0].length,
          markers[index + 1]?.index ?? pibblDeclarationBundle.length,
        )
        .trimStart(),
      filePath,
    };
  });
  if (
    libraries.length !== declarationModulePaths.size ||
    new Set(markers.map((marker) => marker[1])).size !==
      declarationModulePaths.size
  ) {
    throw new Error(
      `Pibbl Studio declarations must define all ${declarationModulePaths.size} package entry points.`,
    );
  }
  return libraries;
}

export function declarationLibraries(): EditorDeclarationLibrary[] {
  return pibblDeclarationLibraries();
}

export function configureDeclarationLibraries(
  defaults: DeclarationLibraryDefaults,
): EditorDeclarationLibrary[] {
  const libraries = declarationLibraries();
  defaults.setExtraLibs(libraries);
  return libraries;
}
