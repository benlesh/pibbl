import type { Plugin } from 'vite';
import { resolve } from 'node:path';

const BUILT_ENTRY_SUFFIXES = new Map([
  ['@crc/core', '/packages/core/dist/index.mjs'],
  ['@crc/core/jsx-runtime', '/packages/core/dist/jsx-runtime.mjs'],
  ['@crc/core/jsx-dev-runtime', '/packages/core/dist/jsx-dev-runtime.mjs'],
  ['@crc/core/internal', '/packages/core/dist/internal.mjs'],
  ['@crc/webgl', '/packages/webgl/dist/index.mjs'],
]);

export function assertBuiltCore(): Plugin {
  return {
    name: 'crc-assert-built-core',
    async buildStart() {
      const importer = resolve(
        import.meta.dirname,
        '../packages/scenarios/src/index.ts',
      );
      for (const [specifier, expectedSuffix] of BUILT_ENTRY_SUFFIXES) {
        const resolved = await this.resolve(specifier, importer, {
          skipSelf: true,
        });
        const normalizedId = resolved?.id.replaceAll('\\', '/').split('?')[0];
        if (!normalizedId?.endsWith(expectedSuffix)) {
          this.error(
            `Built mode resolved ${specifier} to ${resolved?.id ?? 'nothing'}; ` +
            `expected ${expectedSuffix}.`,
          );
        }
      }
    },
    transform(_, id) {
      const normalizedId = id.replaceAll('\\', '/');
      if (
        normalizedId.includes('/packages/core/src/') ||
        normalizedId.includes('/packages/webgl/src/')
      ) {
        this.error(`Built mode loaded CRC source instead of package output: ${id}`);
      }
    },
  };
}
