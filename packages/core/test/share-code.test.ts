import { describe, expect, it } from "vitest";
import {
  encodeCodeRoute,
  MAX_SHARED_URL_LENGTH,
  readSharedCode,
  replaceCodeRoute,
} from "../../../playground/src/share-code";
import { toRunnableScript } from "../../../playground/src/sandbox-module";

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

describe("learning example sandbox modules", () => {
  it("combines root and automatic-runtime aliases into one CRC_CORE binding", () => {
    const runnable = toRunnableScript(`
import { jsx as _jsx, jsxs as _jsxs } from "@crc/core/jsx-runtime";
import { crc, Rectangle, Text } from "@crc/core";
function Lesson() {
  return _jsxs(Text, { children: ["CRC ", _jsx(Rectangle, { style: { width: 2, height: 2 } })] });
}
export default function mount(canvas) {
  return crc(canvas, _jsx(Lesson, {}));
}
`);

    expect(runnable).toContain(
      "const { jsx: _jsx, jsxs: _jsxs, crc, Rectangle, Text } = CRC_CORE;",
    );
  });

  it("accepts development-runtime aliases without exposing another global", () => {
    const runnable = toRunnableScript(`
import { jsxDEV as _jsxDEV } from "@crc/core/jsx-dev-runtime";
import { crc, Rectangle } from "@crc/core";
export default function mount(canvas) {
  return crc(canvas, _jsxDEV(Rectangle, { style: { width: 2, height: 2 } }, undefined, false, undefined, this));
}
`);

    expect(runnable).toContain(
      "const { jsxDEV: _jsxDEV, crc, Rectangle } = CRC_CORE;",
    );
  });

  it.each([
    'import external from "external";',
    'import * as CRC from "@crc/core";',
    'import CRC from "@crc/core";',
    'const runtime = import("@crc/core/jsx-runtime");',
    'import { jsx } from "@crc/core/private-runtime";',
  ])("rejects unsupported emitted module syntax: %s", (statement) => {
    expect(() =>
      toRunnableScript(
        `${statement}\nexport default function mount(canvas) { return canvas; }`,
      ),
    ).toThrow();
  });

  it.each([
    "function mount(canvas) { return canvas; }",
    "export default function mount(target) { return target; }",
    "export default function other(canvas) { return canvas; }",
    "export default function mount(canvas) { return canvas; }\nexport default function mount(canvas) { return canvas; }",
  ])("requires exactly one default mount(canvas) export", (mountSource) => {
    expect(() =>
      toRunnableScript(`import { crc } from "@crc/core";\n${mountSource}`),
    ).toThrow(/default mount\(canvas\)/u);
  });
});
