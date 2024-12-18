import type { CRCJSXOptions, TransformResult } from './types';
import { transform } from '@swc/core';

const CRC_PRAGMA = /^\s*\/\*\*\s*@jsxImportSource\s+crc\s*\*\//;
const CRC_PRAGMA_FACTORY = /^\s*\/\*\*\s*@jsx\s+crc\.createElement\s*\*\//;

export async function transformJSX(
  code: string,
  id: string,
  options: CRCJSXOptions = {},
): Promise<TransformResult> {
  const hasCRCPragma = CRC_PRAGMA.test(code) || CRC_PRAGMA_FACTORY.test(code);

  // Skip if no CRC pragma and no explicit options
  if (!hasCRCPragma && !options.pragma && !options.importSource) {
    return { code, map: null };
  }

  // Determine runtime mode
  const runtime = options.runtime || (options.pragma ? 'classic' : 'automatic');

  const result = await transform(code, {
    filename: id,
    sourceMaps: true,
    jsc: {
      parser: {
        syntax: 'typescript',
        tsx: true,
      },
      transform: {
        react: {
          runtime,
          importSource: options.importSource || 'crc',
          pragma: options.pragma || 'crc.createElement',
          pragmaFrag: options.pragmaFrag || 'crc.Fragment',
          development: options.development || false,
        },
      },
    },
  });

  return {
    code: result.code,
    map: result.map || null,
  };
}
