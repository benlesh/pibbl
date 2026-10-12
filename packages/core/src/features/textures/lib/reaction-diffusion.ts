import { defineRenderLayer, type PibblRenderLayerInput } from "@pibbl/core";
import { TextureRaster, type TextureRenderer } from "./presentation.js";
import { InkSimulation } from "./simulation.js";
import {
  paletteLut,
  texturePalettes,
  validateResolution,
  validateSeed,
  type TexturePalette,
  type TextureResolution,
} from "./palette.js";

/**
 * Radius and strength of a reaction-diffusion brush stroke.
 *
 * @see {@link ReactionDiffusionProps}
 */
export interface TextureBrush {
  /** Radius in the coordinate system of this geometry or effect. See {@link TextureBrush}. */
  readonly radius: number;
  /** Magnitude of the displacement or brush effect. See {@link TextureBrush}. */
  readonly strength: number;
}
/**
 * Authored inputs for ReactionDiffusion, including the declared data and presentation options.
 *
 * @see {@link TextureRenderer}
 * @see {@link TextureResolution}
 * @see {@link TexturePalette}
 * @see {@link TextureBrush}
 * @see {@link ReactionDiffusion}
 */
export interface ReactionDiffusionProps {
  /**
   * Renders the current data or resources using the supplied context. See {@link TextureRenderer}
   * .
   */
  readonly render?: TextureRenderer;
  /** Dimensions of the simulation or raster grid. See {@link TextureResolution}. */
  readonly resolution?: TextureResolution;
  /**
   * Seed used for deterministic sampling or simulation initialization. See
   * {@link ReactionDiffusionProps}.
   */
  readonly seed?: number;
  /**
   * Named pattern configuration used to initialize the simulation. See
   * {@link ReactionDiffusionProps}.
   */
  readonly preset?: "spots" | "stripes";
  /** Ordered colors used to present texture intensity. See {@link TexturePalette}. */
  readonly palette?: TexturePalette;
  /**
   * Whether simulation or playback advancement is suspended. See {@link ReactionDiffusionProps}.
   */
  readonly paused?: boolean;
  /**
   * Changing this revision requests a fresh simulation initialization. See
   * {@link ReactionDiffusionProps}.
   */
  readonly resetRevision?: number;
  /**
   * Brush configuration for interactive reaction-diffusion input, or false to disable it. See
   * {@link TextureBrush}.
   */
  readonly brush?: TextureBrush | false;
}
interface Options {
  resolution: TextureResolution;
  seed: number;
  preset: "spots" | "stripes";
  palette: TexturePalette;
  paused: boolean;
  resetRevision: number;
  brush: TextureBrush | false;
}
function options(props: ReactionDiffusionProps): Options {
  const preset = props.preset ?? "spots";
  if (preset !== "spots" && preset !== "stripes")
    throw new TypeError("Unknown reaction-diffusion preset.");
  const brush = props.brush ?? { radius: 6, strength: 0.8 };
  if (
    brush &&
    (!Number.isFinite(brush.radius) ||
      brush.radius <= 0 ||
      brush.radius > 128 ||
      !Number.isFinite(brush.strength) ||
      brush.strength < 0 ||
      brush.strength > 1)
  )
    throw new RangeError(
      "Brush radius must be in (0,128] and strength in [0,1].",
    );
  if (!Number.isSafeInteger(props.resetRevision ?? 0))
    throw new RangeError("resetRevision must be a safe integer.");
  return {
    resolution: validateResolution(props.resolution),
    seed: validateSeed(props.seed),
    preset,
    palette: [...(props.palette ?? texturePalettes.lagoon)],
    paused: props.paused ?? false,
    resetRevision: props.resetRevision ?? 0,
    brush: brush && { ...brush },
  };
}
interface Stroke {
  x: number;
  y: number;
  radius: number;
  strength: number;
}
interface Resources {
  render?: TextureRenderer;
  config: Options;
  simulation: InkSimulation;
  raster: TextureRaster;
  output: OffscreenCanvasRenderingContext2D;
  lut: Uint8ClampedArray;
  elapsed: number;
  fresh: boolean;
  dirty: boolean;
  disposed: boolean;
  target: object;
  strokes: Stroke[];
  pointer?: { id: number; x: number; y: number; release: () => void };
  invalidate: () => void;
}
function reset(r: Resources, config: Options) {
  const { width, height } = config.resolution;
  const simulation = new InkSimulation(
    width,
    height,
    config.seed,
    config.preset,
  );
  let raster: TextureRaster;
  try {
    raster = new TextureRaster(width, height);
  } catch (error) {
    simulation.dispose();
    throw error;
  }
  r.simulation.dispose();
  r.simulation = simulation;
  r.raster.dispose();
  r.raster = raster;
  r.strokes.length = 0;
  r.pointer?.release();
  r.pointer = undefined;
  r.elapsed = 0;
  r.fresh = true;
  r.dirty = true;
}
function input(
  r: Resources,
  event: Readonly<PibblRenderLayerInput<object>>,
  width: number,
  height: number,
) {
  if (r.disposed) return;
  const original = event.originalEvent as PointerEvent;
  if (event.type === "pointerup" || event.type === "pointercancel") {
    if (r.pointer?.id === original.pointerId) {
      r.pointer.release();
      r.pointer = undefined;
    }
    return;
  }
  const brush = r.config.brush;
  if (!brush || width <= 0 || height <= 0) return;
  const x = (event.point.x / width) * r.simulation.width;
  const y = (event.point.y / height) * r.simulation.height;
  if (event.type === "pointerdown") {
    if (r.pointer || original.button !== 0 || original.isPrimary === false)
      return;
    event.setPointerCapture(original.pointerId);
    r.pointer = {
      id: original.pointerId,
      x,
      y,
      release: () => event.releasePointerCapture(original.pointerId),
    };
  } else if (
    event.type !== "pointermove" ||
    r.pointer?.id !== original.pointerId
  )
    return;
  const previous = r.pointer!;
  const distance = Math.hypot(x - previous.x, y - previous.y);
  // Bound work for off-surface capture. Stamps outside the field are ignored, never clamped to its edge.
  const count = Math.min(
    4096,
    Math.max(1, Math.ceil(distance / Math.max(0.5, brush.radius * 0.3))),
  );
  for (let i = 1; i <= count; i++) {
    const px = previous.x + ((x - previous.x) * i) / count,
      py = previous.y + ((y - previous.y) * i) / count;
    if (
      px >= 0 &&
      py >= 0 &&
      px < r.simulation.width &&
      py < r.simulation.height &&
      r.strokes.length < 8192
    )
      r.strokes.push({ x: px, y: py, ...brush });
  }
  previous.x = x;
  previous.y = y;
  r.invalidate();
}

/**
 * An independently sized, persistent Gray–Scott surface, advanced by Pibbl's scheduler.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; Pibbl mounts this component through JSX or createElement.
 *
 * @see {@link ReactionDiffusionProps}
 */
export const ReactionDiffusion = /* @__PURE__ */ defineRenderLayer<
  ReactionDiffusionProps,
  Resources
>({
  create(context, props) {
    const config = options(props),
      lut = paletteLut(config.palette);
    const output = context.canvas.getContext("2d");
    if (!output) throw new Error("ReactionDiffusion requires Canvas 2D.");
    const { width, height } = config.resolution;
    const raster = new TextureRaster(width, height);
    try {
      return {
        config,
        lut,
        raster,
        output,
        render: props.render,
        simulation: new InkSimulation(
          width,
          height,
          config.seed,
          config.preset,
        ),
        elapsed: 0,
        fresh: true,
        dirty: true,
        disposed: false,
        target: {},
        strokes: [],
        invalidate: context.invalidate,
      };
    } catch (error) {
      raster.dispose();
      throw error;
    }
  },
  update(r, props) {
    const next = options(props),
      old = r.config;
    if (next.palette.join() !== old.palette.join()) {
      r.lut = paletteLut(next.palette);
      r.dirty = true;
    }
    if (
      next.seed !== old.seed ||
      next.preset !== old.preset ||
      next.resetRevision !== old.resetRevision ||
      next.resolution.width !== old.resolution.width ||
      next.resolution.height !== old.resolution.height
    )
      reset(r, next);
    if (next.paused !== old.paused) {
      r.elapsed = 0;
      r.fresh = true;
    }
    if (!next.brush) {
      r.pointer?.release();
      r.pointer = undefined;
    }
    r.config = next;
    r.render = props.render;
  },
  render(r, frame, context) {
    // The frame invalidator does not gate the committed input snapshot between brush samples.
    r.invalidate = frame.invalidate;
    for (const stroke of r.strokes)
      r.simulation.paint(stroke.x, stroke.y, stroke.radius, stroke.strength);
    if (r.strokes.length) r.dirty = true;
    r.strokes.length = 0;
    if (!r.config.paused && !r.fresh) {
      r.elapsed += Math.max(0, Math.min(50, frame.delta));
      const steps = Math.min(24, Math.floor(r.elapsed * 0.48 + 1e-9));
      r.elapsed -= steps / 0.48;
      if (steps) {
        r.simulation.advance(steps);
        r.dirty = true;
      }
    }
    r.fresh = false;
    if (r.dirty) {
      r.raster.update(r.simulation.b, r.lut, 650 / 255);
      r.dirty = false;
    }
    r.raster.draw(
      r.output,
      context.size.width,
      context.size.height,
      context.size.backingWidth,
      context.size.backingHeight,
      r.render,
    );
    if (!r.config.paused) frame.invalidate();
  },
  interaction: {
    settle(r, _props, size) {
      return {
        targets: [
          {
            target: r.target,
            cursor: r.config.brush ? "crosshair" : "default",
          },
        ],
        hitTest: () => ({ kind: "target", target: r.target }),
        onInput: (event) => input(r, event, size.width, size.height),
      };
    },
  },
  dispose(r) {
    if (r.disposed) return;
    r.disposed = true;
    r.pointer?.release();
    r.pointer = undefined;
    r.strokes.length = 0;
    r.invalidate = () => {};
    r.simulation.dispose();
    r.raster.dispose();
    r.render = undefined;
  },
});
