import type { ProceduralTextureProps } from './procedural-texture.js';
import { reuseFieldMemory, lazyKernel } from "./wasm/memory.js";
import { bytes as marbleBytes } from "./wasm/marble-bytes.js";
import { bytes as paperBytes } from "./wasm/paper-bytes.js";
import { bytes as cellularBytes } from "./wasm/cellular-bytes.js";
/**
 * The supported static material generators: marble, paper, and cellular.
 *
 * @see {@link ProceduralTextureProps}
 */
export type TextureKind = "marble" | "paper" | "cellular";
export type MaterialGenerator = (
  width: number,
  height: number,
  seed: number,
  scale: number,
  detail: number,
  previous?: Float32Array,
) => Float32Array;
function generator(bytes: string): MaterialGenerator {
  const module = lazyKernel(bytes);
  return (width, height, seed, scale, detail, previous) => {
    const owner = reuseFieldMemory(previous, module(), width, height);
    const field = owner.fields[0];
    owner.kernel.run(field.byteOffset, width, height, seed, scale, detail);
    return field;
  };
}
export const marbleField = /* @__PURE__ */ generator(marbleBytes);
export const paperField = /* @__PURE__ */ generator(paperBytes);
export const cellularField = /* @__PURE__ */ generator(cellularBytes);
const generators: Record<TextureKind, MaterialGenerator> = {
  marble: marbleField,
  paper: paperField,
  cellular: cellularField,
};
export function materialField(
  width: number,
  height: number,
  kind: TextureKind,
  seed: number,
  scale: number,
  detail: number,
  previous?: Float32Array,
): Float32Array {
  return generators[kind](width, height, seed, scale, detail, previous);
}
