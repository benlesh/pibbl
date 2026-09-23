import webxrDeclaration from "../node_modules/@types/webxr/index.d.ts?raw";
import type { EditorDeclarationLibrary } from "./editor-declaration-libraries";

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

export function threeDeclarationLibraries(): EditorDeclarationLibrary[] {
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
