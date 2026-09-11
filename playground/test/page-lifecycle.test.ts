import { describe, expect, it } from "vitest";

import { createPageLifecycle } from "../src/app/page-lifecycle";

describe("Studio page lifecycle", () => {
  it("disposes an editor before its scenario surface when starting a route", async () => {
    const lifecycle = createPageLifecycle();
    const order: string[] = [];
    const first = await lifecycle.begin();
    await lifecycle.setDisposable(first, {
      dispose: () => {
        order.push("editor");
      },
    });
    await lifecycle.setSurface(first, {
      async dispose() {
        order.push("surface");
      },
    });

    await lifecycle.begin();

    expect(order).toEqual(["editor", "surface"]);
  });

  it("rejects and disposes async work that resolves after a newer route", async () => {
    const lifecycle = createPageLifecycle();
    const first = await lifecycle.begin();
    const second = await lifecycle.begin();
    let disposed = 0;

    await expect(
      lifecycle.setDisposable(first, {
        dispose: () => {
          disposed++;
        },
      }),
    ).resolves.toBe(false);
    expect(disposed).toBe(1);
    expect(lifecycle.isCurrent(second)).toBe(true);
  });

  it("invalidates pending work when the lifecycle is disposed", async () => {
    const lifecycle = createPageLifecycle();
    const order: string[] = [];
    const activeVersion = await lifecycle.begin();
    await lifecycle.setDisposable(activeVersion, {
      dispose: () => {
        order.push("editor");
      },
    });
    await lifecycle.setSurface(activeVersion, {
      async dispose() {
        order.push("surface");
      },
    });

    await lifecycle.dispose();
    const lateDisposable = {
      dispose: () => {
        order.push("late editor");
      },
    };
    const lateSurface = {
      dispose: () => {
        order.push("late surface");
      },
    };

    await expect(
      lifecycle.setDisposable(activeVersion, lateDisposable),
    ).resolves.toBe(false);
    await expect(
      lifecycle.setSurface(activeVersion, lateSurface),
    ).resolves.toBe(false);
    await lifecycle.begin();

    expect(order).toEqual(["editor", "surface", "late editor", "late surface"]);
  });
});
