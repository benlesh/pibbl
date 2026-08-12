import { describe, expect, it } from "vitest";
import {
  encodeCodeRoute,
  MAX_SHARED_URL_LENGTH,
  readSharedCode,
  replaceCodeRoute,
} from "../../../playground/src/share-code";

const route = "#/examples/drawing/rectangle";
const canonical = "export default function mount() {}\n";

describe("learning example share URLs", () => {
  it("round-trips Unicode source and cleans canonical routes", () => {
    const edited = `${canonical}// こんにちは — 🟨\n`;
    const encoded = encodeCodeRoute(route, edited, canonical);

    expect(encoded.tooLong).toBe(false);
    const encodedHash = new URL(encoded.url).hash;
    expect(readSharedCode(encodedHash, canonical)).toEqual({ code: edited });
    expect(encodeCodeRoute(encodedHash, canonical, canonical).url).toBe(
      `${window.location.href.split("#", 1)[0]}${route}`,
    );
  });

  it("recovers from unsupported and malformed payloads", () => {
    expect(readSharedCode(`${route}?code=v2.future`, canonical)).toEqual({
      code: canonical,
      issue:
        "This shared edit uses an unsupported version, so the original lesson was restored.",
    });
    expect(readSharedCode(`${route}?code=v1.%`, canonical)).toEqual({
      code: canonical,
      issue:
        "The shared edit could not be decoded, so the original lesson was restored.",
    });
  });

  it("does not write an oversized payload into browser history", () => {
    const originalHash = window.location.hash;
    let seed = 0x6d2b79f5;
    const randomishSource = Array.from(
      { length: MAX_SHARED_URL_LENGTH * 4 },
      () => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return String.fromCharCode(33 + ((seed >>> 0) % 90));
      },
    ).join("");
    const result = replaceCodeRoute(route, randomishSource, canonical);

    expect(result.tooLong).toBe(true);
    expect(window.location.hash).toBe(originalHash);
  });
});
