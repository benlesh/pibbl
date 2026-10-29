import type {
  LayoutStyle,
  Yoga32ConvertedStyle,
  Yoga32ConvertedStyleResult,
  Yoga32ConversionOptions,
  Yoga32Diagnostic,
  Yoga32MigrationReport,
  Yoga32StyleInput,
  Yoga32TreeInput,
} from "./types.js";

const allowed = new Set<keyof LayoutStyle>([
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "flexBasis",
  "flexGrow",
  "flexShrink",
  "flexDirection",
  "flexWrap",
  "justifyContent",
  "alignItems",
  "alignSelf",
  "alignContent",
  "gap",
  "rowGap",
  "columnGap",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "padding",
  "borderWidth",
  "boxSizing",
  "aspectRatio",
  "position",
  "left",
  "top",
  "right",
  "bottom",
  "overflow",
]);
const aliases: Readonly<Record<string, keyof LayoutStyle>> = Object.freeze({
  flex_direction: "flexDirection",
  flex_wrap: "flexWrap",
  justify_content: "justifyContent",
  align_items: "alignItems",
  align_self: "alignSelf",
  align_content: "alignContent",
  flex_grow: "flexGrow",
  flex_shrink: "flexShrink",
  flex_basis: "flexBasis",
  min_width: "minWidth",
  min_height: "minHeight",
  max_width: "maxWidth",
  max_height: "maxHeight",
  margin_left: "marginLeft",
  margin_right: "marginRight",
  margin_top: "marginTop",
  margin_bottom: "marginBottom",
  border_width: "borderWidth",
  box_sizing: "boxSizing",
  aspect_ratio: "aspectRatio",
});
function diagnostic(
  severity: Yoga32Diagnostic["severity"],
  code: string,
  property: string,
  message: string,
  geometryMayChange: boolean,
  replacement?: string,
  path: readonly number[] = [],
): Yoga32Diagnostic {
  return Object.freeze({
    severity,
    code,
    property,
    message,
    geometryMayChange,
    replacement,
    path: Object.freeze([...path]),
  });
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function isLength(value: unknown): value is number | `${number}%` | "auto" {
  return (
    value === "auto" ||
    isFiniteNumber(value) ||
    (typeof value === "string" && /^-?(?:\d+|\d*\.\d+)%$/.test(value))
  );
}

/**
 * Converts one explicit Yoga 3.2 style under a declared {@link Yoga32ConversionOptions} profile.
 * @param style - Source Yoga style object.
 * @param options - Explicit source compatibility profile.
 * @returns A value or actionable conversion diagnostics.
 */
export function convertYoga32Style(
  style: Yoga32StyleInput,
  options: Yoga32ConversionOptions = {},
): Yoga32ConvertedStyleResult {
  const diagnostics: Yoga32Diagnostic[] = [];
  type MutableStyle = { -readonly [K in keyof LayoutStyle]?: LayoutStyle[K] };
  const converted: MutableStyle = {};
  if (
    options.pointScaleFactor !== undefined &&
    (!isFiniteNumber(options.pointScaleFactor) || options.pointScaleFactor < 0)
  )
    diagnostics.push(
      diagnostic(
        "error",
        "invalid-point-scale",
        "pointScaleFactor",
        "Yoga point scale must be finite and nonnegative.",
        true,
      ),
    );
  if (options.errata?.length)
    diagnostics.push(
      diagnostic(
        "error",
        "unsupported-errata",
        "errata",
        "This converter only accepts the pinned Yoga 3.2.1 ErrataNone profile.",
        true,
        "Remove errata or analyze without executable conversion.",
      ),
    );
  for (const [sourceProperty, value] of Object.entries(style)) {
    if (sourceProperty === "isReferenceBaseline") {
      diagnostics.push(
        diagnostic(
          "error",
          "unsupported-reference-baseline",
          sourceProperty,
          "Yoga reference-baseline selection has no standalone Pibbl equivalent and is never silently replaced by last baseline.",
          true,
        ),
      );
      continue;
    }
    if (
      sourceProperty === "display" ||
      (sourceProperty === "overflow" && value === "scroll")
    ) {
      diagnostics.push(
        diagnostic(
          "error",
          "unsupported-yoga-style",
          sourceProperty,
          "This Yoga style needs an explicit host migration policy.",
          true,
        ),
      );
      continue;
    }
    if (sourceProperty === "flex") {
      diagnostics.push(
        diagnostic(
          "error",
          "ambiguous-flex-shorthand",
          sourceProperty,
          "Numeric Yoga flex must be expanded using the source binding defaults before conversion.",
          true,
          "Emit flexGrow, flexShrink, and flexBasis explicitly.",
        ),
      );
      continue;
    }
    const property =
      aliases[sourceProperty] ?? (sourceProperty as keyof LayoutStyle);
    if (!allowed.has(property)) {
      diagnostics.push(
        diagnostic(
          "error",
          "unsupported-yoga-style",
          sourceProperty,
          "The standalone Pibbl layout contract does not accept this Yoga property.",
          true,
        ),
      );
      continue;
    }
    const lengthProperty =
      property === "width" ||
      property === "height" ||
      property === "minWidth" ||
      property === "minHeight" ||
      property === "maxWidth" ||
      property === "maxHeight" ||
      property === "flexBasis" ||
      property === "margin" ||
      property === "marginLeft" ||
      property === "marginRight" ||
      property === "marginTop" ||
      property === "marginBottom" ||
      property === "left" ||
      property === "right" ||
      property === "top" ||
      property === "bottom";
    const numberProperty =
      property === "flexGrow" ||
      property === "flexShrink" ||
      property === "aspectRatio" ||
      property === "gap" ||
      property === "rowGap" ||
      property === "columnGap";
    const enumProperty =
      property === "flexDirection" ||
      property === "flexWrap" ||
      property === "justifyContent" ||
      property === "alignItems" ||
      property === "alignSelf" ||
      property === "alignContent" ||
      property === "boxSizing" ||
      property === "position" ||
      property === "overflow";
    const edgeProperty = property === "padding" || property === "borderWidth";
    if (lengthProperty && !isLength(value)) {
      diagnostics.push(
        diagnostic(
          "error",
          "invalid-style-value",
          sourceProperty,
          "Expected a numeric, percentage, auto, or omitted length.",
          true,
        ),
      );
      continue;
    }
    if (numberProperty && !isFiniteNumber(value)) {
      diagnostics.push(
        diagnostic(
          "error",
          "invalid-numeric-style",
          sourceProperty,
          "Expected a finite numeric Yoga style value.",
          true,
        ),
      );
      continue;
    }
    if (
      edgeProperty &&
      !(
        isFiniteNumber(value) ||
        (typeof value === "string" && /^-?(?:\d+|\d*\.\d+)%$/.test(value)) ||
        (value !== null && typeof value === "object")
      )
    ) {
      diagnostics.push(
        diagnostic(
          "error",
          "invalid-edge-style",
          sourceProperty,
          "Expected a numeric, percentage, or physical-edge value.",
          true,
        ),
      );
      continue;
    }
    if (!lengthProperty && !numberProperty && !edgeProperty && !enumProperty) {
      diagnostics.push(
        diagnostic(
          "error",
          "invalid-style-value",
          sourceProperty,
          "The Yoga value cannot be represented by the standalone layout style.",
          true,
        ),
      );
      continue;
    }
    (converted as Record<string, unknown>)[property] = value;
  }
  if (options.useWebDefaults) {
    if (converted.flexDirection === undefined) converted.flexDirection = "row";
    if (converted.flexShrink === undefined) converted.flexShrink = 1;
  } else {
    if (converted.flexDirection === undefined)
      converted.flexDirection = "column";
    if (converted.flexShrink === undefined) converted.flexShrink = 0;
  }
  if (converted.position === undefined) converted.position = "relative";
  if (converted.boxSizing === undefined) converted.boxSizing = "border-box";
  if (
    options.direction !== undefined &&
    options.direction !== "ltr" &&
    options.direction !== "rtl"
  )
    diagnostics.push(
      diagnostic(
        "error",
        "invalid-direction",
        "direction",
        "Expected ltr or rtl.",
        true,
      ),
    );
  const errors = diagnostics.some((item) => item.severity === "error");
  return Object.freeze({
    value: errors
      ? undefined
      : Object.freeze({
          style: Object.freeze(converted),
          measurementRevisionRequired:
            Object.hasOwn(style, "measure") ||
            Object.hasOwn(style, "markDirty"),
        }),
    diagnostics: Object.freeze(diagnostics),
  });
}

/**
 * Returns an executable converted style or throws for a failed {@link Yoga32ConvertedStyleResult}.
 * @param result - Conversion result to require.
 * @returns The converted standalone style.
 */
export function assertYoga32Converted(
  result: Yoga32ConvertedStyleResult,
): Yoga32ConvertedStyle {
  if (result.value) return result.value;
  throw new Error(
    `Yoga 3.2 conversion failed: ${result.diagnostics
      .filter((item) => item.severity === "error")
      .map((item) => `${item.property}: ${item.message}`)
      .join(" ")}`,
  );
}

/**
 * Analyzes a Yoga source tree without calculating or silently transforming it.
 * @param tree - Source tree to inspect.
 * @param options - Root compatibility profile.
 * @returns A complete {@link Yoga32MigrationReport}.
 */
export function analyzeYoga32Tree(
  tree: Yoga32TreeInput,
  options: Yoga32ConversionOptions = {},
): Yoga32MigrationReport {
  const diagnostics: Yoga32Diagnostic[] = [];
  let nodeCount = 0;
  let unsupportedNodeCount = 0;
  const visit = (
    node: Yoga32TreeInput,
    path: readonly number[],
    inherited: Yoga32ConversionOptions,
  ): void => {
    nodeCount++;
    const result = convertYoga32Style(node.style ?? {}, {
      ...inherited,
      ...node.config,
    });
    let unsupported = result.value === undefined;
    for (const item of result.diagnostics)
      diagnostics.push(
        Object.freeze({ ...item, path: Object.freeze([...path]) }),
      );
    if (node.isReferenceBaseline) {
      diagnostics.push(
        diagnostic(
          "error",
          "unsupported-reference-baseline",
          "isReferenceBaseline",
          "Yoga reference-baseline flags require an explicit migration decision.",
          true,
          undefined,
          path,
        ),
      );
      unsupported = true;
    }
    if (node.measure === "present")
      diagnostics.push(
        diagnostic(
          "info",
          "measure-callback-review",
          "measure",
          "Move the synchronous callback to the owned LayoutNode measure input and advance its host revision when content changes.",
          false,
          undefined,
          path,
        ),
      );
    if (node.baseline === "present")
      diagnostics.push(
        diagnostic(
          "info",
          "baseline-provider-review",
          "baseline",
          "Translate a baseline callback only after its source and first/last semantics are reviewed.",
          true,
          undefined,
          path,
        ),
      );
    if (unsupported) unsupportedNodeCount++;
    const children = node.children ?? [];
    for (let index = 0; index < children.length; index++)
      visit(children[index]!, [...path, index], {
        ...inherited,
        ...node.config,
      });
  };
  visit(tree, [], options);
  return Object.freeze({
    diagnostics: Object.freeze(diagnostics),
    convertible: unsupportedNodeCount === 0,
    nodeCount,
    unsupportedNodeCount,
  });
}
