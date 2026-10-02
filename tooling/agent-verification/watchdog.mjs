import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

/** Parent-process deadline; never interprets the child's application assertions. */
export async function runWithWatchdog({
  script,
  args = [],
  output,
  deadlineMs = 60000,
  graceMs = 1000,
  cwd = process.cwd(),
  ownedBrowser = false,
}) {
  if (
    !Number.isSafeInteger(deadlineMs) ||
    deadlineMs < 1 ||
    deadlineMs > 3600000
  )
    throw new Error("Invalid deadline: expected 1..3600000 milliseconds.");
  if (!Number.isSafeInteger(graceMs) || graceMs < 1 || graceMs > 10000)
    throw new Error(
      "Invalid termination grace: expected 1..10000 milliseconds.",
    );
  output = resolve(output);
  await mkdir(dirname(output), { recursive: true });
  // A fresh directory prevents old passing reports from masquerading as this run.
  await mkdir(output);
  const started = performance.now();
  const report = {
    schema: "crc-replay-watchdog/1",
    status: "running",
    timestamp: new Date().toISOString(),
    deadlineMs,
    graceMs,
    elapsedMs: 0,
    pid: null,
    exitCode: null,
    exitSignal: null,
    childExited: false,
    cleanupScope: ownedBrowser
      ? "Replay child and parent-owned Playwright browser process group; arbitrary escaped descendants are outside scope."
      : "Direct child only; detached browser descendants are not proven terminated.",
    browserCleanup: {
      status: ownedBrowser ? "pending" : "not-owned",
      pid: null,
      processExited: false,
    },
    stdout: { text: "", truncated: false },
    stderr: { text: "", truncated: false },
    failure: null,
  };
  const file = resolve(output, "watchdog.json");
  await writeFile(file, JSON.stringify(report, null, 2));
  let browserServer;
  if (ownedBrowser) {
    try {
      const { chromium } = await import("playwright");
      browserServer = await chromium.launchServer({
        timeout: Math.max(
          1,
          Math.min(15000, deadlineMs - (performance.now() - started)),
        ),
      });
      report.browserCleanup.pid = browserServer.process().pid;
    } catch (error) {
      report.status =
        performance.now() - started >= deadlineMs ? "timeout" : "launch-error";
      report.failure = String(error.message).slice(0, 1000);
      report.browserCleanup.status = "launch-failed";
      report.elapsedMs = Math.round(performance.now() - started);
      await writeFile(file, JSON.stringify(report, null, 2));
      return report;
    }
  }
  const child = spawn(process.execPath, [script, ...args], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      CRC_VERIFY_BROWSER_ENDPOINT: browserServer?.wsEndpoint() ?? "",
    },
  });
  report.pid = child.pid ?? null;
  for (const stream of ["stdout", "stderr"]) {
    child[stream].setEncoding("utf8");
    child[stream].on("data", (text) => {
      const remaining = 16384 - report[stream].text.length;
      report[stream].text += text.slice(0, remaining);
      if (text.length > remaining) report[stream].truncated = true;
    });
  }
  let timeoutWrite = Promise.resolve();
  await new Promise((resolveDone) => {
    let graceTimer;
    let reapTimer;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(deadlineTimer);
      clearTimeout(graceTimer);
      clearTimeout(reapTimer);
      resolveDone();
    };
    const deadlineTimer = setTimeout(
      () => {
        report.status = "timeout";
        report.elapsedMs = Math.round(performance.now() - started);
        // Persist before waiting for exit; a hung child cannot suppress this record.
        timeoutWrite = writeFile(file, JSON.stringify(report, null, 2)).catch(
          (error) => {
            report.failure = String(error.message).slice(0, 1000);
          },
        );
        child.kill("SIGTERM");
        graceTimer = setTimeout(() => {
          child.kill("SIGKILL");
          // Do not hang the parent on inherited pipes or an unconfirmed OS reap.
          reapTimer = setTimeout(finish, 1000);
        }, graceMs);
      },
      Math.max(1, deadlineMs - (performance.now() - started)),
    );
    child.once("error", (error) => {
      report.status = "launch-error";
      report.failure = String(error.message).slice(0, 1000);
      finish();
    });
    child.once("exit", (code, signal) => {
      report.childExited = true;
      report.exitCode = code;
      report.exitSignal = signal;
      if (report.status === "running") report.status = "exited";
      finish();
    });
  });
  child.stdout.destroy();
  child.stderr.destroy();
  child.unref();
  await timeoutWrite;
  if (browserServer) {
    let cleanupTimer;
    try {
      await Promise.race([
        browserServer.kill(),
        new Promise((_, reject) => {
          cleanupTimer = setTimeout(
            () => reject(new Error("Browser cleanup exceeded 5000 ms.")),
            5000,
          );
        }),
      ]);
      report.browserCleanup.processExited =
        browserServer.process().exitCode !== null ||
        browserServer.process().signalCode !== null;
      report.browserCleanup.status = report.browserCleanup.processExited
        ? "terminated"
        : "unconfirmed";
    } catch (error) {
      report.browserCleanup.status = "failed";
      report.failure = String(error.message).slice(0, 1000);
    } finally {
      clearTimeout(cleanupTimer);
    }
  }
  report.elapsedMs = Math.round(performance.now() - started);
  await writeFile(file, JSON.stringify(report, null, 2));
  return report;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [kind, url, directory, deadline = "60000"] = process.argv.slice(2);
  const scripts = { targeting: "replay.mjs", viz: "viz-replay.mjs" };
  if (!Object.hasOwn(scripts, kind) || !url || !directory) {
    throw new Error(
      "Usage: node tooling/agent-verification/watchdog.mjs targeting|viz URL NEW_OUTPUT_DIRECTORY [DEADLINE_MS]",
    );
  }
  const output = resolve(directory);
  const report = await runWithWatchdog({
    script: resolve(import.meta.dirname, scripts[kind]),
    args: [url, output],
    output,
    deadlineMs: Number(deadline),
    ownedBrowser: true,
    cwd: resolve(import.meta.dirname, "../.."),
  });
  process.stdout.write(
    `${JSON.stringify({ status: report.status, exitCode: report.exitCode, evidence: resolve(output, "watchdog.json") })}\n`,
  );
  process.exitCode =
    report.status === "timeout"
      ? 124
      : report.status === "exited" &&
          report.exitCode === 0 &&
          report.browserCleanup.status === "terminated"
        ? 0
        : 1;
}
