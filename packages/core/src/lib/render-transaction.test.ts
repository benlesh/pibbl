import { expect, it } from "vitest";
import { RootRenderTransaction } from "./render-transaction.js";

it("publishes before policy adoption and fails every finish callback after a publication error", () => {
  const calls: string[] = [];
  const transaction = new RootRenderTransaction();
  transaction.onFinish((success) => calls.push(`focus:${success}`));
  transaction.onPublish(() => {
    calls.push("publish");
    throw new Error("setup");
  });
  transaction.onPublish(() => calls.push("must not publish"));
  transaction.onFinish((success) => {
    calls.push(`cleanup:${success}`);
    throw new Error("cleanup");
  });
  transaction.onFinish((success) => calls.push(`last:${success}`));
  expect(() => transaction.finish(true)).toThrow(AggregateError);
  expect(calls).toEqual([
    "publish",
    "focus:false",
    "cleanup:false",
    "last:false",
  ]);
  expect(() => transaction.finish(true)).not.toThrow();
});
it("does not publish on render failure and finishes once", () => {
  const transaction = new RootRenderTransaction();
  const calls: boolean[] = [];
  transaction.onPublish(() => {
    throw new Error("unreachable");
  });
  transaction.onFinish((success) => calls.push(success));
  transaction.finish(false);
  transaction.finish(true);
  expect(calls).toEqual([false]);
});
it("delivers completion observers after all committed state callbacks", () => {
  const calls: string[] = [];
  const transaction = new RootRenderTransaction();
  transaction.onAfterFinish((success) => calls.push(`observer:${success}`));
  transaction.onFinish((success) => calls.push(`inspection:${success}`));
  transaction.onFinish((success) => calls.push(`policy:${success}`));
  transaction.finish(true);
  expect(calls).toEqual(["inspection:true", "policy:true", "observer:true"]);
});
it("delivers failed completion after failure cleanup without publishing", () => {
  const calls: string[] = [];
  const transaction = new RootRenderTransaction();
  transaction.onPublish(() => calls.push("must-not-publish"));
  transaction.onFinish((success) => calls.push(`cleanup:${success}`));
  transaction.onAfterFinish((success) => calls.push(`observer:${success}`));
  transaction.finish(false);
  expect(calls).toEqual(["cleanup:false", "observer:false"]);
});

it("preflights all geometry before any publication and fails closed", () => {
  const calls: string[] = [];
  const transaction = new RootRenderTransaction();
  transaction.onPublish(() => calls.push("publish"));
  transaction.onPreflight(() => { calls.push("validate"); throw new Error("geometry"); });
  transaction.onFinish(success => calls.push(`finish:${success}`));
  expect(() => transaction.finish(true)).toThrow("geometry");
  expect(calls).toEqual(["validate", "finish:false"]);
});

it('adopts prepared geometry only after every fallible publication succeeds', () => {
  const calls: string[] = [];
  const transaction = new RootRenderTransaction();
  transaction.onAdopt(() => calls.push('geometry'));
  transaction.onPublish(() => calls.push('resource'));
  transaction.onFinish(success => calls.push(`finish:${success}`));
  transaction.finish(true);
  expect(calls).toEqual(['resource', 'geometry', 'finish:true']);

  const failed = new RootRenderTransaction();
  failed.onAdopt(() => calls.push('must-not-adopt'));
  failed.onPublish(() => { throw new Error('resource'); });
  failed.onFinish(success => calls.push(`cleanup:${success}`));
  expect(() => failed.finish(true)).toThrow('resource');
  expect(calls).toEqual(['resource', 'geometry', 'finish:true', 'cleanup:false']);
});

it('distinguishes explicit cancellation from fail-closed publication errors', () => {
  const cancelled = new RootRenderTransaction();
  cancelled.finish(false);
  expect(cancelled.failed).toBe(false);
  const failed = new RootRenderTransaction();
  failed.onPublish(() => { throw new Error('publication'); });
  expect(() => failed.finish(true)).toThrow('publication');
  expect(failed.failed).toBe(true);
});
