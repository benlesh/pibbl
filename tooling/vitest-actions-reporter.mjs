import { appendFileSync } from 'node:fs';
import { GithubActionsReporter } from 'vitest/node';

// Keep Vitest's source annotations, but replace its repeated anonymous summaries.
const escape = (value) => String(value).replace(/[&<>|\r\n]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '|': '&#124;', '\r': ' ', '\n': ' ',
})[character]);

export default class PibblActionsReporter extends GithubActionsReporter {
  constructor() {
    super({ jobSummary: { enabled: false } });
  }

  onTestRunEnd(modules, errors) {
    super.onTestRunEnd(modules, errors);
    if (!process.env.GITHUB_STEP_SUMMARY) return;
    const shard = this.ctx.config.shard;
    const name = process.env.PIBBL_TEST_REPORT_NAME || process.env.npm_lifecycle_event || 'Tests';
    const title = `${name}${shard ? ` · shard ${shard.index}/${shard.count}` : ''}`;
    const rows = [];
    const failures = [];
    const flaky = [];
    for (const module of modules) {
      const counts = { passed: 0, failed: 0, skipped: 0, pending: 0 };
      for (const test of module.children.allTests()) {
        counts[test.result().state]++;
        if (test.result().state === 'failed') failures.push(`${module.relativeModuleId}: ${test.fullName}`);
        if (test.diagnostic()?.flaky) flaky.push(`${module.relativeModuleId}: ${test.fullName}`);
      }
      rows.push(`| ${escape(module.relativeModuleId)} | ${module.state()} | ${counts.passed} passed · ${counts.failed} failed · ${counts.skipped} skipped${counts.pending ? ` · ${counts.pending} pending` : ''} |`);
    }
    let summary = `\n## ${escape(title)}\n\n`;
    if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID) {
      summary += `[Open run logs and failure artifacts](${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID})\n\n`;
    }
    summary += `| Test file | Result | Tests |\n| --- | --- | --- |\n${rows.join('\n')}\n`;
    if (!modules.length) summary += '\nNo test files completed. Inspect the run logs for startup or collection errors.\n';
    if (errors.length) summary += `\n**${errors.length} unhandled error(s)** — inspect the error annotations and run logs.\n`;
    for (const [heading, entries] of [['Failed tests', failures], ['Flaky tests (passed after retry)', flaky]]) {
      if (entries.length) summary += `\n### ${heading}\n\n${entries.map((entry) => `- ${escape(entry)}`).join('\n')}\n`;
    }
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }
}
