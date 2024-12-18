import type { Plugin } from 'vite';
import { transformJSX } from '@crc/jsx';

export default function crcJsx(): Plugin {
  return {
    name: 'crc:jsx',
    enforce: 'pre',
    async transform(code: string, id: string) {
      if (!id.endsWith('.tsx') && !id.endsWith('.jsx')) {
        return null;
      }

      try {
        const result = await transformJSX(code, id, {
          development: process.env.NODE_ENV !== 'production',
        });

        return {
          code: result.code,
          map: result.map,
        };
      } catch (error) {
        console.error(`Error transforming ${id}:`, error);
        return null;
      }
    },
  };
}
