import { GLOBAL_STATE } from "../global-state.js";
import {
  requireHookContext,
  useHookSlot,
  withHooksForbidden,
} from "../hooks/hook-slot.js";
import { registerAdvanceParticipant } from "../scheduler/realm-scheduler.js";
import { signal } from "../signals/graph.js";
import type { CRCInstance, RenderingContext2D } from "../types.js";
import {
  registerTexturePaint,
  type BorrowedTextureRaster,
  type TexturePaint,
  type TexturePlacement,
} from "./texture-protocol.js";

export type { TexturePaint, TexturePlacement } from "./texture-protocol.js";

declare const recipeBrand: unique symbol;
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
  private committed: OffscreenCanvas | undefined;
  private spare: OffscreenCanvas | undefined;
  private provisional: { canvas: OffscreenCanvas; transaction: NonNullable<typeof GLOBAL_STATE.renderTransaction> } | undefined;
  readonly context: TextureContext;
  readonly handle: Texture<any>;
  state: any;
  definition: Definition;
  disposed = false;
  private hasState = false;
  dirty = true;
  private sequence = 0;
  private publicationCanvasesCreated = 0;
  private messages: unknown[] = [];
  private unregister?: () => void;
  private continuing = false;
  private lastTime?: number;
  private initializing = true;
  private retryScheduled = false;
  private palette?: readonly string[];
  private optionsKey: string;
  constructor(
    private owner: CRCInstance | undefined,
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
    const registerPaint = (value: TexturePaint, placement: Readonly<TexturePlacement>) =>
      registerTexturePaint(value, {
        resolvePaint: (ctx, bounds) => this.resolvePaint(ctx, bounds, placement),
        validate: () => this.assertOwner(),
        borrow: callback => callback(this.borrow(placement)),
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
        registerPaint(paint, placement(value));
        return paint;
      },
    }) as Texture<any>;
    registerPaint(this.handle, placement(this.definition.defaultPlacement));
    try {
      this.state = this.call(() =>
        this.definition.create(this.context, recipe.config),
      );
      this.hasState = true;
      this.publishInitial();
      this.initializing = false;
    } catch (error) {
      try {
        this.dispose();
      } catch {
        // The initialization failure remains the actionable error.
      }
      throw error;
    }
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
        try {
          this.disposeState();
          this.canvas.width = width;
          this.canvas.height = height;
          this.messages.length = 0;
          this.lastTime = undefined;
          this.state = this.call(() =>
            this.definition.create(this.context, recipe.config),
          );
          this.hasState = true;
        } catch (error) {
          try { this.dispose(); } catch { /* Preserve the recreate failure. */ }
          throw error;
        }
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
    const participant = (frame: { logicalTime: number }, batch: any) => {
      const retryAtEntry = this.retryScheduled;
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
          const candidate = this.rasterizeCandidate();
          let previous: OffscreenCanvas | undefined;
          batch.stage(this.revision, ++this.sequence, participant);
          batch.registerLifecycle(participant, {
            apply: () => {
              if (this.disposed) {
                candidate.width = candidate.height = 0;
              } else {
                previous = this.committed;
                this.committed = candidate;
                this.spare = previous;
                this.retryScheduled = false;
              }
            },
            rollback: () => {
              if (!this.disposed) {
                this.committed = previous;
                this.spare = candidate;
              }
            },
            abort: () => {
              this.spare = candidate;
              if (!this.disposed) {
                this.dirty = true;
                this.schedule();
              }
            },
          });
        }
        if (!this.continuing && this.messages.length === 0) {
          this.unschedule();
        }
      } catch (error) {
        this.unschedule();
        this.continuing = false;
        if (this.retryScheduled && !retryAtEntry) this.schedule();
        throw error;
      }
    };
    this.unregister = registerAdvanceParticipant(participant);
  }
  private rasterizeCandidate(): OffscreenCanvas {
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
    const spare = this.spare;
    this.spare = undefined;
    const reusable = spare?.width === this.canvas.width && spare.height === this.canvas.height ?
      spare : undefined;
    if (spare && spare !== reusable) spare.width = spare.height = 0;
    let candidate: OffscreenCanvas | undefined;
    try {
      candidate = reusable ?? this.createPublicationCanvas();
      const candidateContext = candidate.getContext("2d");
      if (!candidateContext) throw new Error("Textures require OffscreenCanvas 2D.");
      // Publication canvases are reused; transparent source pixels must erase old paint.
      candidateContext.clearRect(0, 0, candidate.width, candidate.height);
      candidateContext.drawImage(this.canvas, 0, 0);
      return candidate;
    } catch (error) {
      if (candidate) candidate.width = candidate.height = 0;
      this.dirty = true;
      if (!this.retryScheduled) {
        this.retryScheduled = true;
        this.schedule();
      }
      throw error;
    }
  }
  private createPublicationCanvas(): OffscreenCanvas {
    this.publicationCanvasesCreated++;
    return new OffscreenCanvas(this.canvas.width, this.canvas.height);
  }
  /** @internal Structural ownership evidence for texture publication tests. */
  publicationSnapshot(): Readonly<{ publicationCanvasesCreated: number; hasOwner: boolean }> {
    return Object.freeze({ publicationCanvasesCreated: this.publicationCanvasesCreated, hasOwner: this.owner !== undefined });
  }
  private publishInitial(): void {
    const candidate = this.rasterizeCandidate();
    const transaction = GLOBAL_STATE.renderTransaction;
    if (!transaction) {
      this.committed = candidate;
      return;
    }
    this.provisional = { canvas: candidate, transaction };
    transaction.onFinish(success => {
      if (this.provisional?.transaction !== transaction) return;
      const provisional = this.provisional;
      this.provisional = undefined;
      if (success && !this.disposed) this.committed = provisional.canvas;
      else provisional.canvas.width = provisional.canvas.height = 0;
    });
  }
  private assertOwner(): void {
    if (this.disposed) throw new Error("Cannot paint with a disposed texture.");
    let root = GLOBAL_STATE.currentCRCInstance;
    while (root?.parent) root = GLOBAL_STATE.crcInstances.get(root.parent);
    let owner = this.owner;
    while (owner?.parent) owner = GLOBAL_STATE.crcInstances.get(owner.parent);
    if (root !== owner) throw new Error("Textures may only be shared within their owning CRC tree.");
  }
  private borrow(placement: Readonly<TexturePlacement>): BorrowedTextureRaster {
    this.assertOwner();
    const revision = this.revision.get();
    const provisional = this.provisional;
    const source =
      provisional !== undefined && provisional.transaction === GLOBAL_STATE.renderTransaction ?
        provisional.canvas : this.committed;
    if (!source) throw new Error("Texture pixels are not committed for this render transaction.");
    return Object.freeze({ source, width: source.width, height: source.height, revision, resource: this, placement });
  }
  private resolvePaint(ctx: RenderingContext2D, bounds: { x: number; y: number; width: number; height: number }, p: Readonly<TexturePlacement>): string | CanvasGradient | CanvasPattern {
    const borrowed = this.borrow(p);
    const pattern = ctx.createPattern(borrowed.source, "repeat");
    if (!pattern) throw new Error("Could not create texture paint.");
    const stretch = p.mode === "stretch";
    const width = stretch ? bounds.width : (p.tileWidth ?? borrowed.width);
    const height = stretch ? bounds.height : (p.tileHeight ?? borrowed.height);
    pattern.setTransform(new DOMMatrix().translate(bounds.x + (p.offsetX ?? 0), bounds.y + (p.offsetY ?? 0)).rotate(p.rotation ?? 0).scale(Math.max(0.000001, width) / borrowed.width, Math.max(0.000001, height) / borrowed.height));
    return pattern;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unschedule();
    this.messages.length = 0;
    try {
      this.disposeState();
    } finally {
      this.canvas.width = this.canvas.height = 0;
      this.committed && (this.committed.width = this.committed.height = 0);
      this.spare && (this.spare.width = this.spare.height = 0);
      this.provisional && (this.provisional.canvas.width = this.provisional.canvas.height = 0);
      this.state = undefined;
      this.hasState = false;
      this.committed = undefined;
      this.spare = undefined;
      this.provisional = undefined;
      this.owner = undefined;
    }
  }
  private disposeState() {
    if (!this.hasState) return;
    this.hasState = false;
    const state = this.state;
    this.state = undefined;
    this.call(() => this.definition.dispose?.(state, this.context));
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
