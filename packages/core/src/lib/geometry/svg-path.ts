export interface SvgPathOptions {
  d: string;
}

export function createSvgPath(options: Readonly<SvgPathOptions>): Path2D {
  return new Path2D(options.d);
}
