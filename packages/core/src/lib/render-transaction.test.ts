import { expect, it } from 'vitest';
import { RootRenderTransaction } from './render-transaction.js';

it('publishes before policy adoption and fails every finish callback after a publication error', () => {
  const calls: string[] = []; const transaction = new RootRenderTransaction();
  transaction.onFinish(success => calls.push(`focus:${success}`));
  transaction.onPublish(() => { calls.push('publish'); throw new Error('setup'); });
  transaction.onPublish(() => calls.push('must not publish'));
  transaction.onFinish(success => { calls.push(`cleanup:${success}`); throw new Error('cleanup'); });
  transaction.onFinish(success => calls.push(`last:${success}`));
  expect(() => transaction.finish(true)).toThrow(AggregateError);
  expect(calls).toEqual(['publish', 'focus:false', 'cleanup:false', 'last:false']);
  expect(() => transaction.finish(true)).not.toThrow();
});
it('does not publish on render failure and finishes once', () => {
  const transaction = new RootRenderTransaction();const calls: boolean[]=[];
  transaction.onPublish(() => { throw new Error('unreachable'); });
  transaction.onFinish(success => calls.push(success));
  transaction.finish(false);transaction.finish(true);expect(calls).toEqual([false]);
});
it('delivers completion observers after all committed state callbacks', () => {
  const calls: string[] = [];
  const transaction = new RootRenderTransaction();
  transaction.onAfterFinish((success) => calls.push(`observer:${success}`));
  transaction.onFinish((success) => calls.push(`inspection:${success}`));
  transaction.onFinish((success) => calls.push(`policy:${success}`));
  transaction.finish(true);
  expect(calls).toEqual([
    'inspection:true',
    'policy:true',
    'observer:true',
  ]);
});
it('delivers failed completion after failure cleanup without publishing', () => {
  const calls: string[] = [];
  const transaction = new RootRenderTransaction();
  transaction.onPublish(() => calls.push('must-not-publish'));
  transaction.onFinish((success) => calls.push(`cleanup:${success}`));
  transaction.onAfterFinish((success) => calls.push(`observer:${success}`));
  transaction.finish(false);
  expect(calls).toEqual(['cleanup:false', 'observer:false']);
});
