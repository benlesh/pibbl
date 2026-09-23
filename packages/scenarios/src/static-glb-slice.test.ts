import {
  STATIC_GLB_SLICE_ACTION_IDS,
  getLearningExampleBySlug,
  getLearningExampleRoute,
  getScenarioRoute,
  loadScenario,
  scenarioCatalog,
  staticGLBSliceScenarioEntry,
} from "@crc/scenarios";
import { describe, expect, it } from "vitest";
import staticGLBSource from "./learning/webgl/static-glb.example.tsx?raw";
import staticGLBLabSource from "./static-glb-slice.example.tsx?raw";
import staticGLBAssetURL from "../../../playground/public/models/crc-static-glb-slice.glb?url";
import editorDeclarationLibrariesSource from "../../../playground/src/editor-declaration-libraries.ts?raw";
import studioViteConfigSource from "../../../playground/vite.config.ts?raw";

describe("static GLB feedback slice registration", () => {
  it("registers the public example at the exact WebGL route", () => {
    const entry = getLearningExampleBySlug("static-glb");
    expect(entry).toMatchObject({
      slug: "static-glb",
      section: "webgl",
      browseGroup: "webgl",
      api: [
        "useGLTF",
        "Model",
        "WebGLLayer",
        "DirectionalLight",
        "useOrbitCamera",
      ],
      source: {
        path: "packages/scenarios/src/learning/webgl/static-glb.example.tsx",
      },
      canvas: { width: 720, height: 420 },
    });
    expect(entry && getLearningExampleRoute(entry)).toBe(
      "#/examples/webgl/static-glb",
    );
  });

  it("keeps the readable example on supported public imports", () => {
    expect(staticGLBSource.match(/@jsxImportSource @crc\/core/gu)).toHaveLength(
      1,
    );
    expect(staticGLBSource).toMatch(/from ['"]@crc\/core['"]/u);
    expect(staticGLBSource).toMatch(/from ['"]@crc\/webgl['"]/u);
    expect(staticGLBSource).toMatch(/from ['"]@crc\/webgl\/gltf['"]/u);
    expect(staticGLBSource).not.toMatch(
      /@crc\/(?:core|webgl)\/(?:internal|src|lib)(?:\/|['"])/u,
    );
  });

  it("registers the glTF declaration subpath with the Studio editor", () => {
    expect(editorDeclarationLibrariesSource).toContain(
      '["@crc/webgl/gltf", "file:///node_modules/@crc/webgl/gltf.d.ts"]',
    );
  });

  it("allows the opaque Studio sandbox to fetch public assets", () => {
    expect(studioViteConfigSource).toContain(
      '"Access-Control-Allow-Origin": "*"',
    );
    expect(studioViteConfigSource).toContain(
      "server: { headers: sandboxAssetHeaders }",
    );
    expect(studioViteConfigSource).toContain(
      "preview: { headers: sandboxAssetHeaders }",
    );
  });

  it("vendors one self-contained GLB 2 asset consumed by the route", async () => {
    const response = await fetch(staticGLBAssetURL);
    const bytes = await response.arrayBuffer();
    const view = new DataView(bytes);
    expect(response.ok).toBe(true);
    expect(view.getUint32(0, true)).toBe(0x46546c67);
    expect(view.getUint32(4, true)).toBe(2);
    expect(view.getUint32(8, true)).toBe(bytes.byteLength);
  });

  it("registers a separate deterministic laboratory with replacement modes", async () => {
    expect(scenarioCatalog).toContain(staticGLBSliceScenarioEntry);
    expect(getScenarioRoute(staticGLBSliceScenarioEntry)).toBe(
      "#/testing/static-glb",
    );
    expect(staticGLBSliceScenarioEntry).toMatchObject({
      metadata: {
        id: "static-glb",
        slug: "static-glb",
        visibility: "test-laboratory",
        maturity: "characterization",
      },
      canvas: { width: 720, height: 420 },
      source: {
        path: "packages/scenarios/src/static-glb-slice.example.tsx",
      },
    });
    expect(staticGLBLabSource).toContain(
      'STATIC_GLB_SLICE_SOURCE_ID = "static-glb-feedback-example"',
    );
    expect(staticGLBLabSource).not.toBe(staticGLBSource);
    expect(
      staticGLBSliceScenarioEntry.actions.map((action) => action.id),
    ).toEqual(STATIC_GLB_SLICE_ACTION_IDS);
    expect(STATIC_GLB_SLICE_ACTION_IDS).toEqual([
      "show-primary",
      "show-replacement",
      "show-malformed",
      "remove-model",
      "remount-model",
      "reset",
    ]);
    const definition = await loadScenario(staticGLBSliceScenarioEntry);
    expect(definition.actionIds).toEqual(STATIC_GLB_SLICE_ACTION_IDS);
  });
});
