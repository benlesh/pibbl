import assert from "node:assert/strict";
import * as verifier from "./verify-docs.mjs";

assert.equal(
  typeof verifier.verifyMutationProbes,
  "function",
  "The documentation verifier must expose targeted mutation probes.",
);

await verifier.verifyMutationProbes();

// Missing or edited shipped contracts must remain fail-closed.
assert.throws(() => verifier.assertShippedContractSnapshots(new Map()), /Missing shipped contract/);
assert.throws(() => verifier.assertShippedContractSnapshots(new Map([["docs/design/weighted-electric-sources-contract.md", "changed contract"]])), /Shipped contract changed/);
