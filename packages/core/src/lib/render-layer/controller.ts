import { GLOBAL_STATE, getCurrentCRCInstance } from "../global-state.js";
import { getCurrentWorldTransform } from "../render-target.js";
import {
  queueFrameCompletion,
  requestInstanceRender,
} from "../scheduler/realm-scheduler.js";
import type { CRCComponentRefs, RenderingContext2D } from "../types.js";
import type { CRCPointerEvents } from "../events/types.js";
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
  hasResolverPointerCapture,
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
  readonly policy: RenderLayerPolicy;
}

interface RenderLayerPolicy {
  readonly missBehavior: "pass-through" | "block" | "target-layer";
  readonly pointerEvents: CRCPointerEvents | undefined;
  readonly keyboardFocusable: boolean | undefined;
  readonly keyboardNavigationBounds:
    | Readonly<{
        x: number;
        y: number;
        width: number;
        height: number;
      }>
    | undefined;
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

const RESOLVER_CAPTURE_INPUT_TYPES = Object.freeze([
  "pointermove",
  "pointerup",
  "pointercancel",
] as const);

// The private target deliberately owns no user callback. This eligibility
// marker lets the shared keyboard default dispatch its click through the
// component's one structural listener.
const STRUCTURAL_CLICK_ELIGIBILITY = () => {};

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
    CRCRenderLayerInteractionSnapshot<Target> | undefined;
  private committedTargetDescriptors: readonly CRCRenderLayerTarget<Target>[] =
    Object.freeze([]);
  private readonly committedTargets = new Map<
    Target,
    CRCEventTargetRegistration
  >();
  private readonly layerTarget: CRCEventTargetRegistration;
  private committedPolicy: RenderLayerPolicy = Object.freeze({
    missBehavior: "pass-through",
    pointerEvents: undefined,
    keyboardFocusable: undefined,
    keyboardNavigationBounds: undefined,
  });
  private resolverTransform = new DOMMatrix();
  private resolverInverseTransform = new DOMMatrix();
  private resolverBounds = new Path2D();
  private resolverSize: CRCRenderLayerSize | undefined;
  private resolutionErrorQueued = false;
  private readonly inputNativeReleases = new Map<
    CRCResolverInputType,
    () => void
  >();
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
      onPointerCaptureChange: () =>
        this.updateInputNativeOwnership(
          Boolean(this.committedInteraction?.onInput),
        ),
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
    policy: RenderLayerPolicy = this.committedPolicy,
  ): void {
    if (this.disposed) return;
    const initial = !this.created;
    const propsChanged = !initial && !sameProps(this.props, props);
    const sizeChanged = !sameSize(this.size, size);
    const policyChanged = !samePolicy(this.committedPolicy, policy);
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
      const stagedPolicy = snapshotPolicy(policy);
      const candidate = this.canvas.transferToImageBitmap();
      this.candidate?.bitmap.close();
      const stagedCandidate = {
        bitmap: candidate,
        interaction,
        policy: stagedPolicy,
      };
      this.candidate = stagedCandidate;
      const transaction = GLOBAL_STATE.renderTransaction;
      transaction?.onFinish((success) =>
        this.finishCandidate(stagedCandidate, success),
      );
      if (!transaction) this.finishCandidate(stagedCandidate, true);
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
    transaction?.onFinish((success) => {
      if (success && !this.disposed) {
        if (policyChanged && this.committedInteraction) {
          this.commitInteraction(
            {
              snapshot: this.committedInteraction,
              targets: this.committedTargetDescriptors,
              transform: this.resolverTransform,
              clippingStack: this.resolverEntry.clippingStack,
            },
            snapshotPolicy(policy),
          );
        }
        this.refreshCommittedTargetGeometry();
      }
    });
    if (!transaction && policyChanged && this.committedInteraction) {
      this.commitInteraction(
        {
          snapshot: this.committedInteraction,
          targets: this.committedTargetDescriptors,
          transform: this.resolverTransform,
          clippingStack: this.resolverEntry.clippingStack,
        },
        snapshotPolicy(policy),
      );
    }
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
    // Sets preserve insertion order, so refresh the retained entry at its
    // current Canvas paint position on every traversal.
    this.instance.paintEntries.delete(this.resolverEntry);
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
    const snapshot =
      this.definition.interaction?.settle(this.resources!, props, this.size!) ??
      (MISS_SNAPSHOT as CRCRenderLayerInteractionSnapshot<Target>);
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
      targets.push(
        Object.freeze({
          ...target,
          handlers: target.handlers
            ? Object.freeze({ ...target.handlers })
            : undefined,
          keyboardNavigationBounds: target.keyboardNavigationBounds
            ? Object.freeze({ ...target.keyboardNavigationBounds })
            : undefined,
        }),
      );
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
  ): void {
    if (this.candidate !== candidate) return;
    this.candidate = undefined;
    if (!success || this.disposed) {
      candidate.bitmap.close();
      return;
    }
    this.commitInteraction(candidate.interaction, candidate.policy);
    this.committed?.close();
    this.committed = candidate.bitmap;
    this.resolutionErrorQueued = false;
    this.inputGated = false;
  }

  /** Publishes one interaction snapshot only after its bitmap transaction wins. */
  private commitInteraction(
    interaction: StagedInteraction<Target>,
    policy: RenderLayerPolicy,
  ): void {
    const retained = new Set<Target>();
    for (const descriptor of policy.pointerEvents === "none"
      ? []
      : interaction.targets) {
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
      updateTarget(
        registration,
        descriptor.handlers ?? {},
        {
          path: new Path2D(),
          cursor: descriptor.cursor,
          keyboardFocusable: descriptor.keyboardFocusable,
          keyboardNavigationBounds: descriptor.keyboardNavigationBounds,
        },
        true,
      );
      this.applyResolverGeometry(registration, interaction);
      this.observeTransactionalFocusTarget(registration);
    }
    for (const [identity, registration] of this.committedTargets) {
      if (retained.has(identity)) continue;
      releaseTarget(registration);
      this.committedTargets.delete(identity);
    }
    if (
      policy.pointerEvents !== "none" &&
      policy.missBehavior === "target-layer"
    ) {
      updateTarget(
        this.layerTarget,
        { onClick: STRUCTURAL_CLICK_ELIGIBILITY },
        {
          path: new Path2D(),
          keyboardFocusable: policy.keyboardFocusable,
          keyboardNavigationBounds: policy.keyboardNavigationBounds,
        },
        true,
      );
      this.applyResolverGeometry(this.layerTarget, interaction);
      this.observeTransactionalFocusTarget(this.layerTarget);
    } else {
      releaseTarget(this.layerTarget);
    }
    this.committedInteraction = interaction.snapshot;
    this.committedTargetDescriptors = interaction.targets;
    this.committedPolicy = policy;
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
      this.instance.eventRoot.focusPolicy?.observeTarget(target);
      this.observeTransactionalFocusTarget(target);
    }
    if (this.layerTarget.live) {
      this.applyResolverGeometry(this.layerTarget, interaction);
      this.instance.eventRoot.focusPolicy?.observeTarget(this.layerTarget);
      this.observeTransactionalFocusTarget(this.layerTarget);
    }
  }

  private observeTransactionalFocusTarget(
    target: CRCEventTargetRegistration,
  ): void {
    this.instance.eventRoot.focusPolicy?.observeTransactionalTarget?.(target);
  }

  private resolveLocal(
    localX: number,
    localY: number,
    output: CRCHitTestOutput,
  ): void {
    if (this.committedPolicy.pointerEvents === "none") {
      output.disposition = CRCHitDisposition.Miss;
      output.target = null;
      return;
    }
    const state = this.resolveWinnerState(localX, localY);
    output.winner = this.inputWinner;
    output.winnerState = state;
    switch (state.hit.kind) {
      case "miss":
        if (this.committedPolicy.missBehavior === "pass-through") {
          output.disposition = CRCHitDisposition.Miss;
          output.target = null;
          delete output.winner;
          delete output.winnerState;
        } else if (this.committedPolicy.missBehavior === "block") {
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

  private resolveWinnerState(
    localX: number,
    localY: number,
  ): WinnerState<Target> {
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
    snapshot.onInput(
      Object.freeze({
        type,
        point: state.point,
        hit: state.hit,
        originalEvent,
        setPointerCapture: (pointerId: number) =>
          setResolverPointerCapture(this.inputWinner, pointerId),
        releasePointerCapture: (pointerId: number) =>
          releaseResolverPointerCapture(this.inputWinner, pointerId),
      }),
    );
  }

  private updateInputNativeOwnership(enabled: boolean): void {
    const required = new Set<CRCResolverInputType>(
      enabled
        ? RESOLVER_INPUT_TYPES
        : hasResolverPointerCapture(this.inputWinner)
          ? RESOLVER_CAPTURE_INPUT_TYPES
          : [],
    );
    for (const [type, release] of this.inputNativeReleases) {
      if (required.has(type)) continue;
      release();
      this.inputNativeReleases.delete(type);
    }
    const hub = this.instance.eventRoot.nativeListeners;
    if (!hub) return;
    for (const type of required) {
      if (!this.inputNativeReleases.has(type)) {
        this.inputNativeReleases.set(type, hub.acquire(type));
      }
    }
  }

  private failCandidate(
    ctx: RenderingContext2D,
    size: CRCRenderLayerSize,
    error: unknown,
  ): void {
    this.inputGated = true;
    this.drawCommitted(ctx, size);
    queueFrameCompletion(() => {
      throw error;
    });
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
      this.canvas.width = this.canvas.height = 0;
      this.candidate?.bitmap.close();
      this.committed?.close();
      for (const target of this.committedTargets.values())
        releaseTarget(target);
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

function snapshotPolicy(policy: RenderLayerPolicy): RenderLayerPolicy {
  return Object.freeze({
    missBehavior: policy.missBehavior,
    pointerEvents: policy.pointerEvents,
    keyboardFocusable: policy.keyboardFocusable,
    keyboardNavigationBounds: policy.keyboardNavigationBounds
      ? Object.freeze({
          ...policy.keyboardNavigationBounds,
        })
      : undefined,
  });
}

function samePolicy(a: RenderLayerPolicy, b: RenderLayerPolicy): boolean {
  return (
    a.missBehavior === b.missBehavior &&
    a.pointerEvents === b.pointerEvents &&
    a.keyboardFocusable === b.keyboardFocusable &&
    a.keyboardNavigationBounds?.x === b.keyboardNavigationBounds?.x &&
    a.keyboardNavigationBounds?.y === b.keyboardNavigationBounds?.y &&
    a.keyboardNavigationBounds?.width === b.keyboardNavigationBounds?.width &&
    a.keyboardNavigationBounds?.height === b.keyboardNavigationBounds?.height
  );
}
