import type { defineThreeLayer } from './define-three-layer.js';
import type * as THREE from "three";
import type {
  PibblEventHandlers,
  PibblPointerEvents,
  PibblRenderLayerContext,
  PibblRenderLayerFrame,
  PibblRenderLayerHit,
  PibblRenderLayerSize,
  LayoutBox,
} from "@pibbl/core";

/**
 * Application-owned scene and camera required by a Three layer; additional resources may be stored
 * alongside them.
 *
 * @see {@link PibblThreeLayerDefinition}
 * @see {@link defineThreeLayer}
 * @see {@link THREE.Scene}
 * @see {@link THREE.Camera}
 */
export interface PibblThreeLayerResources {
  /** Application-owned scene rendered by the layer. See {@link THREE.Scene}. */
  readonly scene: THREE.Scene;
  /** Application-owned camera used for rendering and picking. See {@link THREE.Camera}. */
  readonly camera: THREE.Camera;
}

/**
 * A Three object registered as a Pibbl logical event and keyboard-focus target.
 *
 * @see {@link PibblEventHandlers}
 * @see {@link PibblPointerEvents}
 * @see {@link LayoutBox}
 * @see {@link PibblThreeLayerDefinition}
 * @see {@link THREE.Object3D}
 */
export interface PibblThreeTarget {
  /** Three object registered as a Pibbl logical target. See {@link THREE.Object3D}. */
  readonly object: THREE.Object3D;
  /** Event handlers dispatched for this logical target. See {@link PibblEventHandlers}. */
  readonly handlers?: PibblEventHandlers;
  /** Whether this content participates in pointer targeting. See {@link PibblPointerEvents}. */
  readonly pointerEvents?: PibblPointerEvents;
  /** Cursor shown while this target owns pointer presentation. See {@link PibblThreeTarget}. */
  readonly cursor?: string;
  /** Whether the target may receive keyboard focus. See {@link PibblThreeTarget}. */
  readonly keyboardFocusable?: boolean;
  /** Logical rectangle used for directional keyboard navigation. See {@link LayoutBox}. */
  readonly keyboardNavigationBounds?: Readonly<LayoutBox>;
}

/**
 * The target, block, or miss result of picking in a Three layer.
 *
 * @see {@link PibblRenderLayerHit}
 * @see {@link PibblThreePicker}
 * @see {@link THREE.Object3D}
 */
export type PibblThreePickResult = PibblRenderLayerHit<THREE.Object3D>;

/**
 * Three renderer construction options, excluding the canvas and transparency owned by the adapter.
 *
 * @see {@link PibblThreeLayerDefinition}
 * @see {@link THREE.WebGLRendererParameters}
 */
export type PibblThreeRendererOptions = Omit<
  THREE.WebGLRendererParameters,
  "canvas" | "alpha"
>;

/**
 * Connects Three controls to Pibbl-routed input through an element-compatible bridge.
 *
 * @see {@link PibblThreeLayerContext}
 */
export interface PibblThreeInputBridge {
  /**
   * Creates controls against the Pibbl input bridge and returns the created control instance. See
   * {@link PibblThreeInputBridge}.
   * @param create - Factory that constructs controls using Pibbl's routed-input element.
   * @returns The control object returned by the factory.
   */
  connect<Control>(create: (element: HTMLElement) => Control): Control;
}

/**
 * Hit-tests a layer-local logical point against a settled Three scene.
 *
 * @param point - Pointer position in layer-local logical coordinates.
 * @returns A Three object target, a blocking hit, or a miss. See {@link PibblThreePickResult}.
 *
 * @see {@link PibblThreePickResult}
 * @see {@link PibblThreeLayerDefinition}
 */
export type PibblThreePicker = (
  point: Readonly<{
    /**
     * Horizontal coordinate or displacement in the containing coordinate system. See
     * {@link PibblThreePicker}.
     */
    x: number;
    /**
     * Vertical coordinate or displacement in the containing coordinate system. See
     * {@link PibblThreePicker}.
     */
    y: number;
  }>,
) => PibblThreePickResult;

/**
 * Pibbl surface context extended with the adapter-owned renderer and controls-input bridge.
 *
 * @see {@link PibblRenderLayerContext}
 * @see {@link PibblThreeInputBridge}
 * @see {@link PibblThreeLayerDefinition}
 * @see {@link THREE.WebGLRenderer}
 */
export interface PibblThreeLayerContext extends PibblRenderLayerContext {
  /** The transparent renderer owned by this mounted adapter. See {@link PibblThreeLayerContext}. */
  readonly renderer: THREE.WebGLRenderer;
  /**
   * Bridge used to connect Three controls to Pibbl-routed events. See {@link PibblThreeInputBridge}.
   */
  readonly input: PibblThreeInputBridge;
}

/**
 * Three scene resource lifecycle, optional rendering overrides, and Pibbl interaction integration.
 *
 * @see {@link PibblThreeLayerResources}
 * @see {@link PibblThreeRendererOptions}
 * @see {@link PibblThreeLayerContext}
 * @see {@link PibblRenderLayerSize}
 * @see {@link PibblRenderLayerFrame}
 * @see {@link PibblThreeTarget}
 * @see {@link PibblThreePicker}
 * @see {@link defineThreeLayer}
 */
export interface PibblThreeLayerDefinition<
  Props,
  Resources extends PibblThreeLayerResources,
> {
  /**
   * Three renderer construction options; Pibbl supplies the canvas and enables transparency. See
   * {@link PibblThreeRendererOptions}.
   */
  readonly renderer?: PibblThreeRendererOptions;
  /**
   * Creates the application's scene, camera, and other explicitly owned resources. See
   * {@link PibblThreeLayerDefinition}.
   * @param context - Adapter-owned renderer, surface, input bridge, and invalidation services. See
   * {@link PibblThreeLayerContext} .
   * @param initialProps - Props from the first mounted render.
   * @returns Application-owned scene, camera, and additional resources retained for this mount.
   */
  create(context: PibblThreeLayerContext, initialProps: Readonly<Props>): Resources;
  /**
   * Applies current props to the persistent Three resources. See {@link PibblThreeLayerDefinition}.
   * @param resources - Resources returned by create.
   * @param props - Latest layer props.
   * @param context - Adapter-owned renderer, surface, input bridge, and invalidation services. See
   * {@link PibblThreeLayerContext} .
   */
  update?(
    resources: Resources,
    props: Readonly<Props>,
    context: PibblThreeLayerContext,
  ): void;
  /**
   * Updates camera or application render targets after the layer size changes. See
   * {@link PibblThreeLayerDefinition}.
   * @param resources - Resources returned by create.
   * @param size - New logical and backing dimensions. See {@link PibblRenderLayerSize}.
   * @param context - Adapter-owned renderer, surface, input bridge, and invalidation services. See
   * {@link PibblThreeLayerContext} .
   */
  resize?(
    resources: Resources,
    size: PibblRenderLayerSize,
    context: PibblThreeLayerContext,
  ): void;
  /**
   * Overrides rendering for custom effects; omitted callbacks use ordinary scene/camera rendering.
   * See {@link PibblThreeLayerDefinition}.
   * @param resources - Resources returned by create.
   * @param frame - Shared Pibbl frame timing and invalidation service. See
   * {@link PibblRenderLayerFrame} .
   * @param context - Adapter-owned renderer, surface, input bridge, and invalidation services. See
   * {@link PibblThreeLayerContext} .
   */
  render?(
    resources: Resources,
    frame: PibblRenderLayerFrame,
    context: PibblThreeLayerContext,
  ): void;
  /**
   * Returns the Three objects exposed as Pibbl interaction and focus targets. See
   * {@link PibblThreeTarget}.
   * @param resources - Resources returned by create.
   * @param props - Props used by this interaction generation.
   * @returns Object targets and their Pibbl event/focus metadata. See {@link PibblThreeTarget}.
   */
  targets?(resources: Resources, props: Readonly<Props>): Iterable<PibblThreeTarget>;
  /**
   * Creates a custom picker for the settled generation; omission uses the adapter's raycasting.
   * See {@link PibblThreePicker}.
   * @param resources - Resources returned by create.
   * @param context - Adapter-owned renderer, surface, input bridge, and invalidation services. See
   * {@link PibblThreeLayerContext} .
   * @returns A picker for the current scene resources. See {@link PibblThreePicker}.
   */
  pick?(resources: Resources, context: PibblThreeLayerContext): PibblThreePicker;
  /**
   * Disposes application-created Three resources; the adapter disposes its own renderer. See
   * {@link PibblThreeLayerDefinition}.
   * @param resources - Application-owned resources returned by create; release geometries,
   * materials, and other owned resources here.
   * @param context - Adapter context; the adapter releases its renderer and bridge after this
   * callback. See {@link PibblThreeLayerContext} .
   */
  dispose?(resources: Resources, context: PibblThreeLayerContext): void;
}
