import type { defineThreeLayer } from './define-three-layer.js';
import type * as THREE from "three";
import type {
  CRCEventHandlers,
  CRCPointerEvents,
  CRCRenderLayerContext,
  CRCRenderLayerFrame,
  CRCRenderLayerHit,
  CRCRenderLayerSize,
  LayoutBox,
} from "@crc/core";

/**
 * Application-owned scene and camera required by a Three layer; additional resources may be stored
 * alongside them.
 *
 * @see {@link CRCThreeLayerDefinition}
 * @see {@link defineThreeLayer}
 * @see {@link THREE.Scene}
 * @see {@link THREE.Camera}
 */
export interface CRCThreeLayerResources {
  /** Application-owned scene rendered by the layer. See {@link THREE.Scene}. */
  readonly scene: THREE.Scene;
  /** Application-owned camera used for rendering and picking. See {@link THREE.Camera}. */
  readonly camera: THREE.Camera;
}

/**
 * A Three object registered as a CRC logical event and keyboard-focus target.
 *
 * @see {@link CRCEventHandlers}
 * @see {@link CRCPointerEvents}
 * @see {@link LayoutBox}
 * @see {@link CRCThreeLayerDefinition}
 * @see {@link THREE.Object3D}
 */
export interface CRCThreeTarget {
  /** Three object registered as a CRC logical target. See {@link THREE.Object3D}. */
  readonly object: THREE.Object3D;
  /** Event handlers dispatched for this logical target. See {@link CRCEventHandlers}. */
  readonly handlers?: CRCEventHandlers;
  /** Whether this content participates in pointer targeting. See {@link CRCPointerEvents}. */
  readonly pointerEvents?: CRCPointerEvents;
  /** Cursor shown while this target owns pointer presentation. See {@link CRCThreeTarget}. */
  readonly cursor?: string;
  /** Whether the target may receive keyboard focus. See {@link CRCThreeTarget}. */
  readonly keyboardFocusable?: boolean;
  /** Logical rectangle used for directional keyboard navigation. See {@link LayoutBox}. */
  readonly keyboardNavigationBounds?: Readonly<LayoutBox>;
}

/**
 * The target, block, or miss result of picking in a Three layer.
 *
 * @see {@link CRCRenderLayerHit}
 * @see {@link CRCThreePicker}
 * @see {@link THREE.Object3D}
 */
export type CRCThreePickResult = CRCRenderLayerHit<THREE.Object3D>;

/**
 * Three renderer construction options, excluding the canvas and transparency owned by the adapter.
 *
 * @see {@link CRCThreeLayerDefinition}
 * @see {@link THREE.WebGLRendererParameters}
 */
export type CRCThreeRendererOptions = Omit<
  THREE.WebGLRendererParameters,
  "canvas" | "alpha"
>;

/**
 * Connects Three controls to CRC-routed input through an element-compatible bridge.
 *
 * @see {@link CRCThreeLayerContext}
 */
export interface CRCThreeInputBridge {
  /**
   * Creates controls against the CRC input bridge and returns the created control instance. See
   * {@link CRCThreeInputBridge}.
   * @param create - Factory that constructs controls using CRC's routed-input element.
   * @returns The control object returned by the factory.
   */
  connect<Control>(create: (element: HTMLElement) => Control): Control;
}

/**
 * Hit-tests a layer-local logical point against a settled Three scene.
 *
 * @param point - Pointer position in layer-local logical coordinates.
 * @returns A Three object target, a blocking hit, or a miss. See {@link CRCThreePickResult}.
 *
 * @see {@link CRCThreePickResult}
 * @see {@link CRCThreeLayerDefinition}
 */
export type CRCThreePicker = (
  point: Readonly<{
    /**
     * Horizontal coordinate or displacement in the containing coordinate system. See
     * {@link CRCThreePicker}.
     */
    x: number;
    /**
     * Vertical coordinate or displacement in the containing coordinate system. See
     * {@link CRCThreePicker}.
     */
    y: number;
  }>,
) => CRCThreePickResult;

/**
 * CRC surface context extended with the adapter-owned renderer and controls-input bridge.
 *
 * @see {@link CRCRenderLayerContext}
 * @see {@link CRCThreeInputBridge}
 * @see {@link CRCThreeLayerDefinition}
 * @see {@link THREE.WebGLRenderer}
 */
export interface CRCThreeLayerContext extends CRCRenderLayerContext {
  /** The transparent renderer owned by this mounted adapter. See {@link CRCThreeLayerContext}. */
  readonly renderer: THREE.WebGLRenderer;
  /**
   * Bridge used to connect Three controls to CRC-routed events. See {@link CRCThreeInputBridge}.
   */
  readonly input: CRCThreeInputBridge;
}

/**
 * Three scene resource lifecycle, optional rendering overrides, and CRC interaction integration.
 *
 * @see {@link CRCThreeLayerResources}
 * @see {@link CRCThreeRendererOptions}
 * @see {@link CRCThreeLayerContext}
 * @see {@link CRCRenderLayerSize}
 * @see {@link CRCRenderLayerFrame}
 * @see {@link CRCThreeTarget}
 * @see {@link CRCThreePicker}
 * @see {@link defineThreeLayer}
 */
export interface CRCThreeLayerDefinition<
  Props,
  Resources extends CRCThreeLayerResources,
> {
  /**
   * Three renderer construction options; CRC supplies the canvas and enables transparency. See
   * {@link CRCThreeRendererOptions}.
   */
  readonly renderer?: CRCThreeRendererOptions;
  /**
   * Creates the application's scene, camera, and other explicitly owned resources. See
   * {@link CRCThreeLayerDefinition}.
   * @param context - Adapter-owned renderer, surface, input bridge, and invalidation services. See
   * {@link CRCThreeLayerContext} .
   * @param initialProps - Props from the first mounted render.
   * @returns Application-owned scene, camera, and additional resources retained for this mount.
   */
  create(context: CRCThreeLayerContext, initialProps: Readonly<Props>): Resources;
  /**
   * Applies current props to the persistent Three resources. See {@link CRCThreeLayerDefinition}.
   * @param resources - Resources returned by create.
   * @param props - Latest layer props.
   * @param context - Adapter-owned renderer, surface, input bridge, and invalidation services. See
   * {@link CRCThreeLayerContext} .
   */
  update?(
    resources: Resources,
    props: Readonly<Props>,
    context: CRCThreeLayerContext,
  ): void;
  /**
   * Updates camera or application render targets after the layer size changes. See
   * {@link CRCThreeLayerDefinition}.
   * @param resources - Resources returned by create.
   * @param size - New logical and backing dimensions. See {@link CRCRenderLayerSize}.
   * @param context - Adapter-owned renderer, surface, input bridge, and invalidation services. See
   * {@link CRCThreeLayerContext} .
   */
  resize?(
    resources: Resources,
    size: CRCRenderLayerSize,
    context: CRCThreeLayerContext,
  ): void;
  /**
   * Overrides rendering for custom effects; omitted callbacks use ordinary scene/camera rendering.
   * See {@link CRCThreeLayerDefinition}.
   * @param resources - Resources returned by create.
   * @param frame - Shared CRC frame timing and invalidation service. See
   * {@link CRCRenderLayerFrame} .
   * @param context - Adapter-owned renderer, surface, input bridge, and invalidation services. See
   * {@link CRCThreeLayerContext} .
   */
  render?(
    resources: Resources,
    frame: CRCRenderLayerFrame,
    context: CRCThreeLayerContext,
  ): void;
  /**
   * Returns the Three objects exposed as CRC interaction and focus targets. See
   * {@link CRCThreeTarget}.
   * @param resources - Resources returned by create.
   * @param props - Props used by this interaction generation.
   * @returns Object targets and their CRC event/focus metadata. See {@link CRCThreeTarget}.
   */
  targets?(resources: Resources, props: Readonly<Props>): Iterable<CRCThreeTarget>;
  /**
   * Creates a custom picker for the settled generation; omission uses the adapter's raycasting.
   * See {@link CRCThreePicker}.
   * @param resources - Resources returned by create.
   * @param context - Adapter-owned renderer, surface, input bridge, and invalidation services. See
   * {@link CRCThreeLayerContext} .
   * @returns A picker for the current scene resources. See {@link CRCThreePicker}.
   */
  pick?(resources: Resources, context: CRCThreeLayerContext): CRCThreePicker;
  /**
   * Disposes application-created Three resources; the adapter disposes its own renderer. See
   * {@link CRCThreeLayerDefinition}.
   * @param resources - Application-owned resources returned by create; release geometries,
   * materials, and other owned resources here.
   * @param context - Adapter context; the adapter releases its renderer and bridge after this
   * callback. See {@link CRCThreeLayerContext} .
   */
  dispose?(resources: Resources, context: CRCThreeLayerContext): void;
}
