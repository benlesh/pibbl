/** Validate the sfnt envelope before handing table contents to HarfBuzz. */
export function validateFontContainer(
  bytes: Uint8Array,
  monochromeFallback: boolean,
): void {
  if (bytes.byteLength < 12 || bytes.byteLength > 32 * 1024 * 1024)
    throw new RangeError("Font must contain 12 bytes to 32 MiB.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signature = view.getUint32(0);
  if (signature !== 0x00010000 && signature !== 0x4f54544f)
    throw new Error("Expected an outline TTF or OTF font.");
  const count = view.getUint16(4);
  const directoryEnd = 12 + count * 16;
  if (!count || directoryEnd > bytes.length)
    throw new Error("Invalid font table directory.");
  const tables = new Set<number>();
  for (let i = 0; i < count; i++) {
    const entry = 12 + i * 16;
    const tag = view.getUint32(entry),
      offset = view.getUint32(entry + 8),
      length = view.getUint32(entry + 12);
    if (
      tables.has(tag) ||
      offset > bytes.length ||
      length > bytes.length - offset ||
      (length > 0 && offset < directoryEnd)
    ) {
      throw new Error("Invalid font table range or duplicate tag.");
    }
    tables.add(tag);
  }
  // Conservative font-level gate: color tables may change the intended glyph
  // appearance even where an ordinary outline also exists.
  if (
    !monochromeFallback &&
    [0x434f4c52, 0x53564720, 0x73626978, 0x43424454, 0x45424454].some((tag) =>
      tables.has(tag),
    )
  ) {
    throw new Error(
      "Color/bitmap/SVG fonts require explicit monochromeFallback and usable outlines.",
    );
  }
  // Parsing glyphs/shaping tables remains HarfBuzz's responsibility.
  const glyf = tables.has(0x676c7966) && tables.has(0x6c6f6361);
  if (!glyf && !tables.has(0x43464620) && !tables.has(0x43464632))
    throw new Error("Font has no supported outline tables.");
}
