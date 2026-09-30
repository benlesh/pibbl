const MAX_FONT_BYTES = 32 * 1024 * 1024;
function checkSize(size: number): void {
  if (size > MAX_FONT_BYTES) throw new RangeError("Font exceeds 32 MiB.");
}
export async function fontBytes(
  source: string | URL | ArrayBuffer | Uint8Array,
  signal: AbortSignal,
): Promise<Uint8Array> {
  if (typeof source !== "string" && !(source instanceof URL)) {
    if (!(source instanceof ArrayBuffer) && !(source instanceof Uint8Array))
      throw new TypeError("Expected a font URL or byte buffer.");
    checkSize(source.byteLength);
    return source instanceof Uint8Array
      ? new Uint8Array(source)
      : new Uint8Array(source.slice(0));
  }
  const response = await fetch(source, { signal });
  try {
    if (!response.ok)
      throw new Error(`Font download failed: HTTP ${response.status}`);
    checkSize(Number(response.headers.get("content-length") ?? 0));
  } catch (error) {
    await response.body?.cancel().catch(() => {});
    throw error;
  }
  if (!response.body) throw new Error("Font download has no body.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      checkSize(length + value.byteLength);
      length += value.byteLength;
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
