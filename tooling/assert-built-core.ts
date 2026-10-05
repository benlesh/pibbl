import type { Plugin } from 'vite';
import { resolve } from 'node:path';

const BUILT_ENTRY_SUFFIXES = new Map([
  ["@pibbl/core/filters", "/packages/core/dist/filters.mjs"],
  ["@pibbl/core/textures", "/packages/core/dist/features/textures/index.mjs"],
  ["@pibbl/core/viz", "/packages/core/dist/features/viz/index.mjs"],
  ["@pibbl/text", "/packages/text/dist/index.mjs"],
  ['@pibbl/core', '/packages/core/dist/index.mjs'],
  ['@pibbl/core/internal', '/packages/core/dist/internal.mjs'],
  ['@pibbl/core/jsx-runtime', '/packages/core/dist/jsx-runtime.mjs'],
  ['@pibbl/core/jsx-dev-runtime', '/packages/core/dist/jsx-dev-runtime.mjs'],
  ['@pibbl/three', '/packages/three/dist/index.mjs'],
  ['@pibbl/core/particles', '/packages/core/dist/features/particles/index.mjs'],
  ['@pibbl/core/physics/2d', '/packages/core/dist/features/physics/2d.mjs'],
  ['@pibbl/core/physics/2d/geometry', '/packages/core/dist/features/physics/2d-geometry.mjs'],
]);

export function assertBuiltCore(): Plugin {
  return {
    name: 'pibbl-assert-built-core',
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
        normalizedId.includes('/packages/core/src/features/textures/') ||
        normalizedId.includes('/packages/core/src/features/viz/') ||
        normalizedId.includes('/packages/text/src/') ||
        normalizedId.includes('/packages/core/src/') ||
        normalizedId.includes('/packages/three/src/') ||
        normalizedId.includes('/packages/core/src/features/particles/') ||
        normalizedId.includes('/packages/core/src/features/physics/')
      ) {
        this.error(`Built mode loaded Pibbl source instead of package output: ${id}`);
      }
    },
  };
}
