/** Text direction used by {@link LayoutConstraints}. */
export type LayoutDirection = "ltr" | "rtl";
/** Main-axis direction accepted by {@link LayoutStyle}. */
export type LayoutFlexDirection =
  "row" | "row-reverse" | "column" | "column-reverse";
/** Line-wrapping policy accepted by {@link LayoutStyle}. */
export type LayoutWrap = "nowrap" | "wrap" | "wrap-reverse";
/** Cross-axis alignment accepted by {@link LayoutStyle}. */
export type LayoutAlign =
  | "auto"
  | "flex-start"
  | "flex-end"
  | "center"
  | "stretch"
  | "baseline"
  | "first-baseline"
  | "last-baseline";
/** Positioning mode accepted by {@link LayoutStyle}. */
export type LayoutPosition = "relative" | "static" | "absolute";
/** Overflow policy accepted by {@link LayoutStyle}. */
export type LayoutOverflow = "visible" | "clip";
/** Intrinsic track keyword accepted by {@link LayoutTrackBreadth}. */
export type LayoutSizingKeyword = "min-content" | "max-content";
/** Immutable capped intrinsic track returned by the {@link LayoutStyle} constructor. */
export interface LayoutFitContentTrack {
  /** Stable discriminant for a capped intrinsic track. */
  readonly kind: "fit-content";
  /** Finite or percentage cap resolved against the Grid owner axis. */
  readonly limit: number | `${number}%`;
}
/** One track breadth accepted by {@link LayoutGridTrack}. */
export type LayoutTrackBreadth =
  | number
  | `${number}%`
  | `${number}fr`
  | LayoutSizingKeyword
  | "auto"
  | LayoutFitContentTrack;
/** Immutable minimum and maximum breadth pair returned by {@link LayoutStyle}. */
export interface LayoutMinMaxTrack {
  /** Stable discriminant for a minimum/maximum pair. */
  readonly kind: "minmax";
  /** Lower Grid track breadth. */
  readonly min: LayoutTrackBreadth;
  /** Upper Grid track breadth. */
  readonly max: LayoutTrackBreadth;
}
/** Immutable repeated track sequence returned by {@link LayoutStyle}. */
export interface LayoutRepeatTrack {
  /** Stable discriminant for a repeated sequence. */
  readonly kind: "repeat";
  /** Fixed count or owner-axis automatic repeat policy. */
  readonly count: number | "auto-fill" | "auto-fit";
  /** Track sequence repeated by this definition. */
  readonly tracks: readonly LayoutGridTrack[];
}
/** Any explicit Grid track accepted by {@link LayoutStyle}. */
export type LayoutGridTrack =
  LayoutTrackBreadth | LayoutMinMaxTrack | LayoutRepeatTrack;
/** Container algorithm selected by {@link LayoutStyle}. */
export type LayoutMode = "flex" | "grid";
/** Box dimension convention selected by {@link LayoutStyle}. */
export type LayoutBoxSizing = "content-box" | "border-box";
/** Scalar, owner-relative percentage, or automatic length accepted by {@link LayoutStyle}. */
export type LayoutLength = number | `${number}%` | "auto";
/** Physical edge values used by {@link LayoutStyle}. */
export interface LayoutEdges {
  /** Physical top edge. */
  readonly top: number;
  /** Physical right edge. */
  readonly right: number;
  /** Physical bottom edge. */
  readonly bottom: number;
  /** Physical left edge. */
  readonly left: number;
}
/** Renderer-neutral style vocabulary consumed by {@link LayoutTree}. */
export interface LayoutStyle {
  /** Selects Flex or explicit Grid placement. */ readonly layout?: LayoutMode;
  /** Declared inline size. */ readonly width?: LayoutLength;
  /** Declared block size. */ readonly height?: LayoutLength;
  /** Minimum inline size. */ readonly minWidth?: LayoutLength;
  /** Minimum block size. */ readonly minHeight?: LayoutLength;
  /** Maximum inline size. */ readonly maxWidth?: LayoutLength;
  /** Maximum block size. */ readonly maxHeight?: LayoutLength;
  /** Flex main-size basis. */ readonly flexBasis?: LayoutLength;
  /** Explicit Grid column tracks. */ readonly gridTemplateColumns?: readonly LayoutGridTrack[];
  /** Explicit Grid row tracks. */ readonly gridTemplateRows?: readonly LayoutGridTrack[];
  /** Implicit Grid column track. */ readonly gridAutoColumns?: LayoutGridTrack;
  /** Implicit Grid row track. */ readonly gridAutoRows?: LayoutGridTrack;
  /** Source-order Grid placement policy. */ readonly gridAutoFlow?:
    "row" | "column" | "row dense" | "column dense";
  /** One-based Grid column start. */ readonly gridColumnStart?: number;
  /** Grid column span. */ readonly gridColumnSpan?: number;
  /** One-based Grid row start. */ readonly gridRowStart?: number;
  /** Grid row span. */ readonly gridRowSpan?: number;
  /** Flex grow factor. */ readonly flexGrow?: number;
  /** Flex shrink factor. */ readonly flexShrink?: number;
  /** Flex main-axis direction. */ readonly flexDirection?: LayoutFlexDirection;
  /** Flex line wrapping policy. */ readonly flexWrap?: LayoutWrap;
  /** Main-axis distribution. */ readonly justifyContent?:
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | "space-evenly";
  /** Container cross-axis alignment. */ readonly alignItems?: Exclude<
    LayoutAlign,
    "auto"
  >;
  /** Item-level cross-axis alignment. */ readonly alignSelf?: LayoutAlign;
  /** Multi-line cross-axis distribution. */ readonly alignContent?:
    | "flex-start"
    | "flex-end"
    | "center"
    | "stretch"
    | "space-between"
    | "space-around"
    | "space-evenly";
  /** Shared inter-item gap. */ readonly gap?: number | `${number}%`;
  /** Row gap override. */ readonly rowGap?: number | `${number}%`;
  /** Column gap override. */ readonly columnGap?: number | `${number}%`;
  /** Shared physical margin. */ readonly margin?: LayoutLength;
  /** Physical top margin. */ readonly marginTop?: LayoutLength;
  /** Physical right margin. */ readonly marginRight?: LayoutLength;
  /** Physical bottom margin. */ readonly marginBottom?: LayoutLength;
  /** Physical left margin. */ readonly marginLeft?: LayoutLength;
  /** Shared or physical-edge padding. */ readonly padding?:
    number | `${number}%` | Readonly<Partial<LayoutEdges>>;
  /** Shared or physical-edge border width. */ readonly borderWidth?:
    number | Readonly<Partial<LayoutEdges>>;
  /** Content or border-box sizing convention. */ readonly boxSizing?: LayoutBoxSizing;
  /** Positive width-to-height ratio. */ readonly aspectRatio?: number;
  /** Relative, static, or absolute positioning. */ readonly position?: LayoutPosition;
  /** Physical left inset. */ readonly left?: LayoutLength;
  /** Physical top inset. */ readonly top?: LayoutLength;
  /** Physical right inset. */ readonly right?: LayoutLength;
  /** Physical bottom inset. */ readonly bottom?: LayoutLength;
  /** Visible or clipped overflow. */ readonly overflow?: LayoutOverflow;
}
/** Immutable physical box returned by {@link LayoutSnapshot}. */
export interface LayoutBox {
  /** Physical x coordinate. */ readonly x: number;
  /** Physical y coordinate. */ readonly y: number;
  /** Nonnegative outer width. */ readonly width: number;
  /** Nonnegative outer height. */ readonly height: number;
}
/** Finite owner constraints supplied to {@link LayoutTree.calculateLayout}. */
export interface LayoutConstraints {
  /** Finite nonnegative available width. */ readonly width: number;
  /** Finite nonnegative available height. */ readonly height: number;
  /** Optional inherited text direction. */ readonly direction?: LayoutDirection;
}
/** One measurement-axis envelope passed to {@link LayoutMeasure}. */
export interface LayoutAxisConstraint {
  /** Inclusive lower bound. */ readonly minimum: number;
  /** Inclusive upper bound. */ readonly maximum: number;
}
/** Final size envelope passed to {@link LayoutMeasure}. */
export interface LayoutMeasureInput {
  /** Width envelope. */ readonly width: LayoutAxisConstraint;
  /** Height envelope. */ readonly height: LayoutAxisConstraint;
}
/** Finite measured size returned from {@link LayoutMeasure}. */
export interface LayoutMeasureResult {
  /** Measured width. */ readonly width: number;
  /** Measured height. */ readonly height: number;
}
/**
 * Synchronous final-size callback owned by a {@link LayoutNodeInput}.
 * @param input - Native finite measurement envelope.
 * @returns A finite measured box.
 */
export type LayoutMeasure = (input: LayoutMeasureInput) => LayoutMeasureResult;
/** Paired Grid contributions consumed by {@link LayoutIntrinsicMeasure}. */
export interface LayoutIntrinsicMeasureResult {
  /** Minimum width contribution. */ readonly minWidth: number;
  /** Maximum width contribution. */ readonly maxWidth: number;
  /** Minimum height contribution. */ readonly minHeight: number;
  /** Maximum height contribution. */ readonly maxHeight: number;
}
/**
 * Synchronous paired intrinsic contribution callback for a {@link LayoutNodeInput}.
 * @returns Ordered minimum and maximum axis contributions.
 */
export type LayoutIntrinsicMeasure = () => LayoutIntrinsicMeasureResult;
/** Initial declaration accepted by {@link LayoutTree.createNode}. */
export interface LayoutNodeInput {
  /** Initial immutable style. */ readonly style?: Readonly<LayoutStyle>;
  /** Optional final-size callback. */ readonly measure?: LayoutMeasure;
  /** Optional paired intrinsic Grid callback. */ readonly measureIntrinsic?: LayoutIntrinsicMeasure;
}
/** Opaque node handle created by {@link LayoutTree}. */
export interface LayoutNode {
  /** Stable tree-local identifier. */ readonly id: number;
}
/** One changed box in a {@link LayoutSnapshot}. */
export interface LayoutChange {
  /** Changed owned node. */ readonly node: LayoutNode;
  /** Prior box, if this node was in the prior snapshot. */ readonly previous:
    LayoutBox | undefined;
  /** Newly calculated box. */ readonly box: LayoutBox;
}
/** Immutable result returned by {@link LayoutTree.calculateLayout}. */
export interface LayoutSnapshot {
  /** Monotonic calculation revision. */ readonly revision: number;
  /** Calculated root node. */ readonly root: LayoutNode;
  /** Nodes whose boxes changed at this revision. */ readonly changes: readonly LayoutChange[];
  /**
   * Gets one reachable node box.
   * @param node - Owned node to inspect.
   * @returns The immutable physical box.
   */ getBox(node: LayoutNode): LayoutBox;
  /**
   * Tests whether one node is reachable from this snapshot root.
   * @param node - Owned node to inspect.
   * @returns Whether the node is present.
   */ has(node: LayoutNode): boolean;
}
/** Mutable owned tree returned by {@link LayoutStyle}. */
export interface LayoutTree {
  /**
   * Creates one detached owned node.
   * @param input - Initial node declaration.
   * @returns A stable tree-local handle.
   */ createNode(input?: LayoutNodeInput): LayoutNode;
  /**
   * Appends a detached child.
   * @param parent - Destination parent.
   * @param child - Detached owned child.
   */ appendChild(parent: LayoutNode, child: LayoutNode): void;
  /**
   * Inserts a detached child at a source-order index.
   * @param parent - Destination parent.
   * @param child - Detached owned child.
   * @param index - Insertion index.
   */ insertChild(parent: LayoutNode, child: LayoutNode, index: number): void;
  /**
   * Detaches an owned child.
   * @param parent - Existing parent.
   * @param child - Existing child.
   */ removeChild(parent: LayoutNode, child: LayoutNode): void;
  /**
   * Replaces selected style fields.
   * @param node - Node to update.
   * @param patch - Partial immutable style.
   */ setStyle(node: LayoutNode, patch: Readonly<Partial<LayoutStyle>>): void;
  /**
   * Calculates one immutable snapshot.
   * @param input - Root and finite owner constraints.
   * @returns The next immutable snapshot.
   */ calculateLayout(
    input: Readonly<LayoutConstraints> & {
      /** Root node for this calculation. */ readonly root: LayoutNode;
    },
  ): LayoutSnapshot;
  /** Releases native tree resources. */ dispose(): void;
}
/** Severity emitted by {@link Yoga32Diagnostic}. */
export type Yoga32DiagnosticSeverity = "error" | "warning" | "info";
/** One versioned Yoga conversion finding for a {@link LayoutStyle}. */
export interface Yoga32Diagnostic {
  /** Finding severity. */ readonly severity: Yoga32DiagnosticSeverity;
  /** Stable diagnostic code. */ readonly code: string;
  /** Source-tree path. */ readonly path: readonly number[];
  /** Source property. */ readonly property: string;
  /** Human-readable explanation. */ readonly message: string;
  /** Suggested explicit replacement. */ readonly replacement?: string;
  /** Whether applying the change can alter geometry. */ readonly geometryMayChange: boolean;
}
/** Opaque Yoga source style accepted by {@link LayoutStyle}. */
export interface Yoga32StyleInput {
  readonly [property: string]: unknown;
}
/** Explicit compatibility profile for {@link LayoutStyle}. */
export interface Yoga32ConversionOptions {
  /** Whether source Yoga used web defaults. */ readonly useWebDefaults?: boolean;
  /** Source writing direction. */ readonly direction?: LayoutDirection;
  /** Source point scale factor. */ readonly pointScaleFactor?: number;
  /** Source errata flags. */ readonly errata?: readonly string[];
}
/** Executable standalone style produced by {@link LayoutStyle}. */
export interface Yoga32ConvertedStyle {
  /** Converted standalone style. */ readonly style: Readonly<LayoutStyle>;
  /** Whether source measurement must be revised manually. */ readonly measurementRevisionRequired: boolean;
}
/** Conversion result returned by {@link LayoutStyle}. */
export interface Yoga32ConvertedStyleResult {
  /** Executable value when no error exists. */ readonly value:
    Yoga32ConvertedStyle | undefined;
  /** Complete conversion findings. */ readonly diagnostics: readonly Yoga32Diagnostic[];
}
/** Yoga source-tree node accepted by {@link LayoutStyle}. */
export interface Yoga32TreeInput {
  /** Source style object. */ readonly style?: Yoga32StyleInput;
  /** Source children. */ readonly children?: readonly Yoga32TreeInput[];
  /** Presence marker for a source measure callback. */ readonly measure?: "present";
  /** Presence marker for a source baseline callback. */ readonly baseline?: "present";
  /** Yoga reference-baseline marker. */ readonly isReferenceBaseline?: boolean;
  /** Node-local compatibility profile. */ readonly config?: Yoga32ConversionOptions;
}
/** Aggregate report returned by {@link LayoutStyle}. */
export interface Yoga32MigrationReport {
  /** All source diagnostics. */ readonly diagnostics: readonly Yoga32Diagnostic[];
  /** Whether every source node can be converted. */ readonly convertible: boolean;
  /** Visited source node count. */ readonly nodeCount: number;
  /** Source nodes containing an error. */ readonly unsupportedNodeCount: number;
}
