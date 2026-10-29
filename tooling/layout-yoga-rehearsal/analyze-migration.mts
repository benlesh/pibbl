#!/usr/bin/env node
/**
 * Versioned Yoga 3.2 migration analyzer. It is intentionally separate from the
 * pinned geometry rehearsal: this tool reports source compatibility; it does not
 * claim geometry parity or invoke a layout engine.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { analyzeYoga32Tree, type Yoga32TreeInput } from '../../packages/layout/src/index.js';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error('Usage: tsx tooling/layout-yoga-rehearsal/analyze-migration.mts INPUT.json OUTPUT.json');
const input = JSON.parse(await readFile(resolve(inputPath), 'utf8')) as Yoga32TreeInput;
const report = analyzeYoga32Tree(input, { useWebDefaults: false, direction: 'ltr', pointScaleFactor: 0, errata: [] });
await writeFile(resolve(outputPath), `${JSON.stringify({ profile: { yoga: '3.2.1', commit: '042f5013152e', useWebDefaults: false, pointScaleFactor: 0, errata: 'ErrataNone' }, report }, null, 2)}\n`);
if (!report.convertible) process.exitCode = 2;
