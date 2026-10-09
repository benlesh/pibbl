import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { combineScore, reviewSchema, reviewerTask } from "./scoring.mjs";
export async function reviewTrial({
  capsule,
  initialSource,
  privateDir,
  outputDirectory,
  deterministic,
  turn,
  model,
  timeoutMs,
}) {
  const reviewDir = resolve(outputDirectory, "review");
  await mkdir(reviewDir);
  await copyFile(
    resolve(capsule, "app.tsx"),
    resolve(reviewDir, "final-app.tsx"),
  );
  await copyFile(initialSource, resolve(reviewDir, "initial-app.tsx"));
  const contract = (await readFile(resolve(capsule, "TASK.md"), "utf8")).split(
    "\n\n",
  )[1];
  const packet = {
    contract,
    checks: deterministic.checks,
    observations: deterministic.observations.map((o) => ({
      stage: o.stage,
      state: {
        application: o.state.application,
        pixels: o.state.pixels,
        canvas: o.state.canvas,
      },
    })),
    agentNotesSelfReported: deterministic.measurements ?? null,
    finalResponse: await readFile(
      resolve(privateDir, "repair-final.txt"),
      "utf8",
    ),
    trace: await readFile(resolve(privateDir, "repair-events.jsonl"), "utf8"),
  };
  await writeFile(
    resolve(reviewDir, "evidence.json"),
    JSON.stringify(packet, null, 2),
  );
  await writeFile(
    resolve(reviewDir, "schema.json"),
    JSON.stringify(reviewSchema),
  );
  await turn({
    directory: reviewDir,
    prompt:
      reviewerTask +
      "\nRead initial-app.tsx, final-app.tsx and evidence.json only. Coordinator checks establish repair correctness but do not prove what the repair agent observed. Credit agent verification only when supported by its trace. Notes and timings are self-reported, not measured facts. Paths/tool names can disclose the arm; do not use arm identity as scoring evidence.",
    schema: resolve(reviewDir, "schema.json"),
    output: resolve(outputDirectory, "review.json"),
    trace: resolve(outputDirectory, "review-events.jsonl"),
    timeoutMs,
    model,
  });
  const review = JSON.parse(
    await readFile(resolve(outputDirectory, "review.json"), "utf8"),
  );
  return combineScore(deterministic, review);
}
