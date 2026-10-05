import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
const assets = new Map([
  ['engine.mjs', ['packages/text/dist/engine.mjs', 'text/javascript']],
  ['engine.wasm', ['packages/text/dist/engine.wasm', 'application/wasm']],
  ['ABeeZee-Regular.ttf', ['packages/text/test/fixtures/ABeeZee-Regular.ttf', 'font/ttf']],
  ['Lato-Regular.ttf', ['packages/text/test/fixtures/lato/Lato-Regular.ttf', 'font/ttf']],
  ['Lato-OFL.txt', ['packages/text/test/fixtures/lato/OFL.txt', 'text/plain']],
  ['OFL.txt', ['packages/text/test/fixtures/OFL.txt', 'text/plain']],
]);
export function textAssets(): Plugin {
  const root = resolve(import.meta.dirname, '..');
  return {
    name: 'pibbl-text-assets',
    configureServer(server) {
      server.middlewares.use('/pibbl-text', (request, response, next) => {
        const asset = assets.get((request.url ?? '').split('?')[0].replace(/^\//u, ''));
        if (!asset) return next();
        void readFile(resolve(root, asset[0])).then(bytes => {
          response.setHeader('Content-Type', asset[1]); response.setHeader('Access-Control-Allow-Origin', '*'); response.end(bytes);
        }).catch(next);
      });
    },
    async generateBundle() {
      for (const [name, [path]] of assets) this.emitFile({ type: 'asset', fileName: `pibbl-text/${name}`, source: await readFile(resolve(root, path)) });
    },
  };
}
