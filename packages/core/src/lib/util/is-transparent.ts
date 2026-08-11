const TRANSPARENT_REGEXP = /^(?:hsla|rgba)\(.*,\s*0\s*\)$/;

export function isTransparent(style: string | CanvasGradient | CanvasPattern) {
  return (
    typeof style === 'string' &&
    (style === 'transparent' || TRANSPARENT_REGEXP.test(style))
  );
}
