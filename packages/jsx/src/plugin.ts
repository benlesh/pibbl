import type { Plugin } from 'vite';
import type { CRCJSXOptions } from './types';
import { transformJSX } from './transform';

export function crcJSXPlugin(options: CRCJSXOptions = {}): Plugin {
  return {
    name: 'vite-plugin-crc-jsx',
    enforce: 'pre',

    async transform(code: string, id: string) {
      if (!id.endsWith('.tsx') && !id.endsWith('.jsx')) {
        return null;
      }

      const result = await transformJSX(code, id, options);
      
      return {
        code: result.code,
        map: result.map
      };
    }
  };
} 
