import { GLOBAL_STATE, getCurrentCRCInstance } from "../global-state.js";
import { getCurrentWorldTransform } from "../render-target.js";
import {
  queueFrameCompletion,
  requestInstanceRender,
} from '../scheduler/realm-scheduler.js';
import type { CRCComponentRefs, RenderingContext2D } from "../types.js";
import {
  CRCHitDisposition,
  CRCPaintEntryKind,
  type CRCHitTestOutput,
  type CRCNestedPaintEntry,
} from "../events/paint-entry.js";
import {
  createTarget,
  releaseTarget,
  updateTarget,
  type CRCEventTargetRegistration,
} from "../events/registrations.js";
import {
  releaseResolverInputWinner,
  releaseResolverPointerCapture,
  setResolverPointerCapture,
  type CRCResolverInputType,
  type CRCResolverInputWinner,
} from "../events/resolver-input.js";
import type {
  CRCRenderLayerContext,
  CRCRenderLayerDefinition,
  CRCRenderLayerFrame,
  CRCRenderLayerHit,
  CRCRenderLayerInteractionSnapshot,
  CRCRenderLayerSize,
  CRCRenderLayerTarget,
} from "./types.js";

class SynchronousLifecycleError extends TypeError {}

interface StagedInteraction<Target extends object> {
  readonly snapshot: CRCRenderLayerInteractionSnapshot<Target>;
  readonly targets: readonly CRCRenderLayerTarget<Target>[];
  readonly transform: DOMMatrix;
  readonly clippingStack: CRCNestedPaintEntry["clippingStack"];
}

interface RenderCandidate<Target extends object> {
  readonly bitmap: ImageBitmap;
  readonly interaction: StagedInteraction<Target>;
}

interface WinnerState<Target extends object> {
  readonly point: Readonly<{ x: number; y: number }>;
  readonly hit: CRCRenderLayerHit<Target>;
}

const MISS_SNAPSHOT: CRCRenderLayerInteractionSnapshot<object> = Object.freeze({
  targets: Object.freeze([]),
  hitTest: () => Object.freeze({ kind: "miss" as const }),
});

const RESOLVER_INPUT_TYPES = Object.freeze([
  "pointerdown",
  "pointermove",
  "pointerup",
  "pointercancel",
  "wheel",
  "contextmenu",
  "click",
] as const);

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
  private needsResize = true;
  private inputGated = true;
  private candidate: RenderCandidate<Target> | undefined;
  private committed: ImageBitmap | undefined;
  private committedInteraction:
    | CRCRenderLayerInteractionSnapshot<Target>
    | undefined;
  private readonly committedTargets = new Map<
    Target,
    CRCEventTargetRegistration
  >();
  private readonly layerTarget: CRCEventTargetRegistration;
  private committedMissBehavior: "pass-through" | "block" | "target-layer" =
    "pass-through";
  private resolverTransform = new DOMMatrix();
  private resolverInverseTransform = new DOMMatrix();
  private resolverBounds = new Path2D();
  private resolverSize: CRCRenderLayerSize | undefined;
  private resolutionErrorQueued = false;
  private inputNativeReleases: readonly (() => void)[] = [];
  private readonly resolverEntry: CRCNestedPaintEntry;
  private readonly inputWinner: CRCResolverInputWinner;
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
    this.layerTarget = createTarget(this.instance, refs, -1);
    this.inputWinner = {
      eventRoot: this.instance.eventRoot,
      deliver: (type, point, originalEvent, state) =>
        this.deliverInput(type, point, originalEvent, state),
    };
    this.resolverEntry = {
      paintKind: CRCPaintEntryKind.Resolver,
      instance: this.instance,
      bounds: this.resolverBounds,
      transform: this.resolverTransform,
      clippingStack: [],
      resolveLocal: (x, y, output) => this.resolveLocal(x, y, output),
    };
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
    missBehavior: "pass-through" | "block" | "target-layer" = "pass-through",
  ): void {
    if (this.disposed) return;
    const initial = !this.created;
    const propsChanged = !initial && !sameProps(this.props, props);
    const sizeChanged = !sameSize(this.size, size);
    this.size = size;
    this.publishResolver(size);
    if (sizeChanged) {
      this.canvas.width = size.backingWidth;
      this.canvas.height = size.backingHeight;
      this.needsResize = true;
      this.needsRender = true;
    }
    if (initial) {
      const resources = this.definition.create(this.context, props);
      assertSynchronous(resources, "create");
      this.resources = resources;
      this.created = true;
    } else {
      try {
        if (propsChanged && this.definition.update) {
          assertSynchronous(
            this.definition.update(this.resources!, props, this.context),
            "update",
          );
        }
        if (this.needsResize && this.definition.resize) {
          assertSynchronous(
            this.definition.resize(this.resources!, size, this.context),
            "resize",
          );
          this.needsResize = false;
        }
      } catch (error) {
        if (isSynchronousViolation(error)) throw error;
        this.failCandidate(ctx, size, error);
        return;
      }
    }
    if (initial && this.needsResize && this.definition.resize) {
      try {
        assertSynchronous(
          this.definition.resize(this.resources!, size, this.context),
          "resize",
        );
        this.needsResize = false;
      } catch (error) {
        if (isSynchronousViolation(error)) throw error;
        this.failCandidate(ctx, size, error);
        return;
      }
    }
    if (!this.definition.resize) this.needsResize = false;
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
        this.failCandidate(ctx, size, error);
        return;
      }
      let interaction: StagedInteraction<Target>;
      try {
        interaction = this.settleInteraction(props);
      } catch (error) {
        if (isSynchronousViolation(error)) throw error;
        this.failCandidate(ctx, size, error);
        return;
      }
      this.stageInteraction(interaction, missBehavior);
      const candidate = this.canvas.transferToImageBitmap();
      this.candidate?.bitmap.close();
      const stagedCandidate = { bitmap: candidate, interaction };
      this.candidate = stagedCandidate;
      const transaction = GLOBAL_STATE.renderTransaction;
      transaction?.onFinish((success) =>
        this.finishCandidate(stagedCandidate, success, missBehavior),
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
    const transaction = GLOBAL_STATE.renderTransaction;
    transaction?.onFinish(success => {
      if (success && !this.disposed) {
        this.committedMissBehavior = missBehavior;
        this.refreshCommittedTargetGeometry();
      }
    });
    this.drawCommitted(ctx, size);
  }

  private publishResolver(size: CRCRenderLayerSize): void {
    if (!sameSize(this.resolverSize, size)) {
      const bounds = new Path2D();
      bounds.rect(0, 0, size.width, size.height);
      this.resolverBounds = bounds;
      this.resolverEntry.bounds = bounds;
      this.resolverSize = size;
    }
    this.resolverTransform = getCurrentWorldTransform();
    this.resolverInverseTransform = this.resolverTransform.inverse();
    this.resolverEntry.transform = this.resolverTransform;
    this.resolverEntry.clippingStack = Array.from(GLOBAL_STATE.clippingStack);
    this.instance.paintEntries.add(this.resolverEntry);
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

  private settleInteraction(props: Readonly<Props>): StagedInteraction<Target> {
    const snapshot = this.definition.interaction?.settle(
      this.resources!,
      props,
      this.size!,
    ) ?? MISS_SNAPSHOT as CRCRenderLayerInteractionSnapshot<Target>;
    assertSynchronous(snapshot, "interaction.settle");
    const targets: CRCRenderLayerTarget<Target>[] = [];
    const identities = new Set<Target>();
    for (const target of snapshot.targets) {
      if (identities.has(target.target)) {
        throw new Error(
          "Render layer interaction contains a duplicate target identity.",
        );
      }
      identities.add(target.target);
      targets.push(Object.freeze({
        ...target,
        handlers: target.handlers ? Object.freeze({ ...target.handlers }) : undefined,
        keyboardNavigationBounds: target.keyboardNavigationBounds ?
          Object.freeze({ ...target.keyboardNavigationBounds }) : undefined,
      }));
    }
    return {
      snapshot,
      targets: Object.freeze(targets),
      transform: this.resolverTransform,
      clippingStack: this.resolverEntry.clippingStack,
    };
  }

  private finishCandidate(
    candidate: RenderCandidate<Target>,
    success: boolean,
    missBehavior: "pass-through" | "block" | "target-layer",
  ): void {
    if (this.candidate !== candidate) return;
    this.candidate = undefined;
    if (!success || this.disposed) {
      candidate.bitmap.close();
      return;
    }
    this.committed?.close();
    this.committed = candidate.bitmap;
    this.committedInteraction = candidate.interaction.snapshot;
    this.committedMissBehavior = missBehavior;
    this.resolutionErrorQueued = false;
    this.inputGated = false;
  }

  private stageInteraction(
    interaction: StagedInteraction<Target>,
    missBehavior: "pass-through" | "block" | "target-layer",
  ): void {
    const retained = new Set<Target>();
    for (const descriptor of interaction.targets) {
      if (descriptor.pointerEvents === "none") continue;
      retained.add(descriptor.target);
      let registration = this.committedTargets.get(descriptor.target);
      if (!registration) {
        registration = createTarget(
          this.instance,
          this.refs,
          this.committedTargets.size + 1,
        );
        this.committedTargets.set(descriptor.target, registration);
      }
      updateTarget(registration, descriptor.handlers ?? {}, {
        path: new Path2D(),
        cursor: descriptor.cursor,
        keyboardFocusable: descriptor.keyboardFocusable,
        keyboardNavigationBounds: descriptor.keyboardNavigationBounds,
      }, true);
      this.applyResolverGeometry(registration, interaction);
    }
    for (const [identity, registration] of this.committedTargets) {
      if (retained.has(identity)) continue;
      releaseTarget(registration);
      this.committedTargets.delete(identity);
    }
    if (missBehavior === "target-layer") {
      updateTarget(this.layerTarget, {}, { path: new Path2D() }, true);
      this.applyResolverGeometry(this.layerTarget, interaction);
    } else {
      releaseTarget(this.layerTarget);
    }
    this.updateInputNativeOwnership(Boolean(interaction.snapshot.onInput));
  }

  private applyResolverGeometry(
    target: CRCEventTargetRegistration,
    interaction: StagedInteraction<Target>,
  ): void {
    if (!target.paintEntry) return;
    target.paintEntry.transform = interaction.transform;
    target.paintEntry.clippingStack = interaction.clippingStack;
    target.owner.paintEntries.delete(target.paintEntry);
  }

  private refreshCommittedTargetGeometry(): void {
    const interaction = {
      transform: this.resolverTransform,
      clippingStack: this.resolverEntry.clippingStack,
    } as StagedInteraction<Target>;
    for (const target of this.committedTargets.values()) {
      this.applyResolverGeometry(target, interaction);
    }
    if (this.layerTarget.live) this.applyResolverGeometry(this.layerTarget, interaction);
  }

  private resolveLocal(
    localX: number,
    localY: number,
    output: CRCHitTestOutput,
  ): void {
    const state = this.resolveWinnerState(localX, localY);
    output.winner = this.inputWinner;
    output.winnerState = state;
    switch (state.hit.kind) {
      case "miss":
        if (this.committedMissBehavior === "pass-through") {
          output.disposition = CRCHitDisposition.Miss;
          output.target = null;
          delete output.winner;
          delete output.winnerState;
        } else if (this.committedMissBehavior === "block") {
          output.disposition = CRCHitDisposition.Block;
          output.target = null;
        } else {
          output.disposition = CRCHitDisposition.Target;
          output.target = this.layerTarget.live ? this.layerTarget : null;
        }
        return;
      case "block":
        output.disposition = CRCHitDisposition.Block;
        output.target = null;
        return;
      case "target": {
        const target = this.committedTargets.get(state.hit.target);
        if (!target?.live) {
          output.disposition = CRCHitDisposition.Block;
          output.target = null;
          output.winnerState = {
            point: state.point,
            hit: Object.freeze({ kind: "block" as const }),
          } satisfies WinnerState<Target>;
          this.reportUnknownTarget();
          return;
        }
        output.disposition = CRCHitDisposition.Target;
        output.target = target;
      }
    }
  }

  private resolveWinnerState(localX: number, localY: number): WinnerState<Target> {
    const point = Object.freeze({ x: localX, y: localY });
    if (this.inputGated || !this.committedInteraction) {
      return { point, hit: Object.freeze({ kind: "block" }) };
    }
    const hit = this.committedInteraction.hitTest(point);
    if (hit.kind === "target" && !this.committedTargets.has(hit.target)) {
      this.reportUnknownTarget();
      return { point, hit: Object.freeze({ kind: "block" }) };
    }
    return { point, hit };
  }

  private reportUnknownTarget(): void {
    if (this.resolutionErrorQueued) return;
    this.resolutionErrorQueued = true;
    queueFrameCompletion(() => {
      throw new Error(
        "Render layer hitTest() returned a target absent from its committed snapshot.",
      );
    });
  }

  private deliverInput(
    type: CRCResolverInputType,
    rootPoint: Readonly<{ x: number; y: number }>,
    originalEvent: PointerEvent | WheelEvent | MouseEvent,
    resolvedState: unknown,
  ): void {
    const snapshot = this.committedInteraction;
    if (!snapshot?.onInput || this.disposed) return;
    let state = resolvedState as WinnerState<Target> | undefined;
    if (!state) {
      const local = this.resolverInverseTransform.transformPoint(
        new DOMPoint(rootPoint.x, rootPoint.y),
      );
      state = this.resolveWinnerState(local.x, local.y);
    }
    snapshot.onInput(Object.freeze({
      type,
      point: state.point,
      hit: state.hit,
      originalEvent,
      setPointerCapture: (pointerId: number) =>
        setResolverPointerCapture(this.inputWinner, pointerId),
      releasePointerCapture: (pointerId: number) =>
        releaseResolverPointerCapture(this.inputWinner, pointerId),
    }));
  }

  private updateInputNativeOwnership(enabled: boolean): void {
    for (const release of this.inputNativeReleases) release();
    this.inputNativeReleases = [];
    const hub = this.instance.eventRoot.nativeListeners;
    if (!enabled || !hub) return;
    this.inputNativeReleases = RESOLVER_INPUT_TYPES.map(type => hub.acquire(type));
  }

  private failCandidate(
    ctx: RenderingContext2D,
    size: CRCRenderLayerSize,
    error: unknown,
  ): void {
    this.inputGated = true;
    this.drawCommitted(ctx, size);
    queueFrameCompletion(() => { throw error; });
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
      this.candidate?.bitmap.close();
      this.committed?.close();
      for (const target of this.committedTargets.values()) releaseTarget(target);
      this.committedTargets.clear();
      releaseTarget(this.layerTarget);
      releaseResolverInputWinner(this.inputWinner);
      this.updateInputNativeOwnership(false);
      this.candidate = undefined;
      this.committed = undefined;
      this.committedInteraction = undefined;
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
