import type { CRCElementSource } from '../element/metadata.js';
import type { CRCNode } from '../element/types.js';
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

/** Opaque identity for one official CRC rendering backend. */
export interface CRCBackendToken {
  readonly [CRC_BACKEND_TOKEN]: true;
}

const backendNames = new WeakMap<CRCBackendToken, string>();

/** Creates a package-private backend identity for an official CRC renderer. */
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

export type CRCBackendPrimitiveProgram<
  P = any,
  R extends SystemStyle = SystemStyle,
  E = any,
> = (
  props: Readonly<PrimitiveProgramProps<P>>,
  style: ResolvedStyle<R>,
  environment: E,
) => CRCNode[] | CRCNode | void;

export interface CRCBackendPrimitiveDefinition<
  P = any,
  S extends SystemStyle = SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
  E = any,
> {
  readonly backend: CRCBackendToken;
  readonly preserveSignalProps?: readonly PreservedSignalPropKey<P>[];
  readonly childInput?: 'structural' | 'text';
  readonly program: CRCBackendPrimitiveProgram<P, R, E>;
  /** @internal Legacy metadata name retained for focused primitive tests. */
  readonly render: CRCBackendPrimitiveProgram<P, R, E>;
  readonly normalizeStyle?: (
    style: SpecifiedStyle<S>,
  ) => NormalizedStyle<N>;
  readonly resolveStyle?: (
    style: NormalizedStyle<N>,
    context: Readonly<StyleResolutionContext>,
  ) => ResolvedStyle<R>;
  readonly measure?: (
    input: MeasureInput<PrimitiveProgramProps<P>, N>,
  ) => MeasureResult;
}

export interface CRCBackendFrameInput {
  readonly canvas: Canvas;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly backingWidth: number;
  readonly backingHeight: number;
  readonly renderTimestamp: number;
}

export interface CRCBackendFrame<E> {
  readonly environment: E;
  readonly context2D?: RenderingContext2D;
  readonly renderTarget?: RenderTargetSnapshot;
  readonly worldBaseTransform?: DOMMatrix;
}

export interface CRCBackendPrimitiveInput {
  readonly componentName: string;
  readonly source?: CRCElementSource;
  readonly definition: CRCBackendPrimitiveDefinition;
  readonly props: Readonly<Record<PropertyKey, unknown>>;
  readonly style: Readonly<Record<PropertyKey, unknown>>;
  readonly presentationTransform2D?: DOMMatrix;
}

export interface CRCBackendMount {
  readonly canvas: Canvas;
  resize(logicalWidth: number, logicalHeight: number): void;
  render(root: CRCNode, timestamp: number): void;
  requestFrame(updateParents: boolean): void;
  /** @internal Cancels queued work without disposing retained backend state. */
  cancelFrame(): void;
  /** @internal Replaces the retained root without scheduling traversal. */
  retainRoot(root: CRCNode): void;
  dispose(): void;
}

export interface CRCBackendDriver<E> {
  readonly token: CRCBackendToken;
  readonly name: string;
  beginFrame(input: CRCBackendFrameInput): CRCBackendFrame<E> | undefined;
  enterComponent(frame: CRCBackendFrame<E>): () => void;
  runPrimitive(
    frame: CRCBackendFrame<E>,
    input: CRCBackendPrimitiveInput,
    runProgram: (invoke: () => CRCNode | void) => void,
  ): void;
  finishFrame(frame: CRCBackendFrame<E>, success: boolean): void;
  dispose(): void;
}

export interface CRCBackendMountOptions<E> {
  readonly parent: Canvas;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly driver: CRCBackendDriver<E>;
}

export interface CRCBackendEventTargetOptions extends CRCEventFocusOptions {
  readonly cursor?: string;
  /** Defers backend-owned focus geometry until its visual generation commits. */
  readonly deferKeyboardNavigationGeometry?: boolean;
}

export interface CRCNestedResolverInput {
  readonly child: CRCBackendMount;
  readonly bounds: Path2D;
  readonly pointerEvents: 'auto' | 'none';
  resolveLocal(
    localX: number,
    localY: number,
    output: CRCHitTestOutput,
  ): void;
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
  if (requiredName === 'webgl2' && active.name === 'canvas2d') {
    return new Error(withJSXSource(`${prefix} Place it under <WebGLLayer>.`, source));
  }
  if (requiredName === 'canvas2d' && active.name === 'webgl2') {
    return new Error(
      withJSXSource(
        `${prefix} Canvas 2D children inside a WebGL island are unsupported.`,
        source,
      ),
    );
  }
  return new Error(withJSXSource(prefix, source));
}

function withJSXSource(message: string, source?: CRCElementSource): string {
  return source ?
      `${message} JSX source: ${source.fileName}:${source.lineNumber}:${source.columnNumber}.` :
    message;
}

export type { CRCEventHandlers };
