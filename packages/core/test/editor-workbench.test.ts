import {
  configureDeclarationLibraries,
  declarationLibraries,
} from "../../../playground/src/editor-declaration-libraries";
import { threeDeclarationLibraries } from "../../../playground/src/three-editor-declaration-libraries";
import { sourceImportsThree } from "../../../playground/src/source-imports-three";
import { typescriptDefaults } from "../../../playground/node_modules/monaco-editor/esm/vs/languages/features/typescript/register.js";
import { describe, expect, it } from "vitest";

describe("Studio editor declaration libraries", () => {
  it("loads Three declarations only for actual module imports", () => {
    expect(
      sourceImportsThree(`
        import { defineThreeLayer } from "@crc/three";
        import { Scene } from "three";
      `),
    ).toBe(true);
    expect(
      sourceImportsThree(
        `import { OrbitControls } from "three/addons/controls/OrbitControls.js";`,
      ),
    ).toBe(true);

    expect(
      sourceImportsThree(`
        const label = "three";
        const example = 'import { Scene } from "three"';
        // import { Scene } from "three";
        /* import { defineThreeLayer } from "@crc/three"; */
      `),
    ).toBe(false);
  });

  it("installs CRC declarations without eagerly loading Three's declaration graph", () => {
    const libraries = declarationLibraries();
    const filePaths = new Set(libraries.map(({ filePath }) => filePath));

    expect(libraries).toHaveLength(12);
    expect(filePaths.size).toBe(12);
    expect(filePaths).toContain("file:///node_modules/@crc/webgl/gltf.d.ts");
    expect(filePaths).toContain("file:///node_modules/@crc/three/index.d.ts");
    expect(filePaths).not.toContain("file:///node_modules/three/index.d.ts");
    expect(filePaths).not.toContain(
      "file:///node_modules/three/src/scenes/Scene.d.ts",
    );
    expect(filePaths).not.toContain(
      "file:///node_modules/three/addons/controls/OrbitControls.d.ts",
    );
    expect(filePaths).not.toContain(
      "file:///node_modules/@types/webxr/index.d.ts",
    );

    expect(configureDeclarationLibraries(typescriptDefaults)).toEqual(
      libraries,
    );
    expect(Object.keys(typescriptDefaults.getExtraLibs()).sort()).toEqual(
      libraries.map(({ filePath }) => filePath).sort(),
    );
  });

  it("preserves the complete Three declaration graph for on-demand installation", () => {
    const libraries = threeDeclarationLibraries();
    const filePaths = new Set(libraries.map(({ filePath }) => filePath));

    expect(libraries).toHaveLength(538);
    expect(filePaths.size).toBe(538);
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
  });
});
