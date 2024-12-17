// Since we don't need to capture this group, we can make it non-capturing by adding ?: after the opening parenthesis
const TRANSPARENT_REGEXP = /^(?:hsla|rgba)\(.*,\s*0\s*\)$/;

export function isTransparent(style: string | CanvasGradient | CanvasPattern) {
  return (
    typeof style === 'string' &&
    (style === 'transparent' || TRANSPARENT_REGEXP.test(style))
  );
}
