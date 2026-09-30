import { resolve } from 'node:path';
import { sourceIdentity, fixturePath, vizFixturePath, identityMarker } from './identity.mjs';

/** Development-only marker embedded in the loaded fixture, not an HTTP identity claim. */
export function targetingIdentityPlugin(root) {
  return {
    name: 'crc-targeting-fixture-identity',
    enforce: 'pre',
    apply: (_config, environment) => environment.command === 'serve' && environment.mode !== 'built',
    async transform(code, id) {
      const file = id.split('?')[0];
      const scope = file === resolve(root, fixturePath) ? 'targeting' : file === resolve(root, vizFixturePath) ? 'viz' : null;
      if (!scope) return null;
      if (code.split(identityMarker).length !== 2) throw new Error('Targeting identity marker missing or duplicated.');
      const identity = await sourceIdentity(root, scope);
      return { code: code.replace(identityMarker, `const fixtureIdentity = ${JSON.stringify(identity)};`), map: null };
    },
    handleHotUpdate(context) {
      const file = context.file;
      if (file.startsWith(resolve(root, 'packages/core/src') + '/') ||
          file.startsWith(resolve(root, 'tooling/agent-verification') + '/') ||
          file.startsWith(resolve(root, 'packages/viz/src') + '/') ||
          file.includes('/viz-hover') ||
          file.includes('/agent-targeting-verification')) {
        context.server.moduleGraph.invalidateAll();
        context.server.ws.send({ type: 'full-reload' });
        return [];
      }
    },
  };
}
