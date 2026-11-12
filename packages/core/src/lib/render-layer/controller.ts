import { committedInstanceRootTransform, snapshotLayoutGeometry, stageLayoutTargetGeometry } from '../layout/geometry-publication.js';
import { GLOBAL_STATE, getCurrentPibblInstance } from "../global-state.js";
import { registerLayoutSuspensionResource, unregisterLayoutSuspensionResource } from "../layout/participation.js";
import { getCurrentWorldTransform } from "../render-target.js";
import {
  queueFrameCompletion,
  requestInstanceRender,
} from "../scheduler/realm-scheduler.js";
import type { PibblComponentRefs, RenderingContext2D } from "../types.js";
import type { PibblPointerEvents } from "../events/types.js";
import {
  PibblHitDisposition,
  PibblPaintEntryKind,
  type PibblHitTestOutput,
  type PibblNestedPaintEntry,
} from "../events/paint-entry.js";
import {
  createTarget,
  releaseTarget,
  updateTarget,
  normalizeHandlers,
  prepareTargetUpdate,
  type PibblEventTargetRegistration,
} from "../events/registrations.js";
import {
  hasResolverPointerCapture,
  releaseResolverInputWinner,
  releaseResolverPointerCapture,
  setResolverPointerCapture,
  type PibblResolverInputType,
  type PibblResolverInputWinner,
} from "../events/resolver-input.js";
import type {
  PibblRenderLayerContext,
  PibblRenderLayerDefinition,
  PibblRenderLayerFrame,
  PibblRenderLayerHit,
  PibblRenderLayerInteractionSnapshot,
  PibblRenderLayerSize,
  PibblRenderLayerTarget,
} from "./types.js";

class SynchronousLifecycleError extends TypeError {}

interface StagedInteraction<Target extends object> {
  readonly snapshot: PibblRenderLayerInteractionSnapshot<Target>;
  readonly targets: readonly PibblRenderLayerTarget<Target>[];
  readonly transform: DOMMatrix;
  readonly clippingStack: PibblNestedPaintEntry["clippingStack"];
}

interface RenderCandidate<Target extends object> {
  readonly bitmap: ImageBitmap;
  readonly interaction: StagedInteraction<Target>;
  readonly policy: RenderLayerPolicy;
  prepared?: PreparedInteraction<Target>;
}

interface PreparedInteraction<Target extends object> {
  readonly interaction: StagedInteraction<Target>;
  readonly policy: RenderLayerPolicy;
  readonly targets: Map<Target, PibblEventTargetRegistration>;
  readonly created: PibblEventTargetRegistration[];
  readonly retired: PibblEventTargetRegistration[];
  readonly registrations: ReturnType<typeof prepareTargetUpdate>[];
  readonly inputLeases: Map<PibblResolverInputType, () => void>;
  readonly addedInputLeases: (() => void)[];
  previousInputLeases?: Map<PibblResolverInputType, () => void>;
  settled?: boolean;
  adopted?: boolean;
  readonly inverse: DOMMatrix;
  readonly layerEnabled: boolean;
}

interface RenderLayerPolicy {
  readonly missBehavior: "pass-through" | "block" | "target-layer";
  readonly pointerEvents: PibblPointerEvents | undefined;
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
  readonly generation: number;
  readonly geometryGeneration: number;
  readonly point: Readonly<{ x: number; y: number }>;
  readonly hit: PibblRenderLayerHit<Target>;
}

const MISS_SNAPSHOT: PibblRenderLayerInteractionSnapshot<object> = Object.freeze({
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
  private readonly instance = getCurrentPibblInstance();
  private readonly refs: PibblComponentRefs<any>;
  private readonly canvas: OffscreenCanvas;
  private readonly context: PibblRenderLayerContext;
  private resources: Resources | undefined;
  private created = false;
  private disposed = false;
  private size: PibblRenderLayerSize | undefined;
  private props: Readonly<Props> | undefined;
  private needsRender = true;
  private needsResize = true;
  private inputDeliveryGated = false;
  private inputGated = true;
  private candidate: RenderCandidate<Target> | undefined;
  private committed: ImageBitmap | undefined;
  private committedInteraction:
    PibblRenderLayerInteractionSnapshot<Target> | undefined;
  private committedTargetDescriptors: readonly PibblRenderLayerTarget<Target>[] =
    Object.freeze([]);
  private committedTargets = new Map<
    Target,
    PibblEventTargetRegistration
  >();
  private readonly layerTarget: PibblEventTargetRegistration;
  private committedPolicy: RenderLayerPolicy = Object.freeze({
    missBehavior: "pass-through",
    pointerEvents: undefined,
    keyboardFocusable: undefined,
    keyboardNavigationBounds: undefined,
  });
  private resolverTransform = new DOMMatrix();
  private resolverInverseTransform = new DOMMatrix();
  private resolverBounds = new Path2D();
  private resolverSize: PibblRenderLayerSize | undefined;
  private interactionGeneration = 0;
  private resolutionErrorQueued = false;
  private inputNativeReleases = new Map<
    PibblResolverInputType,
    () => void
  >();
  private readonly resolverEntry: PibblNestedPaintEntry;
  private readonly inputWinner: PibblResolverInputWinner;
  private lastTime: number | undefined;

  constructor(
    private readonly definition: PibblRenderLayerDefinition<
      Props,
      Resources,
      Target
    >,
    refs: PibblComponentRefs<any>,
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
      paintKind: PibblPaintEntryKind.Resolver,
      instance: this.instance,
      bounds: this.resolverBounds,
      transform: this.resolverTransform,
      clippingStack: [],
      resolveLocal: (x, y, output) => this.resolveLocal(x, y, output),
    };
    const suspensionResource = {
      suspendLayout: () => this.instance.paintEntries.delete(this.resolverEntry),
    };
    registerLayoutSuspensionResource(refs, suspensionResource);
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
    refs.teardowns.add(() => {
      unregisterLayoutSuspensionResource(refs, suspensionResource);
      this.dispose();
    });
  }

  render(
    props: Readonly<Props>,
    size: PibblRenderLayerSize,
    ctx: RenderingContext2D,
    policy: RenderLayerPolicy = this.committedPolicy,
  ): void {
    if (this.disposed) return;
    const initial = !this.created;
    const propsChanged = !initial && !sameProps(this.props, props);
    const sizeChanged = !sameSize(this.size, size);
    const policyChanged = !samePolicy(this.committedPolicy, policy);
    // Renderer callbacks may mutate shared scene resources. No old picker can
    // safely inspect those resources until its candidate generation settles.
    if (initial || propsChanged || sizeChanged || this.needsRender) { this.inputGated = true; this.inputDeliveryGated = true; }
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
      if (this.candidate?.prepared) this.finishPrepared(this.candidate.prepared, false);
      const stagedCandidate: RenderCandidate<Target> = {
        bitmap: candidate,
        interaction,
        policy: stagedPolicy,
      };
      this.candidate = stagedCandidate;
      const transaction = GLOBAL_STATE.renderTransaction;
      if (transaction?.onAdopt) {
        try { stagedCandidate.prepared = this.prepareInteraction(interaction, stagedPolicy); }
        catch (error) { this.finishCandidate(stagedCandidate, false); throw error; }
        transaction.onAdopt(() => this.finishCandidate(stagedCandidate, true));
        transaction.onFinish(success => {
          if (!success) {
            this.finishCandidate(stagedCandidate, false);
          }
          else if (stagedCandidate.prepared) this.finishPrepared(stagedCandidate.prepared, true);
        });
      } else {
        transaction?.onFinish(success => this.finishCandidate(stagedCandidate, success));
        if (!transaction) this.finishCandidate(stagedCandidate, true);
      }
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
    if (transaction?.onAdopt && this.committedInteraction) {
      const prepared = this.prepareInteraction({ snapshot: this.committedInteraction, targets: this.committedTargetDescriptors,
        transform: this.resolverTransform, clippingStack: this.resolverEntry.clippingStack }, snapshotPolicy(policy));
      transaction.onAdopt(() => { if (!this.disposed) this.adoptInteraction(prepared); });
      transaction.onFinish(success => {
        this.finishPrepared(prepared, success);
      });
    } else {
      transaction?.onFinish(success => {
        if (success && !this.disposed) {
          if (policyChanged && this.committedInteraction) this.commitInteraction({ snapshot: this.committedInteraction,
            targets: this.committedTargetDescriptors, transform: this.resolverTransform, clippingStack: this.resolverEntry.clippingStack }, snapshotPolicy(policy));
          this.refreshCommittedTargetGeometry();
        }
      });
      if (!transaction && policyChanged && this.committedInteraction) this.commitInteraction({ snapshot: this.committedInteraction,
        targets: this.committedTargetDescriptors, transform: this.resolverTransform, clippingStack: this.resolverEntry.clippingStack }, snapshotPolicy(policy));
    }
    this.drawCommitted(ctx, size);
  }

  private publishResolver(size: PibblRenderLayerSize): void {
    if (!sameSize(this.resolverSize, size)) {
      const bounds = new Path2D();
      bounds.rect(0, 0, size.width, size.height);
      this.resolverBounds = bounds;
      this.resolverEntry.bounds = bounds;
      this.resolverSize = size;
    }
    this.resolverTransform = getCurrentWorldTransform();
    this.resolverEntry.transform = this.resolverTransform;
    this.resolverEntry.clippingStack = Array.from(GLOBAL_STATE.clippingStack);
    // Sets preserve insertion order, so refresh the retained entry at its
    // current Canvas paint position on every traversal.
    this.instance.paintEntries.delete(this.resolverEntry);
    this.instance.paintEntries.add(this.resolverEntry);
  }

  private drawCommitted(
    ctx: RenderingContext2D,
    size: PibblRenderLayerSize,
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

  private createFrame(): PibblRenderLayerFrame {
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
      (MISS_SNAPSHOT as PibblRenderLayerInteractionSnapshot<Target>);
    assertSynchronous(snapshot, "interaction.settle");
    const targets: PibblRenderLayerTarget<Target>[] = [];
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
    if (!success || this.disposed) {
      this.candidate = undefined;
      this.needsRender = true;
      this.inputGated = true;
      candidate.bitmap.close();
      if (candidate.prepared) this.finishPrepared(candidate.prepared, false);
      return;
    }
    if (candidate.prepared) this.adoptInteraction(candidate.prepared);
    else this.commitInteraction(candidate.interaction, candidate.policy);
    this.committed?.close();
    this.committed = candidate.bitmap;
    this.candidate = undefined;
    this.resolutionErrorQueued = false;
    this.inputGated = false;
    this.inputDeliveryGated = false;
  }

  /** Prepares descriptors without mutating the current target identities or handlers. */
  private prepareInteraction(interaction: StagedInteraction<Target>, policy: RenderLayerPolicy): PreparedInteraction<Target> {
    const targets = new Map<Target, PibblEventTargetRegistration>();
    const created: PibblEventTargetRegistration[] = [];
    const registrations: PreparedInteraction<Target>['registrations'] = [];
    const inputLeases = new Map<PibblResolverInputType, () => void>();
    const addedInputLeases: (() => void)[] = [];
    const transaction = GLOBAL_STATE.renderTransaction ?? this.instance.eventRoot.renderTransaction;
    const stage = (target: PibblEventTargetRegistration, bounds: PibblRenderLayerTarget<Target>['keyboardNavigationBounds'], focusable: boolean) => {
      if (transaction) stageLayoutTargetGeometry(transaction, target, { bounds, transform: interaction.transform });
      this.instance.eventRoot.focusPolicy?.observeTransactionalTarget?.(target, focusable);
    };
    try {
      if (policy.pointerEvents !== 'none') for (const descriptor of interaction.targets) {
        if (descriptor.pointerEvents === 'none') continue;
        let target = this.committedTargets.get(descriptor.target);
        if (!target) { target = createTarget(this.instance, this.refs, this.committedTargets.size + created.length + 1); created.push(target); }
        targets.set(descriptor.target, target);
        registrations.push(prepareTargetUpdate(target, descriptor.handlers ?? {}, {
          path: new Path2D(), cursor: descriptor.cursor, keyboardFocusable: descriptor.keyboardFocusable,
          keyboardNavigationBounds: descriptor.keyboardNavigationBounds,
        }, interaction.transform, interaction.clippingStack));
        const handlers = normalizeHandlers(descriptor.handlers ?? {});
        stage(target, descriptor.keyboardNavigationBounds, descriptor.keyboardFocusable ?? Boolean(handlers.click || handlers.keydown || handlers.keyup));
      }
      const layerEnabled = policy.pointerEvents !== 'none' && policy.missBehavior === 'target-layer';
      stage(this.layerTarget, policy.keyboardNavigationBounds, layerEnabled && (policy.keyboardFocusable ?? true));
      if (layerEnabled) registrations.push(prepareTargetUpdate(this.layerTarget, { onClick: STRUCTURAL_CLICK_ELIGIBILITY }, {
        path: new Path2D(), keyboardFocusable: policy.keyboardFocusable, keyboardNavigationBounds: policy.keyboardNavigationBounds,
      }, interaction.transform, interaction.clippingStack));
      const hub = this.instance.eventRoot.nativeListeners;
      const types = interaction.snapshot.onInput ? RESOLVER_INPUT_TYPES : hasResolverPointerCapture(this.inputWinner) ? RESOLVER_CAPTURE_INPUT_TYPES : [];
      if (hub) for (const type of types) {
        let lease = this.inputNativeReleases.get(type);
        if (!lease) { lease = hub.acquire(type); addedInputLeases.push(lease); }
        inputLeases.set(type, lease);
      }
      const retired: PibblEventTargetRegistration[] = [];
      for (const [identity, target] of this.committedTargets) if (!targets.has(identity)) retired.push(target);
      if (!layerEnabled && this.layerTarget.live) retired.push(this.layerTarget);
      return { interaction, policy, targets, created, retired, registrations, inputLeases, addedInputLeases, layerEnabled, inverse: interaction.transform.inverse() };
    } catch (error) {
      const errors: unknown[] = [error];
      const release = (callback: () => void) => { try { callback(); } catch (releaseError) { errors.push(releaseError); } };
      for (const registration of registrations) release(() => registration.finish());
      for (const lease of addedInputLeases) release(lease);
      for (const target of created) release(() => releaseTarget(target));
      if (errors.length > 1) throw new AggregateError(errors, 'Render layer interaction preparation failed.', { cause: error });
      throw error;
    }
  }

  private adoptInteraction(prepared: PreparedInteraction<Target>): void {
    const { interaction, policy } = prepared;
    for (const registration of prepared.registrations) registration.adopt();
    prepared.previousInputLeases = this.inputNativeReleases;
    this.inputNativeReleases = prepared.inputLeases;
    this.committedTargets = prepared.targets;
    this.committedInteraction = interaction.snapshot;
    this.committedTargetDescriptors = interaction.targets;
    this.committedPolicy = policy;
    this.resolverInverseTransform = prepared.inverse;
    this.interactionGeneration++;
    prepared.adopted = true;
  }

  private finishPrepared(prepared: PreparedInteraction<Target>, success: boolean): void {
    if (prepared.settled) return;
    prepared.settled = true;
    success = success && prepared.adopted === true;
    const errors: unknown[] = [];
    const finish = (callback: () => void) => { try { callback(); } catch (error) { errors.push(error); } };
    for (const registration of prepared.registrations) finish(() => registration.finish());
    if (prepared.previousInputLeases) {
      for (const [type, release] of prepared.previousInputLeases) if (!prepared.inputLeases.has(type)) finish(release);
    } else if (!success) for (const release of prepared.addedInputLeases) finish(release);
    for (const target of success ? prepared.retired : prepared.created) finish(() => releaseTarget(target));
    if (success) for (const registration of prepared.registrations) finish(() => registration.notify());
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Render layer registration completion failed.');
  }

  /** Immediate fallback for callers without a root transaction. */
  private commitInteraction(interaction: StagedInteraction<Target>, policy: RenderLayerPolicy): void {
    const prepared = this.prepareInteraction(interaction, policy);
    this.adoptInteraction(prepared);
    this.finishPrepared(prepared, true);
  }

  private applyResolverGeometry(
    target: PibblEventTargetRegistration,
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
    if (this.committedPolicy.pointerEvents !== "none") {
      for (const descriptor of this.committedTargetDescriptors) {
        if (descriptor.pointerEvents === "none") continue;
        const target = this.committedTargets.get(descriptor.target);
        if (!target) continue;
        // Hidden participation releases the registration while retaining this
        // controller's committed bitmap and interaction snapshot. Re-register
        // it on the first visible traversal so it regains paint, target, and
        // focus ownership without forcing the external renderer to repaint.
        if (!target.live) {
          updateTarget(
            target,
            descriptor.handlers ?? {},
            {
              path: new Path2D(),
              cursor: descriptor.cursor,
              keyboardFocusable: descriptor.keyboardFocusable,
              keyboardNavigationBounds: descriptor.keyboardNavigationBounds,
            },
            true,
          );
        }
        this.applyResolverGeometry(target, interaction);
        this.instance.eventRoot.focusPolicy?.observeTarget(target);
        this.observeTransactionalFocusTarget(target);
      }
    }
    if (
      this.committedPolicy.pointerEvents !== "none" &&
      this.committedPolicy.missBehavior === "target-layer" &&
      !this.layerTarget.live
    ) {
      updateTarget(
        this.layerTarget,
        { onClick: STRUCTURAL_CLICK_ELIGIBILITY },
        {
          path: new Path2D(),
          keyboardFocusable: this.committedPolicy.keyboardFocusable,
          keyboardNavigationBounds:
            this.committedPolicy.keyboardNavigationBounds,
        },
        true,
      );
    }
    if (this.layerTarget.live) {
      this.applyResolverGeometry(this.layerTarget, interaction);
      this.instance.eventRoot.focusPolicy?.observeTarget(this.layerTarget);
      this.observeTransactionalFocusTarget(this.layerTarget);
    }
  }

  private observeTransactionalFocusTarget(
    target: PibblEventTargetRegistration,
  ): void {
    this.instance.eventRoot.focusPolicy?.observeTransactionalTarget?.(target);
  }

  private resolveLocal(
    localX: number,
    localY: number,
    output: PibblHitTestOutput,
  ): void {
    if (this.committedPolicy.pointerEvents === "none") {
      output.disposition = PibblHitDisposition.Miss;
      output.target = null;
      return;
    }
    const state = this.resolveWinnerState(localX, localY);
    if ((state.generation !== this.interactionGeneration || state.geometryGeneration !== snapshotLayoutGeometry(this.instance).generation) || this.disposed || this.inputDeliveryGated) {
      output.disposition = PibblHitDisposition.Block;
      output.target = null;
      delete output.winner;
      delete output.winnerState;
      return;
    }
    output.winner = this.inputWinner;
    output.winnerState = state;
    switch (state.hit.kind) {
      case "miss":
        if (this.committedPolicy.missBehavior === "pass-through") {
          output.disposition = PibblHitDisposition.Miss;
          output.target = null;
          delete output.winner;
          delete output.winnerState;
        } else if (this.committedPolicy.missBehavior === "block") {
          output.disposition = PibblHitDisposition.Block;
          output.target = null;
        } else {
          output.disposition = PibblHitDisposition.Target;
          output.target = this.layerTarget.live ? this.layerTarget : null;
        }
        return;
      case "block":
        output.disposition = PibblHitDisposition.Block;
        output.target = null;
        return;
      case "target": {
        const target = this.committedTargets.get(state.hit.target);
        if (!target?.live) {
          output.disposition = PibblHitDisposition.Block;
          output.target = null;
          output.winnerState = {
            point: state.point, generation: state.generation, geometryGeneration: state.geometryGeneration,
            hit: Object.freeze({ kind: "block" as const }),
          } satisfies WinnerState<Target>;
          this.reportUnknownTarget();
          return;
        }
        output.disposition = PibblHitDisposition.Target;
        output.target = target;
      }
    }
  }

  private resolveWinnerState(
    localX: number,
    localY: number,
  ): WinnerState<Target> {
    const point = Object.freeze({ x: localX, y: localY });
    const generation = this.interactionGeneration;
    const geometryGeneration = snapshotLayoutGeometry(this.instance).generation;
    if (this.inputGated || !this.committedInteraction) {
      return { point, generation, geometryGeneration, hit: Object.freeze({ kind: "block" }) };
    }
    const hit = this.committedInteraction.hitTest(point);
    if ((generation !== this.interactionGeneration || geometryGeneration !== snapshotLayoutGeometry(this.instance).generation) || this.disposed || this.inputGated) {
      return { point, generation, geometryGeneration, hit: Object.freeze({ kind: "block" }) };
    }
    if (hit.kind === "target" && !this.committedTargets.has(hit.target)) {
      this.reportUnknownTarget();
      return { point, generation, geometryGeneration, hit: Object.freeze({ kind: "block" }) };
    }
    return { point, hit, generation, geometryGeneration };
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
    type: PibblResolverInputType,
    rootPoint: Readonly<{ x: number; y: number }>,
    originalEvent: PointerEvent | WheelEvent | MouseEvent,
    resolvedState: unknown,
  ): void {
    const snapshot = this.committedInteraction;
    if (!snapshot?.onInput || this.disposed || this.inputDeliveryGated) return;
    let state = resolvedState as WinnerState<Target> | undefined;
    // A reentrant render between picking and delivery must not pair an old hit
    // with a newer renderer callback or coordinate frame.
    if (state && (state.generation !== this.interactionGeneration || state.geometryGeneration !== snapshotLayoutGeometry(this.instance).generation)) return;
    if (!state) {
      const bridge = committedInstanceRootTransform(this.instance);
      if (!bridge) return;
      const ownerPoint = bridge.inverse().transformPoint(new DOMPoint(rootPoint.x, rootPoint.y));
      const local = this.resolverInverseTransform.transformPoint(ownerPoint);
      state = this.resolveWinnerState(local.x, local.y);
    }
    if (this.inputDeliveryGated || (state.generation !== this.interactionGeneration || state.geometryGeneration !== snapshotLayoutGeometry(this.instance).generation)) return;
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
    const required = new Set<PibblResolverInputType>(
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
    size: PibblRenderLayerSize,
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
    const errors: unknown[] = [];
    const release = (callback: () => void) => { try { callback(); } catch (error) { errors.push(error); } };
    if (this.created && this.definition.dispose) release(() => assertSynchronous(
      this.definition.dispose!(this.resources!, this.context), 'dispose'));
    release(() => { this.canvas.width = this.canvas.height = 0; });
    release(() => this.candidate?.bitmap.close());
    if (this.candidate?.prepared) release(() => this.finishPrepared(this.candidate!.prepared!, false));
    release(() => this.committed?.close());
    for (const target of this.committedTargets.values()) release(() => releaseTarget(target));
    this.committedTargets.clear();
    release(() => releaseTarget(this.layerTarget));
    release(() => releaseResolverInputWinner(this.inputWinner));
    for (const lease of this.inputNativeReleases.values()) release(lease);
    this.inputNativeReleases.clear();
    this.candidate = undefined;
    this.committed = undefined;
    this.committedInteraction = undefined;
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Render layer disposal failed.');
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
  a: PibblRenderLayerSize | undefined,
  b: PibblRenderLayerSize,
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
