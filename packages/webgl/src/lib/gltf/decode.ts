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
  createInternalWebGLTexture,
  type InternalWebGLTextureProducer,
} from '../texture/texture.js';
import { decodeGLTFAccessor } from './accessor.js';
import { readGLB } from './glb.js';
import {
  type CRCGLTFDocument,
  type CRCGLTFObject,
  checkedAdd,
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
  readonly modelMatrix: Float64Array;
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
  validateTopLevelFeatures(json);
  const selectedNodes = selectNodes(json);
  const selectedPrimitives = collectSelectedPrimitives(json, selectedNodes);
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
    );
    const compiled = compilePrimitiveTemplates(
      json,
      binaryChunk,
      selectedPrimitives,
      materials,
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
        records.push({
          geometry: template.geometry,
          material: template.material,
          modelMatrix: selectedNode.modelMatrix,
          sourceOrder,
        });
        sourceOrder += 1;
        const worldBounds = transformBoundsMatrix4(
          selectedNode.modelMatrix,
          getWebGLGeometryData(template.geometry).bounds,
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
    required.forEach((extension, index) => {
      if (typeof extension !== 'string') {
        throw new TypeError(
          `GLB JSON $.extensionsRequired[${index}] must be a string.`,
        );
      }
      throw new TypeError(
        `GLB JSON $.extensionsRequired[${index}] unsupported required ` +
        `extension ${extension}.`,
      );
    });
  }
  for (const field of ['animations', 'skins', 'cameras'] as const) {
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
    const worldMatrix = multiplyMatrix4(
      new Float64Array(16),
      frame.parentMatrix,
      localMatrix,
    );
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

function nodeMatrix(node: CRCGLTFObject, path: string): Float64Array {
  const hasTRS = own(node, 'translation') || own(node, 'rotation') || own(node, 'scale');
  if (node.matrix !== undefined) {
    if (hasTRS) {
      throw new TypeError(`GLB JSON ${path}.matrix is mutually exclusive with TRS fields.`);
    }
    return Float64Array.from(requireFiniteTuple(node.matrix, 16, `${path}.matrix`));
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
  return new Float64Array([
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
  ]);
}

function collectSelectedPrimitives(
  document: CRCGLTFDocument,
  nodes: readonly SelectedNode[],
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
      const { bytes, mimeType } = imageBytes(document, binaryChunk, imageIndex);
      const bitmap = await platform.decodeImage(bytes, mimeType);
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
  return binaryChunk.slice(offset, end);
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
): ReadonlyMap<string, CompiledPrimitive> {
  const result = new Map<string, CompiledPrimitive>();
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
    const positions = decodeGLTFAccessor(
      document,
      binaryChunk,
      positionAccessor,
      'POSITION',
    );
    const normals = optionalAttribute(
      document,
      binaryChunk,
      attributes,
      'NORMAL',
      path,
    );
    const tangents = optionalAttribute(
      document,
      binaryChunk,
      attributes,
      'TANGENT',
      path,
    );
    const textureCoordinates0 = optionalAttribute(
      document,
      binaryChunk,
      attributes,
      'TEXCOORD_0',
      path,
    );
    const indices = selected.primitive.indices === undefined ? undefined :
      decodeGLTFAccessor(
        document,
        binaryChunk,
        requireIndex(selected.primitive.indices, `${path}.indices`),
        'indices',
      );
    const material = selected.primitive.material === undefined ? defaultMaterial :
      materials.get(requireIndex(selected.primitive.material, `${path}.material`))!;
    if (material.baseColorTexture !== undefined && textureCoordinates0 === undefined) {
      throw new TypeError(
        `GLB JSON ${path}.attributes.TEXCOORD_0 is required by baseColorTexture.`,
      );
    }
    try {
      const geometry = createWebGLGeometry({
        positions,
        ...(normals === undefined ? {} : { normals }),
        ...(tangents === undefined ? {} : { tangents }),
        ...(textureCoordinates0 === undefined ? {} : { textureCoordinates0 }),
        ...(indices === undefined ? {} : { indices }),
      });
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

function optionalAttribute(
  document: CRCGLTFDocument,
  binaryChunk: Uint8Array | undefined,
  attributes: CRCGLTFObject,
  usage: 'NORMAL' | 'TANGENT' | 'TEXCOORD_0',
  primitivePath: string,
): Float32Array | undefined {
  if (attributes[usage] === undefined) return undefined;
  return decodeGLTFAccessor(
    document,
    binaryChunk,
    requireIndex(attributes[usage], `${primitivePath}.attributes.${usage}`),
    usage,
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
