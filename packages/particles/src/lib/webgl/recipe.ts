import type {
  CRCWebGLInstancedRecipe,
  CRCWebGLLookupTableRecipe,
} from "@crc/webgl/internal";
import type {
  CompiledEffect3D,
  CompiledEmitter3D,
} from "../compiler.js";
import { buildParticleShader, type ParticleLookupTableIndices } from "./shader.js";
import { recordWebGLParticleRecipeAcquired } from "../system/ownership.js";

export interface CompiledParticleRecipe3D {
  readonly emitter: CompiledEmitter3D;
  readonly recipe: CRCWebGLInstancedRecipe;
}

export interface ParticleRecipeLease3D {
  readonly recipes: readonly CompiledParticleRecipe3D[];
  release(): void;
}

const BILLBOARD_VERTICES = new Float32Array([
  -0.5, -0.5,
  0.5, -0.5,
  0.5, 0.5,
  -0.5, -0.5,
  0.5, 0.5,
  -0.5, 0.5,
]);

const recipeCaches = new WeakMap<
  CompiledEmitter3D,
  Map<string, CRCWebGLInstancedRecipe>
>();

function fixedFingerprint(
  compiled: CompiledEffect3D,
  parameters: Readonly<Float64Array>,
): string {
  const values: number[] = [];
  for (let index = 0; index < parameters.length; index += 1) {
    if (
      compiled.parameterLayout.spawnMask[index] === 1 ||
      compiled.parameterLayout.simulationMask[index] === 1
    ) {
      values.push(index, parameters[index]!);
    }
  }
  return values.join(":");
}

function table(
  samples: readonly number[],
  channels: 1 | 2 | 4,
): CRCWebGLLookupTableRecipe {
  return Object.freeze({
    width: 257,
    height: 1,
    channels,
    data: new Float32Array(samples),
  });
}

function createRecipe(
  compiled: CompiledEffect3D,
  emitter: CompiledEmitter3D,
  parameters: Readonly<Float64Array>,
): CRCWebGLInstancedRecipe {
  const lookupTables: CRCWebGLLookupTableRecipe[] = [];
  const indices: {
    color?: number;
    size?: number;
    rotation?: number;
    opacity?: number;
  } = {};
  const add = (
    property: keyof ParticleLookupTableIndices,
    samples: readonly number[],
    channels: 1 | 2 | 4,
  ) => {
    indices[property] = lookupTables.length;
    lookupTables.push(table(samples, channels));
  };
  if (emitter.appearance.color) {
    add("color", emitter.appearance.color.samples, 4);
  }
  if (emitter.appearance.size) {
    add(
      "size",
      emitter.appearance.size.samples,
      emitter.appearance.size.dimension,
    );
  }
  if (emitter.appearance.rotation) {
    add("rotation", emitter.appearance.rotation.samples, 1);
  }
  if (emitter.appearance.opacity) {
    add("opacity", emitter.appearance.opacity.samples, 1);
  }
  const shader = buildParticleShader({
    emitter,
    parameterLayout: compiled.parameterLayout,
    fixedParameters: parameters,
    lookupTableIndices: indices,
  });
  const billboard = emitter.renderer.type === "billboard";
  return Object.freeze({
    key: Object.freeze({}),
    topology: billboard ? "triangles" : "points",
    vertexSource: shader.vertexSource,
    fragmentSource: shader.fragmentSource,
    verticesPerInstance: billboard ? 6 : 1,
    capacity: emitter.capacity,
    staticVertexData: billboard ? BILLBOARD_VERTICES : undefined,
    lookupTables: Object.freeze(lookupTables),
    sprite:
      billboard && emitter.renderer.source !== undefined
        ? Object.freeze({ source: emitter.renderer.source as TexImageSource })
        : undefined,
  });
}

/** Creates stable, recipe-keyed GPU programs for one compiled 3D definition. */
export function createParticleRecipes3D(
  compiled: CompiledEffect3D,
  parameters: Readonly<Float64Array>,
): readonly CompiledParticleRecipe3D[] {
  const fingerprint = fixedFingerprint(compiled, parameters);
  return Object.freeze(
    compiled.emitters.map((emitter) => {
      let cache = recipeCaches.get(emitter);
      if (!cache) {
        cache = new Map();
        recipeCaches.set(emitter, cache);
      }
      let recipe = cache.get(fingerprint);
      if (!recipe) {
        recipe = createRecipe(compiled, emitter, parameters);
        cache.set(fingerprint, recipe);
      }
      return Object.freeze({ emitter, recipe });
    }),
  );
}

/** Acquires stable recipe identities for one mounted WebGL particle executor. */
export function acquireParticleRecipes3D(
  compiled: CompiledEffect3D,
  parameters: Readonly<Float64Array>,
): ParticleRecipeLease3D {
  const recipes = createParticleRecipes3D(compiled, parameters);
  const releases = recipes.map(() => recordWebGLParticleRecipeAcquired());
  let released = false;
  return Object.freeze({
    recipes,
    release() {
      if (released) return;
      released = true;
      for (const release of releases) release();
    },
  });
}
