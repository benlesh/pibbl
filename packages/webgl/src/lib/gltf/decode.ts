import type {
  CRCWebGLAsset,
  CRCWebGLGeometry,
  CRCWebGLPBRMetallicRoughnessMaterial,
  CRCWebGLTexture,
  CRCWebGLTextureSampler,
} from '../types.js';
import {
  createInternalWebGLAsset,
  releaseInternalWebGLAsset,
} from '../assets/asset.js';
import { resolveWebGLPBRMetallicRoughnessMaterial } from '../components/material.js';
import {
  createWebGLGeometry,
  getWebGLGeometryData,
} from '../geometry/geometry.js';
import {
  multiplyMatrix4,
  transformBoundsMatrix4,
} from '../math/matrix4.js';
import {
  createSettledNormalMatrix,
  validateSettledNormalPair,
} from '../scene/normals.js';
import {
  createInternalWebGLTexture,
  type InternalWebGLTextureProducer,
} from '../texture/texture.js';
import {
  decodeGLTFAccessor,
  type CRCGLTFAccessorDecodeContext,
} from './accessor.js';
import {
  GLTFDecodeBudget,
  assertEncodedImageByteLength,
  assertImageDimensions,
} from './budget.js';
import { readGLB } from './glb.js';
import {
  type CRCGLTFDocument,
  type CRCGLTFObject,
  checkedAdd,
  checkedMultiply,
  optionalArray,
  optionalNonnegativeInteger,
  own,
  requireArray,
  requireFiniteNumber,
  requireFiniteTuple,
  requireIndex,
  requireNonnegativeInteger,
  requireObject,
  validateBinaryChunkPadding,
} from './schema.js';

export interface CRCGLTFDecodePlatform {
  decodeImage(
    bytes: Uint8Array,
    mimeType: 'image/png' | 'image/jpeg',
  ): Promise<ImageBitmap>;
}

interface SelectedNode {
  readonly nodeIndex: number;
  readonly node: CRCGLTFObject;
  readonly modelMatrix: Float32Array;
}

interface SelectedPrimitive {
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly primitive: CRCGLTFObject;
}

type NodeTraversalFrame = Readonly<{
  kind: 'enter';
  nodeValue: unknown;
  referencePath: string;
  parentMatrix: ArrayLike<number>;
}> | Readonly<{
  kind: 'exit';
  nodeIndex: number;
}>;

interface CompiledPrimitive {
  readonly geometry: CRCWebGLGeometry;
  readonly material: CRCWebGLPBRMetallicRoughnessMaterial;
}

interface DecodedImageTextures {
  readonly bitmap: ImageBitmap;
  readonly textures: Map<string, CRCWebGLTexture>;
  owners: number;
  closed: boolean;
}

const IDENTITY_MATRIX = Object.freeze([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

const MATERIAL_KEYS = new Set([
  'name',
  'extras',
  'extensions',
  'pbrMetallicRoughness',
]);
const PBR_KEYS = new Set([
  'baseColorFactor',
  'baseColorTexture',
  'extensions',
  'extras',
  'metallicFactor',
  'roughnessFactor',
]);
const TEXTURE_INFO_KEYS = new Set(['index', 'texCoord', 'extras', 'extensions']);
const ATTRIBUTE_USAGES = new Set([
  'POSITION',
  'NORMAL',
  'TANGENT',
  'TEXCOORD_0',
]);

export async function decodeGLBAsset(
  bytes: ArrayBuffer,
  platform: CRCGLTFDecodePlatform,
): Promise<CRCWebGLAsset> {
  if (typeof platform?.decodeImage !== 'function') {
    throw new TypeError('GLB decode platform.decodeImage must be a function.');
  }
  const { json, binaryChunk } = readGLB(bytes);
  const budget = new GLTFDecodeBudget();
  const accessorContext: CRCGLTFAccessorDecodeContext = {
    budget,
    cache: new Map(),
  };
  validateTopLevelFeatures(json);
  const selectedNodes = selectNodes(json);
  const selectedPrimitives = collectSelectedPrimitives(json, selectedNodes, budget);
  if (selectedPrimitives.length === 0) {
    const sceneIndex = json.scene === undefined ? 0 : requireIndex(json.scene, '$.scene');
    throw new TypeError(
      `GLB JSON $.scenes[${sceneIndex}] selected scene must contain renderable mesh primitives.`,
    );
  }

  const textureProducers: InternalWebGLTextureProducer[] = [];
  let assetCandidate: CRCWebGLAsset | undefined;
  try {
    const materials = await compileReferencedMaterials(
      json,
      binaryChunk,
      selectedPrimitives,
      platform,
      textureProducers,
      budget,
    );
    const compiled = compilePrimitiveTemplates(
      json,
      binaryChunk,
      selectedPrimitives,
      materials,
      accessorContext,
      budget,
    );
    const records = [];
    let sourceOrder = 0;
    let minimumX = Infinity;
    let minimumY = Infinity;
    let minimumZ = Infinity;
    let maximumX = -Infinity;
    let maximumY = -Infinity;
    let maximumZ = -Infinity;
    for (const selectedNode of selectedNodes) {
      if (selectedNode.node.mesh === undefined) continue;
      const meshIndex = requireIndex(
        selectedNode.node.mesh,
        `$.nodes[${selectedNode.nodeIndex}].mesh`,
      );
      const mesh = requireObject(
        requireArray(json.meshes, '$.meshes')[meshIndex],
        `$.meshes[${meshIndex}]`,
      );
      const primitives = requireArray(
        mesh.primitives,
        `$.meshes[${meshIndex}].primitives`,
      );
      for (let primitiveIndex = 0; primitiveIndex < primitives.length; primitiveIndex += 1) {
        const template = compiled.get(`${meshIndex}:${primitiveIndex}`)!;
        const primitivePath =
          `$.meshes[${meshIndex}].primitives[${primitiveIndex}]`;
        const geometryData = getWebGLGeometryData(template.geometry);
        try {
          const normalMatrix = createSettledNormalMatrix(selectedNode.modelMatrix);
          validateSettledNormalPair(geometryData.normals!, normalMatrix);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          throw new TypeError(
            `GLB JSON $.nodes[${selectedNode.nodeIndex}] transform cannot render ` +
            `${primitivePath}: ${detail}`,
            { cause: error },
          );
        }
        records.push({
          geometry: template.geometry,
          material: template.material,
          modelMatrix: selectedNode.modelMatrix,
          sourceOrder,
        });
        sourceOrder += 1;
        const worldBounds = transformBoundsMatrix4(
          selectedNode.modelMatrix,
          geometryData.bounds,
        );
        minimumX = Math.min(minimumX, worldBounds.minimumX);
        minimumY = Math.min(minimumY, worldBounds.minimumY);
        minimumZ = Math.min(minimumZ, worldBounds.minimumZ);
        maximumX = Math.max(maximumX, worldBounds.maximumX);
        maximumY = Math.max(maximumY, worldBounds.maximumY);
        maximumZ = Math.max(maximumZ, worldBounds.maximumZ);
      }
    }
    assetCandidate = createInternalWebGLAsset({
      primitives: records,
      bounds: {
        min: [minimumX, minimumY, minimumZ],
        max: [maximumX, maximumY, maximumZ],
      },
    }, textureProducers.map(producer => producer.texture));
    releaseTextureProducers(textureProducers);
    return assetCandidate;
  } catch (error) {
    if (assetCandidate !== undefined) {
      try {
        releaseInternalWebGLAsset(assetCandidate);
      } catch {
        // Preserve the actionable parse/compile failure after best-effort cleanup.
      }
    }
    releaseTextureProducers(textureProducers);
    throw error;
  }
}

function validateTopLevelFeatures(document: CRCGLTFDocument): void {
  const required = optionalArray(document, 'extensionsRequired', '$');
  if (required !== undefined) {
    const unsupported: string[] = [];
    required.forEach((extension, index) => {
      if (typeof extension !== 'string') {
        throw new TypeError(
          `GLB JSON $.extensionsRequired[${index}] must be a string.`,
        );
      }
      unsupported.push(`[${index}] ${extension}`);
    });
    if (unsupported.length > 0) {
      throw new TypeError(
        'GLB JSON $.extensionsRequired contains unsupported required ' +
        `extensions: ${unsupported.join(', ')}.`,
      );
    }
  }
  for (const field of ['animations', 'skins'] as const) {
    if (document[field] !== undefined) {
      throw new TypeError(`GLB JSON $.${field} is unsupported in static GLB assets.`);
    }
  }
}

function selectNodes(document: CRCGLTFDocument): readonly SelectedNode[] {
  if (document.scenes === undefined) {
    throw new TypeError('GLB JSON $.scenes must contain a selected scene.');
  }
  const scenes = requireArray(document.scenes, '$.scenes');
  if (scenes.length === 0) {
    throw new TypeError('GLB JSON $.scenes must contain a selected scene.');
  }
  const sceneIndex = document.scene === undefined ? 0 :
    requireIndex(document.scene, '$.scene');
  if (sceneIndex >= scenes.length) {
    throw new RangeError(`GLB JSON $.scene references missing $.scenes[${sceneIndex}].`);
  }
  const scene = requireObject(scenes[sceneIndex], `$.scenes[${sceneIndex}]`);
  const roots = scene.nodes === undefined ? [] :
    requireArray(scene.nodes, `$.scenes[${sceneIndex}].nodes`);
  const nodes = document.nodes === undefined ? [] :
    requireArray(document.nodes, '$.nodes');
  const selected: SelectedNode[] = [];
  const parentByNode = new Map<number, string>();
  const visiting = new Set<number>();
  const stack: NodeTraversalFrame[] = [];
  for (let rootIndex = roots.length - 1; rootIndex >= 0; rootIndex -= 1) {
    stack.push({
      kind: 'enter',
      nodeValue: roots[rootIndex],
      referencePath: `$.scenes[${sceneIndex}].nodes[${rootIndex}]`,
      parentMatrix: IDENTITY_MATRIX,
    });
  }
  while (stack.length > 0) {
    const frame = stack.pop()!;
    if (frame.kind === 'exit') {
      visiting.delete(frame.nodeIndex);
      continue;
    }
    const nodeIndex = requireIndex(frame.nodeValue, frame.referencePath);
    if (nodeIndex >= nodes.length) {
      throw new RangeError(
        `${frame.referencePath} references missing $.nodes[${nodeIndex}].`,
      );
    }
    if (visiting.has(nodeIndex)) {
      throw new TypeError(
        `${frame.referencePath} creates a cycle at $.nodes[${nodeIndex}].`,
      );
    }
    const previousParent = parentByNode.get(nodeIndex);
    if (previousParent !== undefined) {
      throw new TypeError(
        `${frame.referencePath} gives $.nodes[${nodeIndex}] multiple parents; first ` +
        `selected at ${previousParent}.`,
      );
    }
    parentByNode.set(nodeIndex, frame.referencePath);
    visiting.add(nodeIndex);
    const nodePath = `$.nodes[${nodeIndex}]`;
    const node = requireObject(nodes[nodeIndex], nodePath);
    validateNodeFeatures(node, nodePath);
    const localMatrix = nodeMatrix(node, nodePath);
    const composedMatrix = multiplyMatrix4(
      new Float64Array(16),
      frame.parentMatrix,
      localMatrix,
    );
    const worldMatrix = canonicalizeMatrix4(
      composedMatrix,
      `${nodePath} composed modelMatrix`,
    );
    validateNormalMatrix(worldMatrix, `${nodePath} composed modelMatrix`);
    selected.push({ nodeIndex, node, modelMatrix: worldMatrix });
    const children = node.children === undefined ? [] :
      requireArray(node.children, `${nodePath}.children`);
    stack.push({ kind: 'exit', nodeIndex });
    for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
      stack.push({
        kind: 'enter',
        nodeValue: children[childIndex],
        referencePath: `${nodePath}.children[${childIndex}]`,
        parentMatrix: worldMatrix,
      });
    }
  }
  return selected;
}

function validateNodeFeatures(node: CRCGLTFObject, path: string): void {
  for (const field of ['camera', 'skin', 'weights'] as const) {
    if (node[field] !== undefined) {
      throw new TypeError(`GLB JSON ${path}.${field} is unsupported in static GLB assets.`);
    }
  }
  if (node.extensions !== undefined) {
    const extensions = requireObject(node.extensions, `${path}.extensions`);
    if (extensions.KHR_lights_punctual !== undefined) {
      throw new TypeError(
        `GLB JSON ${path}.extensions.KHR_lights_punctual is unsupported.`,
      );
    }
  }
}

function nodeMatrix(node: CRCGLTFObject, path: string): Float32Array {
  const hasTRS = own(node, 'translation') || own(node, 'rotation') || own(node, 'scale');
  if (node.matrix !== undefined) {
    if (hasTRS) {
      throw new TypeError(`GLB JSON ${path}.matrix is mutually exclusive with TRS fields.`);
    }
    const authoredMatrix = requireFiniteTuple(node.matrix, 16, `${path}.matrix`);
    validateAuthoredTRSMatrix(authoredMatrix, `${path}.matrix`);
    const matrix = canonicalizeMatrix4(authoredMatrix, `${path}.matrix`);
    validateNormalMatrix(matrix, `${path}.matrix`);
    return matrix;
  }
  const translation = node.translation === undefined ? [0, 0, 0] :
    requireFiniteTuple(node.translation, 3, `${path}.translation`);
  const scale = node.scale === undefined ? [1, 1, 1] :
    requireFiniteTuple(node.scale, 3, `${path}.scale`);
  const rotation = node.rotation === undefined ? [0, 0, 0, 1] :
    requireFiniteTuple(node.rotation, 4, `${path}.rotation`);
  const quaternionLength = Math.hypot(...rotation);
  if (!Number.isFinite(quaternionLength) || quaternionLength === 0) {
    throw new TypeError(`GLB JSON ${path}.rotation must be a nonzero quaternion.`);
  }
  const x = rotation[0]! / quaternionLength;
  const y = rotation[1]! / quaternionLength;
  const z = rotation[2]! / quaternionLength;
  const w = rotation[3]! / quaternionLength;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  const matrix = canonicalizeMatrix4([
    (1 - (yy + zz)) * scale[0]!,
    (xy + wz) * scale[0]!,
    (xz - wy) * scale[0]!,
    0,
    (xy - wz) * scale[1]!,
    (1 - (xx + zz)) * scale[1]!,
    (yz + wx) * scale[1]!,
    0,
    (xz + wy) * scale[2]!,
    (yz - wx) * scale[2]!,
    (1 - (xx + yy)) * scale[2]!,
    0,
    translation[0]!, translation[1]!, translation[2]!, 1,
  ], `${path} local TRS matrix`);
  validateNormalMatrix(matrix, `${path} local TRS matrix`);
  return matrix;
}

function canonicalizeMatrix4(
  values: ArrayLike<number>,
  path: string,
): Float32Array {
  const matrix = new Float32Array(16);
  for (let index = 0; index < 16; index += 1) {
    const value = Math.fround(values[index]!);
    if (!Number.isFinite(value)) {
      throw new RangeError(
        `GLB JSON ${path}[${index}] must be representable as finite Float32.`,
      );
    }
    matrix[index] = value === 0 ? 0 : value;
  }
  return matrix;
}

function validateAuthoredTRSMatrix(matrix: ArrayLike<number>, path: string): void {
  if (matrix[3] !== 0 || matrix[7] !== 0 || matrix[11] !== 0 || matrix[15] !== 1) {
    throw new TypeError(`GLB JSON ${path} must be affine.`);
  }
  const columns = [
    [matrix[0]!, matrix[1]!, matrix[2]!],
    [matrix[4]!, matrix[5]!, matrix[6]!],
    [matrix[8]!, matrix[9]!, matrix[10]!],
  ] as const;
  const lengths = columns.map(column => Math.hypot(...column));
  if (lengths.some(length => !Number.isFinite(length) || length === 0)) {
    throw new TypeError(`GLB JSON ${path} must have an invertible normal matrix.`);
  }
  for (let left = 0; left < columns.length; left += 1) {
    for (let right = left + 1; right < columns.length; right += 1) {
      const dot = columns[left]![0] * columns[right]![0] +
        columns[left]![1] * columns[right]![1] +
        columns[left]![2] * columns[right]![2];
      const tolerance = lengths[left]! * lengths[right]! * 1e-5;
      if (!Number.isFinite(dot) || Math.abs(dot) > tolerance) {
        throw new TypeError(
          `GLB JSON ${path} must decompose to TRS without shear.`,
        );
      }
    }
  }
  validateNormalMatrix(matrix, path);
}

function validateNormalMatrix(matrix: ArrayLike<number>, path: string): void {
  try {
    createSettledNormalMatrix(matrix);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new TypeError(
      `GLB JSON ${path} must have an invertible finite normal matrix: ${detail}`,
      { cause: error },
    );
  }
}

function collectSelectedPrimitives(
  document: CRCGLTFDocument,
  nodes: readonly SelectedNode[],
  budget: GLTFDecodeBudget,
): readonly SelectedPrimitive[] {
  const meshes = document.meshes === undefined ? [] :
    requireArray(document.meshes, '$.meshes');
  const unique = new Map<string, SelectedPrimitive>();
  for (const selectedNode of nodes) {
    if (selectedNode.node.mesh === undefined) continue;
    const nodePath = `$.nodes[${selectedNode.nodeIndex}]`;
    const meshIndex = requireIndex(selectedNode.node.mesh, `${nodePath}.mesh`);
    if (meshIndex >= meshes.length) {
      throw new RangeError(`${nodePath}.mesh references missing $.meshes[${meshIndex}].`);
    }
    const meshPath = `$.meshes[${meshIndex}]`;
    const mesh = requireObject(meshes[meshIndex], meshPath);
    if (mesh.weights !== undefined) {
      throw new TypeError(`${meshPath}.weights is unsupported in static GLB assets.`);
    }
    const primitives = requireArray(mesh.primitives, `${meshPath}.primitives`);
    budget.reserveSelectedPrimitiveInstances(primitives.length, nodePath);
    primitives.forEach((primitiveValue, primitiveIndex) => {
      const primitivePath = `${meshPath}.primitives[${primitiveIndex}]`;
      const primitive = requireObject(primitiveValue, primitivePath);
      if (primitive.targets !== undefined) {
        throw new TypeError(`${primitivePath}.targets is unsupported in static GLB assets.`);
      }
      const mode = primitive.mode === undefined ? 4 :
        requireNonnegativeInteger(primitive.mode, `${primitivePath}.mode`);
      if (mode !== 4) {
        throw new TypeError(`${primitivePath}.mode must be TRIANGLES (4).`);
      }
      const attributes = requireObject(
        primitive.attributes,
        `${primitivePath}.attributes`,
      );
      if (attributes.POSITION === undefined) {
        throw new TypeError(`${primitivePath}.attributes.POSITION is required.`);
      }
      for (const attribute of Object.keys(attributes)) {
        if (!ATTRIBUTE_USAGES.has(attribute)) {
          throw new TypeError(
            `${primitivePath}.attributes.${attribute} is unsupported in static GLB assets.`,
          );
        }
      }
      const key = `${meshIndex}:${primitiveIndex}`;
      if (!unique.has(key)) {
        unique.set(key, { meshIndex, primitiveIndex, primitive });
      }
    });
  }
  return [...unique.values()];
}

async function compileReferencedMaterials(
  document: CRCGLTFDocument,
  binaryChunk: Uint8Array | undefined,
  primitives: readonly SelectedPrimitive[],
  platform: CRCGLTFDecodePlatform,
  producers: InternalWebGLTextureProducer[],
  budget: GLTFDecodeBudget,
): Promise<ReadonlyMap<number, CRCWebGLPBRMetallicRoughnessMaterial>> {
  const materialIndices = new Set<number>();
  for (const selected of primitives) {
    if (selected.primitive.material !== undefined) {
      materialIndices.add(requireIndex(
        selected.primitive.material,
        `$.meshes[${selected.meshIndex}].primitives[${selected.primitiveIndex}].material`,
      ));
    }
  }
  const materials = document.materials === undefined ? [] :
    requireArray(document.materials, '$.materials');
  const materialInputs = new Map<number, {
    readonly pbr: CRCGLTFObject;
    readonly textureIndex: number | undefined;
  }>();
  const textureIndices = new Set<number>();
  for (const materialIndex of materialIndices) {
    if (materialIndex >= materials.length) {
      throw new RangeError(
        `GLB JSON material index ${materialIndex} references missing $.materials[${materialIndex}].`,
      );
    }
    const path = `$.materials[${materialIndex}]`;
    const material = requireObject(materials[materialIndex], path);
    rejectUnknownKeys(material, MATERIAL_KEYS, path);
    const pbr = material.pbrMetallicRoughness === undefined ? {} :
      requireObject(material.pbrMetallicRoughness, `${path}.pbrMetallicRoughness`);
    rejectUnknownKeys(pbr, PBR_KEYS, `${path}.pbrMetallicRoughness`);
    if (pbr.extensions !== undefined) {
      requireObject(pbr.extensions, `${path}.pbrMetallicRoughness.extensions`);
    }
    let textureIndex: number | undefined;
    if (pbr.baseColorTexture !== undefined) {
      const textureInfo = requireObject(
        pbr.baseColorTexture,
        `${path}.pbrMetallicRoughness.baseColorTexture`,
      );
      rejectUnknownKeys(
        textureInfo,
        TEXTURE_INFO_KEYS,
        `${path}.pbrMetallicRoughness.baseColorTexture`,
      );
      const textureCoordinate = textureInfo.texCoord === undefined ? 0 :
        requireNonnegativeInteger(
          textureInfo.texCoord,
          `${path}.pbrMetallicRoughness.baseColorTexture.texCoord`,
        );
      if (textureCoordinate !== 0) {
        throw new TypeError(
          `${path}.pbrMetallicRoughness.baseColorTexture.texCoord must be 0.`,
        );
      }
      textureIndex = requireIndex(
        textureInfo.index,
        `${path}.pbrMetallicRoughness.baseColorTexture.index`,
      );
      textureIndices.add(textureIndex);
    }
    materialInputs.set(materialIndex, { pbr, textureIndex });
  }
  const textures = await decodeTextures(
    document,
    binaryChunk,
    textureIndices,
    platform,
    producers,
    budget,
  );
  const result = new Map<number, CRCWebGLPBRMetallicRoughnessMaterial>();
  for (const [materialIndex, input] of materialInputs) {
    const path = `$.materials[${materialIndex}].pbrMetallicRoughness`;
    const baseColorFactor = input.pbr.baseColorFactor === undefined ?
      [1, 1, 1, 1] : unitTuple(input.pbr.baseColorFactor, 4, `${path}.baseColorFactor`);
    const metallicFactor = input.pbr.metallicFactor === undefined ? 1 :
      unitFactor(input.pbr.metallicFactor, `${path}.metallicFactor`);
    const roughnessFactor = input.pbr.roughnessFactor === undefined ? 1 :
      unitFactor(input.pbr.roughnessFactor, `${path}.roughnessFactor`);
    result.set(materialIndex, resolveWebGLPBRMetallicRoughnessMaterial(
      `GLB JSON $.materials[${materialIndex}]`,
      {
        type: 'pbr-metallic-roughness',
        baseColorFactor,
        ...(input.textureIndex === undefined ? {} : {
          baseColorTexture: {
            texture: textures.get(input.textureIndex)!,
            textureCoordinate: 0,
          },
        }),
        metallicFactor,
        roughnessFactor,
      },
    ));
  }
  return result;
}

async function decodeTextures(
  document: CRCGLTFDocument,
  binaryChunk: Uint8Array | undefined,
  textureIndices: ReadonlySet<number>,
  platform: CRCGLTFDecodePlatform,
  producers: InternalWebGLTextureProducer[],
  budget: GLTFDecodeBudget,
): Promise<ReadonlyMap<number, CRCWebGLTexture>> {
  const textures = document.textures === undefined ? [] :
    requireArray(document.textures, '$.textures');
  const samplers = document.samplers === undefined ? [] :
    requireArray(document.samplers, '$.samplers');
  const imageTextures = new Map<number, DecodedImageTextures>();
  const result = new Map<number, CRCWebGLTexture>();
  for (const textureIndex of textureIndices) {
    const texturePath = `$.textures[${textureIndex}]`;
    if (textureIndex >= textures.length) {
      throw new RangeError(`GLB JSON ${texturePath} is missing.`);
    }
    const texture = requireObject(textures[textureIndex], texturePath);
    const imageIndex = requireIndex(texture.source, `${texturePath}.source`);
    const sampler = texture.sampler === undefined ? defaultSampler() :
      decodeSampler(samplers, requireIndex(texture.sampler, `${texturePath}.sampler`));
    let decoded = imageTextures.get(imageIndex);
    const key = samplerKey(sampler);
    const existingTexture = decoded?.textures.get(key);
    if (existingTexture !== undefined) {
      result.set(textureIndex, existingTexture);
      continue;
    }
    if (decoded === undefined) {
      const imagePath = `$.images[${imageIndex}]`;
      const { bytes, mimeType } = imageBytes(document, binaryChunk, imageIndex);
      assertEncodedImageByteLength(bytes.byteLength, imagePath);
      const encodedDimensions = readEncodedImageDimensions(bytes, mimeType, imagePath);
      assertImageDimensions(
        encodedDimensions.width,
        encodedDimensions.height,
        imagePath,
        'encoded',
      );
      budget.reserveDecodedImagePixels(
        encodedDimensions.width,
        encodedDimensions.height,
        imagePath,
      );
      let bitmap: ImageBitmap;
      try {
        bitmap = await platform.decodeImage(bytes, mimeType);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(
          `GLB JSON $.images[${imageIndex}] image decode failed: ${detail}`,
          { cause: error },
        );
      }
      try {
        assertImageDimensions(bitmap.width, bitmap.height, imagePath, 'decoded');
        if (bitmap.width !== encodedDimensions.width ||
          bitmap.height !== encodedDimensions.height) {
          throw new RangeError(
            `${imagePath} decoded dimensions ${bitmap.width}x${bitmap.height} ` +
            `do not match encoded ${encodedDimensions.width}x${encodedDimensions.height}.`,
          );
        }
      } catch (error) {
        try {
          bitmap.close();
        } catch {
          // Preserve the dimension validation failure.
        }
        throw error;
      }
      decoded = {
        bitmap,
        textures: new Map(),
        owners: 0,
        closed: false,
      };
      imageTextures.set(imageIndex, decoded);
    }
    decoded.owners += 1;
    let producer: InternalWebGLTextureProducer;
    try {
      producer = createInternalWebGLTexture(decoded.bitmap, sampler, () => {
        decoded!.owners -= 1;
        if (decoded!.owners === 0 && !decoded!.closed) {
          decoded!.closed = true;
          decoded!.bitmap.close();
        }
      });
    } catch (error) {
      decoded.owners -= 1;
      if (decoded.owners === 0 && !decoded.closed) {
        decoded.closed = true;
        decoded.bitmap.close();
      }
      throw error;
    }
    producers.push(producer);
    decoded.textures.set(key, producer.texture);
    result.set(textureIndex, producer.texture);
  }
  return result;
}

function imageBytes(
  document: CRCGLTFDocument,
  binaryChunk: Uint8Array | undefined,
  imageIndex: number,
): { readonly bytes: Uint8Array; readonly mimeType: 'image/png' | 'image/jpeg' } {
  const images = requireArray(document.images, '$.images');
  const path = `$.images[${imageIndex}]`;
  if (imageIndex >= images.length) {
    throw new RangeError(`GLB JSON ${path} is missing.`);
  }
  const image = requireObject(images[imageIndex], path);
  if (image.uri !== undefined) {
    throw new TypeError(`GLB JSON ${path}.uri external images are unsupported.`);
  }
  if (image.mimeType !== 'image/png' && image.mimeType !== 'image/jpeg') {
    throw new TypeError(
      `GLB JSON ${path}.mimeType must be image/png or image/jpeg.`,
    );
  }
  const bufferViewIndex = requireIndex(image.bufferView, `${path}.bufferView`);
  return {
    bytes: sliceBufferView(document, binaryChunk, bufferViewIndex, path),
    mimeType: image.mimeType,
  };
}

function sliceBufferView(
  document: CRCGLTFDocument,
  binaryChunk: Uint8Array | undefined,
  bufferViewIndex: number,
  ownerPath: string,
): Uint8Array {
  const views = requireArray(document.bufferViews, '$.bufferViews');
  const viewPath = `$.bufferViews[${bufferViewIndex}]`;
  if (bufferViewIndex >= views.length) {
    throw new RangeError(`${ownerPath}.bufferView references missing ${viewPath}.`);
  }
  const view = requireObject(views[bufferViewIndex], viewPath);
  const bufferIndex = requireIndex(view.buffer, `${viewPath}.buffer`);
  if (bufferIndex !== 0) {
    throw new TypeError(`${viewPath}.buffer must reference the only buffer 0.`);
  }
  if (view.byteStride !== undefined) {
    throw new TypeError(`${viewPath}.byteStride is invalid for image data.`);
  }
  if (view.target !== undefined) {
    throw new TypeError(`${viewPath}.target is invalid for image data.`);
  }
  const buffers = requireArray(document.buffers, '$.buffers');
  const buffer = requireObject(buffers[0], '$.buffers[0]');
  if (buffer.uri !== undefined) {
    throw new TypeError('GLB JSON $.buffers[0].uri external buffers are unsupported.');
  }
  const bufferLength = requireNonnegativeInteger(
    buffer.byteLength,
    '$.buffers[0].byteLength',
  );
  if (binaryChunk === undefined) {
    throw new TypeError(`GLB JSON ${ownerPath} requires a GLB BIN chunk.`);
  }
  validateBinaryChunkPadding(binaryChunk, bufferLength);
  const offset = optionalNonnegativeInteger(
    view.byteOffset,
    `${viewPath}.byteOffset`,
    0,
  );
  const length = requireNonnegativeInteger(view.byteLength, `${viewPath}.byteLength`);
  const end = checkedAdd(offset, length, viewPath);
  if (end > bufferLength) {
    throw new RangeError(
      `GLB JSON ${viewPath} byte range ${offset}..${end} exceeds buffer length ${bufferLength}.`,
    );
  }
  return binaryChunk.subarray(offset, end);
}

function readEncodedImageDimensions(
  bytes: Uint8Array,
  mimeType: 'image/png' | 'image/jpeg',
  path: string,
): { readonly width: number; readonly height: number } {
  return mimeType === 'image/png' ?
    readPNGDimensions(bytes, path) : readJPEGDimensions(bytes, path);
}

function readPNGDimensions(
  bytes: Uint8Array,
  path: string,
): { readonly width: number; readonly height: number } {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.byteLength < 24 ||
    signature.some((byte, index) => bytes[index] !== byte)) {
    throw new TypeError(`${path} encoded image/png header is truncated or invalid.`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8, false) !== 13 ||
    bytes[12] !== 0x49 || bytes[13] !== 0x48 ||
    bytes[14] !== 0x44 || bytes[15] !== 0x52) {
    throw new TypeError(`${path} encoded image/png must begin with a 13-byte IHDR chunk.`);
  }
  return {
    width: view.getUint32(16, false),
    height: view.getUint32(20, false),
  };
}

function readJPEGDimensions(
  bytes: Uint8Array,
  path: string,
): { readonly width: number; readonly height: number } {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new TypeError(`${path} encoded image/jpeg SOI header is truncated or invalid.`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset < bytes.byteLength) {
    if (bytes[offset] !== 0xff) {
      throw new TypeError(`${path} encoded image/jpeg marker at byte ${offset} is invalid.`);
    }
    while (offset < bytes.byteLength && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.byteLength) break;
    const marker = bytes[offset]!;
    offset += 1;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break;
    const lengthEnd = checkedAdd(offset, 2, `${path} JPEG marker 0x${marker.toString(16)}`);
    if (lengthEnd > bytes.byteLength) {
      throw new RangeError(`${path} encoded image/jpeg marker length is truncated.`);
    }
    const segmentLength = view.getUint16(offset, false);
    if (segmentLength < 2) {
      throw new RangeError(`${path} encoded image/jpeg marker length must be at least 2.`);
    }
    const segmentEnd = checkedAdd(
      offset,
      segmentLength,
      `${path} JPEG marker 0x${marker.toString(16)}`,
    );
    if (segmentEnd > bytes.byteLength) {
      throw new RangeError(`${path} encoded image/jpeg marker exceeds encoded bytes.`);
    }
    if (isJPEGStartOfFrame(marker)) {
      if (segmentLength < 7) {
        throw new RangeError(`${path} encoded image/jpeg SOF marker is truncated.`);
      }
      return {
        height: view.getUint16(offset + 3, false),
        width: view.getUint16(offset + 5, false),
      };
    }
    offset = segmentEnd;
  }
  throw new TypeError(`${path} encoded image/jpeg has no supported SOF dimensions.`);
}

function isJPEGStartOfFrame(marker: number): boolean {
  return (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf);
}

function decodeSampler(
  samplers: readonly unknown[],
  samplerIndex: number,
): CRCWebGLTextureSampler {
  const path = `$.samplers[${samplerIndex}]`;
  if (samplerIndex >= samplers.length) {
    throw new RangeError(`GLB JSON ${path} is missing.`);
  }
  const sampler = requireObject(samplers[samplerIndex], path);
  return Object.freeze({
    wrapS: sampler.wrapS === undefined ? 'repeat' :
      mapSampler(sampler.wrapS, `${path}.wrapS`, {
        33071: 'clamp-to-edge',
        33648: 'mirrored-repeat',
        10497: 'repeat',
      }),
    wrapT: sampler.wrapT === undefined ? 'repeat' :
      mapSampler(sampler.wrapT, `${path}.wrapT`, {
        33071: 'clamp-to-edge',
        33648: 'mirrored-repeat',
        10497: 'repeat',
      }),
    minFilter: sampler.minFilter === undefined ? 'linear-mipmap-linear' :
      mapSampler(sampler.minFilter, `${path}.minFilter`, {
        9728: 'nearest',
        9729: 'linear',
        9984: 'nearest-mipmap-nearest',
        9985: 'linear-mipmap-nearest',
        9986: 'nearest-mipmap-linear',
        9987: 'linear-mipmap-linear',
      }),
    magFilter: sampler.magFilter === undefined ? 'linear' :
      mapSampler(sampler.magFilter, `${path}.magFilter`, {
        9728: 'nearest',
        9729: 'linear',
      }),
  });
}

function defaultSampler(): CRCWebGLTextureSampler {
  return Object.freeze({
    wrapS: 'repeat',
    wrapT: 'repeat',
    minFilter: 'linear-mipmap-linear',
    magFilter: 'linear',
  });
}

function mapSampler<T extends string>(
  value: unknown,
  path: string,
  values: Readonly<Record<number, T>>,
): T {
  const numeric = requireNonnegativeInteger(value, path);
  const mapped = values[numeric];
  if (mapped === undefined) {
    throw new TypeError(`GLB JSON ${path} value ${numeric} is unsupported.`);
  }
  return mapped;
}

function samplerKey(sampler: CRCWebGLTextureSampler): string {
  return `${sampler.wrapS}:${sampler.wrapT}:${sampler.minFilter}:${sampler.magFilter}`;
}

function compilePrimitiveTemplates(
  document: CRCGLTFDocument,
  binaryChunk: Uint8Array | undefined,
  primitives: readonly SelectedPrimitive[],
  materials: ReadonlyMap<number, CRCWebGLPBRMetallicRoughnessMaterial>,
  accessorContext: CRCGLTFAccessorDecodeContext,
  budget: GLTFDecodeBudget,
): ReadonlyMap<string, CompiledPrimitive> {
  const result = new Map<string, CompiledPrimitive>();
  const geometryCache = new Map<string, CRCWebGLGeometry>();
  const defaultMaterial = resolveWebGLPBRMetallicRoughnessMaterial(
    'GLB default',
    {
      type: 'pbr-metallic-roughness',
      baseColorFactor: [1, 1, 1, 1],
      metallicFactor: 1,
      roughnessFactor: 1,
    },
  );
  for (const selected of primitives) {
    const path = `$.meshes[${selected.meshIndex}].primitives[${selected.primitiveIndex}]`;
    const attributes = requireObject(selected.primitive.attributes, `${path}.attributes`);
    const positionAccessor = requireIndex(
      attributes.POSITION,
      `${path}.attributes.POSITION`,
    );
    const normalAccessor = optionalAttributeIndex(attributes, 'NORMAL', path);
    const tangentAccessor = optionalAttributeIndex(attributes, 'TANGENT', path);
    const textureCoordinateAccessor = optionalAttributeIndex(
      attributes,
      'TEXCOORD_0',
      path,
    );
    const indicesAccessor = selected.primitive.indices === undefined ? undefined :
      requireIndex(selected.primitive.indices, `${path}.indices`);
    const material = selected.primitive.material === undefined ? defaultMaterial :
      materials.get(requireIndex(selected.primitive.material, `${path}.material`))!;
    if (material.baseColorTexture !== undefined && textureCoordinateAccessor === undefined) {
      throw new TypeError(
        `GLB JSON ${path}.attributes.TEXCOORD_0 is required by baseColorTexture.`,
      );
    }
    const geometryKey = [
      positionAccessor,
      normalAccessor ?? '-',
      tangentAccessor ?? '-',
      textureCoordinateAccessor ?? '-',
      indicesAccessor ?? '-',
    ].join(':');
    try {
      let geometry = geometryCache.get(geometryKey);
      if (geometry === undefined) {
        const positions = decodeGLTFAccessor(
          document,
          binaryChunk,
          positionAccessor,
          'POSITION',
          accessorContext,
        ) as Float32Array;
        const normals = decodeOptionalAttribute(
          document,
          binaryChunk,
          normalAccessor,
          'NORMAL',
          accessorContext,
        );
        const tangents = decodeOptionalAttribute(
          document,
          binaryChunk,
          tangentAccessor,
          'TANGENT',
          accessorContext,
        );
        const textureCoordinates0 = decodeOptionalAttribute(
          document,
          binaryChunk,
          textureCoordinateAccessor,
          'TEXCOORD_0',
          accessorContext,
        );
        const indices = indicesAccessor === undefined ? undefined :
          decodeGLTFAccessor(
            document,
            binaryChunk,
            indicesAccessor,
            'indices',
            accessorContext,
          ) as Uint32Array;
        let streams;
        if (normals === undefined) {
          streams = generateFlatNormalStreams({
            positions,
            tangents,
            textureCoordinates0,
            indices,
            path,
            budget,
          });
        } else {
          streams = { positions, normals, tangents, textureCoordinates0, indices };
          budget.reserveUniqueDecodedVertices(positions.length / 3, path);
          reserveGeometryCopyBytes(streams, path, budget);
        }
        geometry = createWebGLGeometry(streams);
        geometryCache.set(geometryKey, geometry);
      }
      result.set(`${selected.meshIndex}:${selected.primitiveIndex}`, {
        geometry,
        material,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new TypeError(`GLB JSON ${path}: ${detail}`, { cause: error });
    }
  }
  return result;
}

function generateFlatNormalStreams(input: Readonly<{
  positions: ArrayLike<number>;
  tangents: Float32Array | undefined;
  textureCoordinates0: Float32Array | undefined;
  indices: ArrayLike<number> | undefined;
  path: string;
  budget: GLTFDecodeBudget;
}>): {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly tangents?: Float32Array;
  readonly textureCoordinates0?: Float32Array;
} {
  const sourcePositions = input.positions as Float32Array;
  const sourceVertexCount = sourcePositions.length / 3;
  if (!Number.isInteger(sourceVertexCount)) {
    throw new TypeError(`${input.path}.attributes.POSITION must contain VEC3 data.`);
  }
  if (input.tangents !== undefined &&
    input.tangents.length !== sourceVertexCount * 4) {
    throw new TypeError(
      `${input.path}.attributes.TANGENT count must match POSITION count.`,
    );
  }
  if (input.textureCoordinates0 !== undefined &&
    input.textureCoordinates0.length !== sourceVertexCount * 2) {
    throw new TypeError(
      `${input.path}.attributes.TEXCOORD_0 count must match POSITION count.`,
    );
  }
  const vertexIndices = input.indices as Uint32Array | undefined;
  const outputVertexCount = vertexIndices?.length ?? sourceVertexCount;
  if (outputVertexCount % 3 !== 0) {
    throw new TypeError(`${input.path} TRIANGLES vertex count must be divisible by 3.`);
  }
  if (vertexIndices !== undefined) {
    for (let index = 0; index < vertexIndices.length; index += 1) {
      if (vertexIndices[index]! >= sourceVertexCount) {
        throw new RangeError(
          `${input.path}.indices[${index}] must be less than POSITION count ` +
          `${sourceVertexCount}.`,
        );
      }
    }
  }
  input.budget.reserveUniqueDecodedVertices(outputVertexCount, input.path);
  let generatedBytes = checkedMultiply(
    checkedMultiply(outputVertexCount, 3, `${input.path} flat normal values`),
    Float32Array.BYTES_PER_ELEMENT,
    `${input.path} flat normal bytes`,
  );
  if (vertexIndices !== undefined) {
    generatedBytes = checkedAdd(
      generatedBytes,
      checkedMultiply(
        checkedMultiply(outputVertexCount, 3, `${input.path} expanded POSITION values`),
        Float32Array.BYTES_PER_ELEMENT,
        `${input.path} expanded POSITION bytes`,
      ),
      `${input.path} generated numeric bytes`,
    );
    if (input.tangents !== undefined) {
      generatedBytes = checkedAdd(
        generatedBytes,
        checkedMultiply(
          checkedMultiply(outputVertexCount, 4, `${input.path} expanded TANGENT values`),
          Float32Array.BYTES_PER_ELEMENT,
          `${input.path} expanded TANGENT bytes`,
        ),
        `${input.path} generated numeric bytes`,
      );
    }
    if (input.textureCoordinates0 !== undefined) {
      generatedBytes = checkedAdd(
        generatedBytes,
        checkedMultiply(
          checkedMultiply(outputVertexCount, 2, `${input.path} expanded TEXCOORD_0 values`),
          Float32Array.BYTES_PER_ELEMENT,
          `${input.path} expanded TEXCOORD_0 bytes`,
        ),
        `${input.path} generated numeric bytes`,
      );
    }
  }
  input.budget.reserveNumericAttributeBytes(generatedBytes, input.path);
  let geometryValues = checkedMultiply(
    outputVertexCount,
    6,
    `${input.path} flat geometry POSITION and NORMAL values`,
  );
  if (input.tangents !== undefined) {
    geometryValues = checkedAdd(
      geometryValues,
      checkedMultiply(outputVertexCount, 4, `${input.path} flat geometry TANGENT values`),
      `${input.path} flat geometry attribute values`,
    );
  }
  if (input.textureCoordinates0 !== undefined) {
    geometryValues = checkedAdd(
      geometryValues,
      checkedMultiply(
        outputVertexCount,
        2,
        `${input.path} flat geometry TEXCOORD_0 values`,
      ),
      `${input.path} flat geometry attribute values`,
    );
  }
  input.budget.reserveNumericAttributeBytes(
    checkedMultiply(
      geometryValues,
      Float32Array.BYTES_PER_ELEMENT,
      `${input.path} flat geometry copy bytes`,
    ),
    input.path,
  );
  const positions = vertexIndices === undefined ? sourcePositions :
    expandVertexStream(sourcePositions, 3, vertexIndices);
  const tangents = input.tangents === undefined ? undefined :
    vertexIndices === undefined ? input.tangents :
      expandVertexStream(input.tangents, 4, vertexIndices);
  const textureCoordinates0 = input.textureCoordinates0 === undefined ? undefined :
    vertexIndices === undefined ? input.textureCoordinates0 :
      expandVertexStream(input.textureCoordinates0, 2, vertexIndices);
  const normals = new Float32Array(outputVertexCount * 3);
  for (let offset = 0; offset < positions.length; offset += 9) {
    const edge1X = positions[offset + 3]! - positions[offset]!;
    const edge1Y = positions[offset + 4]! - positions[offset + 1]!;
    const edge1Z = positions[offset + 5]! - positions[offset + 2]!;
    const edge2X = positions[offset + 6]! - positions[offset]!;
    const edge2Y = positions[offset + 7]! - positions[offset + 1]!;
    const edge2Z = positions[offset + 8]! - positions[offset + 2]!;
    const crossX = edge1Y * edge2Z - edge1Z * edge2Y;
    const crossY = edge1Z * edge2X - edge1X * edge2Z;
    const crossZ = edge1X * edge2Y - edge1Y * edge2X;
    const maximum = Math.max(Math.abs(crossX), Math.abs(crossY), Math.abs(crossZ));
    if (!Number.isFinite(maximum) || maximum === 0) {
      throw new TypeError(
        `${input.path} triangle ${offset / 9} cannot produce a finite nonzero flat normal.`,
      );
    }
    const scaledX = crossX / maximum;
    const scaledY = crossY / maximum;
    const scaledZ = crossZ / maximum;
    const length = Math.hypot(scaledX, scaledY, scaledZ);
    const normalX = Math.fround(scaledX / length);
    const normalY = Math.fround(scaledY / length);
    const normalZ = Math.fround(scaledZ / length);
    for (let vertex = 0; vertex < 3; vertex += 1) {
      const normalOffset = offset + vertex * 3;
      normals[normalOffset] = normalX === 0 ? 0 : normalX;
      normals[normalOffset + 1] = normalY === 0 ? 0 : normalY;
      normals[normalOffset + 2] = normalZ === 0 ? 0 : normalZ;
    }
  }
  return {
    positions,
    normals,
    ...(tangents === undefined ? {} : { tangents }),
    ...(textureCoordinates0 === undefined ? {} : { textureCoordinates0 }),
  };
}

function expandVertexStream(
  source: Float32Array,
  arity: number,
  indices: Uint32Array,
): Float32Array {
  const expanded = new Float32Array(indices.length * arity);
  for (let outputIndex = 0; outputIndex < indices.length; outputIndex += 1) {
    const sourceOffset = indices[outputIndex]! * arity;
    const outputOffset = outputIndex * arity;
    for (let component = 0; component < arity; component += 1) {
      expanded[outputOffset + component] = source[sourceOffset + component]!;
    }
  }
  return expanded;
}

function reserveGeometryCopyBytes(
  streams: Readonly<{
    positions: ArrayLike<number>;
    normals: ArrayLike<number>;
    tangents?: ArrayLike<number>;
    textureCoordinates0?: ArrayLike<number>;
    indices?: ArrayLike<number>;
  }>,
  path: string,
  budget: GLTFDecodeBudget,
): void {
  let values = checkedAdd(
    streams.positions.length,
    streams.normals.length,
    `${path} geometry attribute values`,
  );
  for (const stream of [streams.tangents, streams.textureCoordinates0, streams.indices]) {
    if (stream !== undefined) {
      values = checkedAdd(values, stream.length, `${path} geometry attribute values`);
    }
  }
  budget.reserveNumericAttributeBytes(
    checkedMultiply(values, Float32Array.BYTES_PER_ELEMENT, `${path} geometry copy bytes`),
    path,
  );
}

function optionalAttributeIndex(
  attributes: CRCGLTFObject,
  usage: 'NORMAL' | 'TANGENT' | 'TEXCOORD_0',
  primitivePath: string,
): number | undefined {
  return attributes[usage] === undefined ? undefined :
    requireIndex(attributes[usage], `${primitivePath}.attributes.${usage}`);
}

function decodeOptionalAttribute(
  document: CRCGLTFDocument,
  binaryChunk: Uint8Array | undefined,
  accessorIndex: number | undefined,
  usage: 'NORMAL' | 'TANGENT' | 'TEXCOORD_0',
  context: CRCGLTFAccessorDecodeContext,
): Float32Array | undefined {
  if (accessorIndex === undefined) return undefined;
  return decodeGLTFAccessor(
    document,
    binaryChunk,
    accessorIndex,
    usage,
    context,
  ) as Float32Array;
}

function unitTuple(value: unknown, length: number, path: string): readonly number[] {
  const values = requireArray(value, path);
  if (values.length !== length) {
    throw new TypeError(`GLB JSON ${path} must contain ${length} values.`);
  }
  return values.map((entry, index) => unitFactor(entry, `${path}[${index}]`));
}

function unitFactor(value: unknown, path: string): number {
  const factor = requireFiniteNumber(value, path);
  if (factor < 0 || factor > 1) {
    throw new RangeError(`GLB JSON ${path} must be between 0 and 1.`);
  }
  return factor;
}

function rejectUnknownKeys(
  value: CRCGLTFObject,
  allowed: ReadonlySet<string>,
  path: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new TypeError(`GLB JSON ${path}.${key} is unsupported.`);
    }
  }
}

function releaseTextureProducers(
  producers: readonly InternalWebGLTextureProducer[],
): void {
  for (let index = producers.length - 1; index >= 0; index -= 1) {
    try {
      producers[index]!.release();
    } catch {
      // Continue releasing every owned candidate.
    }
  }
}
