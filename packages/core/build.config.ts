import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: ['src/index.ts', 'src/types.ts'],
  declaration: true,
  rollup: {
    emitCJS: false,
    dts: {
      compilerOptions: {
        paths: {},
      },
      respectExternal: true,
    },
    inlineDependencies: true,
  },
});
