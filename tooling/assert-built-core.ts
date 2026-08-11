import type { Plugin } from 'vite';

export function assertBuiltCore(): Plugin {
  return {
    name: 'crc-assert-built-core',
    transform(_, id) {
      const normalizedId = id.replaceAll('\\', '/');
      if (normalizedId.includes('/packages/core/src/')) {
        this.error(`Built mode loaded CRC source instead of package output: ${id}`);
      }
    },
  };
}
