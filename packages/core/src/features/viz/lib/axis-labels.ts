/** Fit text without changing its coordinate or the owning scale. */
export function fitAxisLabel(context: Pick<CanvasRenderingContext2D, "measureText">, text: string, maxWidth: number, overflow: "allow" | "wrap" | "truncate", maxLines: number): readonly string[] {
  if (overflow === "allow") return [text];
  const graphemes = (value: string) => Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value), part => part.segment);
  const truncate = (value: string, force = false) => {
    if (!force && context.measureText(value).width <= maxWidth) return value;
    if (context.measureText("…").width > maxWidth) return "";
    const parts = graphemes(value);
    while (parts.length && context.measureText(parts.join("").trimEnd() + "…").width > maxWidth) parts.pop();
    return parts.join("").trimEnd() + "…";
  };
  if (overflow === "truncate") return [truncate(text)];
  const words = text.trim().split(/\s+/u);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const joined = line ? `${line} ${word}` : word;
    if (context.measureText(joined).width <= maxWidth) { line = joined; continue; }
    if (line) { lines.push(line); line = ""; }
    for (const part of graphemes(word)) {
      if (line && context.measureText(line + part).width > maxWidth) { lines.push(line); line = ""; }
      line += part;
    }
  }
  if (line || !lines.length) lines.push(line);
  const fitted = lines.slice(0, maxLines).map(value => truncate(value));
  if (lines.length > maxLines) fitted[maxLines - 1] = truncate(fitted[maxLines - 1], true);
  return fitted;
}
