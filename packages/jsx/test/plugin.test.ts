import { describe, expect, it } from 'vitest';
import { crcJSXPlugin } from '../src';

describe('crcJSXPlugin', () => {
  const plugin = crcJSXPlugin();

  it('should transform JSX files', async () => {
    const code = `
/** @jsxImportSource crc */
const element = <div>Hello</div>;
`;
    const result = await plugin.transform!(code, 'test.tsx');
    expect(result?.code).toContain('import { jsx as _jsx } from "crc/jsx-runtime"');
  });

  it('should skip non-JSX files', async () => {
    const code = 'const x = 1;';
    const result = await plugin.transform!(code, 'test.ts');
    expect(result).toBeNull();
  });

  it('should handle pragma configuration', async () => {
    const customPlugin = crcJSXPlugin({
      pragma: 'customCreate',
      pragmaFrag: 'customFragment',
      runtime: 'classic'
    });

    const code = `
/** @jsx customCreate */
const element = <div>Hello</div>;
`;
    const result = await customPlugin.transform!(code, 'test.tsx');
    expect(result?.code).toContain('customCreate');
  });

  it('should preserve source maps', async () => {
    const code = `
/** @jsxImportSource crc */
const element = <div>Hello</div>;
`;
    const result = await plugin.transform!(code, 'test.tsx');
    expect(result?.map).toBeTruthy();
  });
});
