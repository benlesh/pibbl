import { defineConfig } from 'vite';
import { assertBuiltCore } from '../tooling/assert-built-core.ts';

export default defineConfig(({ mode }) => ({
  plugins: mode === 'built' ? [assertBuiltCore()] : [],
  resolve: {
    tsconfigPaths: mode !== 'built',
  },
}));
