import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { runExperiment } from "./run.mjs";
import { prepareDecisionPair } from "./decision-cases.mjs";
import { measureRepairTrace } from "./effort.mjs";
if (process.argv.length !== 3)
  throw new Error("Usage: node run-decision.mjs NEW_OUTPUT_DIRECTORY");
const root = resolve(process.argv[2]);
await mkdir(root, { recursive: false });
const protocol = JSON.parse(
  await readFile(new URL("./decision-protocol.json", import.meta.url), "utf8"),
);
await writeFile(
  resolve(root, "protocol.json"),
  JSON.stringify(protocol, null, 2),
);
const result = {
  schema: "pibbl-public-inspection-pilot-result/1",
  protocol,
  trials: [],
  status: "running",
};
const save = () =>
  writeFile(resolve(root, "results.json"), JSON.stringify(result, null, 2));
await save();
for (let repeat = 1; repeat <= protocol.repetitions; repeat++) {
  const directory = resolve(root, "repeat-" + repeat);
  const manifest = await runExperiment({
    directory,
    model: protocol.model,
    judgeModel: protocol.judgeModel,
    reasoningEffort: protocol.reasoningEffort,
    cases: repeat === 1 ? protocol.cases : [...protocol.cases].reverse(),
    arms:
      repeat === 1 ? ["ordinary", "inspection"] : ["inspection", "ordinary"],
    prepare: prepareDecisionPair,
    protocol,
  });
  for (const trial of manifest.trials) {
    const privateDir = resolve(directory, trial.caseId, trial.arm + "-private");
    let effort = null;
    try {
      effort = measureRepairTrace(
        await readFile(resolve(privateDir, "repair-events.jsonl"), "utf8"),
      );
    } catch {}
    result.trials.push({ ...trial, repeat, effort });
  }
  await save();
}
const median = (values) => {
  const a = [...values].sort((x, y) => x - y);
  return a.length % 2
    ? a[(a.length - 1) / 2]
    : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};
result.summary = Object.fromEntries(
  protocol.conditions.map((arm) => {
    const rows = result.trials.filter((t) => t.arm === arm),
      scored = rows.filter((t) => t.status === "scored");
    return [
      arm,
      {
        trials: rows.length,
        fullyPassing: rows.filter((t) => t.deterministicPassed).length,
        blocked: rows.length - scored.length,
        meanReview: scored.length
          ? scored.reduce((n, t) => n + t.agentic, 0) / scored.length
          : null,
        meanScore: scored.length
          ? scored.reduce((n, t) => n + t.total, 0) / scored.length
          : null,
      },
    ];
  }),
);
const ratios = [];
for (const ordinary of result.trials.filter((t) => t.arm === "ordinary")) {
  const inspected = result.trials.find(
    (t) =>
      t.arm === "inspection" &&
      t.caseId === ordinary.caseId &&
      t.repeat === ordinary.repeat,
  );
  if (
    ordinary.deterministicPassed &&
    inspected?.deterministicPassed &&
    ordinary.effort?.uncachedTokenProxy > 0 &&
    Number.isFinite(inspected.effort?.uncachedTokenProxy)
  )
    ratios.push(
      inspected.effort.uncachedTokenProxy / ordinary.effort.uncachedTokenProxy,
    );
}
const controlEdits = {};
for (const arm of protocol.conditions) {
  let edits = 0;
  for (const t of result.trials.filter(
    (t) => t.arm === arm && t.caseId === protocol.cleanControlCase,
  )) {
    const d = JSON.parse(
      await readFile(
        resolve(
          root,
          "repeat-" + t.repeat,
          t.caseId,
          t.arm + "-private",
          "deterministic.json",
        ),
        "utf8",
      ),
    );
    if (d.sourceChanged) edits++;
  }
  controlEdits[arm] = edits;
}
result.comparison = {
  matchedCorrectPairs: ratios.length,
  medianPairedEffortReduction: ratios.length ? 1 - median(ratios) : null,
  cleanControlEdits: controlEdits,
};
const eligible =
  result.summary.inspection.blocked === 0 &&
  result.summary.ordinary.blocked === 0 &&
  ratios.length >=
    protocol.threshold.minimumMatchedCorrectPairsForEffortComparison;
result.thresholdStatus = !eligible
  ? "inconclusive"
  : result.summary.inspection.fullyPassing >=
        result.summary.ordinary.fullyPassing &&
      controlEdits.inspection <= controlEdits.ordinary &&
      result.summary.inspection.meanReview >=
        result.summary.ordinary.meanReview &&
      result.comparison.medianPairedEffortReduction >=
        protocol.threshold.minimumMedianPairedEffortReduction
    ? "cleared"
    : "not-cleared";
result.status = "complete";
await save();
process.stdout.write(
  JSON.stringify(
    {
      summary: result.summary,
      comparison: result.comparison,
      thresholdStatus: result.thresholdStatus,
    },
    null,
    2,
  ),
);
