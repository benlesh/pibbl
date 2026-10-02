import { releaseField } from "./wasm/memory.js";
import { defineRenderLayer } from "@crc/core";
import {
  paletteLut,
  texturePalettes,
  validateResolution,
  validateSeed,
  type TexturePalette,
  type TextureResolution,
} from "./palette.js";
import { TextureRaster, type TextureRenderer } from "./presentation.js";
import { materialField, type TextureKind } from "./material-field.js";

export interface ProceduralTextureProps {
  readonly kind: TextureKind;
  readonly seed?: number;
  readonly resolution?: TextureResolution;
  /** Feature frequency across the texture, from 1 to 32. */
  readonly scale?: number;
  /** Distortion, grain strength, or cellular jitter, from 0 to 1. */
  readonly detail?: number;
  readonly palette?: TexturePalette;
  readonly render?: TextureRenderer;
}
function normalize(p: ProceduralTextureProps) {
  if (!["marble", "paper", "cellular"].includes(p.kind))
    throw new TypeError("Unknown procedural texture kind.");
  const scale = p.scale ?? 6,
    detail = p.detail ?? 0.65;
  if (
    !Number.isFinite(scale) ||
    scale < 1 ||
    scale > 32 ||
    !Number.isFinite(detail) ||
    detail < 0 ||
    detail > 1
  )
    throw new RangeError(
      "Texture scale must be in [1,32] and detail in [0,1].",
    );
  return {
    kind: p.kind,
    seed: validateSeed(p.seed),
    resolution: validateResolution(p.resolution),
    scale,
    detail,
    palette: [...(p.palette ?? texturePalettes.porcelain)],
    render: p.render,
  };
}
type Options = ReturnType<typeof normalize>;
interface Resources {
  options: Options;
  field: Float32Array;
  raster: TextureRaster;
  lut: Uint8ClampedArray;
  output: OffscreenCanvasRenderingContext2D;
  dirty: boolean;
}
function generate(o: Options, previous?: Float32Array) {
  return materialField(
    o.resolution.width,
    o.resolution.height,
    o.kind,
    o.seed,
    o.scale,
    o.detail,
    previous,
  );
}

/** A seeded static material. It requests no continuing animation frames. */
export const ProceduralTexture = /* @__PURE__ */ defineRenderLayer<
  ProceduralTextureProps,
  Resources
>({
  create(context, props) {
    const options = normalize(props),
      lut = paletteLut(options.palette);
    const output = context.canvas.getContext("2d");
    if (!output) throw new Error("ProceduralTexture requires Canvas 2D.");
    const raster = new TextureRaster(
      options.resolution.width,
      options.resolution.height,
    );
    try {
      return {
        options,
        lut,
        output,
        raster,
        field: generate(options),
        dirty: true,
      };
    } catch (error) {
      raster.dispose();
      throw error;
    }
  },
  update(r, props) {
    const next = normalize(props),
      old = r.options;
    if (next.palette.join() !== old.palette.join()) {
      r.lut = paletteLut(next.palette);
      r.dirty = true;
    }
    const resized =
      next.resolution.width !== old.resolution.width ||
      next.resolution.height !== old.resolution.height;
    if (
      resized ||
      next.kind !== old.kind ||
      next.seed !== old.seed ||
      next.scale !== old.scale ||
      next.detail !== old.detail
    ) {
      const field = generate(next, r.field);
      if (resized) {
        const raster = new TextureRaster(
          next.resolution.width,
          next.resolution.height,
        );
        r.raster.dispose();
        r.raster = raster;
      }
      if (field !== r.field) releaseField(r.field);
      r.field = field;
      r.dirty = true;
    }
    r.options = next;
  },
  render(r, _frame, context) {
    if (r.dirty) {
      r.raster.update(r.field, r.lut);
      r.dirty = false;
    }
    r.raster.draw(
      r.output,
      context.size.width,
      context.size.height,
      context.size.backingWidth,
      context.size.backingHeight,
      r.options.render,
    );
  },
  dispose(r) {
    r.raster.dispose();
    releaseField(r.field);
    r.field = new Float32Array(0);
    r.options.render = undefined;
  },
});
