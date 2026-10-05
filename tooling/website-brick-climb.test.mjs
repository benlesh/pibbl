import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { galleries } from '../website/gallery.mjs';
import { loadAuthored } from '../website/documentation.mjs';
import { resolve } from 'node:path';

test('Brick Climb is discoverable as a standalone showcase with a focused sprite companion', async () => {
  const records = await loadAuthored(resolve(import.meta.dirname, '..'));
  const page = records.find(record => record.id === 'examples/brick-climb');
  assert.ok(page, 'published showcase page');
  assert.ok(galleries.find(gallery => gallery.id === 'showcases').pages.includes(page.id));
  assert.match(records.find(record => record.id === 'examples').content, /\/examples\/brick-climb\//);
  assert.match(page.content, /#\/examples\/composition\/sprites/);
  assert.match(page.content, /pnpm@11\.21\.0 brick-climb/);
  assert.match(page.content, /5191/);
  assert.ok(page.meta.sources.includes('games/brick-climb/scene.tsx'));
  const guide = await readFile(new URL('../docs/site/learn/guides/sprites.md', import.meta.url), 'utf8');
  assert.match(guide, /\/examples\/brick-climb\//);
});
