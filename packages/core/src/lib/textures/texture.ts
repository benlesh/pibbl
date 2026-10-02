import { GLOBAL_STATE } from "../global-state.js";
import {
  requireHookContext,
  useHookSlot,
  withHooksForbidden,
} from "../hooks/hook-slot.js";
import { registerAdvanceParticipant } from "../scheduler/realm-scheduler.js";
import { signal } from "../signals/graph.js";
import type { CRCInstance, RenderingContext2D } from "../types.js";

declare const textureBrand: unique symbol;
declare const recipeBrand: unique symbol;
export interface TexturePlacement {
  readonly mode?: "repeat" | "stretch";
  readonly tileWidth?: number;
  readonly tileHeight?: number;
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly rotation?: number;
}
export interface TexturePaint {
  readonly [textureBrand]: true;
}
export interface Texture<Message = never> extends TexturePaint {
  send(message: Message): void;
  paint(placement: TexturePlacement): TexturePaint;
}
export interface TextureOptions {
  readonly resolution?: { readonly width: number; readonly height: number };
  readonly palette?: readonly string[];
}
export interface TextureContext {
  readonly canvas: OffscreenCanvas;
  readonly palette: readonly string[] | undefined;
  /** Marks the source pixels dirty and requests a CRC update. */
  invalidate(): void;
  /** Requests another CRC frame; implementations stop by not requesting again. */
  requestFrame(): void;
}
export interface TextureFrame {
  readonly delta: number;
  readonly time: number;
}
export interface TextureDefinition<Config, State, Message = never> {
  readonly defaultPlacement?: TexturePlacement;
  create(context: TextureContext, config: Readonly<Config>): State;
  update?(
    state: State,
    config: Readonly<Config>,
    context: TextureContext,
  ): void;
  receive?(state: State, message: Message, context: TextureContext): void;
  advance?(state: State, frame: TextureFrame, context: TextureContext): void;
  rasterize(state: State, context: TextureContext): void;
  dispose?(state: State, context: TextureContext): void;
}
export interface TextureRecipe<Message = never> {
  readonly [recipeBrand]: (message: Message) => Message;
}
type Definition = TextureDefinition<any, any, any>;
interface Recipe {
  definition: Definition;
  config: any;
}
const recipes = new WeakMap<object, Recipe>();
const paints = new WeakMap<
  object,
  { resource: Resource; placement: Readonly<TexturePlacement> }
>();

/** Defines a pure recipe factory; resource allocation starts at useTexture. */
export function defineTexture<Config, State, Message = never>(
  definition: TextureDefinition<Config, State, Message>,
): (config: Config) => TextureRecipe<Message> {
  const stable = Object.freeze({ ...definition });
  return (config) => {
    const recipe = Object.freeze({}) as TextureRecipe<Message>;
    recipes.set(recipe, {
      definition: stable,
      config: structuredClone(config),
    });
    return recipe;
  };
}
function placement(value: TexturePlacement = {}): Readonly<TexturePlacement> {
  if (
    value.mode !== undefined &&
    value.mode !== "repeat" &&
    value.mode !== "stretch"
  )
    throw new TypeError("Unknown texture placement mode.");
  for (const key of [
    "tileWidth",
    "tileHeight",
    "offsetX",
    "offsetY",
    "rotation",
  ] as const) {
    const n = value[key];
    if (
      n !== undefined &&
      (!Number.isFinite(n) ||
        ((key === "tileWidth" || key === "tileHeight") && n <= 0))
    )
      throw new RangeError(`Invalid texture placement ${key}.`);
  }
  return Object.freeze({ ...value });
}
function dimensions(options: TextureOptions): [number, number] {
  const width = options.resolution?.width ?? 256,
    height = options.resolution?.height ?? 160;
  if (
    ![width, height].every((n) => Number.isInteger(n) && n >= 8 && n <= 1024) ||
    width * height > 262144
  )
    throw new RangeError(
      "Texture resolution must be 8..1024 cells per axis, at most 262144 cells.",
    );
  return [width, height];
}
class Resource {
  readonly revision = signal(0);
  readonly canvas: OffscreenCanvas;
  readonly context: TextureContext;
  readonly handle: Texture<any>;
  state: any;
  definition: Definition;
  disposed = false;
  dirty = true;
  private sequence = 0;
  private messages: unknown[] = [];
  private unregister?: () => void;
  private continuing = false;
  private lastTime?: number;
  private initializing = true;
  private palette?: readonly string[];
  private optionsKey: string;
  constructor(
    readonly owner: CRCInstance,
    recipe: Recipe,
    options: TextureOptions,
  ) {
    const [width, height] = dimensions(options);
    this.optionsKey = JSON.stringify(options);
    this.palette = options.palette && Object.freeze([...options.palette]);
    this.canvas = new OffscreenCanvas(width, height);
    this.definition = recipe.definition;
    const self = this;
    this.context = Object.freeze({
      canvas: this.canvas,
      get palette() {
        return self.palette;
      },
      invalidate() {
        if (!self.disposed) {
          self.dirty = true;
          if (!self.initializing) self.schedule();
        }
      },
      requestFrame() {
        if (!self.disposed) {
          self.continuing = true;
          self.schedule();
        }
      },
    });
    this.handle = Object.freeze({
      send: (message: unknown) => {
        if (this.disposed) return;
        if (GLOBAL_STATE.currentCRCInstance)
          throw new Error("Texture.send cannot run during CRC evaluation.");
        if (!this.definition.receive)
          throw new Error("This texture does not accept messages.");
        if (this.messages.length >= 8192)
          throw new RangeError("Texture message queue is full.");
        this.messages.push(structuredClone(message));
        this.schedule();
      },
      paint: (value: TexturePlacement) => {
        const paint = Object.freeze({}) as TexturePaint;
        paints.set(paint, { resource: this, placement: placement(value) });
        return paint;
      },
    }) as Texture<any>;
    paints.set(this.handle, {
      resource: this,
      placement: placement(this.definition.defaultPlacement),
    });
    try {
      this.state = this.call(() =>
        this.definition.create(this.context, recipe.config),
      );
    } catch (error) {
      this.unregister?.();
      this.canvas.width = this.canvas.height = 0;
      throw error;
    }
    this.initializing = false;
  }
  private call<T>(fn: () => T): T {
    return withHooksForbidden(
      "Texture implementations cannot call CRC hooks.",
      fn,
    );
  }
  update(recipe: Recipe, options: TextureOptions) {
    if (this.disposed) return;
    if (recipe.definition !== this.definition)
      throw new Error(
        "Changing a texture definition requires a new keyed owner.",
      );
    const [width, height] = dimensions(options);
    const nextKey = JSON.stringify(options);
    if (nextKey !== this.optionsKey) {
      this.palette = options.palette && Object.freeze([...options.palette]);
      this.optionsKey = nextKey;
      if (width !== this.canvas.width || height !== this.canvas.height) {
        this.call(() => this.definition.dispose?.(this.state, this.context));
        this.canvas.width = width;
        this.canvas.height = height;
        this.messages.length = 0;
        this.lastTime = undefined;
        this.state = this.call(() =>
          this.definition.create(this.context, recipe.config),
        );
      }
      this.context.invalidate();
    }
    this.call(() =>
      this.definition.update?.(this.state, recipe.config, this.context),
    );
  }
  private unschedule() {
    this.unregister?.();
    this.unregister = undefined;
  }
  private schedule() {
    if (this.unregister || this.disposed) return;
    this.unregister = registerAdvanceParticipant((frame, batch) => {
      this.unschedule();
      const wasContinuing = this.continuing;
      this.continuing = false;
      try {
        const messages = this.messages;
        this.messages = [];
        for (const message of messages)
          this.call(() =>
            this.definition.receive?.(this.state, message, this.context),
          );
        if (wasContinuing)
          this.call(() =>
            this.definition.advance?.(
              this.state,
              {
                delta:
                  this.lastTime === undefined
                    ? 0
                    : Math.max(0, frame.logicalTime - this.lastTime),
                time: frame.logicalTime,
              },
              this.context,
            ),
          );
        this.lastTime = this.continuing ? frame.logicalTime : undefined;
        if (this.dirty) {
          this.rasterize();
          batch.stage(this.revision, ++this.sequence, this);
        }
        if (!this.continuing && this.messages.length === 0) {
          this.unschedule();
        }
      } catch (error) {
        this.unschedule();
        this.continuing = false;
        throw error;
      }
    });
  }
  rasterize() {
    if (!this.dirty) return;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Textures require OffscreenCanvas 2D.");
    ctx.save();
    try {
      ctx.resetTransform();
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.call(() => this.definition.rasterize(this.state, this.context));
      this.dirty = false;
    } finally {
      ctx.restore();
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unschedule();
    this.messages.length = 0;
    try {
      this.call(() => this.definition.dispose?.(this.state, this.context));
    } finally {
      this.canvas.width = this.canvas.height = 0;
      this.state = undefined;
    }
  }
}

/** Owns one persistent texture resource for the current mounted hook slot. */
export function useTexture<Message>(
  input: TextureRecipe<Message>,
  options: TextureOptions = {},
): Texture<Message> {
  const recipe = recipes.get(input);
  if (!recipe)
    throw new TypeError("useTexture requires a defineTexture recipe.");
  const { crcInstance } = requireHookContext();
  let created = false;
  const resource = useHookSlot("texture", (teardowns) => {
    created = true;
    const value = new Resource(crcInstance, recipe, options);
    teardowns.add(() => value.dispose());
    return value;
  }).value;
  if (!created)
    GLOBAL_STATE.renderTransaction!.onFinish((success) => {
      if (success) resource.update(recipe, options);
    });
  return resource.handle;
}

/** Internal paint resolution shared by Canvas built-ins. */
export function resolveTexturePaint(
  value: string | CanvasGradient | CanvasPattern | TexturePaint,
  ctx: RenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
): string | CanvasGradient | CanvasPattern {
  const entry =
    typeof value === "object" && value !== null ? paints.get(value) : undefined;
  if (!entry) return value as string | CanvasGradient | CanvasPattern;
  const { resource, placement: p } = entry;
  if (resource.disposed)
    throw new Error("Cannot paint with a disposed texture.");
  let root = GLOBAL_STATE.currentCRCInstance;
  while (root?.parent) root = GLOBAL_STATE.crcInstances.get(root.parent);
  let owner = resource.owner;
  while (owner.parent) owner = GLOBAL_STATE.crcInstances.get(owner.parent)!;
  if (root !== owner)
    throw new Error(
      "Textures may only be shared within their owning CRC tree.",
    );
  resource.revision.get();
  resource.rasterize();
  const pattern = ctx.createPattern(resource.canvas, "repeat");
  if (!pattern) throw new Error("Could not create texture paint.");
  const stretch = p.mode === "stretch";
  const width = stretch ? bounds.width : (p.tileWidth ?? resource.canvas.width);
  const height = stretch
    ? bounds.height
    : (p.tileHeight ?? resource.canvas.height);
  pattern.setTransform(
    new DOMMatrix()
      .translate(bounds.x + (p.offsetX ?? 0), bounds.y + (p.offsetY ?? 0))
      .rotate(p.rotation ?? 0)
      .scale(
        Math.max(0.000001, width) / resource.canvas.width,
        Math.max(0.000001, height) / resource.canvas.height,
      ),
  );
  return pattern;
}
