import { PathGeometry, toSvgPathData } from "@pibbl/core";
import type { GraphRoute, Point } from "./types.js";
type Endpoints = Readonly<{ sourceAnchor: Point; targetAnchor: Point }>;
function route(
  endpoints: Endpoints,
  segments: GraphRoute["segments"],
  arrowLength = 0,
): GraphRoute {
  const { sourceAnchor: a, targetAnchor: b } = endpoints;
  for (const point of [a, b])
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
      throw new RangeError("Route anchors must be finite.");
  if (!Number.isFinite(arrowLength) || arrowLength < 0)
    throw new RangeError("arrowLength must be finite and nonnegative.");
  const angle = Math.atan2(b.y - a.y, b.x - a.x),
    c = Math.cos(angle),
    s = Math.sin(angle);
  return {
    ...endpoints,
    segments,
    arrowSegments:
      arrowLength === 0
        ? null
        : [
            { type: "move", x: b.x, y: b.y },
            {
              type: "line",
              x: b.x - arrowLength * c - (arrowLength * s) / 2,
              y: b.y - arrowLength * s + (arrowLength * c) / 2,
            },
            {
              type: "line",
              x: b.x - arrowLength * c + (arrowLength * s) / 2,
              y: b.y - arrowLength * s - (arrowLength * c) / 2,
            },
            { type: "close" },
          ],
  };
}
/**
 * Build an independent straight graph route in local logical units.
 * @param endpoints - Finite named source and target anchor points. See {@link GraphRoute}.
 * @param options - Optional nonnegative arrowLength (default zero).
 * @returns Named anchors and independently editable core path segments. See {@link GraphRoute}.
 */
export function straightGraphRoute(
  endpoints: Endpoints,
  options: Readonly<{ arrowLength?: number }> = {},
): GraphRoute {
  const { sourceAnchor: a, targetAnchor: b } = endpoints;
  return route(
    endpoints,
    [
      { type: "move", x: a.x, y: a.y },
      { type: "line", x: b.x, y: b.y },
    ],
    options.arrowLength,
  );
}
/**
 * Build an independent horizontal orthogonal graph route in local logical units.
 * @param endpoints - Finite named source and target anchor points. See {@link GraphRoute}.
 * @param options - Optional nonnegative arrowLength (default zero).
 * @returns Named anchors and independently editable core path segments. See {@link GraphRoute}.
 */
export function orthogonalGraphRoute(
  endpoints: Endpoints,
  options: Readonly<{ arrowLength?: number }> = {},
): GraphRoute {
  const { sourceAnchor: a, targetAnchor: b } = endpoints,
    middle = (a.x + b.x) / 2;
  const result = route(
    endpoints,
    [
      { type: "move", x: a.x, y: a.y },
      { type: "line", x: middle, y: a.y },
      { type: "line", x: middle, y: b.y },
      { type: "line", x: b.x, y: b.y },
    ],
    options.arrowLength,
  );
  if (options.arrowLength)
    return {
      ...result,
      arrowSegments: straightGraphRoute(
        { sourceAnchor: { x: middle, y: b.y }, targetAnchor: b },
        options,
      ).arrowSegments,
    };
  return result;
}
/**
 * Build an independent horizontal cubic graph route in local logical units.
 * @param endpoints - Finite named source and target anchor points. See {@link GraphRoute}.
 * @param options - Optional nonnegative arrowLength (default zero); curvature defaults to 0.5 and must be in [0, 1].
 * @returns Named anchors and independently editable core path segments. See {@link GraphRoute}.
 */
export function curvedGraphRoute(
  endpoints: Endpoints,
  options: Readonly<{ curvature?: number; arrowLength?: number }> = {},
): GraphRoute {
  const { sourceAnchor: a, targetAnchor: b } = endpoints,
    curvature = options.curvature ?? 0.5;
  if (!Number.isFinite(curvature) || curvature < 0 || curvature > 1)
    throw new RangeError("curvature must be between 0 and 1.");
  const dx = (b.x - a.x) * curvature;
  const result = route(
    endpoints,
    [
      { type: "move", x: a.x, y: a.y },
      {
        type: "cubic",
        cp1x: a.x + dx,
        cp1y: a.y,
        cp2x: b.x - dx,
        cp2y: b.y,
        x: b.x,
        y: b.y,
      },
    ],
    options.arrowLength,
  );
  return options.arrowLength && dx !== 0
    ? {
        ...result,
        arrowSegments: straightGraphRoute(
          { sourceAnchor: { x: b.x - dx, y: b.y }, targetAnchor: b },
          options,
        ).arrowSegments,
      }
    : result;
}
export function routePath(segments: GraphRoute["segments"]): string {
  const path = new PathGeometry();
  path.spliceSegments(0, 0, segments);
  return toSvgPathData(path);
}
