import type { Plugin } from 'vite';
import { resolve } from 'node:path';

const BUILT_ENTRY_SUFFIXES = new Map([
  ["@crc/core/filters", "/packages/core/dist/filters.mjs"],
  ["@crc/core/textures", "/packages/core/dist/features/textures/index.mjs"],
  ["@crc/core/viz", "/packages/core/dist/features/viz/index.mjs"],
  ['@crc/core', '/packages/core/dist/index.mjs'],
  ['@crc/core/internal', '/packages/core/dist/internal.mjs'],
  ['@crc/core/jsx-runtime', '/packages/core/dist/jsx-runtime.mjs'],
  ['@crc/core/jsx-dev-runtime', '/packages/core/dist/jsx-dev-runtime.mjs'],
  ['@crc/three', '/packages/three/dist/index.mjs'],
  ['@crc/core/particles', '/packages/core/dist/features/particles/index.mjs'],
  ['@crc/core/physics/2d', '/packages/core/dist/features/physics/2d.mjs'],
  ['@crc/core/physics/2d/geometry', '/packages/core/dist/features/physics/2d-geometry.mjs'],
  ['@crc/core/physics/3d/geometry', '/packages/core/dist/features/physics/3d-geometry.mjs'],
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
        normalizedId.includes('/packages/core/src/features/textures/') ||
        normalizedId.includes('/packages/core/src/features/viz/') ||
        normalizedId.includes('/packages/core/src/') ||
        normalizedId.includes('/packages/three/src/') ||
        normalizedId.includes('/packages/core/src/features/particles/') ||
        normalizedId.includes('/packages/core/src/features/physics/')
      ) {
        this.error(`Built mode loaded CRC source instead of package output: ${id}`);
      }
    },
  };
}
