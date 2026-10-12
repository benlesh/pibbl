/**
 * Geometry and construction options for a svg path.
 *
 * @see {@link createSvgPath}
 */
export interface SvgPathOptions {
  /**
   * Geometry to draw or clip, supplied in the declared path representation. See
   * {@link SvgPathOptions}.
   */
  d: string;
}

/**
 * Creates a Canvas Path2D for svg geometry from validated options.
 *
 * @param options - SVG path data to parse. See {@link SvgPathOptions}.
 * @returns A native Canvas path parsed from the supplied data.
 *
 * @see {@link SvgPathOptions}
 */
export function createSvgPath(options: Readonly<SvgPathOptions>): Path2D {
  return new Path2D(options.d);
}
