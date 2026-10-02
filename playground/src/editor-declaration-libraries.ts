import crcDeclarationBundle from "./crc-editor-types.txt?raw";

export interface EditorDeclarationLibrary {
  readonly content: string;
  readonly filePath: string;
}

interface DeclarationLibraryDefaults {
  setExtraLibs(libraries: EditorDeclarationLibrary[]): void;
}

const declarationModulePaths = new Map([
  ["@crc/textures", "file:///node_modules/@crc/textures/index.d.ts"],
<<<<<<< HEAD
=======
  ["@crc/text", "file:///node_modules/@crc/text/index.d.ts"],
>>>>>>> origin/main
  ["@crc/viz", "file:///node_modules/@crc/viz/index.d.ts"],
  ["@crc/core", "file:///node_modules/@crc/core/index.d.ts"],
  ["@crc/core/jsx-runtime", "file:///node_modules/@crc/core/jsx-runtime.d.ts"],
  [
    "@crc/core/jsx-dev-runtime",
    "file:///node_modules/@crc/core/jsx-dev-runtime.d.ts",
  ],
  ["@crc/particles", "file:///node_modules/@crc/particles/index.d.ts"],
  ["@crc/physics/2d", "file:///node_modules/@crc/physics/2d.d.ts"],
  [
    "@crc/physics/2d/geometry",
    "file:///node_modules/@crc/physics/2d/geometry.d.ts",
  ],
  [
    "@crc/physics/3d/geometry",
    "file:///node_modules/@crc/physics/3d/geometry.d.ts",
  ],
  ["@crc/three", "file:///node_modules/@crc/three/index.d.ts"],
]);

function crcDeclarationLibraries(): EditorDeclarationLibrary[] {
  const markers = [
    ...crcDeclarationBundle.matchAll(/^\/\* @crc-studio-module (.+) \*\/$/gmu),
  ];
  const libraries = markers.map((marker, index) => {
    const moduleName = marker[1];
    const filePath = moduleName && declarationModulePaths.get(moduleName);
    if (!filePath) throw new Error("Unknown CRC Studio declaration module.");
    return {
      content: crcDeclarationBundle
        .slice(
          marker.index + marker[0].length,
          markers[index + 1]?.index ?? crcDeclarationBundle.length,
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
      `CRC Studio declarations must define all ${declarationModulePaths.size} package entry points.`,
    );
  }
  return libraries;
}

export function declarationLibraries(): EditorDeclarationLibrary[] {
  return crcDeclarationLibraries();
}

export function configureDeclarationLibraries(
  defaults: DeclarationLibraryDefaults,
): EditorDeclarationLibrary[] {
  const libraries = declarationLibraries();
  defaults.setExtraLibs(libraries);
  return libraries;
}
