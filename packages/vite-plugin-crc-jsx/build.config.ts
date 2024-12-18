import fs from 'node:fs';
import { url } from 'node:inspector';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fglob from 'fast-glob';
import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: [
    'src/index',
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
    esbuild: {
      target: 'node14',
    },
  },
  externals: [
    'vite',
    '@crc/jsx',
  ],
  hooks: {
    'build:done': async (ctx) => {
      // https://github.com/unjs/unbuild/issues/248
      if (ctx.options.stub) {
        fglob.sync('./dist/**/*.*js', { onlyFiles: true }).forEach((item) => {
          const filePath = path.resolve(__dirname, item);
          fs.readFile(filePath, (err, data) => {
            if (err) {
              return err;
            }
            let str = data.toString();
            str = str.replace(/file:\/\/\/(.+)/g, subStr =>
              path.relative(path.resolve(filePath, '..'), fileURLToPath(subStr)).replace(/\\/g, '/'));
            fs.writeFile(filePath, str, (err) => {
              if (err) return err;
            });
          });
        });
      }
    },
  },
});
