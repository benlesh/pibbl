import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isSandboxAsset,
  respondWithSandboxAsset,
} from "../../../playground/src/sandbox-assets";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Studio asset transport", () => {
  it("keeps the closed layout asset allowlist within the configured deployment base", () => {
    vi.stubEnv("BASE_URL", "/nested/studio/");
    const origin = window.location.origin;
    expect(
      isSandboxAsset(
        new URL("/nested/studio/pibbl-layout/layout.wasm", origin),
        origin,
      ),
    ).toBe(true);
    expect(
      isSandboxAsset(
        new URL("/other/pibbl-layout/layout.wasm", origin),
        origin,
      ),
    ).toBe(false);
    expect(
      isSandboxAsset(
        new URL("/nested/studio/pibbl-layout/private.json", origin),
        origin,
      ),
    ).toBe(false);
  });
  it("allows the exact root layout asset from a nested Studio page", () => {
    const origin = window.location.origin;
    const base = `${origin}/releases/abc/playground/`;
    expect(
      isSandboxAsset(new URL("/pibbl-layout/layout.wasm", base), origin),
    ).toBe(true);
    expect(
      isSandboxAsset(new URL("/pibbl-layout/private.json", base), origin),
    ).toBe(false);
    expect(
      isSandboxAsset(
        new URL("/pibbl-layout/layout.wasm?token=x", base),
        origin,
      ),
    ).toBe(false);
  });
  it("limits host reads to the exact public text assets on its own origin", () => {
    const origin = window.location.origin;
    expect(
      isSandboxAsset(new URL("/pibbl-text/Lato-Regular.ttf", origin), origin),
    ).toBe(true);
    for (const path of [
      "/private.json",
      "/pibbl-text/other.ttf",
      "/pibbl-text/engine.mjs?user=1",
      "/pibbl-text/engine.wasm#fragment",
      "https://example.com/pibbl-text/Lato-Regular.ttf",
    ]) {
      expect(isSandboxAsset(new URL(path, origin), origin)).toBe(false);
    }
  });

  it("transfers asset bytes without credentials and refuses redirects", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "Content-Type": "font/ttf" },
      }),
    );
    const channel = new MessageChannel();
    const response = new Promise<MessageEvent>((resolve) => {
      channel.port1.onmessage = resolve;
    });
    const lifetime = new AbortController();
    try {
      await respondWithSandboxAsset(
        new URL("/pibbl-text/Lato-Regular.ttf", location.href).href,
        channel.port2,
        lifetime.signal,
      );
      const { data } = await response;
      expect([...new Uint8Array(data.body)]).toEqual([1, 2, 3]);
      expect(data.status).toBe(200);
      expect(data.headers["Content-Type"]).toBe("font/ttf");
      expect(fetch).toHaveBeenCalledWith(expect.any(URL), {
        credentials: "omit",
        redirect: "error",
        signal: lifetime.signal,
      });
    } finally {
      channel.port1.close();
    }
  });

  it("rejects forged asset messages before making a host request", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const channel = new MessageChannel();
    const response = new Promise<MessageEvent>((resolve) => {
      channel.port1.onmessage = resolve;
    });
    try {
      await respondWithSandboxAsset(
        new URL("/private.json", location.href).href,
        channel.port2,
        new AbortController().signal,
      );
      expect((await response).data.error).toBe("Unsupported preview asset.");
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      channel.port1.close();
    }
  });

  it("reports failed downloads to the preview", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("network unavailable"),
    );
    const channel = new MessageChannel();
    const response = new Promise<MessageEvent>((resolve) => {
      channel.port1.onmessage = resolve;
    });
    try {
      await respondWithSandboxAsset(
        new URL("/pibbl-text/engine.wasm", location.href).href,
        channel.port2,
        new AbortController().signal,
      );
      expect((await response).data.error).toBe("network unavailable");
    } finally {
      channel.port1.close();
    }
  });
});
