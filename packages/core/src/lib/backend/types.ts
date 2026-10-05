import type { registerNestedInteractionResolver, useBackendEventTarget } from '../../internal.js';
import type { mountBackendPibbl } from '../mount-pibbl.js';
import type { defineBackendPrimitive } from '../define-primitive.js';
import type { PibblElementSource } from '../element/metadata.js';
import type { PibblNode, PibblNodeInput } from '../element/types.js';
import type { PibblHitTestOutput } from '../events/paint-entry.js';
import type { PibblEventFocusOptions, PibblEventHandlers } from '../events/types.js';
import type {
  MeasureInput,
  MeasureResult,
  NormalizedStyle,
  PreservedSignalPropKey,
  PrimitiveProgramProps,
  ResolvedStyle,
  SpecifiedStyle,
  StyleResolutionContext,
  SystemStyle,
  Canvas,
  RenderingContext2D,
} from '../types.js';
import type { RenderTargetSnapshot } from '../render-target.js';

declare const PIBBL_BACKEND_TOKEN: unique symbol;

/**
 * Opaque identity for one official Pibbl rendering backend.
 *
 * @see {@link createBackendToken}
 * @see {@link PibblBackendDriver}
 * @see {@link PibblBackendPrimitiveDefinition}
 */
export interface PibblBackendToken {
  readonly [PIBBL_BACKEND_TOKEN]: true;
}

const backendNames = new WeakMap<PibblBackendToken, string>();

/**
 * Creates a package-private backend identity for an official Pibbl renderer.
 *
 * @param name - Diagnostic name identifying the backend.
 * @returns A unique backend identity token. See {@link PibblBackendToken}.
 *
 * @see {@link PibblBackendToken}
 */
export function createBackendToken(name: string): PibblBackendToken {
  if (!name.trim()) {
    throw new Error('Pibbl backend names must be nonempty.');
  }
  const token = Object.freeze({}) as PibblBackendToken;
  backendNames.set(token, name);
  return token;
}

/** @internal Used only for diagnostics and dispatch inside core. */
export function getBackendTokenName(token: PibblBackendToken): string {
  return backendNames.get(token) ?? 'unknown';
}

/**
 * Executable primitive rendering program recognized by the backend.
 *
 * @param props - Resolved non-style component inputs. See {@link PrimitiveProgramProps}.
 * @param style - Resolved primitive style. See {@link ResolvedStyle}.
 * @param environment - Backend environment for the active frame.
 * @returns Child nodes to traverse, or no children. See {@link PibblNodeInput}.
 *
 * @see {@link SystemStyle}
 * @see {@link PrimitiveProgramProps}
 * @see {@link ResolvedStyle}
 * @see {@link PibblNodeInput}
 * @see {@link PibblBackendPrimitiveDefinition}
 * @see {@link defineBackendPrimitive}
 */
export type PibblBackendPrimitiveProgram<
  P = any,
  R extends SystemStyle = SystemStyle,
  E = any,
> = (
  props: Readonly<PrimitiveProgramProps<P>>,
  style: ResolvedStyle<R>,
  environment: E,
) => PibblNodeInput | void;

/**
 * Rendering, style, and measurement definition of a backend primitive.
 *
 * @see {@link SystemStyle}
 * @see {@link PibblBackendToken}
 * @see {@link PibblBackendPrimitiveProgram}
 * @see {@link SpecifiedStyle}
 * @see {@link NormalizedStyle}
 * @see {@link StyleResolutionContext}
 * @see {@link ResolvedStyle}
 * @see {@link MeasureInput}
 * @see {@link PrimitiveProgramProps}
 * @see {@link MeasureResult}
 * @see {@link PibblBackendPrimitiveInput}
 */
export interface PibblBackendPrimitiveDefinition<
  P = any,
  S extends SystemStyle = SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
  E = any,
> {
  /** Identity of the backend that accepts this primitive. See {@link PibblBackendToken}. */
  readonly backend: PibblBackendToken;
  /**
   * Names props whose signal identity is preserved for the primitive program. See
   * {@link PreservedSignalPropKey}.
   */
  readonly preserveSignalProps?: readonly PreservedSignalPropKey<P>[];
  /**
   * Declares how the primitive receives and resolves its children. See
   * {@link PibblBackendPrimitiveDefinition}.
   */
  readonly childInput?: 'structural' | 'text';
  /** Executable primitive program used by the backend. See {@link PibblBackendPrimitiveProgram}. */
  readonly program: PibblBackendPrimitiveProgram<P, R, E>;
  /**
   * Applies primitive defaults and shorthand normalization before layout resolution. See
   * {@link SpecifiedStyle}, {@link NormalizedStyle}.
   * @param style - Specified style values before normalization. See {@link SpecifiedStyle}.
   * @returns Normalized style with the primitive's shorthand and defaults applied. See
   * {@link NormalizedStyle} .
   */
  readonly normalizeStyle?: (style: SpecifiedStyle<S>) => NormalizedStyle<N>;
  /**
   * Resolves normalized style using the current layout context. See {@link NormalizedStyle},
   * {@link StyleResolutionContext}, {@link ResolvedStyle}.
   * @param style - Normalized style to resolve. See {@link NormalizedStyle}.
   * @param context - Layout and diagnostic context for resolution. See
   * {@link StyleResolutionContext} .
   * @returns Resolved style ready for rendering. See {@link ResolvedStyle}.
   */
  readonly resolveStyle?: (
    style: NormalizedStyle<N>,
    context: Readonly<StyleResolutionContext>,
  ) => ResolvedStyle<R>;
  /**
   * Measures declared primitive inputs without painting or retaining draw commands. See
   * {@link MeasureInput}, {@link PrimitiveProgramProps}, {@link MeasureResult}.
   * @param input - Props, normalized style, constraints, and nested measurement services. See
   * {@link MeasureInput} , {@link PrimitiveProgramProps} .
   * @returns Measured dimensions or an unsupported measurement result. See {@link MeasureResult}.
   */
  readonly measure?: (input: MeasureInput<PrimitiveProgramProps<P>, N>) => MeasureResult;
}

/**
 * Inputs used to begin a backend frame.
 *
 * @see {@link Canvas}
 * @see {@link PibblBackendDriver}
 */
export interface PibblBackendFrameInput {
  /** Canvas surface associated with this resource or mount. See {@link Canvas}. */
  readonly canvas: Canvas;
  /** Canvas width in logical units. See {@link PibblBackendFrameInput}. */
  readonly logicalWidth: number;
  /** Canvas height in logical units. See {@link PibblBackendFrameInput}. */
  readonly logicalHeight: number;
  /** Width of the backing raster in physical pixels. See {@link PibblBackendFrameInput}. */
  readonly backingWidth: number;
  /** Height of the backing raster in physical pixels. See {@link PibblBackendFrameInput}. */
  readonly backingHeight: number;
  /** Timestamp associated with this render frame. See {@link PibblBackendFrameInput}. */
  readonly renderTimestamp: number;
}

/**
 * The backend rendering context for one scheduled frame.
 *
 * @see {@link RenderingContext2D}
 * @see {@link PibblBackendDriver}
 */
export interface PibblBackendFrame<E> {
  /** Backend environment used while evaluating the frame. See {@link PibblBackendFrame}. */
  readonly environment: E;
  /** Canvas 2D context used for the current frame. See {@link RenderingContext2D}. */
  readonly context2D?: RenderingContext2D;
  /** Current drawing target owned by the backend frame. See {@link RenderTargetSnapshot}. */
  readonly renderTarget?: RenderTargetSnapshot;
  /**
   * World transform establishing the backend frame's logical coordinate basis. See
   * {@link PibblBackendFrame}.
   */
  readonly worldBaseTransform?: DOMMatrix;
}

/**
 * Resolved inputs delivered to a backend primitive program.
 *
 * @see {@link PibblElementSource}
 * @see {@link PibblBackendPrimitiveDefinition}
 * @see {@link PibblBackendDriver}
 */
export interface PibblBackendPrimitiveInput {
  /** Component name retained for diagnostics. See {@link PibblBackendPrimitiveInput}. */
  readonly componentName: string;
  /** Authoring source location retained for diagnostics. See {@link PibblElementSource}. */
  readonly source?: PibblElementSource;
  /**
   * Primitive definition used to resolve and render the supplied inputs. See
   * {@link PibblBackendPrimitiveDefinition}.
   */
  readonly definition: PibblBackendPrimitiveDefinition;
  /**
   * Component props supplied to evaluation or measurement. See {@link PibblBackendPrimitiveInput}.
   */
  readonly props: Readonly<Record<PropertyKey, unknown>>;
  /** Declared presentation and layout properties. See {@link PibblBackendPrimitiveInput}. */
  readonly style: Readonly<Record<PropertyKey, unknown>>;
  /**
   * Transform applied to the primitive's presented Canvas geometry. See
   * {@link PibblBackendPrimitiveInput}.
   */
  readonly presentationTransform2D?: DOMMatrix;
}

/**
 * A mounted backend's frame execution and cleanup operations.
 *
 * @see {@link Canvas}
 * @see {@link PibblNode}
 * @see {@link PibblNestedResolverInput}
 * @see {@link mountBackendPibbl}
 */
export interface PibblBackendMount {
  /** Canvas surface associated with this resource or mount. See {@link Canvas}. */
  readonly canvas: Canvas;
  /**
   * Updates the backend surface to the supplied dimensions. See {@link PibblBackendMount}.
   * @param logicalWidth - New logical viewport width.
   * @param logicalHeight - New logical viewport height.
   */
  resize(logicalWidth: number, logicalHeight: number): void;
  /**
   * Renders the current data or resources using the supplied context. See {@link PibblBackendMount}
   * .
   * @param root - Node tree to render. See {@link PibblNode}.
   * @param timestamp - Frame timestamp in milliseconds.
   */
  render(root: PibblNode, timestamp: number): void;
  /**
   * Requests future work from the owning scheduler. See {@link PibblBackendMount}.
   * @param updateParents - Whether ancestor compositions also need to be scheduled.
   */
  requestFrame(updateParents: boolean): void;
  /** Releases resources owned by this mounted object. See {@link PibblBackendMount}. */
  dispose(): void;
}

/**
 * Version-coupled rendering backend lifecycle used by official integrations.
 *
 * @see {@link PibblBackendToken}
 * @see {@link PibblBackendFrameInput}
 * @see {@link PibblBackendFrame}
 * @see {@link PibblBackendPrimitiveInput}
 * @see {@link PibblNodeInput}
 * @see {@link PibblBackendMountOptions}
 */
export interface PibblBackendDriver<E> {
  /** Identity token distinguishing this backend driver. See {@link PibblBackendToken}. */
  readonly token: PibblBackendToken;
  /** Name identifying this backend, emitter, or parameter. See {@link PibblBackendDriver}. */
  readonly name: string;
  /**
   * Begins backend work for one shared scheduler frame. See {@link PibblBackendFrame}.
   * @param input - Root surface, timestamp, and logical dimensions for this render. See
   * {@link PibblBackendFrameInput} .
   * @returns Frame state, or undefined when no frame should be rendered. See
   * {@link PibblBackendFrame} .
   */
  beginFrame(input: PibblBackendFrameInput): PibblBackendFrame<E> | undefined;
  /**
   * Enters a component's backend evaluation scope. See {@link PibblBackendDriver}.
   * @param frame - Frame whose component environment should become active. See
   * {@link PibblBackendFrame} .
   * @returns A cleanup function restoring the previous environment.
   */
  enterComponent(frame: PibblBackendFrame<E>): () => void;
  /**
   * Runs a primitive's drawing program in the current backend frame. See {@link PibblBackendDriver}
   * .
   * @param frame - Active backend frame. See {@link PibblBackendFrame}.
   * @param input - Primitive descriptor and resolved rendering inputs. See
   * {@link PibblBackendPrimitiveInput} .
   * @param runProgram - Runtime callback used to invoke the primitive program. See
   * {@link PibblNodeInput} .
   */
  runPrimitive(
    frame: PibblBackendFrame<E>,
    input: PibblBackendPrimitiveInput,
    runProgram: (invoke: () => PibblNodeInput | void) => void,
  ): void;
  /**
   * Completes the backend frame and its pending composition work. See {@link PibblBackendDriver}.
   * @param frame - Frame returned by beginFrame. See {@link PibblBackendFrame}.
   * @param success - Whether traversal completed successfully.
   */
  finishFrame(frame: PibblBackendFrame<E>, success: boolean): void;
  /** Releases resources owned by this mounted object. See {@link PibblBackendDriver}. */
  dispose(): void;
}

/**
 * Canvas, configuration, and ownership inputs used to create a backend mount.
 *
 * @see {@link Canvas}
 * @see {@link PibblBackendDriver}
 * @see {@link mountBackendPibbl}
 */
export interface PibblBackendMountOptions<E> {
  /** Owning parent runtime instance. See {@link Canvas}. */
  readonly parent: Canvas;
  /** Canvas width in logical units. See {@link PibblBackendMountOptions}. */
  readonly logicalWidth: number;
  /** Canvas height in logical units. See {@link PibblBackendMountOptions}. */
  readonly logicalHeight: number;
  /** Backend driver responsible for this mount. See {@link PibblBackendDriver}. */
  readonly driver: PibblBackendDriver<E>;
}

/**
 * Backend target registration options with logical interaction geometry.
 *
 * @see {@link useBackendEventTarget}
 */
export interface PibblBackendEventTargetOptions extends PibblEventFocusOptions {
  /**
   * Cursor shown while this target owns pointer presentation. See
   * {@link PibblBackendEventTargetOptions}.
   */
  readonly cursor?: string;
  /** Defers backend-owned focus geometry until its visual generation commits. */
  readonly deferKeyboardNavigationGeometry?: boolean;
}

/**
 * Context supplied when resolving nested content through a backend.
 *
 * @see {@link PibblBackendMount}
 * @see {@link PibblHitTestOutput}
 * @see {@link registerNestedInteractionResolver}
 */
export interface PibblNestedResolverInput {
  /** Nested child content to resolve. See {@link PibblBackendMount}. */
  readonly child: PibblBackendMount;
  /** Logical region constraining the content or query. See {@link PibblNestedResolverInput}. */
  readonly bounds: Path2D;
  /** Whether this content participates in pointer targeting. See {@link PibblNestedResolverInput}. */
  readonly pointerEvents: 'auto' | 'none';
  /**
   * Resolves nested content in the current local coordinate system. See
   * {@link PibblNestedResolverInput}.
   * @param localX - Horizontal position in resolver-local coordinates.
   * @param localY - Vertical position in resolver-local coordinates.
   * @param output - Mutable hit-test result to populate. See {@link PibblHitTestOutput}.
   */
  resolveLocal(localX: number, localY: number, output: PibblHitTestOutput): void;
}

/** @internal */
export function backendMismatchError(
  componentName: string,
  required: PibblBackendToken,
  active: PibblBackendDriver<unknown>,
  source?: PibblElementSource,
): Error {
  const requiredName = getBackendTokenName(required);
  const prefix = `${componentName} requires the ${requiredName} backend and ` +
    `cannot render in the ${active.name} root.`;
  return new Error(withJSXSource(prefix, source));
}

function withJSXSource(message: string, source?: PibblElementSource): string {
  return source ?
      `${message} JSX source: ${source.fileName}:${source.lineNumber}:${source.columnNumber}.` :
    message;
}

export type { PibblEventHandlers };
