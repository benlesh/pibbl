import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWithWatchdog } from "./watchdog.mjs";

test(
  "parent terminates its browser when the page and replay both stop responding",
  { timeout: 20000, skip: process.platform === "win32" },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "pibbl-browser-watchdog-"));
    try {
      const script = join(directory, "hang.mjs");
      const output = join(directory, "result");
      await writeFile(
        script,
        `
      import { chromium } from ${JSON.stringify(import.meta.resolve("playwright"))};
      import { writeFileSync } from 'node:fs';
      import { execFileSync } from 'node:child_process';
      const browser = await chromium.connect(process.env.PIBBL_VERIFY_BROWSER_ENDPOINT);
      const page = await browser.newPage();
      await page.setContent('<canvas></canvas>');
      await page.evaluate(() => { setTimeout(() => { while (true) {} }, 0); });
      writeFileSync(process.argv[2] + '/report.json', JSON.stringify({ status: 'incomplete', stage: 'hang-injected' }));
      writeFileSync(process.argv[2] + '/process-groups.txt', execFileSync('ps', ['-axo', 'pid=,pgid=']));
      process.on('SIGTERM', () => {});
      while (true) {}
    `,
      );
      const report = await runWithWatchdog({
        script,
        args: [output],
        output,
        ownedBrowser: true,
        deadlineMs: 4000,
        graceMs: 100,
      });
      assert.equal(report.status, "timeout");
      assert.equal(report.childExited, true);
      assert.equal(report.exitSignal, "SIGKILL");
      assert.equal(report.browserCleanup.status, "terminated");
      assert.equal(report.browserCleanup.processExited, true);
      assert.ok(report.browserCleanup.pid > 0);
      assert.throws(() => process.kill(report.browserCleanup.pid, 0), {
        code: "ESRCH",
      });
      const groups = (
        await readFile(join(output, "process-groups.txt"), "utf8")
      )
        .trim()
        .split("\n")
        .map((line) => line.trim().split(/\s+/).map(Number));
      const browserGroup = groups
        .filter(([, group]) => group === report.browserCleanup.pid)
        .map(([pid]) => pid);
      assert.ok(
        browserGroup.length > 1,
        "Must exercise browser descendants, not only the launcher.",
      );
      for (const pid of browserGroup)
        assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
      assert.equal(
        JSON.parse(await readFile(join(output, "report.json"), "utf8")).stage,
        "hang-injected",
      );
      assert.deepEqual(
        JSON.parse(await readFile(join(output, "watchdog.json"), "utf8")),
        report,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
