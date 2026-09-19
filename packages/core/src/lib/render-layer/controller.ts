import { GLOBAL_STATE, getCurrentCRCInstance } from "../global-state.js";
import {
  queueFrameCompletion,
  requestInstanceRender,
} from '../scheduler/realm-scheduler.js';
import type { CRCComponentRefs, RenderingContext2D } from "../types.js";
import type {
  CRCRenderLayerContext,
  CRCRenderLayerDefinition,
  CRCRenderLayerFrame,
  CRCRenderLayerSize,
} from "./types.js";

class SynchronousLifecycleError extends TypeError {}

export function assertSynchronous(value: unknown, callback: string): void {
  if (value && typeof (value as { then?: unknown }).then === "function") {
    throw new SynchronousLifecycleError(
      `defineRenderLayer ${callback}() must be synchronous.`,
    );
  }
}

export class RenderLayerController<Props, Resources, Target extends object> {
  private readonly instance = getCurrentCRCInstance();
  private readonly refs: CRCComponentRefs<any>;
  private readonly canvas: OffscreenCanvas;
  private readonly context: CRCRenderLayerContext;
  private resources: Resources | undefined;
  private created = false;
  private disposed = false;
  private size: CRCRenderLayerSize | undefined;
  private props: Readonly<Props> | undefined;
  private needsRender = true;
  /** Reserved for the coordinate bridge introduced in the next slice. */
  private inputGated = true;
  private candidate: ImageBitmap | undefined;
  private committed: ImageBitmap | undefined;
  private lastTime: number | undefined;

  constructor(
    private readonly definition: CRCRenderLayerDefinition<
      Props,
      Resources,
      Target
    >,
    refs: CRCComponentRefs<any>,
  ) {
    this.refs = refs;
    assertCapability();
    this.canvas = new OffscreenCanvas(1, 1);
    const controller = this;
    this.context = Object.freeze({
      canvas: this.canvas,
      get size() {
        if (!controller.size) {
          throw new Error("Render layer size is unavailable before mount.");
        }
        return controller.size;
      },
      invalidate() {
        controller.invalidate(true);
      },
    });
    refs.teardowns.add(() => this.dispose());
  }

  render(
    props: Readonly<Props>,
    size: CRCRenderLayerSize,
    ctx: RenderingContext2D,
  ): void {
    if (this.disposed) return;
    const initial = !this.created;
    const propsChanged = !initial && !sameProps(this.props, props);
    const sizeChanged = !sameSize(this.size, size);
    this.size = size;
    if (sizeChanged) {
      this.canvas.width = size.backingWidth;
      this.canvas.height = size.backingHeight;
    }
    if (initial) {
      const resources = this.definition.create(this.context, props);
      assertSynchronous(resources, "create");
      this.resources = resources;
      this.created = true;
    } else if (propsChanged && this.definition.update) {
      assertSynchronous(
        this.definition.update(this.resources!, props, this.context),
        "update",
      );
    }
    if (sizeChanged && this.definition.resize) {
      assertSynchronous(
        this.definition.resize(this.resources!, size, this.context),
        "resize",
      );
    }
    this.props = snapshotProps(props);
    if (initial || propsChanged || sizeChanged || this.needsRender) {
      const frame = this.createFrame();
      this.needsRender = false;
      try {
        assertSynchronous(
          this.definition.render(this.resources!, frame, this.context),
          "render",
        );
      } catch (error) {
        if (isSynchronousViolation(error)) throw error;
        this.inputGated = true;
        this.drawCommitted(ctx, size);
        queueFrameCompletion(() => { throw error; });
        return;
      }
      const candidate = this.canvas.transferToImageBitmap();
      this.candidate?.close();
      this.candidate = candidate;
      const transaction = GLOBAL_STATE.renderTransaction;
      transaction?.onFinish((success) =>
        this.finishCandidate(candidate, success),
      );
      ctx.drawImage(
        candidate,
        0,
        0,
        size.backingWidth,
        size.backingHeight,
        0,
        0,
        size.width,
        size.height,
      );
      return;
    }
    this.drawCommitted(ctx, size);
  }

  private drawCommitted(
    ctx: RenderingContext2D,
    size: CRCRenderLayerSize,
  ): void {
    if (this.committed) {
      ctx.drawImage(
        this.committed,
        0,
        0,
        size.backingWidth,
        size.backingHeight,
        0,
        0,
        size.width,
        size.height,
      );
    }
  }

  private createFrame(): CRCRenderLayerFrame {
    const snapshot = GLOBAL_STATE.frameSnapshot;
    const time = snapshot?.logicalTime ?? this.instance.renderTimestamp;
    const delta = this.lastTime === undefined ? 0 : time - this.lastTime;
    this.lastTime = time;
    return Object.freeze({
      frameId: snapshot?.frameId ?? 0,
      time,
      delta,
      deltaSeconds: delta / 1000,
      invalidate: () => this.invalidate(false),
    });
  }

  private invalidate(gateInput: boolean): void {
    if (
      this.disposed ||
      this.refs.teardowns.closed ||
      this.instance.mainTeardowns.closed
    )
      return;
    this.needsRender = true;
    if (gateInput) this.inputGated = true;
    requestInstanceRender(this.instance);
  }

  private finishCandidate(candidate: ImageBitmap, success: boolean): void {
    if (this.candidate !== candidate) return;
    this.candidate = undefined;
    if (!success || this.disposed) {
      candidate.close();
      return;
    }
    this.committed?.close();
    this.committed = candidate;
    this.inputGated = false;
  }

  private dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      if (this.created && this.definition.dispose) {
        assertSynchronous(
          this.definition.dispose(this.resources!, this.context),
          "dispose",
        );
      }
    } finally {
      this.candidate?.close();
      this.committed?.close();
      this.candidate = undefined;
      this.committed = undefined;
    }
  }
}

function assertCapability(): void {
  if (
    typeof OffscreenCanvas !== "function" ||
    typeof OffscreenCanvas.prototype.transferToImageBitmap !== "function"
  ) {
    throw new Error(
      "defineRenderLayer requires OffscreenCanvas with transferToImageBitmap().",
    );
  }
}

function sameSize(
  a: CRCRenderLayerSize | undefined,
  b: CRCRenderLayerSize,
): boolean {
  return (
    !!a &&
    a.width === b.width &&
    a.height === b.height &&
    a.backingWidth === b.backingWidth &&
    a.backingHeight === b.backingHeight
  );
}

function isSynchronousViolation(error: unknown): boolean {
  return error instanceof SynchronousLifecycleError;
}

function snapshotProps<Props>(props: Readonly<Props>): Readonly<Props> {
  return Object.freeze({ ...props });
}

function sameProps<Props>(
  a: Readonly<Props> | undefined,
  b: Readonly<Props>,
): boolean {
  if (!a) return false;
  const aKeys = Reflect.ownKeys(a);
  const bKeys = Reflect.ownKeys(b as object);
  return (
    aKeys.length === bKeys.length &&
    aKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        Object.is(a[key as keyof Props], b[key as keyof Props]),
    )
  );
}
