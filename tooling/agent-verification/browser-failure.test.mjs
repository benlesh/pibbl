import { once } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { observeBrowserFailure } from "./browser-failure.mjs";
import { finalizeReplayOutcome } from "./replay-outcome.mjs";

test('a real late page error survives cleanup and invalidates provisional success', { timeout: 15000 }, async () => {
  const browser = await chromium.launch();
  const report = { status: 'pass', errors: [], droppedErrors: 0 };
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    const observed = page.waitForEvent('pageerror');
    await page.evaluate(() => { setTimeout(() => { throw new Error('late regression error'); }, 0); });
    await observed;
    await browser.close();
    assert.equal(finalizeReplayOutcome(report), false);
    assert.equal(report.status, 'fail');
    assert.deepEqual(report.errors, ['late regression error']);
  } finally {
    await browser.close();
  }
});

test(
  "a real renderer crash is distinct from ordinary cleanup and historical snapshots stay fixed",
  { timeout: 15000 },
  async () => {
    const browser = await chromium.launch();
    let observer;
    try {
      const page = await browser.newPage();
      await page.setContent("<canvas></canvas>");
      observer = observeBrowserFailure(browser, page);
      const before = observer.snapshot();
      const session = await page.context().newCDPSession(page);
      const crashed = page.waitForEvent("crash", { timeout: 5000 });
      const injection = session.send("Page.crash").catch(() => {});
      await crashed;
      const after = observer.snapshot();
      assert.deepEqual(before, {
        pageCrashed: false,
        unexpectedDisconnect: false,
        category: null,
      });
      assert.deepEqual(after, {
        pageCrashed: true,
        unexpectedDisconnect: false,
        category: "page-crash",
      });
      assert.equal(Object.isFrozen(after), true);
      observer.beginCleanup();
      await browser.close();
      await injection;
      assert.equal(observer.snapshot().unexpectedDisconnect, false);
    } finally {
      observer?.dispose();
      await browser.close();
    }
  },
);

test(
  "unexpected browser loss is recorded separately from expected shutdown",
  { timeout: 15000 },
  async () => {
    for (const expected of [false, true]) {
      const browser = await chromium.launch();
      const page = await browser.newPage();
      const observer = observeBrowserFailure(browser, page);
      try {
        if (expected) observer.beginCleanup();
        const disconnected = once(browser, "disconnected");
        await browser.close();
        await disconnected;
        assert.deepEqual(observer.snapshot(), {
          pageCrashed: false,
          unexpectedDisconnect: !expected,
          category: expected ? null : "browser-disconnected",
        });
      } finally {
        observer.dispose();
        await browser.close();
      }
    }
  },
);
