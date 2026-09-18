import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, getBounds, prune, textureCompress } from "@gltf-transform/functions";
import { format } from "prettier";
import sharp from "sharp";

const REVISION = "c6a6bd13ab2b3c685c7903d03561b8a9392f38b8";
const REPOSITORY = "https://github.com/KhronosGroup/glTF-Sample-Assets";
const RAW_ROOT = `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/${REVISION}/Models`;
const OUTPUT_DIRECTORY = fileURLToPath(
  new URL("../playground/public/models/", import.meta.url),
);
const ALLOWED_ATTRIBUTES = new Set([
  "POSITION",
  "NORMAL",
  "TANGENT",
  "TEXCOORD_0",
]);

const MODELS = [
  {
    id: "avocado",
    name: "Avocado",
    authors: "Microsoft",
    license: "CC0-1.0",
    source: { type: "glb", model: "Avocado" },
  },
  {
    id: "boombox",
    name: "Boom Box",
    authors: "Microsoft",
    license: "CC0-1.0",
    source: { type: "glb", model: "BoomBox" },
  },
  {
    id: "toy-car",
    name: "Toy Car",
    authors: "Guido Odendahl and Eric Chadwick",
    license: "CC0-1.0",
    source: { type: "glb", model: "ToyCar" },
  },
  {
    id: "scifi-helmet",
    name: "Sci-Fi Helmet",
    authors: "Michael Pavlovic and Norbert Nopper",
    license: "CC0-1.0",
    source: { type: "gltf", model: "SciFiHelmet" },
  },
];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const workspace = await mkdtemp(path.join(tmpdir(), "crc-static-glb-gallery-"));

try {
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const provenance = [];
  for (const model of MODELS) {
    const source = await downloadSource(model, workspace);
    const document = await io.read(source.entryPath);
    makeCRCCompatible(document);
    await document.transform(
      prune(),
      dedup(),
      textureCompress({
        encoder: sharp,
        resize: [512, 512],
        slots: /^baseColorTexture$/u,
        quality: 88,
        effort: 8,
      }),
      prune(),
    );
    normalizeSelectedScene(document);
    document.getRoot().getAsset().generator =
      "CRC gallery preparation with glTF Transform 4.5.0";
    const outputBytes = await io.writeBinary(document);
    const outputName = `khronos-${model.id}.glb`;
    await writeFile(path.join(OUTPUT_DIRECTORY, outputName), outputBytes);
    provenance.push({
      ...model,
      outputName,
      sourceURL: source.sourceURL,
      sourceSHA256: source.sha256,
      outputSHA256: sha256(outputBytes),
      outputBytes: outputBytes.byteLength,
    });
  }
  await writeFile(
    path.join(OUTPUT_DIRECTORY, "khronos-static-glb-gallery.LICENSE.md"),
    await format(renderProvenance(provenance), { parser: "markdown" }),
  );
} finally {
  await rm(workspace, { recursive: true, force: true });
}

async function downloadSource(model, directory) {
  const modelDirectory = path.join(directory, model.id);
  await mkdir(modelDirectory, { recursive: true });
  if (model.source.type === "glb") {
    const sourceURL = `${RAW_ROOT}/${model.source.model}/glTF-Binary/${model.source.model}.glb`;
    const bytes = await download(sourceURL);
    const entryPath = path.join(modelDirectory, `${model.source.model}.glb`);
    await writeFile(entryPath, bytes);
    return { entryPath, sourceURL, sha256: sha256(bytes) };
  }

  const sourceURL = `${RAW_ROOT}/${model.source.model}/glTF/${model.source.model}.gltf`;
  const jsonBytes = await download(sourceURL);
  const json = JSON.parse(new TextDecoder().decode(jsonBytes));
  const resources = [
    ...(json.buffers ?? []).map((buffer) => buffer.uri),
    ...(json.images ?? []).map((image) => image.uri),
  ].filter((uri) => typeof uri === "string" && !uri.startsWith("data:"));
  const sourceEntries = [[`${model.source.model}.gltf`, jsonBytes]];
  for (const uri of [...new Set(resources)].sort()) {
    const bytes = await download(new URL(uri, sourceURL).href);
    sourceEntries.push([uri, bytes]);
  }
  for (const [relativePath, bytes] of sourceEntries) {
    const target = path.join(modelDirectory, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  const digest = createHash("sha256");
  for (const [relativePath, bytes] of sourceEntries.sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    digest.update(relativePath);
    digest.update(new Uint8Array([0]));
    digest.update(bytes);
  }
  return {
    entryPath: path.join(modelDirectory, `${model.source.model}.gltf`),
    sourceURL,
    sha256: digest.digest("hex"),
  };
}

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}.`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function makeCRCCompatible(document) {
  const root = document.getRoot();
  for (const node of root.listNodes()) {
    node.setCamera(null).setSkin(null).setWeights([]);
  }
  for (const animation of root.listAnimations()) animation.dispose();
  for (const camera of root.listCameras()) camera.dispose();
  for (const skin of root.listSkins()) skin.dispose();
  for (const mesh of root.listMeshes()) {
    mesh.setWeights([]);
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMode() !== 4) {
        throw new Error(`${mesh.getName() || "mesh"} contains a non-triangle primitive.`);
      }
      for (const semantic of primitive.listSemantics()) {
        if (!ALLOWED_ATTRIBUTES.has(semantic)) {
          primitive.setAttribute(semantic, null);
        }
      }
      for (const target of primitive.listTargets()) primitive.removeTarget(target);
    }
  }
  for (const material of root.listMaterials()) {
    material
      .setNormalTexture(null)
      .setOcclusionTexture(null)
      .setEmissiveTexture(null)
      .setEmissiveFactor([0, 0, 0])
      .setMetallicRoughnessTexture(null)
      .setAlphaMode("OPAQUE")
      .setDoubleSided(false);
    material.getBaseColorTextureInfo()?.setTexCoord(0);
  }
  for (const extension of [...root.listExtensionsUsed()]) extension.dispose();
}

function normalizeSelectedScene(document) {
  const scene = document.getRoot().getDefaultScene();
  if (!scene) throw new Error("Gallery source has no default scene.");
  const bounds = getBounds(scene);
  const size = bounds.max.map((value, index) => value - bounds.min[index]);
  const largestDimension = Math.max(...size);
  if (!(largestDimension > 0) || !Number.isFinite(largestDimension)) {
    throw new Error("Gallery source has invalid scene bounds.");
  }
  const scale = 2.4 / largestDimension;
  const centerX = (bounds.min[0] + bounds.max[0]) / 2;
  const centerZ = (bounds.min[2] + bounds.max[2]) / 2;
  const children = [...scene.listChildren()];
  const wrapper = document
    .createNode("CRC gallery normalization")
    .setScale([scale, scale, scale])
    .setTranslation([-centerX * scale, -bounds.min[1] * scale, -centerZ * scale]);
  scene.addChild(wrapper);
  for (const child of children) wrapper.addChild(child);
}

function renderProvenance(models) {
  const rows = models.map((model) => `| ${model.name} | ${model.authors} | ${model.license} | \`${model.sourceSHA256}\` | \`${model.outputSHA256}\` | ${model.outputBytes.toLocaleString("en-US")} |`).join("\n");
  return `# Khronos static GLB gallery provenance

These files are deterministic CRC-compatible derivatives of models from
[KhronosGroup/glTF-Sample-Assets](${REPOSITORY}) at revision \`${REVISION}\`.

| Model | Authors | License | Source entry SHA-256 | Derived SHA-256 | Bytes |
| --- | --- | --- | --- | --- | ---: |
${rows}

Every model is dedicated under Creative Commons Zero 1.0 by its listed
authors. The full license is available at
<https://creativecommons.org/publicdomain/zero/1.0/>.

## Reproduction

Run \`node tooling/prepare-static-glb-gallery.mjs\`. The pinned pipeline uses
glTF Transform 4.5.0 and Sharp 0.35.4. It bundles external resources, removes
animation, skins, cameras, morph targets, unsupported vertex streams,
normal/occlusion/emissive maps, and extension-only material properties; keeps
triangle geometry, hierarchy, UV0, base-color textures, and metallic/roughness
factors; limits base-color textures to 512×512; prunes unused resources; and
normalizes each selected scene to a centered 2.4-unit footprint on y=0.

## Upstream sources

${models.map((model) => `- **${model.name}:** ${model.sourceURL}`).join("\n")}
`;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
