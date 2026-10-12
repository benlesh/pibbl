// Strengthen existing saved-trial verification without granting extra repair attempts.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { scoreTrial } from "./judge.mjs";
import { reviewTrial } from "./review.mjs";
import { codexTurn } from "./run.mjs";
import { combineScore } from "./scoring.mjs";
if (process.argv.length < 4 || process.argv.length > 5)
  throw new Error(
    "Usage: node rescore.mjs EXISTING_BATCH NEW_OUTPUT_DIRECTORY [CORRECTED_REVIEWS_DIRECTORY]",
  );
const batch = resolve(process.argv[2]),
  output = resolve(process.argv[3]),
  prior = process.argv[4] ? resolve(process.argv[4]) : null;
await mkdir(output, { recursive: false });
const original = JSON.parse(
  await readFile(resolve(batch, "results.json"), "utf8"),
);
const results = {
  schema: "pibbl-saved-trial-rescore/1",
  sourceBatch: batch,
  oracleRevision: "native-nearest-ID-boundaries-v2",
  reviewPolicy:
    "Reuse valid prior reviews for unchanged passing outcomes; fresh agent review for failed outcomes",
  trials: [],
};
const save = () =>
  writeFile(resolve(output, "results.json"), JSON.stringify(results, null, 2));
await save();
for (const trial of original.trials) {
  const result = {
    caseId: trial.caseId,
    arm: trial.arm,
    elapsedSeconds: trial.elapsedSeconds,
  };
  results.trials.push(result);
  try {
    const pair = resolve(batch, trial.caseId),
      capsule = resolve(pair, trial.arm),
      privateDir = resolve(pair, trial.arm + "-private"),
      dest = resolve(output, trial.caseId + "-" + trial.arm);
    await mkdir(dest);
    const deterministic = await scoreTrial(capsule);
    await writeFile(
      resolve(dest, "deterministic.json"),
      JSON.stringify(deterministic, null, 2),
    );
    result.sourceChanged = deterministic.sourceChanged;
    if (deterministic.status === "blocked") {
      result.status = "blocked";
      result.total = null;
      result.reason = deterministic.errors;
    } else if (deterministic.status === "fail") {
      Object.assign(
        result,
        await reviewTrial({
          capsule,
          initialSource: resolve(pair, "initial-app.tsx"),
          privateDir,
          outputDirectory: dest,
          deterministic,
          turn: codexTurn,
          model:
            original.judgeModel === "CLI default"
              ? undefined
              : original.judgeModel,
          timeoutMs: original.timeoutMs,
        }),
      );
      result.reviewFresh = true;
    } else {
      const reviewPath = prior
        ? resolve(prior, trial.caseId + "-" + trial.arm, "review.json")
        : resolve(privateDir, "review.json");
      const review = JSON.parse(await readFile(reviewPath, "utf8"));
      await writeFile(
        resolve(dest, "review.json"),
        JSON.stringify(review, null, 2),
      );
      Object.assign(result, combineScore(deterministic, review));
      result.reviewFresh = false;
    }
  } catch (e) {
    result.status = "blocked";
    result.total = null;
    result.reason = e.message;
  }
  await save();
}
results.completed = new Date().toISOString();
await save();
process.stdout.write(JSON.stringify(results.trials, null, 2) + "\n");
