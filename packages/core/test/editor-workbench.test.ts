import {
  configureDeclarationLibraries,
  declarationLibraries,
} from "../../../playground/src/editor-declaration-libraries";
import { typescriptDefaults } from "../../../playground/node_modules/monaco-editor/esm/vs/languages/features/typescript/register.js";
import { describe, expect, it } from "vitest";

describe("Studio editor declaration libraries", () => {
  it("parses seven CRC modules and installs real Three and OrbitControls declarations", () => {
    const libraries = declarationLibraries();
    const filePaths = new Set(libraries.map(({ filePath }) => filePath));

    expect(libraries).toHaveLength(545);
    expect(filePaths.size).toBe(545);
    expect(filePaths).toContain("file:///node_modules/@crc/three/index.d.ts");
    expect(filePaths).toContain("file:///node_modules/three/index.d.ts");
    expect(filePaths).toContain(
      "file:///node_modules/three/src/scenes/Scene.d.ts",
    );
    expect(filePaths).toContain(
      "file:///node_modules/three/addons/controls/OrbitControls.d.ts",
    );
    expect(filePaths).toContain(
      "file:///node_modules/@types/webxr/index.d.ts",
    );

    expect(configureDeclarationLibraries(typescriptDefaults)).toEqual(
      libraries,
    );
    expect(Object.keys(typescriptDefaults.getExtraLibs()).sort()).toEqual(
      libraries.map(({ filePath }) => filePath).sort(),
    );
  });
});
