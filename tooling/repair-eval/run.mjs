import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { preparePair } from "./prepare-pair.mjs";
import { caseIds } from "./private-cases.mjs";
import { scoreTrial } from "./judge.mjs";
import { reviewTrial } from "./review.mjs";
const protectedFiles = [
  "runtime.mjs",
  "serve.mjs",
  "boot.mjs",
  "index.html",
  "TASK.md",
  "trial.json",
];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hashes = async (dir) =>
  Object.fromEntries(
    await Promise.all(
      protectedFiles.map(async (f) => [
        f,
        digest(await readFile(resolve(dir, f))),
      ]),
    ),
  );
export async function codexTurn({
  directory,
  prompt,
  schema,
  output,
  trace,
  timeoutMs,
  model,
  command = "codex",
}) {
  const args = [
    "exec",
    "--ephemeral",
    "--skip-git-repo-check",
    "--ignore-user-config",
    ...(schema ? ["--sandbox", "read-only"] : ["--approve-for-me"]),
    "--json",
    "-C",
    directory,
    "-o",
    output,
  ];
  if (schema) args.push("--output-schema", schema);
  if (model) args.push("--model", model);
  args.push("-");
  const child = spawn(command, args, {
    stdio: ["pipe", "pipe", "pipe"],
    detached: true,
  });
  const events = [],
    errors = [];
  child.stdout.on("data", (b) => events.push(b));
  child.stderr.on("data", (b) => errors.push(b));
  let timedOut = false;
  const kill = () => {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  };
  const timer = setTimeout(() => {
    timedOut = true;
    kill();
  }, timeoutMs);
  let code;
  try {
    code = await new Promise((ok, no) => {
      child.once("error", no);
      child.once("close", ok);
      child.stdin.end(prompt);
    });
  } finally {
    clearTimeout(timer);
    await writeFile(trace, Buffer.concat(events));
    await writeFile(trace + ".stderr", Buffer.concat(errors));
  }
  if (timedOut || code !== 0)
    throw new Error(timedOut ? "Agent timed out" : `Agent exited ${code}`);
}
export async function runExperiment({
  directory,
  model,
  judgeModel,
  timeoutMs = 600000,
  turn = codexTurn,
  score = scoreTrial,
  cases = caseIds,
}) {
  directory = resolve(directory);
  await mkdir(directory, { recursive: false });
  const manifest = {
    schema: "pibbl-automated-repair-eval/1",
    started: new Date().toISOString(),
    model: model ?? "CLI default",
    judgeModel: judgeModel ?? model ?? "CLI default",
    timeoutMs,
    weights: { deterministic: 80, agentic: 20 },
    blinding: "Procedural; workspace-write is not read isolation",
    trials: [],
  };
  const save = () =>
    writeFile(
      resolve(directory, "results.json"),
      JSON.stringify(manifest, null, 2),
    );
  await save();
  for (const [i, caseId] of cases.entries()) {
    const pair = resolve(directory, caseId);
    await preparePair({ caseId, directory: pair });
    for (const arm of i % 2
      ? ["attribution", "ordinary"]
      : ["ordinary", "attribution"]) {
      const capsule = resolve(pair, arm),
        privateDir = resolve(pair, arm + "-private");
      await mkdir(privateDir);
      const result = { caseId, arm, status: "running" };
      manifest.trials.push(result);
      await save();
      const initial = await hashes(capsule),
        started = Date.now();
      try {
        await turn({
          directory: capsule,
          prompt:
            (await readFile(resolve(capsule, "TASK.md"), "utf8")) +
            `\nAutomation environment: use an available port (node serve.mjs 0 prints its port). For headless browser work, the provisioned Playwright entry is ${createRequire(import.meta.url).resolve("playwright")}; use \`const { chromium } = (await import(PLAYWRIGHT_ENTRY)).default\` with that exact entry substituted for PLAYWRIGHT_ENTRY from a Node script if browser tools are unavailable (the entry is CommonJS). Dependency access is allowed; evaluator/parent/opposite-arm access is not. Clean up servers and browsers you start before finishing.`,
          output: resolve(privateDir, "repair-final.txt"),
          trace: resolve(privateDir, "repair-events.jsonl"),
          timeoutMs,
          model,
        });
        result.elapsedSeconds = (Date.now() - started) / 1000;
        const final = await hashes(capsule);
        if (JSON.stringify(initial) !== JSON.stringify(final))
          throw new Error("Protected harness changed; trial invalid");
        const deterministic = await score(capsule);
        await writeFile(
          resolve(privateDir, "deterministic.json"),
          JSON.stringify(deterministic, null, 2),
        );
        if (deterministic.status === "blocked") {
          result.status = "blocked";
          result.reason = deterministic.errors;
          continue;
        }
        Object.assign(
          result,
          await reviewTrial({
            capsule,
            initialSource: resolve(pair, "initial-app.tsx"),
            privateDir,
            outputDirectory: privateDir,
            deterministic,
            turn,
            model: judgeModel ?? model,
            timeoutMs,
          }),
        );
      } catch (e) {
        result.status = "blocked";
        result.reason = e.message;
        result.total = null;
      } finally {
        await save();
      }
    }
  }
  manifest.completed = new Date().toISOString();
  manifest.summary = Object.fromEntries(
    ["ordinary", "attribution"].map((arm) => {
      const trials = manifest.trials.filter((t) => t.arm === arm),
        scored = trials.filter((t) => t.status === "scored");
      return [
        arm,
        {
          completed: scored.length,
          blocked: trials.length - scored.length,
          meanScore: scored.length
            ? scored.reduce((n, t) => n + t.total, 0) / scored.length
            : null,
        },
      ];
    }),
  );
  await save();
  return manifest;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.argv.length < 3 || process.argv.length > 5)
    throw new Error(
      "Usage: node run.mjs NEW_OUTPUT_DIRECTORY [REPAIR_MODEL] [JUDGE_MODEL]",
    );
  const result = await runExperiment({
    directory: process.argv[2],
    model: process.argv[3],
    judgeModel: process.argv[4],
  });
  process.stdout.write(JSON.stringify(result.summary, null, 2) + "\n");
}
