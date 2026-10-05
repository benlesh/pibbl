import type { registerNestedInteractionResolver, useBackendEventTarget } from '../../internal.js';
import type { mountBackendCRC } from '../mount-crc.js';
import type { defineBackendPrimitive } from '../define-primitive.js';
import type { CRCElementSource } from '../element/metadata.js';
import type { CRCNode, CRCNodeInput } from '../element/types.js';
import type { CRCHitTestOutput } from '../events/paint-entry.js';
import type { CRCEventFocusOptions, CRCEventHandlers } from '../events/types.js';
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

declare const CRC_BACKEND_TOKEN: unique symbol;

/**
 * Opaque identity for one official CRC rendering backend.
 *
 * @see {@link createBackendToken}
 * @see {@link CRCBackendDriver}
 * @see {@link CRCBackendPrimitiveDefinition}
 */
export interface CRCBackendToken {
  readonly [CRC_BACKEND_TOKEN]: true;
}

const backendNames = new WeakMap<CRCBackendToken, string>();

/**
 * Creates a package-private backend identity for an official CRC renderer.
 *
 * @param name - Diagnostic name identifying the backend.
 * @returns A unique backend identity token. See {@link CRCBackendToken}.
 *
 * @see {@link CRCBackendToken}
 */
export function createBackendToken(name: string): CRCBackendToken {
  if (!name.trim()) {
    throw new Error('CRC backend names must be nonempty.');
  }
  const token = Object.freeze({}) as CRCBackendToken;
  backendNames.set(token, name);
  return token;
}

/** @internal Used only for diagnostics and dispatch inside core. */
export function getBackendTokenName(token: CRCBackendToken): string {
  return backendNames.get(token) ?? 'unknown';
}

/**
 * Executable primitive rendering program recognized by the backend.
 *
 * @param props - Resolved non-style component inputs. See {@link PrimitiveProgramProps}.
 * @param style - Resolved primitive style. See {@link ResolvedStyle}.
 * @param environment - Backend environment for the active frame.
 * @returns Child nodes to traverse, or no children. See {@link CRCNodeInput}.
 *
 * @see {@link SystemStyle}
 * @see {@link PrimitiveProgramProps}
 * @see {@link ResolvedStyle}
 * @see {@link CRCNodeInput}
 * @see {@link CRCBackendPrimitiveDefinition}
 * @see {@link defineBackendPrimitive}
 */
export type CRCBackendPrimitiveProgram<
  P = any,
  R extends SystemStyle = SystemStyle,
  E = any,
> = (
  props: Readonly<PrimitiveProgramProps<P>>,
  style: ResolvedStyle<R>,
  environment: E,
) => CRCNodeInput | void;

/**
 * Rendering, style, and measurement definition of a backend primitive.
 *
 * @see {@link SystemStyle}
 * @see {@link CRCBackendToken}
 * @see {@link CRCBackendPrimitiveProgram}
 * @see {@link SpecifiedStyle}
 * @see {@link NormalizedStyle}
 * @see {@link StyleResolutionContext}
 * @see {@link ResolvedStyle}
 * @see {@link MeasureInput}
 * @see {@link PrimitiveProgramProps}
 * @see {@link MeasureResult}
 * @see {@link CRCBackendPrimitiveInput}
 */
export interface CRCBackendPrimitiveDefinition<
  P = any,
  S extends SystemStyle = SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
  E = any,
> {
  /** Identity of the backend that accepts this primitive. See {@link CRCBackendToken}. */
  readonly backend: CRCBackendToken;
  /**
   * Names props whose signal identity is preserved for the primitive program. See
   * {@link PreservedSignalPropKey}.
   */
  readonly preserveSignalProps?: readonly PreservedSignalPropKey<P>[];
  /**
   * Declares how the primitive receives and resolves its children. See
   * {@link CRCBackendPrimitiveDefinition}.
   */
  readonly childInput?: 'structural' | 'text';
  /** Executable primitive program used by the backend. See {@link CRCBackendPrimitiveProgram}. */
  readonly program: CRCBackendPrimitiveProgram<P, R, E>;
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
 * @see {@link CRCBackendDriver}
 */
export interface CRCBackendFrameInput {
  /** Canvas surface associated with this resource or mount. See {@link Canvas}. */
  readonly canvas: Canvas;
  /** Canvas width in logical units. See {@link CRCBackendFrameInput}. */
  readonly logicalWidth: number;
  /** Canvas height in logical units. See {@link CRCBackendFrameInput}. */
  readonly logicalHeight: number;
  /** Width of the backing raster in physical pixels. See {@link CRCBackendFrameInput}. */
  readonly backingWidth: number;
  /** Height of the backing raster in physical pixels. See {@link CRCBackendFrameInput}. */
  readonly backingHeight: number;
  /** Timestamp associated with this render frame. See {@link CRCBackendFrameInput}. */
  readonly renderTimestamp: number;
}

/**
 * The backend rendering context for one scheduled frame.
 *
 * @see {@link RenderingContext2D}
 * @see {@link CRCBackendDriver}
 */
export interface CRCBackendFrame<E> {
  /** Backend environment used while evaluating the frame. See {@link CRCBackendFrame}. */
  readonly environment: E;
  /** Canvas 2D context used for the current frame. See {@link RenderingContext2D}. */
  readonly context2D?: RenderingContext2D;
  /** Current drawing target owned by the backend frame. See {@link RenderTargetSnapshot}. */
  readonly renderTarget?: RenderTargetSnapshot;
  /**
   * World transform establishing the backend frame's logical coordinate basis. See
   * {@link CRCBackendFrame}.
   */
  readonly worldBaseTransform?: DOMMatrix;
}

/**
 * Resolved inputs delivered to a backend primitive program.
 *
 * @see {@link CRCElementSource}
 * @see {@link CRCBackendPrimitiveDefinition}
 * @see {@link CRCBackendDriver}
 */
export interface CRCBackendPrimitiveInput {
  /** Component name retained for diagnostics. See {@link CRCBackendPrimitiveInput}. */
  readonly componentName: string;
  /** Authoring source location retained for diagnostics. See {@link CRCElementSource}. */
  readonly source?: CRCElementSource;
  /**
   * Primitive definition used to resolve and render the supplied inputs. See
   * {@link CRCBackendPrimitiveDefinition}.
   */
  readonly definition: CRCBackendPrimitiveDefinition;
  /**
   * Component props supplied to evaluation or measurement. See {@link CRCBackendPrimitiveInput}.
   */
  readonly props: Readonly<Record<PropertyKey, unknown>>;
  /** Declared presentation and layout properties. See {@link CRCBackendPrimitiveInput}. */
  readonly style: Readonly<Record<PropertyKey, unknown>>;
  /**
   * Transform applied to the primitive's presented Canvas geometry. See
   * {@link CRCBackendPrimitiveInput}.
   */
  readonly presentationTransform2D?: DOMMatrix;
}

/**
 * A mounted backend's frame execution and cleanup operations.
 *
 * @see {@link Canvas}
 * @see {@link CRCNode}
 * @see {@link CRCNestedResolverInput}
 * @see {@link mountBackendCRC}
 */
export interface CRCBackendMount {
  /** Canvas surface associated with this resource or mount. See {@link Canvas}. */
  readonly canvas: Canvas;
  /**
   * Updates the backend surface to the supplied dimensions. See {@link CRCBackendMount}.
   * @param logicalWidth - New logical viewport width.
   * @param logicalHeight - New logical viewport height.
   */
  resize(logicalWidth: number, logicalHeight: number): void;
  /**
   * Renders the current data or resources using the supplied context. See {@link CRCBackendMount}
   * .
   * @param root - Node tree to render. See {@link CRCNode}.
   * @param timestamp - Frame timestamp in milliseconds.
   */
  render(root: CRCNode, timestamp: number): void;
  /**
   * Requests future work from the owning scheduler. See {@link CRCBackendMount}.
   * @param updateParents - Whether ancestor compositions also need to be scheduled.
   */
  requestFrame(updateParents: boolean): void;
  /** Releases resources owned by this mounted object. See {@link CRCBackendMount}. */
  dispose(): void;
}

/**
 * Version-coupled rendering backend lifecycle used by official integrations.
 *
 * @see {@link CRCBackendToken}
 * @see {@link CRCBackendFrameInput}
 * @see {@link CRCBackendFrame}
 * @see {@link CRCBackendPrimitiveInput}
 * @see {@link CRCNodeInput}
 * @see {@link CRCBackendMountOptions}
 */
export interface CRCBackendDriver<E> {
  /** Identity token distinguishing this backend driver. See {@link CRCBackendToken}. */
  readonly token: CRCBackendToken;
  /** Name identifying this backend, emitter, or parameter. See {@link CRCBackendDriver}. */
  readonly name: string;
  /**
   * Begins backend work for one shared scheduler frame. See {@link CRCBackendFrame}.
   * @param input - Root surface, timestamp, and logical dimensions for this render. See
   * {@link CRCBackendFrameInput} .
   * @returns Frame state, or undefined when no frame should be rendered. See
   * {@link CRCBackendFrame} .
   */
  beginFrame(input: CRCBackendFrameInput): CRCBackendFrame<E> | undefined;
  /**
   * Enters a component's backend evaluation scope. See {@link CRCBackendDriver}.
   * @param frame - Frame whose component environment should become active. See
   * {@link CRCBackendFrame} .
   * @returns A cleanup function restoring the previous environment.
   */
  enterComponent(frame: CRCBackendFrame<E>): () => void;
  /**
   * Runs a primitive's drawing program in the current backend frame. See {@link CRCBackendDriver}
   * .
   * @param frame - Active backend frame. See {@link CRCBackendFrame}.
   * @param input - Primitive descriptor and resolved rendering inputs. See
   * {@link CRCBackendPrimitiveInput} .
   * @param runProgram - Runtime callback used to invoke the primitive program. See
   * {@link CRCNodeInput} .
   */
  runPrimitive(
    frame: CRCBackendFrame<E>,
    input: CRCBackendPrimitiveInput,
    runProgram: (invoke: () => CRCNodeInput | void) => void,
  ): void;
  /**
   * Completes the backend frame and its pending composition work. See {@link CRCBackendDriver}.
   * @param frame - Frame returned by beginFrame. See {@link CRCBackendFrame}.
   * @param success - Whether traversal completed successfully.
   */
  finishFrame(frame: CRCBackendFrame<E>, success: boolean): void;
  /** Releases resources owned by this mounted object. See {@link CRCBackendDriver}. */
  dispose(): void;
}

/**
 * Canvas, configuration, and ownership inputs used to create a backend mount.
 *
 * @see {@link Canvas}
 * @see {@link CRCBackendDriver}
 * @see {@link mountBackendCRC}
 */
export interface CRCBackendMountOptions<E> {
  /** Owning parent runtime instance. See {@link Canvas}. */
  readonly parent: Canvas;
  /** Canvas width in logical units. See {@link CRCBackendMountOptions}. */
  readonly logicalWidth: number;
  /** Canvas height in logical units. See {@link CRCBackendMountOptions}. */
  readonly logicalHeight: number;
  /** Backend driver responsible for this mount. See {@link CRCBackendDriver}. */
  readonly driver: CRCBackendDriver<E>;
}

/**
 * Backend target registration options with logical interaction geometry.
 *
 * @see {@link useBackendEventTarget}
 */
export interface CRCBackendEventTargetOptions extends CRCEventFocusOptions {
  /**
   * Cursor shown while this target owns pointer presentation. See
   * {@link CRCBackendEventTargetOptions}.
   */
  readonly cursor?: string;
  /** Defers backend-owned focus geometry until its visual generation commits. */
  readonly deferKeyboardNavigationGeometry?: boolean;
}

/**
 * Context supplied when resolving nested content through a backend.
 *
 * @see {@link CRCBackendMount}
 * @see {@link CRCHitTestOutput}
 * @see {@link registerNestedInteractionResolver}
 */
export interface CRCNestedResolverInput {
  /** Nested child content to resolve. See {@link CRCBackendMount}. */
  readonly child: CRCBackendMount;
  /** Logical region constraining the content or query. See {@link CRCNestedResolverInput}. */
  readonly bounds: Path2D;
  /** Whether this content participates in pointer targeting. See {@link CRCNestedResolverInput}. */
  readonly pointerEvents: 'auto' | 'none';
  /**
   * Resolves nested content in the current local coordinate system. See
   * {@link CRCNestedResolverInput}.
   * @param localX - Horizontal position in resolver-local coordinates.
   * @param localY - Vertical position in resolver-local coordinates.
   * @param output - Mutable hit-test result to populate. See {@link CRCHitTestOutput}.
   */
  resolveLocal(localX: number, localY: number, output: CRCHitTestOutput): void;
}

/** @internal */
export function backendMismatchError(
  componentName: string,
  required: CRCBackendToken,
  active: CRCBackendDriver<unknown>,
  source?: CRCElementSource,
): Error {
  const requiredName = getBackendTokenName(required);
  const prefix = `${componentName} requires the ${requiredName} backend and ` +
    `cannot render in the ${active.name} root.`;
  return new Error(withJSXSource(prefix, source));
}

function withJSXSource(message: string, source?: CRCElementSource): string {
  return source ?
      `${message} JSX source: ${source.fileName}:${source.lineNumber}:${source.columnNumber}.` :
    message;
}

export type { CRCEventHandlers };
