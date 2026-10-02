const TRANSPARENT_REGEXP = /^(?:hsla|rgba)\(.*,\s*0\s*\)$/;

export function isTransparent(style: unknown) {
  return (
    typeof style === 'string' &&
    (style === 'transparent' || TRANSPARENT_REGEXP.test(style))
  );
}
