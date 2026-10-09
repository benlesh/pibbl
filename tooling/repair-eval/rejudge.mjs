// Re-review saved trials without rerunning repairs or modifying original evidence.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { reviewTrial } from "./review.mjs";
import { codexTurn } from "./run.mjs";
const batch = resolve(process.argv[2] ?? ""),
  output = resolve(process.argv[3] ?? "");
if (process.argv.length !== 4)
  throw new Error(
    "Usage: node rejudge.mjs EXISTING_BATCH NEW_OUTPUT_DIRECTORY",
  );
await mkdir(output, { recursive: false });
const source = JSON.parse(
  await readFile(resolve(batch, "results.json"), "utf8"),
);
const results = {
  schema: "pibbl-saved-trial-review/1",
  sourceBatch: batch,
  reviewRevision: "explicit-read-permission-and-self-reported-notes",
  trials: [],
};
const save = () =>
  writeFile(resolve(output, "results.json"), JSON.stringify(results, null, 2));
await save();
for (const trial of source.trials) {
  const result = {
    caseId: trial.caseId,
    arm: trial.arm,
    elapsedSeconds: trial.elapsedSeconds,
  };
  results.trials.push(result);
  try {
    const pair = resolve(batch, trial.caseId),
      privateDir = resolve(pair, trial.arm + "-private"),
      dest = resolve(output, trial.caseId + "-" + trial.arm);
    await mkdir(dest);
    const deterministic = JSON.parse(
      await readFile(resolve(privateDir, "deterministic.json"), "utf8"),
    );
    if (deterministic.status === "blocked") {
      result.status = "blocked";
      result.total = null;
    } else
      Object.assign(
        result,
        await reviewTrial({
          capsule: resolve(pair, trial.arm),
          initialSource: resolve(pair, "initial-app.tsx"),
          privateDir,
          outputDirectory: dest,
          deterministic,
          turn: codexTurn,
          model:
            source.judgeModel === "CLI default" ? undefined : source.judgeModel,
          timeoutMs: source.timeoutMs,
        }),
      );
  } catch (e) {
    result.status = "blocked";
    result.reason = e.message;
    result.total = null;
  }
  await save();
}
process.stdout.write(JSON.stringify(results.trials, null, 2) + "\n");
