import { defineConfig } from 'vite';
import { assertBuiltCore } from '../tooling/assert-built-core.ts';
import { crcRuntimeSource } from '../tooling/crc-runtime-source.ts';

export default defineConfig(({ mode }) => ({
  plugins: [
    ...(mode === 'built' ? [assertBuiltCore()] : []),
    crcRuntimeSource(mode),
  ],
  resolve: {
    tsconfigPaths: mode !== 'built',
  },
}));
