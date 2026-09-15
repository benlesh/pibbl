import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  WEBGL_LIGHTING_EXAMPLE_IDS,
  validateWebGLLightingExampleSources,
  webGLLightingExampleSourcePath,
} from './webgl-lighting-example-contract';

const workspaceRoot = process.cwd();
const sources = await Promise.all(
  WEBGL_LIGHTING_EXAMPLE_IDS.map(async (id) => ({
    id,
    source: await readFile(
      resolve(workspaceRoot, webGLLightingExampleSourcePath(id)),
      'utf8',
    ),
  })),
);

validateWebGLLightingExampleSources(sources);
process.stdout.write(
  `Validated ${sources.length} same-scene WebGL lighting lessons.\n`,
);
