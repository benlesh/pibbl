import assert from "node:assert/strict";
import * as verifier from "./verify-docs.mjs";

assert.equal(
  typeof verifier.verifyMutationProbes,
  "function",
  "The documentation verifier must expose targeted mutation probes.",
);

await verifier.verifyMutationProbes();
