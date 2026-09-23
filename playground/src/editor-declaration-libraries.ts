import crcDeclarationBundle from "./crc-editor-types.txt?raw";
import webxrDeclaration from "../node_modules/@types/webxr/index.d.ts?raw";

export interface EditorDeclarationLibrary {
  readonly content: string;
  readonly filePath: string;
}

interface DeclarationLibraryDefaults {
  setExtraLibs(libraries: EditorDeclarationLibrary[]): void;
}

const declarationModulePaths = new Map([
  ["@crc/core", "file:///node_modules/@crc/core/index.d.ts"],
  ["@crc/core/jsx-runtime", "file:///node_modules/@crc/core/jsx-runtime.d.ts"],
  [
    "@crc/core/jsx-dev-runtime",
    "file:///node_modules/@crc/core/jsx-dev-runtime.d.ts",
  ],
  ["@crc/particles", "file:///node_modules/@crc/particles/index.d.ts"],
  [
    "@crc/particles/webgl",
    "file:///node_modules/@crc/particles/webgl.d.ts",
  ],
  ["@crc/physics/2d", "file:///node_modules/@crc/physics/2d.d.ts"],
  [
    "@crc/physics/2d/geometry",
    "file:///node_modules/@crc/physics/2d/geometry.d.ts",
  ],
  ["@crc/physics/3d", "file:///node_modules/@crc/physics/3d.d.ts"],
  [
    "@crc/physics/3d/geometry",
    "file:///node_modules/@crc/physics/3d/geometry.d.ts",
  ],
  ["@crc/three", "file:///node_modules/@crc/three/index.d.ts"],
  ["@crc/webgl", "file:///node_modules/@crc/webgl/index.d.ts"],
  ["@crc/webgl/gltf", "file:///node_modules/@crc/webgl/gltf.d.ts"],
]);

const threeRootDeclarations = import.meta.glob(
  "../node_modules/@types/three/index.d.ts",
  { eager: true, import: "default", query: "?raw" },
) as Readonly<Record<string, string>>;
const threeSourceDeclarations = import.meta.glob(
  "../node_modules/@types/three/src/**/*.d.ts",
  { eager: true, import: "default", query: "?raw" },
) as Readonly<Record<string, string>>;
const threeOrbitControlsDeclaration = import.meta.glob(
  "../node_modules/@types/three/examples/jsm/controls/OrbitControls.d.ts",
  { eager: true, import: "default", query: "?raw" },
) as Readonly<Record<string, string>>;

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

function onlyDeclaration(
  declarations: Readonly<Record<string, string>>,
  label: string,
): readonly [string, string] {
  const entries = Object.entries(declarations);
  if (entries.length !== 1) {
    throw new Error(`CRC Studio must load exactly one ${label} declaration.`);
  }
  return entries[0]!;
}

function threeDeclarationLibraries(): EditorDeclarationLibrary[] {
  const [indexPath, indexContent] = onlyDeclaration(
    threeRootDeclarations,
    "Three root",
  );
  const [orbitPath, orbitContent] = onlyDeclaration(
    threeOrbitControlsDeclaration,
    "OrbitControls",
  );
  if (!indexPath.endsWith("/@types/three/index.d.ts")) {
    throw new Error("Unexpected Three root declaration path.");
  }
  if (
    !orbitPath.endsWith(
      "/@types/three/examples/jsm/controls/OrbitControls.d.ts",
    )
  ) {
    throw new Error("Unexpected OrbitControls declaration path.");
  }
  const sourceLibraries = Object.entries(threeSourceDeclarations).map(
    ([path, content]) => {
      const marker = "/@types/three/";
      const markerIndex = path.lastIndexOf(marker);
      if (markerIndex < 0) {
        throw new Error("Unexpected Three source declaration path.");
      }
      return {
        content,
        filePath: `file:///node_modules/three/${path.slice(markerIndex + marker.length)}`,
      };
    },
  );
  if (sourceLibraries.length !== 535) {
    throw new Error(
      `CRC Studio must load exactly 535 Three source declarations, received ${sourceLibraries.length}.`,
    );
  }
  return [
    {
      content: indexContent,
      filePath: "file:///node_modules/three/index.d.ts",
    },
    ...sourceLibraries,
    {
      content: orbitContent,
      filePath:
        "file:///node_modules/three/addons/controls/OrbitControls.d.ts",
    },
    {
      content: webxrDeclaration,
      filePath: "file:///node_modules/@types/webxr/index.d.ts",
    },
  ];
}

export function declarationLibraries(): EditorDeclarationLibrary[] {
  return [...crcDeclarationLibraries(), ...threeDeclarationLibraries()];
}

export function configureDeclarationLibraries(
  defaults: DeclarationLibraryDefaults,
): EditorDeclarationLibrary[] {
  const libraries = declarationLibraries();
  defaults.setExtraLibs(libraries);
  return libraries;
}
