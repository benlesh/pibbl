import test from "node:test";
import assert from "node:assert/strict";
import { measureRepairTrace } from "./effort.mjs";
test("uses measured uncached input plus output without double-counting reasoning", () => {
  assert.deepEqual(
    measureRepairTrace(
      JSON.stringify({
        type: "turn.completed",
        usage: {
          input_tokens: 100,
          cached_input_tokens: 60,
          output_tokens: 20,
          reasoning_output_tokens: 10,
        },
      }),
    ),
    {
      inputTokens: 100,
      cachedInputTokens: 60,
      outputTokens: 20,
      uncachedTokenProxy: 60,
      commandExecutions: 0,
    },
  );
});
test("missing measurements stay missing", () =>
  assert.equal(measureRepairTrace("{}").uncachedTokenProxy, null));
